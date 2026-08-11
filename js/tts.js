/* ==================== TTS 模块（AI 配音） ====================
 * 使用 Web Speech API（SpeechSynthesis），浏览器原生支持
 * 优化自然度：
 *   1. 分句朗读 + 句间停顿（模拟自然语流）
 *   2. 句型识别调整语调（疑问升调、感叹加强、陈述平稳）
 *   3. 优先选用微软神经网络声音（Xiaoxiao/Yunxi 等）
 *   4. 内联按钮放在对话气泡底部
 */
const TTS = {
  synth: window.speechSynthesis || null,
  _voices: [],
  queue: [],            // 分句队列
  state: 'idle',        // idle | speaking | paused
  currentBubble: null,  // 当前朗读的气泡
  currentBtn: null,     // 当前气泡的按钮
  _text: '',            // 当前朗读的完整文本
  _bestVoice: null,     // 缓存最佳声音

  init() {
    if (!this.synth) {
      console.warn('[TTS] 浏览器不支持语音合成');
      return;
    }
    const loadVoices = () => {
      this._voices = this.synth.getVoices();
      this._bestVoice = null; // 重新选择
      console.log('[TTS] 可用声音:', this._voices.map(v => `${v.name}(${v.lang})`).join(', '));
    };
    loadVoices();
    this.synth.onvoiceschanged = loadVoices;
  },

  /** 为对话气泡添加内联朗读按钮 */
  attachButton(bubble, text) {
    if (!this.synth || !bubble || !text) return;
    // 避免重复附加
    if (bubble.querySelector('.tts-inline-btn')) return;
    const btn = document.createElement('button');
    btn.className = 'tts-inline-btn';
    btn.textContent = '🔊 朗读';
    btn.style.cssText = 'display:inline-flex;align-items:center;gap:4px;margin-top:6px;padding:4px 12px;border:1px solid var(--rule,rgba(0,0,0,.1));border-radius:14px;background:rgba(255,255,255,.7);font-size:.72rem;color:var(--accent,#4a8f4a);cursor:pointer;transition:all .2s;user-select:none';
    btn.onmouseover = () => btn.style.background = 'rgba(74,143,74,.14)';
    btn.onmouseout = () => {
      if (this.currentBtn !== btn) btn.style.background = 'rgba(255,255,255,.7)';
    };
    btn.onclick = (e) => {
      e.stopPropagation();
      this.toggleSpeak(text, btn, bubble);
    };
    bubble.appendChild(btn);
  },

  /** 点击按钮：开始/暂停/继续 */
  toggleSpeak(text, btn, bubble) {
    // 同一气泡：暂停/继续
    if (this.currentBubble === bubble) {
      if (this.state === 'speaking') {
        this.synth.pause();
        this.state = 'paused';
        btn.textContent = '▶️ 继续';
      } else if (this.state === 'paused') {
        this.synth.resume();
        this.state = 'speaking';
        btn.textContent = '⏸️ 暂停';
      }
      return;
    }
    // 不同气泡：停止旧的，开始新的
    this.speak(text, btn, bubble);
  },

  /** 自动朗读（AI 回复后触发） */
  speak(text, btn, bubble) {
    if (!this.synth || !text) return;
    this.stop(); // 停止之前的

    this._text = text;
    this.currentBubble = bubble || null;
    this.currentBtn = btn || null;

    const cleanText = this.cleanText(text);
    if (!cleanText) return;

    // 分句朗读（提升自然度）
    this.queue = this.splitSentences(cleanText);
    this.state = 'speaking';
    if (btn) btn.textContent = '⏸️ 暂停';
    this._processQueue();
  },

  /** 分句：按句末标点切分，保留标点 */
  splitSentences(text) {
    // 按中文句号/问号/感叹号/省略号切分，保留标点
    const sentences = text.match(/[^。！？!?…]+[。！？!?…]+/g);
    if (sentences && sentences.length) return sentences;
    return [text];
  },

  /** 根据句末标点判断句型，返回语调参数 */
  _getProsody(sentence) {
    // 默认：陈述句
    let pitch = 1.0;
    let rate = 0.95;
    let pauseAfter = 180; // 句末停顿(ms)

    if (/[？?]\s*$/.test(sentence)) {
      // 疑问句：末尾升调
      pitch = 1.12;
      rate = 0.92;
      pauseAfter = 220;
    } else if (/[！!]\s*$/.test(sentence)) {
      // 感叹句：加强、略快
      pitch = 1.08;
      rate = 0.98;
      pauseAfter = 200;
    } else if (/[…]\s*$/.test(sentence)) {
      // 省略号：拖长、低沉
      pitch = 0.95;
      rate = 0.85;
      pauseAfter = 280;
    } else if (/[。]\s*$/.test(sentence)) {
      // 句号：平稳
      pitch = 1.0;
      rate = 0.95;
      pauseAfter = 180;
    }
    return { pitch, rate, pauseAfter };
  },

  /** 处理朗读队列 */
  _processQueue() {
    if (this.state === 'paused') return;
    if (this.queue.length === 0) {
      this._onFinish();
      return;
    }

    const sentence = this.queue.shift().trim();
    if (!sentence) {
      this._processQueue();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(sentence);
    utterance.lang = 'zh-CN';

    // 根据句型调整语调
    const prosody = this._getProsody(sentence);
    utterance.rate = prosody.rate;
    utterance.pitch = prosody.pitch;
    utterance.volume = 1;

    const voice = this._getBestVoice();
    if (voice) utterance.voice = voice;

    utterance.onend = () => {
      if (this.state !== 'speaking') return;
      // 句间停顿，让语流更自然
      if (this.queue.length > 0) {
        setTimeout(() => {
          if (this.state === 'speaking') this._processQueue();
        }, prosody.pauseAfter);
      } else {
        this._onFinish();
      }
    };
    utterance.onerror = () => {
      if (this.state === 'speaking') this._processQueue();
    };

    this.synth.speak(utterance);
  },

  /** 朗读完成 */
  _onFinish() {
    this.state = 'idle';
    if (this.currentBtn) this.currentBtn.textContent = '🔊 朗读';
    this.currentBubble = null;
    this.currentBtn = null;
    this.queue = [];
  },

  /** 选择最佳声音（优先神经网络女声） */
  _getBestVoice() {
    if (this._bestVoice) return this._bestVoice;
    const voices = this._voices.length ? this._voices : (this.synth?.getVoices() || []);

    // 优先级 1：微软神经网络女声（最自然，Edge 浏览器内置）
    const neuralFemale = voices.find(v =>
      v.lang.startsWith('zh') && /xiaoxiao|xiaoyi|tingting|huihui|yaoyao|xiaohan|sunhi/i.test(v.name)
    );
    if (neuralFemale) {
      this._bestVoice = neuralFemale;
      return neuralFemale;
    }

    // 优先级 2：微软多语言神经网络声音（Xiaoxiao Multilingual 等）
    const multilingual = voices.find(v =>
      v.lang.startsWith('zh') && /multilingual|neural/i.test(v.name) && /female|女|xiao/i.test(v.name)
    );
    if (multilingual) {
      this._bestVoice = multilingual;
      return multilingual;
    }

    // 优先级 3：Google 中文女声（Chrome 内置，较自然）
    const googleFemale = voices.find(v =>
      v.lang.startsWith('zh') && /google/i.test(v.name) && /female|女/i.test(v.name)
    );
    if (googleFemale) {
      this._bestVoice = googleFemale;
      return googleFemale;
    }

    // 优先级 4：标注 Female 的中文声音
    const zhFemale = voices.find(v =>
      v.lang.startsWith('zh') && /female|女/i.test(v.name)
    );
    if (zhFemale) {
      this._bestVoice = zhFemale;
      return zhFemale;
    }

    // 优先级 5：任意中文声音
    const anyZh = voices.find(v => v.lang.startsWith('zh')) || null;
    this._bestVoice = anyZh;
    return anyZh;
  },

  /** 停止所有朗读 */
  stop() {
    if (this.synth) this.synth.cancel();
    this.queue = [];
    if (this.currentBtn) this.currentBtn.textContent = '🔊 朗读';
    this.state = 'idle';
    this.currentBubble = null;
    this.currentBtn = null;
  },

  /** 清理文本（移除 emoji、Markdown 标记、特殊符号，避免被朗读出来） */
  cleanText(text) {
    return text
      // 移除 emoji 及符号（全覆盖）
      .replace(/[\u{2122}\u{2139}\u{2300}-\u{23FF}\u{25A0}-\u{25FE}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{1F000}-\u{1FAFF}]/gu, '')
      // 移除 ZWJ 组合 emoji（如 👨‍👩‍👧）中的零宽连接符与变体选择符
      .replace(/\u{200D}\u{FE0F}?/gu, '')
      // 移除 ZWJ 连接后的孤立 emoji 组件
      .replace(/(?:[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]\u{FE0F}?\u{200D}?)+/gu, '')
      // 移除 Markdown 标记（加粗、斜体、代码、标题等）
      .replace(/\*\*\*([^*]+)\*\*\*/g, '$1')  // ***text***
      .replace(/\*\*([^*]+)\*\*/g, '$1')       // **text**
      .replace(/\*([^*]+)\*/g, '$1')            // *text*
      .replace(/__([^_]+)__/g, '$1')            // __text__
      .replace(/_([^_]+)_/g, '$1')              // _text_
      .replace(/`([^`]+)`/g, '$1')              // `text`
      .replace(/~~([^~]+)~~/g, '$1')            // ~~text~~
      .replace(/^#{1,6}\s+/gm, '')              // # 标题
      .replace(/^>\s*/gm, '')                    // > 引用
      .replace(/^[-*+]\s+/gm, '')                // - 列表项
      .replace(/^\d+\.\s+/gm, '')                // 1. 有序列表
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')  // [text](url) → text
      .replace(/\[([^\]]*)\]\[[^\]]*\]/g, '$1') // [text][ref] → text
      // 移除括号及其内容（朗读时不读出括号内的舞台指示/备注等）
      .replace(/（[^（）]*）/g, '')               // 中文圆括号（...）
      .replace(/\([^()]*\)/g, '')                 // 英文圆括号 (...)
      // 移除【】标记块
      .replace(/【[^】]*】/g, '')
      // 移除 Markdown 分隔线
      .replace(/^[-*_]{3,}\s*$/gm, '')
      // 移除行首数字编号
      .replace(/^\s*\d+[\.\、]\s*/gm, '')
      // 换行处理
      .replace(/\n{2,}/g, '。')
      .replace(/\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
};
