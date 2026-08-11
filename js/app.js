/* ==================== App State Manager ==================== */
const App = {
  state: {
    currentStage: 0,
    currentStep: 0,
    user: {
      animalCode: '',      // 游客动物身份编码，如 'V1'
      animalName: '',      // 动物名称，如 '细尾獴'
      animalEmoji: '',     // 动物 emoji
      peopleCount: 1,
      ages: []
    },
    languageLevel: 'L2',   // 语言风格等级 L1-L5
    selectedVenues: [],    // 用户选择的场馆 code 数组
    route: [],             // 排序后的游览路线 [{code, name, animals, distanceFromPrev, walkTimeFromPrev}]
    routePlan: null,       // 路线规划详情 {totalDistance, totalWalkTime, segments}
    currentVenueIndex: 0,  // 当前游览的场馆索引
    photos: [],
    chatHistory: []
  },

  views: {},
  // Stage 0: Identity (3 steps), Stage 1: Planning (3 steps), Stage 2: Venue Visit (4 steps), Stage 3: Story (3 steps)
  stageSteps: [3, 3, 4, 4],
  ds: null,

  init() {
    this.ds = DataSourceFactory.get();
    this.buildComponents();
    this.bindElements();
    this.bindGlobalEvents();
    if (typeof TTS !== 'undefined') TTS.init();
    // 初始化 RAG 知识库（异步加载，不阻塞 UI）
    if (typeof RAG !== 'undefined') RAG.init().catch(e => console.warn('[App] RAG init:', e));
    this.goToStage(0, 0);
    console.log('[App] Initialized');
  },

  buildComponents() {
    // --- stage0-step2: Animal card selection (no dialogue overlay needed) ---
    // Cards are rendered dynamically by Stage1.onEnter

    // --- stage1-step0: Venue selection intro ---
    const venueIntro = document.getElementById('venue-select-intro');
    if (venueIntro) {
      const count = this.state.user.peopleCount;
      const animalName = this.state.user.animalName || '动物';
      if (count === 1) {
        venueIntro.textContent = `变身完成！你是${animalName}，现在来计划冒险之旅吧！`;
      } else {
        venueIntro.textContent = `变身完成！你们是${animalName}，现在来计划冒险之旅吧！`;
      }
    }

    // --- stage2-step1: Dynamic venue dialogue overlay ---
    const venueDialogueContainer = document.getElementById('venue-dialogue');
    if (venueDialogueContainer && !venueDialogueContainer.dataset.built) {
      const dlg = Components.createDialogueOverlay({
        npcName: '🧭 红山',
        npcText: '欢迎来到场馆！',
        multiTurn: true,
        quickReplies: [], // 动态生成
        inputConfig: {
          placeholder: '问红山任何问题...',
          inputId: 'venue-chat-input',
          onSubmit: (text) => Stage2.ask(text),
          onMic: () => App.voiceInput('venue-chat-input', { mockText: '这是什么动物？', onSubmit: (t) => Stage2.ask(t) })
        }
      });
      const chatArea = dlg.getChatArea();
      chatArea.id = 'venue-chat';
      chatArea.style.cssText = 'flex:1;padding:8px 0;overflow-y:auto';
      // 拍照按钮
      const photoBtn = Components.createButton({ text: '📸 拍照打卡', onClick: () => Stage2.takePhoto() });
      photoBtn.style.marginTop = '8px';
      // 快捷气泡：餐厅、卫生间、市集
      const quickActions = document.createElement('div');
      quickActions.style.cssText = 'display:flex;gap:6px;margin-top:8px;flex-wrap:wrap';
      ['🍽️ 餐厅', '🚻 卫生间', '🛍️ 市集'].forEach(label => {
        const btn = document.createElement('button');
        btn.textContent = label;
        btn.style.cssText = 'padding:6px 10px;border-radius:16px;border:1px solid var(--rule);background:var(--white);font-size:.72rem;cursor:pointer;color:var(--ink)';
        btn.onclick = () => Stage2.handleQuickAction(label);
        quickActions.appendChild(btn);
      });
      dlg.el.appendChild(quickActions);
      dlg.el.appendChild(photoBtn);
      // 下一站按钮（动态显示文字：下一站 / 生成故事）
      const nextVenueBtn = Components.createButton({
        text: '➡️ 下一站',
        onClick: () => Stage2.proceedToNext()
      });
      nextVenueBtn.id = 'next-venue-btn';
      nextVenueBtn.style.marginTop = '8px';
      dlg.el.appendChild(nextVenueBtn);
      venueDialogueContainer.appendChild(dlg.el);
      venueDialogueContainer.dataset.built = 'true';

      // 场馆对话页：默认展开 overlay，确保聊天区和所有按钮可见
      // 不展开时 max-height:240px + overflow:hidden 会截断底部按钮
      dlg.el.classList.add('expanded');
      dlg.el.style.maxHeight = 'calc(100% - 100px)';
    }
  },

  bindElements() {
    this.toastEl = document.getElementById('toast');
  },

  bindGlobalEvents() {
    document.querySelectorAll('.stage-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const stage = parseInt(tab.dataset.stage);
        const step = parseInt(tab.dataset.step);
        this.goToStage(stage, step);
      });
    });
  },

  goToStage(stage, step) {
    // 离开当前页面时停止语音朗读
    if (typeof TTS !== 'undefined' && TTS.state === 'speaking') {
      TTS.stop();
    }

    this.state.currentStage = stage;
    this.state.currentStep = step;

    const currentView = document.querySelector('.view.active');
    if (currentView) {
      currentView.classList.add('leaving');
      currentView.classList.remove('active');
      setTimeout(() => currentView.classList.remove('leaving'), 300);
    }

    const viewId = `stage${stage}-step${step}`;
    const view = document.getElementById(viewId);
    if (view) {
      view.classList.add('entering');
      requestAnimationFrame(() => {
        view.classList.add('active');
        setTimeout(() => view.classList.remove('entering'), 300);
      });
    }

    document.querySelectorAll('.stage-tab').forEach(t => {
      const ts = parseInt(t.dataset.stage);
      const tp = parseInt(t.dataset.step);
      t.classList.toggle('active', ts === stage && tp === step);
    });

    const stageController = StageRegistry[stage];
    if (stageController && typeof stageController.onEnter === 'function') {
      stageController.onEnter(step);
    }
  },

  next() {
    const maxSteps = this.stageSteps[this.state.currentStage] || 1;
    if (this.state.currentStep < maxSteps - 1) {
      this.goToStage(this.state.currentStage, this.state.currentStep + 1);
    } else if (this.state.currentStage < this.stageSteps.length - 1) {
      this.goToStage(this.state.currentStage + 1, 0);
    }
  },

  prev() {
    if (this.state.currentStep > 0) {
      this.goToStage(this.state.currentStage, this.state.currentStep - 1);
    } else if (this.state.currentStage > 0) {
      const prev = this.state.currentStage - 1;
      this.goToStage(prev, (this.stageSteps[prev] || 1) - 1);
    }
  },

  toast(msg) {
    if (!this.toastEl) return;
    this.toastEl.textContent = msg;
    this.toastEl.classList.add('show');
    setTimeout(() => this.toastEl.classList.remove('show'), 2000);
  },

  handleError(err, context = '') {
    console.error(`[App Error] ${context}:`, err);
    this.toast('出了点小问题，请稍后再试');
    if (CONFIG && CONFIG.dataSource) {
      CONFIG.dataSource.mode = 'mock';
      DataSourceFactory._instance = null;
      this.ds = DataSourceFactory.get();
    }
  },

  saveToHistory(role, content) {
    this.state.chatHistory.push({ role, content });
    if (this.state.chatHistory.length > 50) {
      this.state.chatHistory = this.state.chatHistory.slice(-50);
    }
  },

  loadChatHistory(chatAreaId) {
    const chatArea = document.getElementById(chatAreaId);
    if (!chatArea) return;
    chatArea.innerHTML = '';
    this.state.chatHistory.forEach(msg => {
      const role = msg.role === 'user' ? 'user' : (msg.role === 'system' ? 'system' : 'ai');
      const bubble = Components.createChatBubble({ role, text: msg.content });
      chatArea.appendChild(bubble);
    });
    chatArea.scrollTop = chatArea.scrollHeight;
  },

  /**
   * 发送聊天消息 — 集成语言风格适配 + 关系矩阵 + 内容过滤
   * @param {string} text - 用户输入
   * @param {string} chatAreaId - 聊天区域 ID
   * @param {Object} opts - { systemHint, venueCode }
   */
  async sendChat(text, chatAreaId, opts = {}) {
    const ds = this.ds || DataSourceFactory.get();
    const chatArea = document.getElementById(chatAreaId);
    if (!chatArea) return;

    const overlay = chatArea.closest('.dialogue-overlay');
    if (overlay && overlay.classList.contains('multi-turn') && !overlay.classList.contains('expanded')) {
      overlay.classList.add('expanded');
    }

    // 用户气泡
    const userBubble = Components.createChatBubble({ role: 'user', text });
    chatArea.appendChild(userBubble);
    chatArea.scrollTop = chatArea.scrollHeight;

    // === 内容过滤 ===
    if (typeof ZooData !== 'undefined') {
      const filterResult = ZooData.filterContent(text);
      if (filterResult.type !== 'venue' && filterResult.response) {
        // 非场馆相关问题，直接返回预设回复
        const aiBubble = Components.createChatBubble({ role: 'ai', text: filterResult.response });
        chatArea.appendChild(aiBubble);
        chatArea.scrollTop = chatArea.scrollHeight;
        this.saveToHistory('user', text);
        this.saveToHistory('assistant', filterResult.response);
        return filterResult.response;
      }
    }

    // AI 气泡 + 思考指示器
    const aiBubble = Components.createChatBubble({ role: 'ai', text: '' });
    const thinkingLabel = document.createElement('div');
    thinkingLabel.className = 'thinking-label';
    thinkingLabel.textContent = '红山正在思考...';
    const typing = document.createElement('div');
    typing.className = 'typing-indicator';
    typing.innerHTML = '<span></span><span></span><span></span>';
    if (aiBubble._textEl) {
      aiBubble._textEl.appendChild(thinkingLabel);
      aiBubble._textEl.appendChild(typing);
    }
    chatArea.appendChild(aiBubble);
    chatArea.scrollTop = chatArea.scrollHeight;

    let firstChunkReceived = false;

    // === RAG：按需检索红山知识库 ===
    let ragContext = '';
    try {
      // 拼接检索查询：用户问题 + 当前场馆动物（增强相关性）
      let ragQuery = text;
      if (opts.venueCode && typeof ZooData !== 'undefined') {
        const venue = ZooData.getVenues().find(v => v.code === opts.venueCode);
        if (venue) ragQuery += ` ${venue.name} ${venue.animals}`;
      }
      const ragResults = await this.ds.rag.retrieve(ragQuery, 3);
      if (ragResults && ragResults.length > 0) {
        ragContext = '\n\n【红山知识库参考材料 — 请优先依据以下内容回答，若无匹配再用通用知识】\n';
        ragResults.forEach((r, i) => {
          const sourceName = r.source === 'tuiwen' ? '推文内容素材池' : (r.source === 'jiangjie_gao' ? '讲解稿' : (r.source || '知识库'));
          ragContext += `\n[${i + 1}] 来源: ${sourceName}${r.heading ? ' · ' + r.heading : ''}\n`;
          ragContext += r.content.substring(0, 500) + (r.content.length > 500 ? '...' : '') + '\n';
        });
        console.log('[RAG] 检索命中', ragResults.length, '条（top3）');
      } else {
        console.log('[RAG] 未匹配到相关知识，使用通用回答');
      }
    } catch (err) {
      console.warn('[RAG] 检索异常（不影响主流程）:', err);
    }

    // === 构建 system prompt（语言风格 + 关系矩阵 + RAG） ===
    const messages = [...this.state.chatHistory, { role: 'user', content: text }];

    // 构建系统提示
    let systemPrompt = '';
    if (typeof ZooData !== 'undefined') {
      const style = ZooData.getLanguageStyle(this.state.languageLevel);
      const animal = ZooData.getAnimalById(this.state.user.animalCode);

      // 语言风格指令
      systemPrompt += `你是红山动物园的AI导游"红山"。请以客观观察者的视角介绍动物的行为与习性。\n\n`;
      systemPrompt += `【硬性限制】\n1. 回复必须不超过300字（含标点），超过即失败。精炼生动，不堆砌信息，把详细内容留到多轮对话中逐步展开。\n2. 除非用户主动使用英文提问，否则全程使用中文，禁止拉丁学名（如Acinonyx jubatus）、英文缩写（如IUCN）、英文单词等任何非中文术语；用户用英文提问时可用英文回复。\n3. 禁止使用第一人称（"我""我们"）代指动物，只能用第三人称客观叙述——如"猎豹会……"、"它的习性是……"、"这只${animal ? animal.name : '动物'}正在……"。\n4. ${this.state.languageLevel === 'L5' ? 'L5成人等级：可适度使用"生态位""协同进化""种群结构""行为丰容""环境富集""繁殖策略"等专业科普术语，允许引用数据和研究结论，无需过度简化；避免学术黑话，但可直接使用已广泛传播的专业概念。' : '禁止过于专业的学术黑话，所有概念用通俗中文表达，必要时用比喻解释。'}\n\n`;
      systemPrompt += `【语言风格要求】当前等级：${this.state.languageLevel}（${style.label}）\n`;
      systemPrompt += `词汇：${style.vocab}\n句长：单句≤${style.maxSentenceLen || '不限'}词\n抽象度：${style.abstraction}\n结构：${style.structure}\n互动：${style.interaction}\n情感基调：${style.emotion}\n\n`;

      // 关系矩阵指令
      if (opts.venueCode) {
        const venue = ZooData.getVenues().find(v => v.code === opts.venueCode);
        const relation = ZooData.getRelationship(this.state.user.animalCode, opts.venueCode);
        if (venue) {
          systemPrompt += `【当前场馆】${venue.name}（动物：${venue.animals}）\n`;
          systemPrompt += `【关系类型】${relation.label}（${relation.mood}）\n`;
          systemPrompt += `【叙事基调】${relation.tone}\n\n`;
        }
      }

      // 通用规则
      systemPrompt += `【通用规则】\n1. 以客观观察者视角叙述，用第三人称介绍动物的行为、习性与个体故事，禁止以动物身份使用第一人称（"我""我们""我们动物"等）\n2. 叙事化优先，知识嵌入场景与故事而非百科式罗列\n3. 多轮引导，不一次性堆砌全部信息\n4. 锚定现场可见对象与当前场馆动物，不脱离场景泛谈\n5. 禁止商业化诱导、否定嘲笑、恐怖化；L5等级允许使用专业术语和数据，不必刻意儿童化\n6. 严格遵循上述语言风格等级的词汇、句长、抽象度要求\n`;
    }

    // 注入 RAG 知识库内容（优先级最高，优先使用）
    if (ragContext) {
      systemPrompt += ragContext;
      systemPrompt += `\n【使用要求】优先引用上述知识库内容中的事实（如动物习性、饲养员故事、丰容做法等），用故事化方式呈现，不要直接照搬原文。如知识库中无匹配内容再使用通用知识。\n`;
    }

    if (opts.systemHint) {
      systemPrompt += `\n【补充参考】\n${opts.systemHint}\n`;
    }

    if (systemPrompt) {
      messages.unshift({ role: 'system', content: systemPrompt });
    }

    let fullText = '';
    try {
      fullText = await ds.llm.chat(messages, (chunk) => {
        if (aiBubble._textEl) {
          if (!firstChunkReceived) {
            firstChunkReceived = true;
            aiBubble._textEl.innerHTML = '';
          }
          aiBubble._textEl.textContent += chunk;
        }
        chatArea.scrollTop = chatArea.scrollHeight;
      });
      if (!firstChunkReceived) {
        if (aiBubble._textEl) aiBubble._textEl.innerHTML = '';
      }
      if (aiBubble._textEl) aiBubble._textEl.textContent = fullText;
    } catch (err) {
      if (aiBubble._textEl) aiBubble._textEl.innerHTML = '';
      if (aiBubble._textEl) aiBubble._textEl.textContent = '非常抱歉😣，网络似乎有些不稳定，红山暂时无法回应。请稍后再试，或继续探索下一个场馆！🌿';
      fullText = '非常抱歉，网络似乎有些不稳定，红山暂时无法回应。请稍后再试，或继续探索下一个场馆！';
      this.handleError(err, 'sendChat');
    }

    this.saveToHistory('user', text);
    this.saveToHistory('assistant', fullText);

    // 流式输出完成后：为气泡附加 TTS 内联朗读按钮，并自动开始朗读
    if (typeof TTS !== 'undefined' && fullText) {
      TTS.attachButton(aiBubble, fullText);
      const ttsBtn = aiBubble.querySelector('.tts-inline-btn');
      TTS.speak(fullText, ttsBtn, aiBubble);
    }

    return fullText;
  },

  toggleCollapse(btn) {
    const overlay = btn.closest('.dialogue-overlay');
    if (overlay.classList.contains('collapsed')) {
      overlay.classList.remove('collapsed');
      btn.textContent = '▼';
    } else {
      overlay.classList.add('collapsed');
      btn.textContent = '💬';
    }
  },

  voiceInput(inputId, opts = {}) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const bar = input.closest('.chat-input-bar, .input-bar');
    const overlay = bar?.closest('.dialogue-overlay');
    const micBtn = bar?.querySelector('.mic-btn');

    Voice.start({
      mockText: opts.mockText || '这是什么动物？',
      onStart: () => {
        input.value = '';
        input.placeholder = '正在聆听...';
        if (micBtn) { micBtn.classList.add('listening'); micBtn.textContent = '🔴'; }
      },
      onResult: (text) => {
        input.value = text;
        input.placeholder = opts.placeholder || '问红山任何问题...';

        if (overlay) {
          const chatArea = overlay.querySelector('.dialogue-chat-area');
          if (chatArea) {
            if (!overlay.classList.contains('expanded')) {
              overlay.classList.add('expanded');
              chatArea.style.display = 'block';
            }
            const bubble = Components.createChatBubble({ role: 'user', text });
            chatArea.appendChild(bubble);
            chatArea.scrollTop = chatArea.scrollHeight;
          } else {
            const npcText = overlay.querySelector('.npc-text');
            if (npcText) {
              npcText.innerHTML = `<span style="color:var(--accent)">你说：</span>${text}`;
            }
          }
        }

        if (opts.onSubmit && text.trim()) {
          opts.onSubmit(text.trim());
        }
      },
      onEnd: () => {
        if (micBtn) { micBtn.classList.remove('listening'); micBtn.textContent = '🎤'; }
        input.placeholder = opts.placeholder || '问红山任何问题...';
      }
    });
  }
};

/* ==================== Chat Engine ==================== */
const Chat = {
  addBubble(containerId, role, text) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${role}`;
    const senderLabels = {
      ai: '🧭 红山',
      user: App.state.user.animalName || '游客',
      system: '📸 系统'
    };
    if (role !== 'system') {
      const sender = document.createElement('div');
      sender.className = 'sender';
      sender.textContent = senderLabels[role] || role;
      bubble.appendChild(sender);
    }
    const textEl = document.createElement('div');
    textEl.textContent = text;
    bubble.appendChild(textEl);
    container.appendChild(bubble);
    container.scrollTop = container.scrollHeight;
    return bubble;
  },
  clear(containerId) {
    const container = document.getElementById(containerId);
    if (container) container.innerHTML = '';
  },
  scrollToBottom(containerId) {
    const container = document.getElementById(containerId);
    if (container) container.scrollTop = container.scrollHeight;
  }
};

/* ==================== Voice Utility (FunASR + Web Speech API + mock fallback) ==================== */
const Voice = {
  _recognition: null,
  _listening: false,
  _audioContext: null,
  _mediaStream: null,
  _processor: null,
  _source: null,
  _ws: null,
  _finalText: '',
  _resultReceived: false,
  _currentOpts: null,
  _simulateTimer: null,

  isSupported() {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  },

  isFunASRAvailable() {
    // 浏览器环境：需要 WebSocket + getUserMedia + 有效配置
    return typeof LLM_CONFIG !== 'undefined' &&
           LLM_CONFIG.enabled &&
           LLM_CONFIG.asrModel &&
           LLM_CONFIG.wsUrl &&
           LLM_CONFIG.apiKey &&
           typeof navigator !== 'undefined' &&
           navigator.mediaDevices &&
           typeof navigator.mediaDevices.getUserMedia === 'function';
  },

  start(opts = {}) {
    if (this._listening) return;
    this._listening = true;
    this._finalText = '';
    this._resultReceived = false;
    this._currentOpts = opts;

    const funASR = this.isFunASRAvailable();
    const webSpeech = this.isSupported();
    console.log('[Voice] start — FunASR available:', funASR, '| Web Speech available:', webSpeech);

    if (funASR) {
      this._startFunASR(opts).catch(err => {
        console.warn('[Voice] FunASR failed, falling back:', err.message);
        this._cleanupFunASR();
        if (this.isSupported()) {
          this._startNative(opts);
        } else {
          this._simulate(opts);
        }
      });
      return;
    }

    if (this.isSupported()) {
      this._startNative(opts);
    } else {
      this._simulate(opts);
    }
  },

  _startNative(opts) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = opts.lang || 'zh-CN';
    rec.continuous = false;
    rec.interimResults = false;

    rec.onstart = () => { if (opts.onStart) opts.onStart(); };
    rec.onresult = (event) => {
      const text = event.results[0][0].transcript;
      this._resultReceived = true;
      if (opts.onResult) opts.onResult(text);
    };
    rec.onerror = (event) => {
      console.warn('[Voice] Web Speech error:', event.error);
      if (!this._resultReceived) {
        this._simulate(opts);
      }
    };
    rec.onend = () => {
      if (!this._resultReceived && this._currentOpts) {
        console.log('[Voice] No result received, using mock fallback');
        this._simulate(this._currentOpts);
      } else {
        this._listening = false;
        if (opts.onEnd) opts.onEnd();
      }
    };

    this._recognition = rec;
    try {
      rec.start();
    } catch (e) {
      this._listening = false;
      this._simulate(opts);
    }
  },

  async _startFunASR(opts) {
    this._mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, sampleRate: 16000, echoCancellation: true, noiseSuppression: true }
    });

    try {
      this._audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
    } catch (e) {
      this._audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    const source = this._audioContext.createMediaStreamSource(this._mediaStream);
    this._source = source;

    const bufferSize = 4096;
    this._processor = this._audioContext.createScriptProcessor(bufferSize, 1, 1);

    // 通过本地代理连接 DashScope FunASR（浏览器不支持自定义 Header，需代理转发 Authorization）
    const wsUrl = 'ws://localhost:53857';
    this._taskId = (crypto.randomUUID && crypto.randomUUID()) || ('task-' + Date.now() + '-' + Math.random().toString(36).slice(2));

    this._ws = new WebSocket(wsUrl);
    this._ws.binaryType = 'arraybuffer';

    let taskStarted = false;

    this._ws.onopen = () => {
      console.log('[Voice] FunASR WebSocket connected');
      const startMsg = {
        header: { action: 'run-task', task_id: this._taskId, streaming: 'duplex' },
        payload: {
          task_group: 'audio',
          task: 'asr',
          function: 'recognition',
          model: LLM_CONFIG.asrModel,
          input: {},
          parameters: { format: 'pcm', sample_rate: 16000, language_hints: ['zh', 'en'] }
        }
      };
      this._ws.send(JSON.stringify(startMsg));
      if (opts.onStart) opts.onStart();

      this._processor.onaudioprocess = (e) => {
        if (!this._listening || !this._ws || this._ws.readyState !== WebSocket.OPEN) return;
        const inputBuffer = e.inputBuffer.getChannelData(0);
        const actualRate = this._audioContext.sampleRate;
        let pcmData = inputBuffer;
        if (actualRate !== 16000) {
          pcmData = this._downsample(inputBuffer, actualRate, 16000);
        }
        const pcm16 = new Int16Array(pcmData.length);
        for (let i = 0; i < pcmData.length; i++) {
          const s = Math.max(-1, Math.min(1, pcmData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        this._ws.send(pcm16.buffer);
      };

      source.connect(this._processor);
      this._processor.connect(this._audioContext.destination);
    };

    this._ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const eventType = msg.header?.event;
        if (eventType === 'task-started') {
          taskStarted = true;
        } else if (eventType === 'result-generated') {
          const sentence = msg.payload?.output?.sentence;
          if (sentence && sentence.text) {
            this._finalText = sentence.text;
          }
        } else if (eventType === 'task-finished') {
          if (opts.onResult && this._finalText) {
            opts.onResult(this._finalText);
          }
          this._cleanupFunASR();
          this._listening = false;
          if (opts.onEnd) opts.onEnd();
        } else if (eventType === 'task-failed') {
          this._cleanupFunASR();
          if (this.isSupported()) { this._startNative(opts); } else { this._simulate(opts); }
        }
      } catch (e) { /* ignore */ }
    };

    this._ws.onerror = (e) => {
      console.warn('[Voice] FunASR WebSocket error, falling back to Web Speech:', e.message || 'unknown');
      this._cleanupFunASR();
      if (this.isSupported()) { this._startNative(opts); } else { this._simulate(opts); }
    };

    this._ws.onclose = (e) => {
      console.log('[Voice] FunASR WebSocket closed:', e.code, e.reason || 'no reason');
      if (this._listening) {
        if (opts.onResult && this._finalText) {
          opts.onResult(this._finalText);
        }
        this._cleanupFunASR();
        this._listening = false;
        if (opts.onEnd) opts.onEnd();
      }
    };

    setTimeout(() => {
      if (this._listening && this._ws && this._ws.readyState === WebSocket.OPEN) {
        this._finishFunASR();
      }
    }, 10000);
  },

  _finishFunASR() {
    if (this._ws && this._ws.readyState === WebSocket.OPEN) {
      const finishMsg = {
        header: { action: 'finish-task', task_id: this._taskId || '', streaming: 'duplex' },
        payload: {
          task_group: 'audio',
          task: 'asr',
          function: 'recognition',
          model: LLM_CONFIG.asrModel,
          input: {},
          parameters: { format: 'pcm', sample_rate: 16000 }
        }
      };
      try { this._ws.send(JSON.stringify(finishMsg)); } catch (e) { /* ignore */ }
    }
  },

  _downsample(buffer, fromRate, toRate) {
    if (fromRate === toRate) return buffer;
    const ratio = fromRate / toRate;
    const newLength = Math.round(buffer.length / ratio);
    const result = new Float32Array(newLength);
    let offsetResult = 0, offsetBuffer = 0;
    while (offsetResult < newLength) {
      const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
      let accum = 0, count = 0;
      for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
        accum += buffer[i];
        count++;
      }
      result[offsetResult] = count > 0 ? accum / count : 0;
      offsetResult++;
      offsetBuffer = nextOffsetBuffer;
    }
    return result;
  },

  _cleanupFunASR() {
    if (this._processor) { try { this._processor.disconnect(); } catch (e) {} this._processor = null; }
    if (this._source) { try { this._source.disconnect(); } catch (e) {} this._source = null; }
    if (this._mediaStream) { this._mediaStream.getTracks().forEach(t => t.stop()); this._mediaStream = null; }
    if (this._audioContext) { try { this._audioContext.close(); } catch (e) {} this._audioContext = null; }
    if (this._ws) { try { this._ws.close(); } catch (e) {} this._ws = null; }
  },

  stop() {
    if (this._ws && this._ws.readyState === WebSocket.OPEN) {
      this._finishFunASR();
      setTimeout(() => { this._cleanupFunASR(); this._listening = false; }, 500);
      return;
    }
    this._cleanupFunASR();
    if (this._recognition) {
      try { this._recognition.stop(); } catch (e) {}
      this._recognition = null;
      return;
    }
    this._listening = false;
  },

  _simulate(opts) {
    if (opts.onStart) opts.onStart();
    const mockText = opts.mockText || '这是什么动物？';
    const delay = 600 + Math.random() * 400;
    this._simulateTimer = setTimeout(() => {
      this._resultReceived = true;
      if (opts.onResult) opts.onResult(mockText);
      this._listening = false;
      if (opts.onEnd) opts.onEnd();
    }, delay);
  },

  isListening() {
    return this._listening;
  }
};

/* ==================== Camera Utility ==================== */
const Camera = {
  _stream: null,

  isSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  },

  async capture(opts = {}) {
    if (this.isSupported()) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        this._stream = stream;
        const video = document.createElement('video');
        video.srcObject = stream;
        video.autoplay = true;
        video.playsinline = true;
        await new Promise(resolve => { video.onloadedmetadata = resolve; });
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        stream.getTracks().forEach(t => t.stop());
        this._stream = null;
        if (opts.onCapture) opts.onCapture({ dataUrl, label: opts.mockLabel || '拍照成功' });
      } catch (err) {
        console.warn('[Camera] getUserMedia failed:', err);
        this._simulate(opts);
      }
    } else {
      this._simulate(opts);
    }
  },

  _simulate(opts) {
    const label = opts.mockLabel || '拍照成功';
    if (opts.onCapture) opts.onCapture({ dataUrl: null, label, simulated: true });
  }
};

/* ==================== Stage 1: 游客信息获取 ==================== */
const Stage1 = {
  _selectedAnimal: null, // 当前选中的动物 code

  onEnter(step) {
    if (step === 1) {
      const count = parseInt(document.getElementById('people-count')?.value) || 1;
      this.renderAgeList(count);
    }
    if (step === 2) {
      this.renderAnimalCards();
      // 更新确定按钮状态
      this._updateConfirmBtn();
    }
  },

  adjustPeople(delta) {
    const input = document.getElementById('people-count');
    if (!input) return;
    let count = parseInt(input.value) || 1;
    count = Math.max(1, Math.min(5, count + delta));
    input.value = count;
    this.renderAgeList(count);
  },

  renderAgeList(count) {
    const container = document.getElementById('age-list');
    if (!container) return;
    const existing = [];
    container.querySelectorAll('input').forEach(inp => { existing.push(inp.value); });
    let html = '';
    for (let i = 0; i < count; i++) {
      const val = existing[i] || '';
      html += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">`;
      html += `<span style="font-size:.75rem;color:var(--muted);width:40px">成员${i + 1}</span>`;
      html += `<input type="number" placeholder="年龄" min="0" max="120" value="${val}" style="flex:1;border:1px solid var(--rule);border-radius:6px;padding:6px 8px;font-size:.78rem">`;
      html += `</div>`;
    }
    container.innerHTML = html;
  },

  step1_submit() {
    const checkbox = document.getElementById('privacy-check');
    if (!checkbox.checked) {
      App.toast('请先勾选同意隐私政策');
      return;
    }
    const ageInputs = document.querySelectorAll('#age-list input');
    for (let i = 0; i < ageInputs.length; i++) {
      const val = ageInputs[i].value.trim();
      if (!val || isNaN(parseInt(val)) || parseInt(val) < 0 || parseInt(val) > 120) {
        App.toast(`请输入成员${i + 1}的有效年龄`);
        ageInputs[i].focus();
        return;
      }
    }
    App.state.user.ages = Array.from(ageInputs).map(inp => parseInt(inp.value));
    App.state.user.peopleCount = parseInt(document.getElementById('people-count').value) || 1;

    // 确定语言风格等级（取最小年龄）
    if (typeof ZooData !== 'undefined') {
      App.state.languageLevel = ZooData.getLanguageLevel(App.state.user.ages);
      console.log('[App] Language level:', App.state.languageLevel, 'ages:', App.state.user.ages);
    }

    App.next();
  },

  /** 渲染横拉动物身份卡片 */
  renderAnimalCards() {
    const container = document.getElementById('animal-cards-scroll');
    if (!container) return;
    container.innerHTML = '';

    if (typeof ZooData === 'undefined') return;
    const animals = ZooData.getAnimalIdentities();

    animals.forEach(animal => {
      const card = document.createElement('div');
      card.className = 'animal-card';
      card.style.cssText = 'flex-shrink:0;width:140px;height:180px;border-radius:12px;border:2px solid var(--rule);background:var(--white);display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;scroll-snap-align:center;transition:border-color .2s,box-shadow .2s;padding:12px;gap:8px';
      card.dataset.code = animal.code;

      card.innerHTML = `
        <div style="font-size:3rem">${animal.emoji}</div>
        <div style="font-size:.85rem;font-weight:700;color:var(--ink)">${animal.name}</div>
        <div style="font-size:.68rem;color:var(--muted);text-align:center">${animal.category}</div>
      `;

      card.onclick = () => this.step2_selectAnimal(animal.code, card);
      container.appendChild(card);
    });
  },

  /** 选择动物身份 */
  step2_selectAnimal(code, cardEl) {
    this._selectedAnimal = code;
    // 更新卡片选中状态
    document.querySelectorAll('.animal-card').forEach(c => {
      c.style.borderColor = 'var(--rule)';
      c.style.boxShadow = 'none';
    });
    if (cardEl) {
      cardEl.style.borderColor = 'var(--accent)';
      cardEl.style.boxShadow = '0 0 0 2px var(--accent)';
    }
    this._updateConfirmBtn();
  },

  /** 更新确定按钮状态 */
  _updateConfirmBtn() {
    const btn = document.getElementById('step2-confirm-btn');
    if (!btn) return;
    if (this._selectedAnimal) {
      btn.disabled = false;
      btn.style.opacity = '1';
      btn.style.cursor = 'pointer';
    } else {
      btn.disabled = true;
      btn.style.opacity = '.5';
      btn.style.cursor = 'not-allowed';
    }
  },

  /** 随机选择动物身份（滑动动画 800ms） */
  step2_randomSelect() {
    if (typeof ZooData === 'undefined') return;
    const animals = ZooData.getAnimalIdentities();
    const randomIndex = Math.floor(Math.random() * animals.length);
    const randomAnimal = animals[randomIndex];

    const container = document.getElementById('animal-cards-scroll');
    if (!container) return;
    const cards = container.querySelectorAll('.animal-card');
    if (!cards.length) return;

    // 滑动特效：先快速来回滚动，最终定位到随机结果
    const targetCard = cards[randomIndex];
    const scrollStart = container.scrollLeft;
    const scrollEnd = targetCard.offsetLeft - (container.offsetWidth - targetCard.offsetWidth) / 2;
    const duration = 800;
    const startTime = performance.now();

    // 添加一些来回滚动效果
    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // 使用 ease-out + 轻微过冲
      const eased = 1 - Math.pow(1 - progress, 3);
      // 加入一点弹跳效果
      const bounce = progress > 0.8 ? Math.sin((progress - 0.8) * Math.PI * 5) * 10 * (1 - progress) : 0;
      container.scrollLeft = scrollStart + (scrollEnd - scrollStart) * eased + bounce;

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // 滑动结束后选中
        this.step2_selectAnimal(randomAnimal.code, targetCard);
      }
    };
    requestAnimationFrame(animate);
  },

  /** 确定动物身份选择 */
  step2_confirm() {
    if (!this._selectedAnimal) {
      App.toast('请先选择动物身份');
      return;
    }
    const animal = ZooData.getAnimalById(this._selectedAnimal);
    if (animal) {
      App.state.user.animalCode = animal.code;
      App.state.user.animalName = animal.name;
      App.state.user.animalEmoji = animal.emoji;
      console.log('[App] Animal identity:', animal.name);
    }
    App.next();
  }
};

/* ==================== Stage 2: 游览规划 ==================== */
const Stage2 = {
  _selectedVenues: new Set(),

  onEnter(step) {
    if (step === 0) {
      this.renderVenueList();
      this._updateVenueIntro();
      this._updateVenueConfirmBtn();
    }
    if (step === 1) {
      this.renderRoute();
    }
    if (step === 2) {
      this._updateStartNavInfo();
    }
  },

  _updateVenueIntro() {
    const intro = document.getElementById('venue-select-intro');
    if (!intro) return;
    const count = App.state.user.peopleCount;
    const animalName = App.state.user.animalName || '动物';
    if (count === 1) {
      intro.textContent = `变身完成！你是${animalName}，现在来计划冒险之旅吧！`;
    } else {
      intro.textContent = `变身完成！你们是${animalName}，现在来计划冒险之旅吧！`;
    }
  },

  /** 渲染场馆多选列表 */
  renderVenueList() {
    const container = document.getElementById('venue-checkbox-list');
    if (!container) return;
    container.innerHTML = '';

    if (typeof ZooData === 'undefined') return;
    const venues = ZooData.getVenues();

    venues.forEach(venue => {
      const item = document.createElement('label');
      item.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px solid var(--rule);cursor:pointer';
      item.innerHTML = `
        <input type="checkbox" value="${venue.code}" style="width:18px;height:18px;accent-color:var(--accent)">
        <div style="flex:1">
          <div style="font-size:.82rem;font-weight:600;color:var(--ink)">${venue.name}</div>
          <div style="font-size:.68rem;color:var(--muted)">${venue.animals}</div>
        </div>
      `;
      const checkbox = item.querySelector('input');
      checkbox.checked = this._selectedVenues.has(venue.code);
      checkbox.onchange = () => {
        if (checkbox.checked) {
          this._selectedVenues.add(venue.code);
        } else {
          this._selectedVenues.delete(venue.code);
        }
        this._updateVenueConfirmBtn();
      };
      container.appendChild(item);
    });
  },

  _updateVenueConfirmBtn() {
    const btn = document.getElementById('venue-confirm-btn');
    if (!btn) return;
    if (this._selectedVenues.size > 0) {
      btn.disabled = false;
      btn.style.opacity = '1';
      btn.style.cursor = 'pointer';
    } else {
      btn.disabled = true;
      btn.style.opacity = '.5';
      btn.style.cursor = 'not-allowed';
    }
  },

  /** 确定场馆选择，生成最短路径路线 */
  confirmVenues() {
    if (this._selectedVenues.size === 0) {
      App.toast('请至少选择一个场馆');
      return;
    }

    // 保存选择的场馆
    App.state.selectedVenues = Array.from(this._selectedVenues);

    // 使用最近邻算法规划最短路径（从南门出发）
    const plan = ZooData.planRoute(App.state.selectedVenues);
    App.state.route = plan.route;
    App.state.routePlan = {
      totalDistance: plan.totalDistance,
      totalWalkTime: plan.totalWalkTime,
      segments: plan.segments
    };

    App.next();
  },

  /** 渲染推荐路线（地图标记 + SVG 连线 + 路线列表含距离时间） */
  renderRoute() {
    const routeList = document.getElementById('route-list');
    const pinsContainer = document.getElementById('route-map-pins');
    const svg = document.getElementById('route-svg');
    if (!routeList) return;

    // 清空
    routeList.innerHTML = '';
    if (pinsContainer) pinsContainer.innerHTML = '';
    if (svg) svg.innerHTML = '';

    const route = App.state.route;
    const plan = App.state.routePlan;
    if (!route.length) return;

    // === 1. 在地图上绘制标记点和路线 ===
    const points = [];
    // 南门起点
    const entranceCoord = ZooData.getEntranceCoord();
    const entrancePos = ZooData.coordToMapPercent(entranceCoord);
    points.push({ code: 'ENTRANCE', name: '南门', pos: entrancePos, isStart: true });

    route.forEach(stop => {
      const coord = ZooData.getVenueCoord(stop.code);
      if (coord) {
        points.push({ code: stop.code, name: stop.name, pos: ZooData.coordToMapPercent(coord), isStart: false });
      }
    });

    // 绘制 SVG 连线（虚线，按顺序连接）
    if (points.length >= 2) {
      const pathData = points.map((p, i) => {
        return `${i === 0 ? 'M' : 'L'} ${p.pos.x} ${p.pos.y}`;
      }).join(' ');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', pathData);
      path.setAttribute('stroke', '#E07856');
      path.setAttribute('stroke-width', '2');
      path.setAttribute('stroke-dasharray', '4 3');
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
      svg.appendChild(path);
    }

    // 绘制标记点
    points.forEach((p, i) => {
      const pin = document.createElement('div');
      pin.style.cssText = `position:absolute;left:${p.pos.x}%;top:${p.pos.y}%;transform:translate(-50%,-50%);z-index:2`;
      if (p.isStart) {
        pin.innerHTML = `<div style="width:22px;height:22px;border-radius:50%;background:#4a7c59;color:#fff;display:flex;align-items:center;justify-content:center;font-size:.65rem;font-weight:700;box-shadow:0 1px 4px rgba(0,0,0,.3);border:2px solid #fff">起</div>`;
      } else {
        pin.innerHTML = `<div style="width:20px;height:20px;border-radius:50%;background:var(--accent);color:#fff;display:flex;align-items:center;justify-content:center;font-size:.65rem;font-weight:700;box-shadow:0 1px 4px rgba(0,0,0,.3);border:2px solid #fff">${i}</div>`;
      }
      pinsContainer.appendChild(pin);
    });

    // === 2. 渲染路线汇总（总距离 + 总步行时间） ===
    if (plan) {
      const summary = document.createElement('div');
      summary.style.cssText = 'background:var(--bg2);border-radius:var(--radius);padding:8px 12px;margin-bottom:8px;display:flex;justify-content:space-around;text-align:center';
      summary.innerHTML = `
        <div>
          <div style="font-size:.65rem;color:var(--muted)">总步行距离</div>
          <div style="font-size:.82rem;font-weight:700;color:var(--accent)">${ZooData.formatDistance(plan.totalDistance)}</div>
        </div>
        <div>
          <div style="font-size:.65rem;color:var(--muted)">总步行时间</div>
          <div style="font-size:.82rem;font-weight:700;color:var(--accent)">${ZooData.formatTime(plan.totalWalkTime)}</div>
        </div>
        <div>
          <div style="font-size:.65rem;color:var(--muted)">场馆数</div>
          <div style="font-size:.82rem;font-weight:700;color:var(--accent)">${route.length}</div>
        </div>
      `;
      routeList.appendChild(summary);
    }

    // === 3. 渲染路线列表（含每段距离和时间） ===
    // 南门起点
    const startItem = document.createElement('div');
    startItem.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 0';
    startItem.innerHTML = `
      <div style="width:24px;height:24px;border-radius:50%;background:#4a7c59;color:#fff;display:flex;align-items:center;justify-content:center;font-size:.65rem;font-weight:700;flex-shrink:0">起</div>
      <div style="flex:1">
        <div style="font-size:.82rem;font-weight:600">${entranceCoord.name}</div>
      </div>
    `;
    routeList.appendChild(startItem);

    // 各场馆
    route.forEach((stop, i) => {
      // 段信息（距离/时间）
      const segItem = document.createElement('div');
      segItem.style.cssText = 'padding:2px 0 2px 32px;font-size:.65rem;color:var(--muted);display:flex;align-items:center;gap:4px';
      segItem.innerHTML = `
        <span style="color:var(--accent)">↓</span>
        <span>${ZooData.formatDistance(stop.distanceFromPrev)} · ${ZooData.formatTime(stop.walkTimeFromPrev)}</span>
      `;
      routeList.appendChild(segItem);

      // 场馆项
      const item = document.createElement('div');
      item.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 0';
      item.innerHTML = `
        <div style="width:24px;height:24px;border-radius:50%;background:var(--accent);color:#fff;display:flex;align-items:center;justify-content:center;font-size:.7rem;font-weight:700;flex-shrink:0">${i + 1}</div>
        <div style="flex:1">
          <div style="font-size:.82rem;font-weight:600">${stop.name}</div>
          <div style="font-size:.68rem;color:var(--muted)">${stop.animals}</div>
        </div>
      `;
      routeList.appendChild(item);
    });
  },

  _updateStartNavInfo() {
    const route = App.state.route;
    if (!route.length) return;
    const firstStop = route[0];
    const nameEl = document.getElementById('next-stop-name');
    const etaEl = document.getElementById('next-stop-eta');
    if (nameEl) nameEl.textContent = firstStop.name;
    if (etaEl) etaEl.textContent = `步行约 ${ZooData.formatTime(firstStop.walkTimeFromPrev)} · ${ZooData.formatDistance(firstStop.distanceFromPrev)}`;
  },

  // === 以下为动态场馆游览方法（Stage 2 复用） ===

  /** 获取当前场馆信息 */
  getCurrentVenue() {
    const route = App.state.route;
    const idx = App.state.currentVenueIndex;
    if (idx >= route.length) return null;
    return route[idx];
  },

  /** 渲染当前场馆导航页 */
  renderVenueNav() {
    const venue = this.getCurrentVenue();
    if (!venue) return;
    const animal = ZooData.getAnimalById(App.state.user.animalCode);
    const relation = ZooData.getRelationship(App.state.user.animalCode, venue.code);

    document.getElementById('venue-nav-icon').textContent = animal ? animal.emoji : '🧭';
    document.getElementById('venue-nav-title').textContent = `前往${venue.name}`;
    document.getElementById('venue-nav-desc').textContent = relation.tone;
    document.getElementById('venue-nav-eta').textContent = `步行约 ${ZooData.formatTime(venue.walkTimeFromPrev)} · ${ZooData.formatDistance(venue.distanceFromPrev)}`;
    document.getElementById('venue-nav-relation').textContent = `关系：${relation.label}`;
    document.getElementById('venue-nav-btn').textContent = `到达${venue.name}`;
  },

  /** 渲染当前场馆对话页 */
  renderVenueChat() {
    const venue = this.getCurrentVenue();
    if (!venue) return;

    // 更新标题
    const titleEl = document.getElementById('venue-chat-title');
    if (titleEl) titleEl.textContent = `📍 ${venue.name}`;

    const chatArea = document.getElementById('venue-chat');
    if (!chatArea) return;

    // 加载对话历史
    App.loadChatHistory('venue-chat');

    // 生成问候语
    const greeting = ZooData.generateGreeting(
      App.state.user.animalCode,
      venue.code,
      App.state.languageLevel
    );

    // 保存问候语到历史
    if (!chatArea.dataset.greeted || chatArea.dataset.venueCode !== venue.code) {
      App.saveToHistory('assistant', greeting);
      chatArea.dataset.greeted = 'true';
      chatArea.dataset.venueCode = venue.code;

      // 显示问候语气泡
      const bubble = Components.createChatBubble({ role: 'ai', text: greeting });
      chatArea.appendChild(bubble);
      chatArea.scrollTop = chatArea.scrollHeight;
    }

    // 更新快捷回复
    const overlay = chatArea.closest('.dialogue-overlay');
    if (overlay) {
      const quickReplyContainer = overlay.querySelector('.quick-replies');
      if (quickReplyContainer) {
        quickReplyContainer.innerHTML = '';
        const quickReplies = ZooData.generateQuickReplies(
          App.state.user.animalCode,
          venue.code,
          App.state.languageLevel
        );
        quickReplies.forEach(qr => {
          const btn = document.createElement('button');
          btn.className = 'quick-reply';
          btn.textContent = qr.text;
          btn.onclick = () => Stage2.ask(qr.question);
          quickReplyContainer.appendChild(btn);
        });
      }
    }

    // 更新"下一站"按钮文字（最后一站显示"生成故事"）
    const nextBtn = document.getElementById('next-venue-btn');
    if (nextBtn) {
      const isLast = App.state.currentVenueIndex >= App.state.route.length - 1;
      nextBtn.textContent = isLast ? '🎉 冒险结束' : '➡️ 下一站';
    }
  },

  /** 渲染拍照页 */
  renderPhotoPrompt() {
    const venue = this.getCurrentVenue();
    if (!venue) return;
    const animal = ZooData.getAnimalById(App.state.user.animalCode);
    const relation = ZooData.getRelationship(App.state.user.animalCode, venue.code);
    const photoPrompt = ZooData.generatePhotoPrompt(
      App.state.user.animalCode,
      venue.code,
      App.state.languageLevel
    );

    document.getElementById('venue-photo-title').textContent = `${relation.label} · ${venue.name}`;
    document.getElementById('venue-photo-desc').textContent = photoPrompt;
    document.getElementById('venue-photo-emoji').textContent = animal ? animal.emoji : '📸';
    document.getElementById('venue-photo-pose').textContent = relation.label;
    document.getElementById('venue-photo-detail').textContent = relation.photo;
  },

  /** 渲染过渡页（下一站或结束） */
  renderTransition() {
    const route = App.state.route;
    const idx = App.state.currentVenueIndex;
    const isLast = idx >= route.length - 1;

    if (isLast) {
      // 最后一站，准备生成故事
      document.getElementById('venue-transition-icon').textContent = '🌅';
      document.getElementById('venue-transition-title').textContent = '探险即将结束';
      document.getElementById('venue-transition-desc').textContent = '让我们生成专属冒险故事';
      const infoDiv = document.getElementById('venue-transition-info');
      if (infoDiv) infoDiv.style.display = 'none';
      const btn = document.getElementById('venue-transition-btn');
      if (btn) btn.textContent = '📖 生成我的探险故事';
    } else {
      const nextVenue = route[idx + 1];
      const nextRelation = ZooData.getRelationship(App.state.user.animalCode, nextVenue.code);
      document.getElementById('venue-transition-icon').textContent = '🧭';
      document.getElementById('venue-transition-title').textContent = '探险继续';
      document.getElementById('venue-transition-desc').textContent = nextRelation.tone;
      const infoDiv = document.getElementById('venue-transition-info');
      if (infoDiv) infoDiv.style.display = 'block';
      document.getElementById('venue-transition-label').textContent = '下一站';
      document.getElementById('venue-transition-next').textContent = nextVenue.name;
      document.getElementById('venue-transition-eta').textContent = `步行约 ${ZooData.formatTime(nextVenue.walkTimeFromPrev)} · ${nextRelation.label}`;
      const btn = document.getElementById('venue-transition-btn');
      if (btn) btn.textContent = `前往${nextVenue.name}`;
    }
  },

  /** 处理用户提问 */
  async ask(question, extraHint = '') {
    const input = document.getElementById('venue-chat-input');
    if (input) input.value = '';

    const venue = this.getCurrentVenue();
    const venueCode = venue ? venue.code : null;

    // RAG 检索
    const ds = App.ds || DataSourceFactory.get();
    let context = '';
    try {
      const results = await ds.rag.retrieve(question, 3);
      context = results.map(r => r.content).join('\n\n');
    } catch (e) { /* ignore */ }

    // 合并 RAG 上下文与额外提示（如设施导航距离）
    let fullHint = context ? `参考资料：\n${context}` : '';
    if (extraHint) fullHint = (fullHint ? fullHint + '\n' : '') + extraHint;

    await App.sendChat(question, 'venue-chat', {
      venueCode,
      systemHint: fullHint ? fullHint : undefined
    });
  },

  /** 拍照打卡 — 详细生动描述动作姿态 */
  takePhoto() {
    const venue = this.getCurrentVenue();
    if (!venue) return;
    const relation = ZooData.getRelationship(App.state.user.animalCode, venue.code);
    const poseDetail = ZooData.generatePhotoPoseDetail(
      App.state.user.animalCode,
      venue.code,
      App.state.languageLevel
    );

    Camera.capture({
      mockLabel: `${venue.name} · ${relation.label}`,
      onCapture: (result) => {
        App.state.photos.push(`${poseDetail.emoji} ${poseDetail.title}`);
        // 生成详细动作描述消息（仅给用户打卡动作建议，不含"拍照成功"等话术）
        const photoMsg = `${poseDetail.emoji} ${poseDetail.title}\n\n${poseDetail.detail}`;
        App.saveToHistory('system', photoMsg);
        const systemBubble = Components.createChatBubble({ role: 'system', text: photoMsg });
        const chatArea = document.getElementById('venue-chat');
        if (chatArea) {
          chatArea.appendChild(systemBubble);
          chatArea.scrollTop = chatArea.scrollHeight;
        }
        App.toast(`已解锁${relation.label}姿势`);
        // AI 配音朗读拍照动作描述（关联内联按钮，可暂停）
        if (typeof TTS !== 'undefined') {
          const ttsBtn = systemBubble.querySelector('.tts-inline-btn');
          TTS.speak(photoMsg, ttsBtn, systemBubble);
        }
      }
    });
  },

  /** 快捷气泡处理（餐厅/卫生间/市集）— 不走LLM，直接展开设施导航信息 */
  handleQuickAction(label) {
    const venue = this.getCurrentVenue();
    if (!venue) return;

    let facilityCode = null;
    let facilityName = '';
    let facilityEmoji = '';
    if (label.includes('餐厅')) {
      facilityCode = 'FACILITY_RESTAURANT';
      facilityName = '红山主题餐厅';
      facilityEmoji = '🍽️';
    } else if (label.includes('卫生间')) {
      facilityCode = 'FACILITY_TOILET';
      facilityName = '公共厕所（本土动物馆）';
      facilityEmoji = '🚻';
    } else if (label.includes('市集')) {
      facilityCode = 'FACILITY_MARKET';
      facilityName = '红山市集';
      facilityEmoji = '🛍️';
    }

    if (!facilityCode) return;

    // 计算从当前场馆到设施的距离、时间、方向
    const fromCoord = ZooData.getVenueCoord(venue.code);
    const toCoord = ZooData.getVenueCoord(facilityCode);
    if (!fromCoord || !toCoord) return;

    const dist = ZooData.calculateDistance(fromCoord, toCoord);
    const time = ZooData.estimateWalkTime(dist);

    // 计算方向（东南西北）
    const dLng = toCoord.lng - fromCoord.lng;
    const dLat = toCoord.lat - fromCoord.lat;
    let direction = '';
    if (Math.abs(dLat) > Math.abs(dLng)) {
      direction = dLat > 0 ? '北' : '南';
    } else {
      direction = dLng > 0 ? '东' : '西';
    }
    // 加入次要方向
    if (Math.abs(dLat) > Math.abs(dLng) * 0.5 && Math.abs(dLng) > Math.abs(dLat) * 0.5) {
      const subDir = dLng > 0 ? '东' : '西';
      direction = (dLat > 0 ? '北' : '南') + subDir;
    }

    // 在对话区显示设施导航信息卡片（不走LLM，低延迟）
    const chatArea = document.getElementById('venue-chat');
    if (!chatArea) return;

    // 用户气泡（显示点击的快捷动作）
    const userBubble = Components.createChatBubble({ role: 'user', text: `${facilityEmoji} ${label.includes('餐厅') ? '附近有餐厅吗？' : label.includes('卫生间') ? '卫生间在哪？' : '附近有市集吗？'}` });
    chatArea.appendChild(userBubble);

    // 系统气泡（设施导航信息）
    const navMsg = `${facilityEmoji} ${facilityName}\n\n📍 当前位置：${venue.name}\n🧭 方向：向${direction}方向走\n🚶 距离：约${ZooData.formatDistance(dist)}\n⏱️ 步行：约${ZooData.formatTime(time)}\n\n${label.includes('餐厅') ? '到餐厅可以补充能量，休息一下再继续探险！' : label.includes('卫生间') ? '卫生间就在附近，记得保持环境卫生哦！' : '市集里有红山特色纪念品，可以去逛逛！'}`;
    App.saveToHistory('user', label);
    App.saveToHistory('system', navMsg);
    const navBubble = Components.createChatBubble({ role: 'system', text: navMsg });
    chatArea.appendChild(navBubble);
    chatArea.scrollTop = chatArea.scrollHeight;
    // AI 配音朗读导航信息（关联内联按钮，可暂停）
    if (typeof TTS !== 'undefined') {
      const ttsBtn = navBubble.querySelector('.tts-inline-btn');
      TTS.speak(navMsg, ttsBtn, navBubble);
    }
  },

  /** 从过渡页前进到下一场馆或故事生成 */
  proceedToNext() {
    const route = App.state.route;
    const idx = App.state.currentVenueIndex;

    if (idx >= route.length - 1) {
      // 最后一站，进入故事生成
      App.goToStage(3, 0);
    } else {
      // 前往下一场馆，回到 stage2 step0
      App.state.currentVenueIndex = idx + 1;
      App.goToStage(2, 0);
    }
  }
};

/* ==================== Stage 3: 故事生成 ==================== */
const Stage3 = {
  onEnter(step) {
    if (step === 0) this.renderAdventureComplete();
    if (step === 1) this.generateStory();
    if (step === 2) this.renderCompleteInfo();
    if (step === 3) this.renderEnding();
  },

  /** 冒险完成页：展示氛围文案、统计数据 + 生成故事按钮 */
  renderAdventureComplete() {
    const animal = ZooData.getAnimalById(App.state.user.animalCode);
    const route = App.state.route;
    const photos = App.state.photos;
    const lang = App.state.languageLevel;

    const emojiEl = document.getElementById('adventure-complete-emoji');
    const titleEl = document.getElementById('adventure-complete-title');
    const subtitleEl = document.getElementById('adventure-complete-subtitle');
    const infoEl = document.getElementById('adventure-complete-info');

    const aName = animal ? animal.name : '探险家';
    const aEmoji = animal ? animal.emoji : '🐾';

    // 根据语言等级生成不同氛围文案
    const atmospheres = {
      L1: { emoji: '🎊', sub: '今天玩得超开心！红山的动物朋友们下次见啦～' },
      L2: { emoji: '🎉', sub: `带着满满的收获，${aName}探险队准备回到人类世界啦！` },
      L3: { emoji: '🌅', sub: `夕阳洒在红山森林上，${aName}的奇妙冒险告一段落。` },
      L4: { emoji: '✨', sub: `从${aName}的视角，重新认识了这座森林里的每一位居民。` },
      L5: { emoji: '🌿', sub: `这段沉浸式的探索，记录了${aName}与红山的珍贵连结。` }
    };
    const atm = atmospheres[lang] || atmospheres.L2;

    if (emojiEl) emojiEl.textContent = atm.emoji;
    if (subtitleEl) subtitleEl.textContent = atm.sub;

    // 统计信息卡
    if (infoEl) {
      const totalDist = route.reduce((s, r) => s + (r.distanceFromPrev || 0), 0);
      const totalTime = route.reduce((s, r) => s + (r.walkTimeFromPrev || 0), 0);

      infoEl.innerHTML = `
        <p style="font-size:.78rem;color:var(--ink);line-height:1.9">
          <span style="font-size:1.2rem">${aEmoji}</span><br>
          <span style="font-weight:700;font-size:.88rem">${aName}探险数据</span><br>
          📍 探索场馆：<span style="color:var(--accent);font-weight:600">${route.length}</span> 处<br>
          🚶 累计步行：<span style="color:var(--accent);font-weight:600">${ZooData.formatDistance(totalDist)}</span><br>
          ⏱️ 游览时长：<span style="color:var(--accent);font-weight:600">${ZooData.formatTime(totalTime)}</span><br>
          📸 拍照打卡：<span style="color:var(--accent);font-weight:600">${photos.length}</span> 张
        </p>
      `;
    }
  },

  /** 结局页：动态适配身份 */
  renderEnding() {
    const animal = ZooData.getAnimalById(App.state.user.animalCode);
    const endingEmoji = document.getElementById('ending-emoji');
    const endingTitle = document.getElementById('ending-title');
    if (endingEmoji && animal) endingEmoji.textContent = `🌿${animal.emoji}🌿`;
    if (endingTitle && animal) endingTitle.textContent = `再见，${animal.name}！`;
  },

  async generateStory() {
    const storyEl = document.getElementById('story-text');
    const spinnerEl = document.getElementById('story-spinner-2');
    const actionsEl = document.getElementById('story-actions');
    if (!storyEl) return;

    if (spinnerEl) spinnerEl.style.display = 'flex';
    storyEl.style.display = 'none';
    storyEl.textContent = '';
    if (actionsEl) actionsEl.style.display = 'none';

    const ds = App.ds || DataSourceFactory.get();
    const animal = ZooData.getAnimalById(App.state.user.animalCode);
    const style = ZooData.getLanguageStyle(App.state.languageLevel);

    // 构建故事 prompt（适配新状态）
    const context = {
      animalName: animal ? animal.name : '动物',
      animalEmoji: animal ? animal.emoji : '🐾',
      languageLevel: App.state.languageLevel,
      languageStyleLabel: style.label,
      peopleCount: App.state.user.peopleCount,
      ages: App.state.user.ages,
      route: App.state.route,
      photos: App.state.photos,
      chatHighlights: App.state.chatHistory
        .filter(m => m.role === 'user')
        .slice(-8)
        .map(m => m.content)
    };

    // 构建故事 prompt
    const storyPrompt = `你是"红山"AI导游。请根据以下信息，为游客生成一段探险故事。

【角色】
- 动物身份：${context.animalName} ${context.animalEmoji}
- 游览人数：${context.peopleCount}人，年龄：${context.ages.join('、')}岁

【语言风格】
- 等级：${context.languageLevel}（${context.languageStyleLabel}）
- 请按照该语言风格的要求生成故事

【游览路线】
${(context.route || []).map((s, i) => `${i+1}. ${s.name}（${s.animals}）`).join('\n')}

【拍照打卡】
${(context.photos || []).map(p => `- ${p}`).join('\n') || '无'}

【对话亮点】
${(context.chatHighlights || []).map(h => `- ${h}`).join('\n') || '无'}

请生成一段 300-500 字的探险游记，要求：
1. 以客观观察者视角叙事，用第三人称描述游客（化身为${context.animalName}的探险家）的游览过程
2. 禁止使用第一人称"我""我们"代指动物，只能用"这只${context.animalName}""它们"或直接说动物名
3. 融入科普知识点（动物关系、行为丰容等），用第三人称描述动物的行为与习性
4. 根据关系矩阵体现不同场馆的叙事基调（天敌紧张、回家亲切等）
5. 语言风格匹配${context.languageLevel}等级（${context.languageStyleLabel}）
6. 以温暖结尾收束`;

    let fullStory = '';
    try {
      fullStory = await ds.llm.chat([{ role: 'user', content: storyPrompt }], (chunk) => {
        if (spinnerEl) spinnerEl.style.display = 'none';
        storyEl.style.display = 'block';
        storyEl.textContent += chunk;
        storyEl.scrollTop = storyEl.scrollHeight;
      });
      if (spinnerEl) spinnerEl.style.display = 'none';
      storyEl.style.display = 'block';
      if (fullStory && !storyEl.textContent) storyEl.textContent = fullStory;
      if (actionsEl) actionsEl.style.display = 'block';
    } catch (err) {
      if (spinnerEl) spinnerEl.style.display = 'none';
      storyEl.style.display = 'block';
      // 兜底故事：包含用户身份和到过的展馆，其余保持通用
      const venueList = (context.route || []).map(s => s.name).join('、');
      const photoNote = (context.photos || []).length > 0
        ? `途中还拍下了${context.photos.length}张打卡照片，记录了每一个难忘瞬间。\n\n`
        : '';
      storyEl.textContent = `${context.animalEmoji} ${context.animalName}探险家的红山游记

今天，化身为${context.animalName}的探险家在红山动物星球完成了一场精彩的探索之旅！

从南门出发后，${context.animalName}探险家依次探访了${venueList}。每到一处场馆，都用心观察动物的行为，了解了它们与${context.animalName}之间的奇妙关系——有天敌相遇时的紧张对峙，有远亲重逢时的温暖时刻，也有跨大陆新朋友的惊喜邂逅。

${photoNote}虽然故事生成遇到了一点小插曲，但这段冒险旅程中收获的知识和快乐是真实而珍贵的。带着满满的回忆，${context.animalName}探险家回到了人类世界，期待着下一次的探索！${context.animalEmoji}🌿`;
      if (actionsEl) actionsEl.style.display = 'block';
      App.handleError(err, 'generateStory');
    }
  },

  renderCompleteInfo() {
    const infoEl = document.getElementById('story-complete-info');
    if (!infoEl) return;
    const animal = ZooData.getAnimalById(App.state.user.animalCode);
    const route = App.state.route;
    const photos = App.state.photos;

    infoEl.innerHTML = `
      <p style="font-size:.78rem;color:var(--ink);line-height:1.6">
        ${animal ? animal.emoji : '🐾'} ${animal ? animal.name : '动物'}的红山冒险<br>
        探索场馆：<span style="color:var(--accent)">${route.length}处</span><br>
        📸 拍照打卡：<span style="color:var(--accent)">${photos.length}处</span><br>
        💬 对话互动：<span style="color:var(--accent)">多轮</span>
      </p>
    `;
  },

  regenerate() {
    const storyEl = document.getElementById('story-text');
    if (storyEl) storyEl.textContent = '';
    this.generateStory();
  },

  share() {
    const storyEl = document.getElementById('story-text');
    if (storyEl && storyEl.textContent) {
      App.toast('已复制故事到剪贴板！');
    }
  }
};

/* ==================== Stage Registry ==================== */
const StageRegistry = {
  0: Stage1,  // 游客信息获取
  1: Stage2,  // 游览规划
  2: {        // 动态场馆游览
    onEnter(step) {
      if (step === 0) Stage2.renderVenueNav();
      if (step === 1) Stage2.renderVenueChat();
      if (step === 2) Stage2.renderPhotoPrompt();
      if (step === 3) Stage2.renderTransition();
    }
  },
  3: Stage3   // 故事生成
};

/* ==================== 覆写 App.next 以支持场馆循环 ==================== */
const _originalNext = App.next.bind(App);
App.next = function() {
  // 在 stage2 step3（过渡页）时，需要判断是去下一场馆还是故事生成
  if (this.state.currentStage === 2 && this.state.currentStep === 3) {
    Stage2.proceedToNext();
    return;
  }
  _originalNext();
};

/* ==================== Init ==================== */
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
