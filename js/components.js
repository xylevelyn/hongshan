/**
 * ==================== 组件库 Components ====================
 * 纯 JS 工厂函数，返回 HTMLElement 或 {el, ...methods} API 对象
 * 复用 css/base.css 中已有的样式类，保持视觉一致性
 *
 * 用法:
 *   const btn = Components.createButton({ text:'确定', onClick: () => {} });
 *   container.appendChild(btn);
 *
 *   const chat = Components.createChatArea({ id:'my-chat' });
 *   container.appendChild(chat.el);
 *   chat.appendBubble('ai', '你好！');
 */

const Components = {

  // ==================== 1. Button ====================
  /**
   * 创建按钮
   * @param {Object} config
   * @param {string} config.variant - 'primary' | 'secondary' (默认 'primary')
   * @param {string} config.text - 按钮文字
   * @param {Function} config.onClick - 点击回调
   * @param {string} [config.icon] - 前缀 emoji（可选）
   * @param {boolean} [config.disabled] - 禁用状态
   * @returns {HTMLButtonElement}
   */
  createButton(config = {}) {
    const btn = document.createElement('button');
    btn.className = config.variant === 'secondary' ? 'btn-secondary' : 'btn-primary';
    if (config.icon) {
      btn.textContent = `${config.icon} ${config.text || ''}`;
    } else {
      btn.textContent = config.text || '';
    }
    btn.type = 'button';
    if (config.disabled) btn.disabled = true;
    if (config.onClick) btn.addEventListener('click', config.onClick);
    if (config.id) btn.id = config.id;
    return btn;
  },

  // ==================== 2. InputBar ====================
  /**
   * 创建输入栏（支持文字/语音双模式切换）
   * 文字模式: [输入框] [🎤语音按钮 → 切换语音模式]
   * 语音模式: [⌨️键盘按钮 → 切换文字模式] [按住说话按钮 → 长按录音松开发送]
   *
   * @param {Object} config
   * @param {string} [config.placeholder] - 输入提示
   * @param {Function} [config.onSubmit] - 回车提交回调 (text) => void
   * @param {Function} [config.onMic] - 语音按钮/按住说话触发的回调（启动 Voice）
   * @param {boolean} [config.showMic] - 是否显示语音切换（默认 true）
   * @param {Object} [config.actionBtn] - 额外按钮 { text, onClick, class }
   * @param {string} [config.inputId] - input 的 id
   * @returns {HTMLDivElement}
   */
  createInputBar(config = {}) {
    const bar = document.createElement('div');
    bar.className = 'input-bar';

    // ---------- 文字模式元素 ----------
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = config.placeholder || '';
    if (config.inputId) input.id = config.inputId;

    if (config.onSubmit) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && input.value.trim()) {
          config.onSubmit(input.value.trim());
          input.value = '';
        }
      });
    }

    bar.appendChild(input);

    // 语音切换按钮（文字模式下显示，点击切换到语音模式）
    const micBtn = document.createElement('button');
    micBtn.className = 'mic-btn toggle-voice-btn';
    micBtn.type = 'button';
    micBtn.textContent = '🎤';
    if (config.showMic !== false) bar.appendChild(micBtn);

    // ---------- 语音模式元素 ----------
    // 键盘切换按钮（语音模式下显示，点击切回文字模式）
    const keyboardBtn = document.createElement('button');
    keyboardBtn.className = 'mic-btn keyboard-btn';
    keyboardBtn.type = 'button';
    keyboardBtn.textContent = '⌨️';
    keyboardBtn.style.display = 'none';
    bar.appendChild(keyboardBtn);

    // 按住说话按钮
    const speakBtn = document.createElement('button');
    speakBtn.className = 'speak-btn';
    speakBtn.type = 'button';
    speakBtn.textContent = '按住说话';
    speakBtn.style.display = 'none';
    bar.appendChild(speakBtn);

    // ---------- 模式切换逻辑 ----------
    const switchToVoice = () => {
      bar.classList.add('voice-mode');
      input.style.display = 'none';
      micBtn.style.display = 'none';
      if (config.actionBtnEl) config.actionBtnEl.style.display = 'none';
      keyboardBtn.style.display = 'flex';
      speakBtn.style.display = 'flex';
    };

    const switchToText = () => {
      bar.classList.remove('voice-mode');
      input.style.display = 'block';
      micBtn.style.display = 'flex';
      if (config.actionBtnEl) config.actionBtnEl.style.display = 'flex';
      keyboardBtn.style.display = 'none';
      speakBtn.style.display = 'none';
    };

    micBtn.addEventListener('click', switchToVoice);
    keyboardBtn.addEventListener('click', switchToText);

    // ---------- 按住说话逻辑 ----------
    let isRecording = false;

    const startSpeaking = (e) => {
      e.preventDefault();
      if (isRecording) return;
      isRecording = true;
      speakBtn.classList.add('recording');
      speakBtn.textContent = '松开 发送';
      if (config.onMic) config.onMic();
    };

    const stopSpeaking = (e) => {
      e.preventDefault();
      if (!isRecording) return;
      isRecording = false;
      speakBtn.classList.remove('recording');
      speakBtn.textContent = '按住说话';
      if (typeof Voice !== 'undefined' && Voice.isListening()) {
        Voice.stop();
      }
    };

    // 触摸事件（移动端）
    speakBtn.addEventListener('touchstart', startSpeaking, { passive: false });
    speakBtn.addEventListener('touchend', stopSpeaking, { passive: false });
    speakBtn.addEventListener('touchcancel', stopSpeaking, { passive: false });
    // 鼠标事件（桌面端）
    speakBtn.addEventListener('mousedown', startSpeaking);
    speakBtn.addEventListener('mouseup', stopSpeaking);
    speakBtn.addEventListener('mouseleave', stopSpeaking);

    // ---------- 额外操作按钮 ----------
    if (config.actionBtn) {
      const ab = document.createElement('button');
      ab.className = config.actionBtn.class || 'rand-btn';
      ab.type = 'button';
      ab.textContent = config.actionBtn.text || '';
      if (config.actionBtn.onClick) ab.addEventListener('click', config.actionBtn.onClick);
      bar.appendChild(ab);
      config.actionBtnEl = ab;
    }

    // 暴露 API：切换模式 + 获取元素
    bar._switchToVoice = switchToVoice;
    bar._switchToText = switchToText;
    bar._input = input;
    bar._speakBtn = speakBtn;
    bar._micBtn = micBtn;

    return bar;
  },

  // ==================== 3. DialogueOverlay ====================
  /**
   * 创建底部对话浮层（NPC 台词 + 聊天区域 + 快捷回复 + 输入栏 + 收起按钮）
   * 支持两种模式：
   *   - 简单模式：NPC 台词 + 快捷回复 + 输入栏（默认）
   *   - 多轮对话模式：展开后向上扩展，内嵌可滚动聊天区域
   * @param {Object} config
   * @param {string} [config.npcName] - NPC 名称
   * @param {string} [config.npcText] - NPC 台词
   * @param {Array<{text, onClick}>} [config.quickReplies] - 快捷回复按钮
   * @param {Object} [config.inputConfig] - 输入栏配置（传给 createInputBar）
   * @param {boolean} [config.collapsible] - 是否可收起（默认 true）
   * @param {boolean} [config.multiTurn] - 是否启用多轮对话模式（默认 false）
   * @returns {Object} API: { el, collapse, expand, toggle, update, setInput, expandChat, collapseChat, appendBubble }
   */
  createDialogueOverlay(config = {}) {
    const overlay = document.createElement('div');
    overlay.className = 'dialogue-overlay';
    if (config.multiTurn) overlay.classList.add('multi-turn');

    // Collapse button
    if (config.collapsible !== false) {
      const collapseBtn = document.createElement('button');
      collapseBtn.className = 'collapse-btn';
      collapseBtn.type = 'button';
      collapseBtn.textContent = '▼';
      overlay.appendChild(collapseBtn);
    }

    // NPC name
    const nameEl = document.createElement('div');
    nameEl.className = 'npc-name';
    nameEl.textContent = config.npcName || '🧭 红山';
    overlay.appendChild(nameEl);

    // NPC text
    const textEl = document.createElement('div');
    textEl.className = 'npc-text';
    textEl.textContent = config.npcText || '';
    overlay.appendChild(textEl);

    // Chat area (for multi-turn dialogue, hidden by default)
    const chatArea = document.createElement('div');
    chatArea.className = 'dialogue-chat-area chat-area';
    chatArea.style.display = 'none';
    overlay.appendChild(chatArea);

    // Quick replies
    const repliesEl = document.createElement('div');
    repliesEl.className = 'quick-replies';
    if (config.quickReplies) {
      config.quickReplies.forEach(qr => {
        const chip = document.createElement('span');
        chip.className = 'quick-reply';
        chip.textContent = qr.text;
        if (qr.onClick) chip.addEventListener('click', qr.onClick);
        repliesEl.appendChild(chip);
      });
    }
    overlay.appendChild(repliesEl);

    // Input bar
    let inputBarEl = null;
    if (config.inputConfig !== null) {
      inputBarEl = Components.createInputBar(config.inputConfig || {});
      inputBarEl.classList.add('chat-input-bar');
      overlay.appendChild(inputBarEl);
    }

    // Collapse logic
    const collapseBtn = overlay.querySelector('.collapse-btn');
    const toggle = () => {
      overlay.classList.toggle('collapsed');
      if (collapseBtn) {
        collapseBtn.textContent = overlay.classList.contains('collapsed') ? '💬' : '▼';
      }
    };
    if (collapseBtn) collapseBtn.addEventListener('click', toggle);

    // Multi-turn expand/collapse logic
    let chatExpanded = false;
    const expandChat = () => {
      if (!chatExpanded) {
        chatExpanded = true;
        overlay.classList.add('expanded');
        chatArea.style.display = 'block';
      }
    };
    const collapseChat = () => {
      if (chatExpanded) {
        chatExpanded = false;
        overlay.classList.remove('expanded');
        chatArea.style.display = 'none';
      }
    };

    // Append a chat bubble to the chat area
    const appendBubble = (role, text, sender) => {
      const bubble = Components.createChatBubble({ role, text, sender });
      chatArea.appendChild(bubble);
      chatArea.scrollTop = chatArea.scrollHeight;
      return bubble;
    };

    return {
      el: overlay,
      collapse() {
        if (!overlay.classList.contains('collapsed')) toggle();
      },
      expand() {
        if (overlay.classList.contains('collapsed')) toggle();
      },
      toggle,
      /** 更新 NPC 台词和快捷回复 */
      update({ npcName, npcText, quickReplies } = {}) {
        if (npcName !== undefined) nameEl.textContent = npcName;
        if (npcText !== undefined) textEl.textContent = npcText;
        if (quickReplies !== undefined) {
          repliesEl.innerHTML = '';
          quickReplies.forEach(qr => {
            const chip = document.createElement('span');
            chip.className = 'quick-reply';
            chip.textContent = qr.text;
            if (qr.onClick) chip.addEventListener('click', qr.onClick);
            repliesEl.appendChild(chip);
          });
        }
      },
      /** 获取输入栏元素 */
      getInput() { return inputBarEl; },
      /** 获取聊天区域元素 */
      getChatArea() { return chatArea; },
      /** 展开多轮对话模式 */
      expandChat,
      /** 收起多轮对话模式 */
      collapseChat,
      /** 追加聊天气泡 */
      appendBubble,
      /** 获取当前展开状态 */
      isChatExpanded() { return chatExpanded; }
    };
  },

  // ==================== 4. ChatBubble ====================
  /**
   * 创建聊天气泡
   * @param {Object} config
   * @param {string} config.role - 'ai' | 'user' | 'system'
   * @param {string} config.text - 气泡内容
   * @param {string} [config.sender] - 发送者名称（不传则用默认标签）
   * @returns {HTMLDivElement}
   */
  createChatBubble(config = {}) {
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${config.role || 'ai'}`;

    const senderLabels = {
      ai: '🧭 红山',
      user: (typeof App !== 'undefined' && App.state.user.animalName) ? App.state.user.animalName : '探险家',
      system: '📸 系统'
    };

    if (config.role !== 'system') {
      const sender = document.createElement('div');
      sender.className = 'sender';
      sender.textContent = config.sender || senderLabels[config.role] || config.role || '';
      bubble.appendChild(sender);
    }

    const textEl = document.createElement('div');
    textEl.textContent = config.text || '';
    bubble.appendChild(textEl);

    // Store text element reference for streaming
    bubble._textEl = textEl;

    // 为有文本的 AI/系统气泡附加 TTS 内联朗读按钮
    // （流式输出的气泡初始 text 为空，按钮由调用方在流式完成后通过 TTS.attachButton 附加）
    if (config.text && (config.role === 'ai' || config.role === 'system')) {
      if (typeof TTS !== 'undefined') {
        TTS.attachButton(bubble, config.text);
      }
    }

    return bubble;
  },

  // ==================== 5. ChatArea ====================
  /**
   * 创建聊天区域（可滚动，支持追加气泡、流式输出）
   * @param {Object} config
   * @param {string} [config.id] - 容器 id
   * @returns {Object} API: { el, appendBubble, appendStreaming, finishStreaming, clear, scrollToBottom }
   */
  createChatArea(config = {}) {
    const area = document.createElement('div');
    area.className = 'chat-area';
    area.style.display = 'flex';
    area.style.flexDirection = 'column';
    if (config.id) area.id = config.id;

    let streamingBubble = null;
    let streamingText = '';

    return {
      el: area,
      /**
       * 追加一个气泡
       * @param {string} role - 'ai'|'user'|'system'
       * @param {string} text - 气泡内容
       * @param {string} [sender] - 发送者
       * @returns {HTMLDivElement} 气泡元素
       */
      appendBubble(role, text, sender) {
        const bubble = Components.createChatBubble({ role, text, sender });
        area.appendChild(bubble);
        area.scrollTop = area.scrollHeight;
        return bubble;
      },
      /**
       * 开始流式输出（创建空 AI 气泡，逐步追加文字）
       * @param {string} [sender] - 发送者名称
       * @returns {HTMLDivElement} 流式气泡元素
       */
      appendStreaming(sender) {
        streamingBubble = Components.createChatBubble({ role: 'ai', text: '', sender });
        streamingText = '';
        area.appendChild(streamingBubble);
        area.scrollTop = area.scrollHeight;
        return streamingBubble;
      },
      /**
       * 追加流式文本块
       * @param {string} chunk - 文本片段
       */
      appendChunk(chunk) {
        if (!streamingBubble) return;
        streamingText += chunk;
        if (streamingBubble._textEl) {
          streamingBubble._textEl.textContent = streamingText;
        }
        area.scrollTop = area.scrollHeight;
      },
      /** 结束流式输出 */
      finishStreaming() {
        streamingBubble = null;
        streamingText = '';
      },
      /** 清空聊天区域 */
      clear() {
        area.innerHTML = '';
        streamingBubble = null;
        streamingText = '';
      },
      /** 滚动到底部 */
      scrollToBottom() {
        area.scrollTop = area.scrollHeight;
      }
    };
  },

  // ==================== 6. MapPin ====================
  /**
   * 创建地图标记点
   * @param {Object} config
   * @param {string} config.label - 标签文字（如"猫科星球"）
   * @param {string} config.icon - 圆圈内图标/文字（如"猫"或数字）
   * @param {string} config.top - CSS top 值（如"42%"）
   * @param {string} config.left - CSS left 值（如"82%"）
   * @param {boolean} [config.visited] - 是否已访问
   * @param {boolean} [config.showLabel] - 是否显示标签（默认 true）
   * @param {Function} [config.onClick] - 点击回调
   * @returns {HTMLDivElement}
   */
  createMapPin(config = {}) {
    const pin = document.createElement('div');
    pin.className = 'map-pin';
    if (config.visited) pin.classList.add('visited');
    pin.style.top = config.top || '50%';
    pin.style.left = config.left || '50%';

    const circle = document.createElement('div');
    circle.className = 'pin-circle';
    circle.textContent = config.icon || '';
    pin.appendChild(circle);

    if (config.showLabel !== false && config.label) {
      const label = document.createElement('span');
      label.className = 'pin-label';
      label.textContent = config.label;
      pin.appendChild(label);
    }

    if (config.onClick) pin.addEventListener('click', config.onClick);

    return pin;
  },

  // ==================== 7. GachaCapsule ====================
  /**
   * 创建扭蛋胶囊
   * @param {Object} config
   * @param {string} [config.icon] - 破壳后显示的图标（默认 🦊）
   * @param {Function} [config.onOpen] - 打开回调
   * @param {string} [config.id] - 元素 id
   * @returns {Object} API: { el, open, isOpen }
   */
  createGachaCapsule(config = {}) {
    const capsule = document.createElement('div');
    capsule.className = 'gacha-capsule';
    if (config.id) capsule.id = config.id;

    const qMark = document.createElement('span');
    qMark.className = 'q-mark';
    qMark.textContent = '?';
    capsule.appendChild(qMark);

    const charIcon = document.createElement('span');
    charIcon.className = 'char-icon';
    charIcon.textContent = config.icon || '🦊';
    capsule.appendChild(charIcon);

    let opened = false;

    const open = () => {
      if (opened) return;
      opened = true;
      capsule.classList.add('opened');
      if (config.onOpen) config.onOpen(capsule);
    };

    capsule.addEventListener('click', open);

    return {
      el: capsule,
      open,
      isOpen() { return opened; }
    };
  },

  // ==================== 8. Toast ====================
  /**
   * 创建全局 Toast 提示
   * @param {Object} [config]
   * @param {number} [config.duration] - 显示时长 ms（默认 2000）
   * @returns {Object} API: { el, show }
   */
  createToast(config = {}) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);

    let timer = null;

    return {
      el: toast,
      /**
       * 显示 toast
       * @param {string} msg - 提示消息
       * @param {number} [duration] - 覆盖默认时长
       */
      show(msg, duration) {
        toast.textContent = msg;
        toast.classList.add('show');
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => toast.classList.remove('show'), duration || config.duration || 2000);
      }
    };
  },

  // ==================== 9. LoadingSpinner ====================
  /**
   * 创建加载动画
   * @param {Object} [config]
   * @param {string} [config.text] - 加载文字（如"红山正在思考..."）
   * @param {string} [config.size] - 尺寸（如"40px"，默认 "40px"）
   * @returns {Object} API: { el, show, hide, setText }
   */
  createLoadingSpinner(config = {}) {
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'display:none;flex-direction:column;align-items:center;justify-content:center;padding:16px;';

    const spinner = document.createElement('div');
    spinner.className = 'spinner';
    if (config.size) {
      spinner.style.width = config.size;
      spinner.style.height = config.size;
    }
    wrapper.appendChild(spinner);

    const textEl = document.createElement('p');
    textEl.style.cssText = 'font-size:.78rem;color:var(--muted);';
    textEl.textContent = config.text || '加载中...';
    wrapper.appendChild(textEl);

    return {
      el: wrapper,
      show(text) {
        if (text !== undefined) textEl.textContent = text;
        wrapper.style.display = 'flex';
      },
      hide() {
        wrapper.style.display = 'none';
      },
      setText(text) {
        textEl.textContent = text;
      }
    };
  },

  // ==================== 10. StageView（复合组件） ====================
  /**
   * 创建一个 Stage 视图容器（带标题和内容区）
   * @param {Object} config
   * @param {string} config.id - view 的 id（如 "stage2-step0"）
   * @param {string} [config.title] - 标题
   * @param {boolean} [config.centered] - 是否居中布局
   * @returns {Object} API: { el, contentEl, setTitle }
   */
  createStageView(config = {}) {
    const view = document.createElement('div');
    view.className = 'view';
    if (config.id) view.id = config.id;

    const content = document.createElement('div');
    content.style.cssText = config.centered !== false
      ? 'padding:16px;flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;'
      : 'padding:16px;flex:1;display:flex;flex-direction:column;';

    if (config.title) {
      const title = document.createElement('h3');
      title.className = 'title-md';
      title.style.textAlign = 'center';
      title.style.marginBottom = '1rem';
      title.textContent = config.title;
      content.appendChild(title);
    }

    view.appendChild(content);

    return {
      el: view,
      contentEl: content,
      setTitle(text) {
        const titleEl = content.querySelector('.title-md');
        if (titleEl) titleEl.textContent = text;
      }
    };
  },

  // ==================== 11. AvatarGroup（复合组件） ====================
  /**
   * 创建角色头像组（用于角色命名/展示界面）
   * @param {Object} config
   * @param {Array<{name, icon, named}>} config.avatars - 头像配置
   * @returns {Object} API: { el, setName, setIcon, markNamed }
   */
  createAvatarGroup(config = {}) {
    const group = document.createElement('div');
    group.style.cssText = 'display:flex;justify-content:center;gap:1.2rem;margin-bottom:1.2rem;';

    const avatarEls = [];
    const nameEls = [];

    (config.avatars || []).forEach((av, i) => {
      const wrapper = document.createElement('div');
      wrapper.style.textAlign = 'center';

      const circle = document.createElement('div');
      circle.style.cssText = av.named
        ? 'width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,var(--accent),#CC6B20);display:flex;align-items:center;justify-content:center;font-size:1.8rem;margin-bottom:.3rem;transition:all .3s ease;'
        : 'width:64px;height:64px;border-radius:50%;background:var(--bg2);border:2px dashed var(--rule);display:flex;align-items:center;justify-content:center;font-size:1.8rem;margin-bottom:.3rem;transition:all .3s ease;';
      circle.textContent = av.icon || '🦊';
      circle.id = `avatar-${i + 1}`;
      wrapper.appendChild(circle);

      const name = document.createElement('span');
      name.style.cssText = `font-size:.85rem;font-weight:700;color:${av.named ? 'var(--ink)' : 'var(--muted)'}`;
      name.textContent = av.name || '？';
      name.id = `display-name-${i + 1}`;
      wrapper.appendChild(name);

      avatarEls.push(circle);
      nameEls.push(name);
      group.appendChild(wrapper);
    });

    const orangeBg = 'linear-gradient(135deg, var(--accent), #CC6B20)';

    return {
      el: group,
      /** 设置某位置头像名称 */
      setName(index, name) {
        if (nameEls[index]) {
          nameEls[index].textContent = name;
          nameEls[index].style.color = 'var(--ink)';
        }
      },
      /** 设置某位置头像图标 */
      setIcon(index, icon) {
        if (avatarEls[index]) avatarEls[index].textContent = icon;
      },
      /** 标记某位置已命名（变橙色） */
      markNamed(index) {
        if (avatarEls[index]) {
          avatarEls[index].style.background = orangeBg;
          avatarEls[index].style.border = 'none';
        }
        if (nameEls[index]) nameEls[index].style.color = 'var(--ink)';
      }
    };
  },

  // ==================== 12. RouteList（复合组件） ====================
  /**
   * 创建路线列表（编号 + 场馆名 + 时间）
   * @param {Object} config
   * @param {Array<{name, time, rest}>} config.stops - 路线站点
   * @returns {Object} API: { el, setStops, markVisited }
   */
  createRouteList(config = {}) {
    const list = document.createElement('div');
    list.style.cssText = 'padding:8px 12px;overflow-y:auto;flex:1;';

    const renderStops = (stops, visitedUpTo = -1) => {
      list.innerHTML = '';
      (stops || []).forEach((stop, i) => {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 0;';
        if (i < stops.length - 1) row.style.borderBottom = '1px solid var(--rule)';

        const num = document.createElement('div');
        const isVisited = i <= visitedUpTo;
        num.style.cssText = `width:24px;height:24px;border-radius:50%;background:${isVisited ? 'var(--accent2)' : 'var(--accent)'};color:#fff;display:flex;align-items:center;justify-content:center;font-size:.7rem;font-weight:700;flex-shrink:0`;
        num.textContent = String(i + 1);
        row.appendChild(num);

        const info = document.createElement('div');
        const nameEl = document.createElement('div');
        nameEl.style.cssText = 'font-size:.82rem;font-weight:600';
        nameEl.textContent = stop.name;
        info.appendChild(nameEl);

        const timeEl = document.createElement('div');
        timeEl.style.cssText = 'font-size:.68rem;color:var(--muted)';
        timeEl.textContent = stop.time + (stop.rest ? ' · 休整' : '');
        info.appendChild(timeEl);
        row.appendChild(info);

        list.appendChild(row);
      });
    };

    renderStops(config.stops, -1);

    return {
      el: list,
      setStops(stops) { renderStops(stops, -1); },
      markVisited(upToIndex) { renderStops(config.stops, upToIndex); }
    };
  }
};
