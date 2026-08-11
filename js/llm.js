/* ==================== LLM Config ==================== */
// 平台：阿里云百炼（DashScope）— Qwen 全系列
// 一个 API Key 通吃 Qwen-Plus / Qwen-Long / FunASR
//
// ⚠️ 使用前请替换下方 apiKey 为你自己的 DashScope API Key
//    申请地址：https://bailian.console.aliyun.com
//    模型授权：需开通 qwen-plus 和 paraformer-realtime-v2
const LLM_CONFIG = {
  provider: 'qwen',
  apiKey: 'sk-your-dashscope-api-key-here',  // ← 替换为你的 API Key

  // OpenAI 兼容地址（通用域名）
  baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',

  // DashScope 原生地址（FunASR 语音识别用）
  dashscopeUrl: 'https://dashscope.aliyuncs.com/api/v1',

  // FunASR WebSocket 地址（实时语音识别）
  // 注意：浏览器 WebSocket 不支持自定义 Authorization 头，
  //       需配合 voice-proxy.js 本地代理使用。
  wsUrl: 'wss://dashscope.aliyuncs.com/api-ws/v1/inference',

  // 文本对话模型
  model: 'qwen-plus',              // qwen-plus（非思考模式，响应快）| 备选：qwen3.7-plus / qwen-turbo

  // 语音识别模型（FunASR）
  asrModel: 'paraformer-realtime-v2',

  temperature: 0.8,
  maxTokens: 550,   // 限制回复在300字以内（中文≈1.5-2 tokens/字）
  enabled: true   // ✅ 已启用真实 API
};

/* ==================== System Prompts ==================== */
const PROMPTS = {
  // 红山Agent 的核心人设（动态构建，适配用户选择的动物身份）
  buildSystem(animalName, animalEmoji) {
    const name = animalName || '动物';
    const emoji = animalEmoji || '🐾';
    return `你是"红山"，一个AI导游Agent，在南京红山森林动物园里引导游客以动物身份游览。

【你的角色设定】
- 你不是动物，你是AI Agent，名叫"红山"
- 你用温暖、活泼、有冒险感的语气引导游客
- 游客已选择化身为${name}，你称呼他们为"${name}探险家"
- 你了解红山动物园的每个场馆、每个动物的个体故事

【对话风格】
- 回复不超过300字，精炼生动，不堆砌信息（手机端阅读）
- 除非用户主动使用英文提问，否则全程使用中文，禁止拉丁学名、英文缩写、英文单词等非中文术语
- 禁止过于专业的学术黑话，所有概念用通俗中文表达
- 多用emoji增强氛围（${emoji}🌿🗺️🔍）
- 主动提问引导观察，不灌输式科普
- 把知识点融入故事情节，不说教
- 匹配用户年龄调整词汇与句长，避免超龄灌输

【知识库要点 - 红山动物园】
- 猫科星球：猎豹、狞猫（耳朵360度转动）、美洲豹小布&里昂、薮猫
- 细尾獴馆：群居等级制度、哨兵制度、小王子与莫莫的故事
- 考拉馆：考拉青柠是"栖架征服者"
- 狼馆：新狼王天涯接替老狼王沃夫
- 行为丰容：饲养员把食物藏起来让动物自己找
- 猫科斑纹口诀：实心点状(猎豹)、花瓣花心(美洲豹)、空心铜钱(金钱豹)`;
  },

  // 各阶段的引导Prompt（动态构建）
  buildStagePrompt(stage, animalName) {
    const name = animalName || '探险家';
    const stages = {
      welcome: `${name}探险家，欢迎来到红山动物星球！请选择你想幻化成的动物吧！`,
      routePlanning: `${name}探险家，开始制定探索路线了！告诉我你想去哪些场馆？`,
      farewell: `${name}探险家，今天度过了奇妙的探险。你要回到人类世界了吗？我帮你把今天的冒险编成一个故事吧！`
    };
    return stages[stage] || stages.welcome;
  }
};

/* ==================== LLM Client ==================== */
const LLM = {

  /**
   * 发送对话请求
   * @param {Array} messages - [{role:'user'|'assistant'|'system', content:'...'}]
   * @param {Function} onChunk - 流式回调 (chunkText) => void
   * @returns {Promise<string>} 完整回复
   */
  async chat(messages, onChunk) {
    if (!LLM_CONFIG.enabled) {
      return this.mockChat(messages, onChunk);
    }

    try {
      // 检查 messages 中是否已有 system 消息（app.js sendChat 会构建完整的 system prompt）
      const hasSystemMsg = messages.some(m => m.role === 'system');

      let fullMessages;
      if (hasSystemMsg) {
        // 已有 system 消息，直接使用（app.js 已注入语言风格+关系矩阵+身份信息）
        fullMessages = [...messages];
      } else {
        // 没有 system 消息，注入动态构建的人设 prompt
        const animalName = (typeof App !== 'undefined' && App.state.user.animalName) ? App.state.user.animalName : '动物';
        const animalEmoji = (typeof App !== 'undefined' && App.state.user.animalEmoji) ? App.state.user.animalEmoji : '🐾';
        let systemPrompt = PROMPTS.buildSystem(animalName, animalEmoji);

        // RAG 检索补充
        if (typeof RAG !== 'undefined' && RAG._loaded) {
          const lastUserMsg = messages.filter(m => m.role === 'user').pop();
          if (lastUserMsg) {
            const ragContext = await RAG.getContext(lastUserMsg.content, 3);
            if (ragContext) systemPrompt += ragContext;
          }
        }

        fullMessages = [{ role: 'system', content: systemPrompt }, ...messages];
      }

      const response = await fetch(`${LLM_CONFIG.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${LLM_CONFIG.apiKey}`
        },
        body: JSON.stringify({
          model: LLM_CONFIG.model,
          messages: fullMessages,
          temperature: LLM_CONFIG.temperature,
          max_tokens: LLM_CONFIG.maxTokens,
          stream: !!onChunk,  // 有回调就流式
          enable_thinking: false  // ✅ 关闭思考链，提升响应速度
        })
      });

      if (!response.ok) {
        throw new Error(`API错误: ${response.status} ${response.statusText}`);
      }

      // 流式读取
      if (onChunk && response.body) {
        let fullText = '';
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n').filter(l => l.startsWith('data: '));

          for (const line of lines) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            try {
              const json = JSON.parse(data);
              const delta = json.choices?.[0]?.delta?.content;
              if (delta) {
                fullText += delta;
                onChunk(delta);
              }
            } catch (e) { /* skip */ }
          }
        }
        return fullText;
      }

      // 非流式
      const data = await response.json();
      return data.choices?.[0]?.message?.content || '';

    } catch (err) {
      console.error('[LLM] 请求失败:', err);
      // 故事生成请求失败时，抛出错误让调用方使用兜底文案
      const lastUserMsg = messages.filter(m => m.role === 'user').pop();
      if (lastUserMsg && /探险故事|生成.*故事/.test(lastUserMsg.content)) {
        throw err;
      }
      // 普通对话失败时，返回委婉真诚的兜底文案
      const fallback = '非常抱歉😣，当前网络似乎有些不太稳定，红山暂时没法回应您的问题。\n\n不过别担心，探险不会因为这点小插曲而停下脚步！您可以稍后再试，或者先去探索下一个场馆，说不定会有新的发现呢！🌿';
      App.toast('网络似乎不太稳定，请稍后再试');
      if (onChunk) {
        for (const char of fallback) {
          await new Promise(r => setTimeout(r, 30));
          onChunk(char);
        }
      }
      return fallback;
    }
  },

  /**
   * Mock模式 - 不需要API Key的模拟回复
   */
  async mockChat(messages, onChunk) {
    const lastUserMsg = messages.filter(m => m.role === 'user').pop();
    const userText = lastUserMsg?.content || '';

    // 动态获取用户身份
    const animalName = (typeof App !== 'undefined' && App.state.user.animalName) ? App.state.user.animalName : '动物';
    const animalEmoji = (typeof App !== 'undefined' && App.state.user.animalEmoji) ? App.state.user.animalEmoji : '🐾';

    // 模拟回复库（动态适配身份）
    const replies = {
      route: `${animalName}探险家，侦察路线已就绪！🗺️ 让我们出发去探索吧！确定路线吗？`,
      cheetah: `嘘！🤫 猎豹正在睡觉！作为${animalName}，靠近猫科动物领地要十分小心。看那边——狞猫的耳朵在360度转动！像不像雷达？`,
      food: `${animalEmoji} 说到吃的，不同的动物有不同的食谱呢！你想了解哪种动物的觅食方式？`,
      home: `欢迎来到${animalName}的家！${animalEmoji} 这里有很多有趣的故事，你有什么想了解的吗？`,
      default: `收到！继续探险吧，${animalName}探险家！${animalEmoji}🌿`
    };

    let reply = replies.default;
    if (/路线|去哪|想去|猫科/.test(userText)) reply = replies.route;
    else if (/猎豹|猫科|天敌/.test(userText)) reply = replies.cheetah;
    else if (/吃|食物|觅食|蝎子/.test(userText)) reply = replies.food;
    else if (/回家|细尾獴馆|部落/.test(userText)) reply = replies.home;

    // 模拟流式输出
    if (onChunk) {
      for (const char of reply) {
        await new Promise(r => setTimeout(r, 30));
        onChunk(char);
      }
    }
    return reply;
  },

  /**
   * 快捷方法：单轮对话
   */
  async ask(userText, onChunk) {
    return this.chat([
      { role: 'user', content: userText }
    ], onChunk);
  },

  /**
   * 从用户输入中提取动物角色和名字
   * 例: "我是丁满！细尾獴！" → { role:'细尾獴', name:'丁满' }
   */
  async extractIdentity(userText) {
    if (!LLM_CONFIG.enabled) {
      // Mock：简单正则
      const nameMatch = userText.match(/我是(.+?)[！!]/);
      const animalMatch = userText.match(/(细尾獴|狐獴|猫|狼|考拉|熊)/);
      return {
        name: nameMatch ? nameMatch[1] : '丁满',
        role: animalMatch ? animalMatch[1] : '细尾獴'
      };
    }

    const reply = await this.chat([{
      role: 'user',
      content: `从以下用户输入中提取动物角色和名字，返回JSON格式：{"role":"细尾獴","name":"丁满"}\n用户输入：${userText}`
    }]);
    try {
      return JSON.parse(reply.match(/\{[\s\S]*\}/)?.[0] || '{}');
    } catch {
      return { name: '丁满', role: '细尾獴' };
    }
  }
};
