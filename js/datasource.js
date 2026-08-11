/**
 * ==================== 数据源抽象层 DataSource ====================
 *
 * 架构原则:
 *   - 业务代码只依赖 DataSourceFactory 返回的接口对象，不依赖具体实现
 *   - Mock 实现是默认实现，Demo 可独立运行不依赖外部服务
 *   - Real 实现是 plug-in，后续接入真实服务时只需实现接口 + 改 CONFIG.mode
 *   - 所有接口返回 Promise，支持 async/await
 *
 * 用法:
 *   const ds = DataSourceFactory.get();
 *   const reply = await ds.llm.chat(messages, onChunk);
 *   const venueInfo = await ds.mcp.callTool('get_venue_info', { name: '猫科星球' });
 *   const knowledge = await ds.rag.retrieve('细尾獴吃什么', 3);
 *   const weather = await ds.api.getWeather();
 */

// ==================== 全局配置 ====================
const CONFIG = {
  /**
   * 数据源模式: 'mock' | 'real'
   * - 'mock': 使用 Mock 实现（默认，Demo 独立运行）
   * - 'real': 使用真实实现（需配置各 Source 的连接信息）
   */
  dataSource: {
    mode: 'real'  // ✅ 已启用真实 LLM（Qwen3-Max / FunASR）
  },

  /** LLM 配置（复用 llm.js 中的 LLM_CONFIG） */
  llm: {
    // 具体配置见 llm.js 顶部 LLM_CONFIG
    // 此处仅作为 DataSourceFactory 读取入口
    get enabled() { return typeof LLM_CONFIG !== 'undefined' && LLM_CONFIG.enabled; }
  },

  /** 后端代理 URL（生产环境用于隐藏 API Key） */
  apiProxyUrl: null  // 例: 'https://your-server.com/api/llm-proxy'
};


// ==================== 接口定义（文档用，JS 无 interface） ====================
/**
 * interface LLMSource {
 *   async chat(messages: Array<{role, content}>, onChunk?: Function): Promise<string>
 *   async generateStory(context: Object, onChunk?: Function): Promise<string>
 *   async extractIdentity(text: string): Promise<{role, name}>
 * }
 *
 * interface MCPSource {
 *   async callTool(toolName: string, params: Object): Promise<any>
 *   async listTools(): Promise<Array<string>>
 * }
 *
 * interface APISource {
 *   async getWeather(): Promise<{temp, condition, suggestion}>
 *   async getVenueSchedule(venueName: string): Promise<{open, close, feedingTime}>
 *   async get CrowdInfo(venueName: string): Promise<{level, count}>
 * }
 *
 * interface RAGSource {
 *   async retrieve(query: string, topK?: number): Promise<Array<{content, score, source}>>
 * }
 */


// ==================== Mock LLM Source ====================
const MockLLMSource = {
  /**
   * 对话 — 复用 llm.js 中的 LLM.mockChat
   */
  async chat(messages, onChunk) {
    if (typeof LLM !== 'undefined' && LLM.mockChat) {
      return LLM.mockChat(messages, onChunk);
    }
    // fallback
    const reply = '收到！继续探险吧，小哨兵们！🦊🌿';
    if (onChunk) {
      for (const char of reply) {
        await new Promise(r => setTimeout(r, 30));
        onChunk(char);
      }
    }
    return reply;
  },

  /**
   * 生成探险故事 — 根据上下文组装故事 prompt 调用 LLM
   */
  async generateStory(context, onChunk) {
    const { userName, animalName, animalEmoji, companionNames, route, footprints, photos, chatHighlights } = context;
    const aName = animalName || '动物';
    const aEmoji = animalEmoji || '🐾';

    // 构建故事 prompt（动态适配身份）
    const storyPrompt = `你是"红山"AI导游。请根据以下信息，为${aName}探险家生成一段探险故事。

【角色】
- 主角：${userName || '探险家'}（${aName}）
- 伙伴：${(companionNames || []).join('、')}

【游览路线】
${(route || []).map((s, i) => `${i+1}. ${s.name} (${s.time || ''})`).join('\n')}

【拍照打卡】
${(photos || []).map(p => `- ${p}`).join('\n') || '无'}

【对话亮点】
${(chatHighlights || []).map(h => `- ${h}`).join('\n') || '无'}

请生成一段 300-500 字的探险故事，要求：
1. 以第三人称叙事，把游览过程包装成${aName}的冒险
2. 融入科普知识点（天敌、觅食、行为丰容等）
3. 以"回到人类世界"的温暖结尾收束
4. 语气活泼有冒险感，适合 7 岁孩子理解`;

    if (typeof LLM !== 'undefined' && LLM.mockChat) {
      return LLM.mockChat([{ role: 'user', content: storyPrompt }], onChunk);
    }

    // fallback story（动态适配身份）
    const story = `清晨的阳光洒在红山森林动物园，${aName}探险家${userName || '探险家'}带着伙伴${(companionNames || []).join('和')}，从南门出发了。${aEmoji}

一路走来，他们参观了${(route || []).slice(0, 3).map(s => s.name).join('、')}等场馆。每到一处，都有新的发现和惊喜——动物们的行为、习性、与${aName}的关系，都让探险家着迷。

${(photos || []).length > 0 ? `途中还拍下了精彩的照片：${photos.join('、')}。` : ''}每一次对话都解锁了新的知识点，让这次冒险更加丰富。

夕阳西下，${aName}探险家带着满满的知识和回忆，回到了人类世界。这一天的冒险，将永远留在他们的心中。${aEmoji}🌿`;

    if (onChunk) {
      for (const char of story) {
        await new Promise(r => setTimeout(r, 30));
        onChunk(char);
      }
    }
    return story;
  },

  /**
   * 从用户输入提取动物角色和名字
   */
  async extractIdentity(text) {
    if (typeof LLM !== 'undefined' && LLM.extractIdentity) {
      return LLM.extractIdentity(text);
    }
    const nameMatch = text.match(/我是(.+?)[！!]/);
    const animalMatch = text.match(/(细尾獴|狐獴|猫|狼|考拉|熊)/);
    return {
      name: nameMatch ? nameMatch[1] : '丁满',
      role: animalMatch ? animalMatch[1] : '细尾獴'
    };
  }
};


// ==================== Real LLM Source ====================
const RealLLMSource = {
  async chat(messages, onChunk) {
    if (typeof LLM !== 'undefined' && LLM.chat) {
      return LLM.chat(messages, onChunk);
    }
    throw new Error('LLM module not loaded');
  },

  async generateStory(context, onChunk) {
    const { userName, animalName, animalEmoji, companionNames, route, photos, chatHighlights } = context;
    const aName = animalName || '动物';
    const storyPrompt = `你是"红山"AI导游。请根据以下信息，为${aName}探险家生成一段探险故事。

【角色】主角：${userName || '探险家'}（${aName}），伙伴：${(companionNames || []).join('、')}

【游览路线】
${(route || []).map((s, i) => `${i+1}. ${s.name}`).join('\n')}

【拍照打卡】
${(photos || []).map(p => `- ${p}`).join('\n') || '无'}

请生成300-500字的探险故事，以第三人称叙事，把游览过程包装成${aName}的冒险，融入科普知识，以温暖结尾收束。`;

    if (typeof LLM !== 'undefined') {
      return LLM.chat([{ role: 'user', content: storyPrompt }], onChunk);
    }
    throw new Error('LLM module not loaded');
  },

  async extractIdentity(text) {
    if (typeof LLM !== 'undefined' && LLM.extractIdentity) {
      return LLM.extractIdentity(text);
    }
    throw new Error('LLM module not loaded');
  }
};


// ==================== Mock MCP Source ====================
/**
 * 模拟 MCP (Model Context Protocol) 工具调用
 * 后续真实接入时，替换为 MCP Server 的 WebSocket/SSE 通信
 */
const MockMCPSource = {
  // 预置工具列表
  _tools: ['get_venue_info', 'get_animal_story', 'plan_route', 'check_weather', 'find_nearest_facility'],

  // 场馆信息数据库
  _venueDB: {
    '猫科星球': {
      name: '猫科星球',
      animals: ['猎豹', '狞猫', '美洲豹(小布&里昂)', '薮猫'],
      description: '猫科星球是红山动物园的猫科动物集中展区，住着多种猫科动物。',
      highlights: [
        '猎豹是陆地上跑得最快的动物，时速可达120公里',
        '狞猫的耳朵能360度转动，像雷达一样灵敏',
        '美洲豹咬合力极强，捕猎时直接咬碎猎物颅骨',
        '薮猫常被误认为猎豹幼崽，但斑纹不同'
      ],
      feedingTime: '10:00',
      bestVisitTime: '上午9:00-11:00'
    },
    '细尾獴馆': {
      name: '细尾獴馆',
      animals: ['细尾獴（丁满原型）'],
      description: '细尾獴又叫狐獴，生活在南非喀拉哈里沙漠。红山的细尾獴馆有迷你沙丘展区。',
      highlights: [
        '丁满正是卡通形象"丁满"的原型',
        '群居等级制度： Alpha 雌性领导整个家族',
        '哨兵制度：轮流站岗放哨，发现天敌发出警报',
        '挖洞高手：用锋利爪子挖出复杂的地道系统'
      ],
      feedingTime: '12:30',
      bestVisitTime: '全天'
    },
    '考拉馆': {
      name: '考拉馆',
      animals: ['考拉青柠'],
      description: '考拉青柠是红山的明星，被称为"栖架征服者"。',
      highlights: ['考拉每天要睡18-22小时', '青柠两岁了，正在学习独立', '考拉只吃桉树叶'],
      feedingTime: '9:00',
      bestVisitTime: '上午9:00-10:00'
    },
    '狼馆': {
      name: '狼馆',
      animals: ['新狼王天涯', '老狼王沃夫'],
      description: '新狼王天涯接替老狼王沃夫，承其风骨。',
      highlights: ['狼群有严格的等级制度', '新狼王天涯年轻力壮，带领狼群巡猎', ' wolves howl to communicate'],
      feedingTime: '11:30',
      bestVisitTime: '上午11:00-12:00'
    },
    '高黎贡': {
      name: '高黎贡小熊猫馆',
      animals: ['小熊猫'],
      description: '高黎贡展区展示小熊猫等珍稀物种。',
      highlights: ['小熊猫不是小浣熊', '喜欢在树上活动', '吃竹子和水果'],
      feedingTime: '10:30',
      bestVisitTime: '上午10:00-11:00'
    }
  },

  // 动物故事数据库
  _storyDB: {
    '细尾獴': {
      title: '小王子：我居然被"背叛"了',
      content: '在细尾獴的族群中，有着严格的等级制度。Alpha 雌性领导整个家族，其他成员各有分工。哨兵轮流站岗，发现天敌就发出警报声，让家族成员迅速躲进地洞。小王子曾经是家族的骄傲，但一次"背叛"让他重新理解了信任和责任……',
      source: '推文《小王子：我居然被"背叛"了》'
    },
    '猎豹': {
      title: '猫科斑纹口诀',
      content: '猎豹的斑纹是实心点状的，美洲豹的斑纹像花瓣中间有花心，金钱豹是空心铜钱状。记住这个口诀就能分辨！红山的饲养员把肉藏在纸盒、纸筒、藤球里，让猫科们像在野外捕猎一样觅食，这就是"行为丰容"。',
      source: '猫科星球讲解词'
    },
    '考拉': {
      title: '考拉青柠，两岁咯',
      content: '考拉青柠是红山的明星，被称为"栖架征服者"。两岁的青柠正在学习独立生活。考拉每天要睡18-22小时，醒来就吃桉树叶。它们的新陈代谢很慢，所以总是懒洋洋的。',
      source: '推文《考拉青柠，两岁咯》'
    },
    '狼': {
      title: '承其风骨，新狼王注定是他',
      content: '新狼王天涯接替老狼王沃夫，成为狼群的新领袖。天涯年轻力壮，承其风骨，带领狼群巡猎。狼群有严格的等级制度，头狼享有优先进食权。',
      source: '推文《承其风骨，新狼王注定是他》'
    },
    '长颈鹿': {
      title: '大草原上来了一位小小公主',
      content: '长颈鹿宝宝瑞妮是红山的新成员，被称为"大草原上的小公主"。瑞妮正在学习适应新环境，饲养员为它准备了特别的丰容设施。',
      source: '推文《大草原上来了一位小小公主》'
    }
  },

  async callTool(toolName, params = {}) {
    // 模拟网络延迟
    await new Promise(r => setTimeout(r, 300 + Math.random() * 200));

    switch (toolName) {
      case 'get_venue_info': {
        const venue = this._venueDB[params.name];
        if (!venue) return { error: `未找到场馆: ${params.name}` };
        return venue;
      }

      case 'get_animal_story': {
        const story = this._storyDB[params.animal || params.name];
        if (!story) return { error: `未找到动物故事: ${params.animal || params.name}` };
        return story;
      }

      case 'plan_route': {
        // 模拟路线规划
        const { venues = [], startTime = '9:00', endTime = '15:00', restCount = 3 } = params;
        return {
          route: venues.map((v, i) => ({
            name: v,
            time: `${9 + i}:00-${9 + i}:20`,
            order: i + 1
          })),
          totalTime: '6小时',
          restPoints: restCount
        };
      }

      case 'check_weather': {
        return { temp: 26, condition: '晴', suggestion: '适合户外游览，注意防晒' };
      }

      case 'find_nearest_facility': {
        const { type = 'restaurant', currentLocation = '猫科星球' } = params;
        const facilities = {
          restaurant: { name: '猫科餐厅', distance: '50米', direction: '前方左转' },
          restroom: { name: '卫生间', distance: '30米', direction: '右后方' },
          exit: { name: '南门', distance: '200米', direction: '前方直走' }
        };
        return facilities[type] || facilities.restaurant;
      }

      default:
        return { error: `未知工具: ${toolName}` };
    }
  },

  async listTools() {
    return [...this._tools];
  }
};


// ==================== Real MCP Source（占位，后续实现） ====================
const RealMCPSource = {
  // TODO: 接入真实 MCP Server
  // 需要通过 WebSocket 或 SSE 连接 MCP Server
  // const ws = new WebSocket(CONFIG.mcp.serverUrl);
  // ws.send(JSON.stringify({ tool: toolName, params }));
  async callTool(toolName, params) {
    throw new Error(`RealMCPSource 尚未实现 — tool: ${toolName}`);
  },
  async listTools() {
    throw new Error('RealMCPSource 尚未实现');
  }
};


// ==================== Mock API Source ====================
/**
 * 模拟外部 REST API 调用
 * 后续真实接入时，替换为后端代理的 fetch 请求
 */
const MockAPISource = {
  async getWeather() {
    await new Promise(r => setTimeout(r, 200));
    return { temp: 26, condition: '晴', humidity: 65, suggestion: '适合户外游览，记得防晒！☀️' };
  },

  async getVenueSchedule(venueName) {
    await new Promise(r => setTimeout(r, 200));
    const schedules = {
      '猫科星球': { open: '8:30', close: '17:00', feedingTime: '10:00', crowdLevel: '中等' },
      '细尾獴馆': { open: '8:30', close: '17:00', feedingTime: '12:30', crowdLevel: '较少' },
      '考拉馆': { open: '8:30', close: '17:00', feedingTime: '9:00', crowdLevel: '较多' },
      '狼馆': { open: '8:30', close: '17:00', feedingTime: '11:30', crowdLevel: '中等' }
    };
    return schedules[venueName] || { open: '8:30', close: '17:00', feedingTime: '未知', crowdLevel: '未知' };
  },

  async getCrowdInfo(venueName) {
    await new Promise(r => setTimeout(r, 200));
    return { venue: venueName, level: '中等', count: 15 + Math.floor(Math.random() * 20) };
  }
};


// ==================== Real API Source（占位） ====================
const RealAPISource = {
  // TODO: 接入真实后端 API
  // async getWeather() {
  //   const res = await fetch(`${CONFIG.api.baseUrl}/weather`);
  //   return res.json();
  // }
  async getWeather() { throw new Error('RealAPISource 尚未实现'); },
  async getVenueSchedule(venueName) { throw new Error('RealAPISource 尚未实现'); },
  async getCrowdInfo(venueName) { throw new Error('RealAPISource 尚未实现'); }
};


// ==================== Mock RAG Source ====================
/**
 * 模拟 RAG (Retrieval-Augmented Generation) 知识检索
 * 后续真实接入时，替换为向量数据库查询 + embedding
 */
const MockRAGSource = {
  // 知识库条目（从 PRD 内容资产素材池提取）
  _knowledgeBase: [
    {
      id: 'kb_001',
      content: '细尾獴是"肉食爱好者"，甲虫、白蚁、蟋蟀都是美味佳肴！它们用锋利的爪子快速刨开沙土，用灵敏的鼻子嗅探，哪怕昆虫藏在地下几厘米深也能精准找到。饲养员会给它们准备活的昆虫，让它们体验"自己觅食"的乐趣——这叫"行为丰容"。',
      source: '细尾獴讲解词',
      tags: ['细尾獴', '觅食', '行为丰容', '食物']
    },
    {
      id: 'kb_002',
      content: '细尾獴是吃蝎子的高手！会快速用爪子去掉蝎子的毒刺然后一口吞掉。它们的叫声能传递信息——短而急促是发现猎物的信号，悠长的叫声是提醒同伴警惕天敌。',
      source: '细尾獴讲解词',
      tags: ['细尾獴', '蝎子', '叫声', '通讯']
    },
    {
      id: 'kb_003',
      content: '细尾獴用排泄物来标记领地和传递信息。每只细尾獴的排泄物气味都不同，就像它们的"名片"一样，告诉其他家族成员"我来过这里"。哨兵会站在高处放哨，发现危险就发出警报声。',
      source: '细尾獴讲解词',
      tags: ['细尾獴', '标记领地', '排泄', '哨兵']
    },
    {
      id: 'kb_004',
      content: '猎豹是细尾獴的头号天敌！猎豹是陆地上跑得最快的动物，时速可达120公里。但猎豹只能短距离冲刺，长时间奔跑会导致体温过高。在红山动物园，猎豹通常在上午比较活跃。',
      source: '猫科星球讲解词',
      tags: ['猎豹', '天敌', '速度', '猫科']
    },
    {
      id: 'kb_005',
      content: '猫科斑纹口诀：猎豹的斑纹是实心点状的，美洲豹的斑纹像花瓣中间有花心，金钱豹是空心铜钱状。狞猫的耳朵能360度转动，比细尾獴的听力还厉害！美洲豹是丛林霸主，咬合力极强。',
      source: '猫科星球讲解词',
      tags: ['猫科', '斑纹', '狞猫', '美洲豹', '猎豹']
    },
    {
      id: 'kb_006',
      content: '红山的饲养员从不会让猫科动物们"好好吃饭"。他们把肉藏在纸盒、纸筒、藤球里，甚至埋在雪里和生态垫层里，让猫科们像在野外捕猎一样，靠自己的努力吃到食物。这就是红山的"动物福利"和"行为丰容"。',
      source: '猫科星球讲解词',
      tags: ['行为丰容', '动物福利', '猫科', '饲养员']
    },
    {
      id: 'kb_007',
      content: '细尾獴又叫狐獴，生活在南非喀拉哈里沙漠，进化出了超强挖洞本领。它们有群居等级制度，Alpha 雌性领导整个家族。丁满正是卡通形象"丁满"的原型。',
      source: '细尾獴讲解词',
      tags: ['细尾獴', '狐獴', '南非', '群居', '等级制度', '丁满']
    },
    {
      id: 'kb_008',
      content: '美洲豹小布是妈妈，她最爱泡澡玩球。旁边大一圈的是爸爸里昂，领地意识超强，有时候会发出像摩托车的吼叫宣示领地。薮猫经常被误认成猎豹幼崽，因为身上也有斑点。',
      source: '猫科星球讲解词',
      tags: ['美洲豹', '小布', '里昂', '薮猫', '猫科']
    },
    {
      id: 'kb_009',
      content: '新狼王天涯接替老狼王沃夫，承其风骨，成为狼群的新领袖。狼群有严格的等级制度，头狼享有优先进食权。狼群通过嚎叫来沟通和宣示领地。',
      source: '推文《承其风骨，新狼王注定是他》',
      tags: ['狼', '狼王', '天涯', '沃夫', '等级制度']
    },
    {
      id: 'kb_010',
      content: '考拉青柠是红山的明星，被称为"栖架征服者"。考拉每天要睡18-22小时，醒来就吃桉树叶。它们的新陈代谢很慢，所以总是懒洋洋的。青柠两岁了，正在学习独立。',
      source: '推文《考拉青柠，两岁咯》',
      tags: ['考拉', '青柠', '桉树', '睡眠']
    }
  ],

  /**
   * 检索相关知识
   * @param {string} query - 查询文本
   * @param {number} topK - 返回条数（默认 3）
   * @returns {Promise<Array<{id, content, source, score, tags}>>}
   */
  async retrieve(query, topK = 3) {
    // 模拟向量检索延迟
    await new Promise(r => setTimeout(r, 200 + Math.random() * 100));

    const queryLower = query.toLowerCase();

    // 简单关键词匹配（真实实现用 embedding 相似度）
    const scored = this._knowledgeBase.map(entry => {
      let score = 0;
      const contentLower = entry.content.toLowerCase();
      const tagsLower = entry.tags.map(t => t.toLowerCase());

      // 关键词匹配
      queryLower.split(/\s+/).forEach(word => {
        if (word.length < 2) return;
        if (contentLower.includes(word)) score += 2;
        if (tagsLower.some(t => t.includes(word))) score += 3;
      });

      // 主题匹配
      const topics = ['细尾獴', '猎豹', '猫科', '狼', '考拉', '行为丰容', '觅食', '天敌', '哨兵', '斑纹'];
      topics.forEach(topic => {
        if (query.includes(topic) && entry.tags.some(t => t.includes(topic))) {
          score += 5;
        }
      });

      return { ...entry, score };
    });

    return scored
      .filter(e => e.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }
};


// ==================== Real RAG Source（接入 rag.js 知识库） ====================
/**
 * 真实 RAG 检索 — 使用 rag.js 中的 RAG 引擎
 * 知识库来源：飞书知识库「红山动物园 > 资料」的讲解稿和推文
 */
const RealRAGSource = {
  /**
   * 检索相关知识
   * @param {string} query - 查询文本
   * @param {number} topK - 返回条数（默认 3）
   * @returns {Promise<Array<{id, content, source, score, heading, tags}>>}
   */
  async retrieve(query, topK = 3) {
    if (typeof RAG === 'undefined') {
      console.warn('[RAGSource] RAG 模块未加载，回退到 MockRAGSource');
      return MockRAGSource.retrieve(query, topK);
    }

    try {
      const results = await RAG.retrieve(query, topK);
      // 转换格式以兼容 MockRAGSource 的返回结构
      return results.map(r => ({
        id: r.id,
        content: r.content,
        source: r.source === 'tuiwen' ? '推文内容素材池' : (r.source === 'jiangjie_gao' ? '讲解稿' : r.source),
        score: r.score,
        heading: r.heading,
        tags: []  // RAG 引擎返回的 keywords 在 retrieve 中已用于匹配
      }));
    } catch (err) {
      console.error('[RAGSource] 检索失败:', err);
      return MockRAGSource.retrieve(query, topK);
    }
  }
};


// ==================== DataSource Factory ====================
/**
 * 数据源工厂 — 根据 CONFIG.dataSource.mode 返回对应实现
 * 业务代码只调用 DataSourceFactory.get()，不直接引用具体实现
 */
const DataSourceFactory = {
  _instance: null,

  /**
   * 获取数据源实例
   * @returns {{llm, mcp, api, rag}}
   */
  get() {
    if (this._instance) return this._instance;

    const isMock = CONFIG.dataSource.mode === 'mock';

    this._instance = {
      llm: isMock ? MockLLMSource : RealLLMSource,
      mcp: isMock ? MockMCPSource : RealMCPSource,
      api: isMock ? MockAPISource : RealAPISource,
      rag: isMock ? MockRAGSource : RealRAGSource
    };

    console.log(`[DataSourceFactory] Initialized in '${CONFIG.dataSource.mode}' mode`);
    return this._instance;
  },

  /**
   * 切换模式（运行时切换）
   * @param {string} mode - 'mock' | 'real'
   */
  setMode(mode) {
    CONFIG.dataSource.mode = mode;
    this._instance = null; // 强制下次 get() 时重新创建
    console.log(`[DataSourceFactory] Mode switched to '${mode}'`);
  }
};
