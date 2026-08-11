/**
 * ==================== RAG 检索引擎 ====================
 *
 * 知识库来源：飞书知识库「红山动物园 > 资料」
 *   - 推文内容素材池整理.docx（100条推文标题+链接）
 *   - 2025南京市红山森林动物园讲解稿更新.docx（100个讲解段落，38个场馆分区）
 *
 * 检索策略：
 *   1. 关键词匹配（TF-IDF 简化版，离线可用）
 *   2. 语义匹配（可选：调用 Qwen text-embedding API）
 *
 * 用法：
 *   const results = await RAG.retrieve('细尾獴吃什么', 3);
 *   // → [{content, score, source, heading}, ...]
 */

const RAG = {

  /** 知识库数据（加载后赋值） */
  _kb: null,
  _chunks: [],
  _index: null,  // 倒排索引
  _loaded: false,

  /** 知识库文件路径 */
  _kbPath: 'data/knowledge_base.json',

  /** 停用词 */
  _stopWords: new Set([
    '的', '了', '是', '在', '我', '有', '和', '就', '不', '人', '都', '一',
    '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着',
    '没有', '看', '好', '自己', '这', '那', '它', '他', '她', '们', '什么',
    '怎么', '可以', '能', '被', '从', '把', '让', '给', '为', '与', '及'
  ]),

  /**
   * 初始化：加载知识库并构建倒排索引
   */
  async init() {
    if (this._loaded) return;

    try {
      const response = await fetch(this._kbPath);
      if (!response.ok) {
        throw new Error(`加载知识库失败: ${response.status}`);
      }
      this._kb = await response.json();
      this._chunks = this._kb.chunks || [];
      this._buildIndex();
      this._loaded = true;
      console.log(`[RAG] 知识库已加载: ${this._chunks.length} 个文本块`);
    } catch (err) {
      console.error('[RAG] 初始化失败:', err);
      // 使用空知识库，不阻塞
      this._chunks = [];
      this._index = new Map();
      this._loaded = true;
    }
  },

  /**
   * 构建倒排索引
   */
  _buildIndex() {
    this._index = new Map();  // keyword → Set<chunkIndex>

    // 动物/场馆关键词词典（用于增强匹配）
    const entityDict = {
      '细尾獴': ['细尾獴', '狐獴', '丁满', '迷你沙丘'],
      '猎豹': ['猎豹', '猫科星球'],
      '狞猫': ['狞猫'],
      '美洲豹': ['美洲豹', '小布', '里昂'],
      '薮猫': ['薮猫'],
      '金钱豹': ['金钱豹', '豹'],
      '考拉': ['考拉', '青柠'],
      '狼': ['狼', '天涯', '沃夫', '狼馆'],
      '长颈鹿': ['长颈鹿', '瑞妮', '大草原'],
      '熊猫': ['熊猫', '平平', '和和', '九九', '熊猫馆'],
      '猩猩': ['猩猩', '大猩猩', '黑猩猩'],
      '水獭': ['水獭'],
      '扬子鳄': ['扬子鳄', '鳄鱼'],
      '虎': ['虎', '老虎', '虎馆', '虎山'],
      '熊': ['熊', '黑熊', '棕熊', '熊馆', '熊谷'],
      '小熊猫': ['小熊猫', '高黎贡'],
      '犀牛': ['犀牛', '白犀牛'],
      '象': ['象', '大象', '大象馆'],
      '鸟': ['鸟', '猛禽', '犀鸟', '鹦鹉', '仙鹤'],
      '猫科星球': ['猫科星球', '猎豹', '狞猫', '薮猫', '美洲豹'],
      '丰容': ['丰容', '行为丰容'],
      '哨兵': ['哨兵', '放哨'],
      '天敌': ['天敌'],
      '斑纹': ['斑纹', '实心点', '花瓣', '铜钱'],
      '本土物种': ['本土物种', '保育区', '救助', '放归'],
      '冈瓦纳': ['冈瓦纳'],
      '非洲': ['非洲', '非洲之歌'],
      '澳大利亚': ['澳洲', '袋鼠', '澳大利亚'],
    };

    this._chunks.forEach((chunk, idx) => {
      // 1. 使用预提取的关键词
      if (chunk.keywords) {
        chunk.keywords.forEach(kw => {
          if (!this._index.has(kw)) this._index.set(kw, new Set());
          this._index.get(kw).add(idx);
        });
      }

      // 2. 从标题和文本中提取实体
      const fullText = (chunk.heading + ' ' + chunk.text).toLowerCase();
      for (const [entity, aliases] of Object.entries(entityDict)) {
        for (const alias of aliases) {
          if (fullText.includes(alias.toLowerCase())) {
            if (!this._index.has(entity)) this._index.set(entity, new Set());
            this._index.get(entity).add(idx);
          }
        }
      }
    });

    console.log(`[RAG] 倒排索引构建完成: ${this._index.size} 个关键词`);
  },

  /**
   * 分词（简化版：按字符和空格切分）
   */
  _tokenize(text) {
    // 移除标点和URL
    const cleaned = text.replace(/https?:\/\/[^\s]+/g, '').replace(/[^\u4e00-\u9fff\w\s]/g, ' ');
    const tokens = [];
    // 中文按2-3字组合
    const chineseChars = cleaned.match(/[\u4e00-\u9fff]+/g) || [];
    for (const segment of chineseChars) {
      // 单字
      for (const ch of segment) {
        if (!this._stopWords.has(ch)) tokens.push(ch);
      }
      // 双字
      for (let i = 0; i < segment.length - 1; i++) {
        const bi = segment.substring(i, i + 2);
        if (!this._stopWords.has(bi)) tokens.push(bi);
      }
      // 三字
      for (let i = 0; i < segment.length - 2; i++) {
        const tri = segment.substring(i, i + 3);
        tokens.push(tri);
      }
    }
    // 英文单词
    const englishWords = cleaned.match(/[a-zA-Z]+/g) || [];
    tokens.push(...englishWords.filter(w => w.length > 2));

    return [...new Set(tokens)]; // 去重
  },

  /**
   * 检索知识库
   * @param {string} query - 用户查询
   * @param {number} topK - 返回前K条
   * @returns {Promise<Array<{content, score, source, heading}>>}
   */
  async retrieve(query, topK = 3) {
    if (!this._loaded) {
      await this.init();
    }

    if (this._chunks.length === 0) {
      return [];
    }

    // 1. 关键词匹配
    const queryTokens = this._tokenize(query);
    const scores = new Map();  // chunkIndex → score

    // 实体匹配（高权重）
    for (const [entity, aliases] of Object.entries(this._entityAliases)) {
      for (const alias of aliases) {
        if (query.includes(alias)) {
          const chunkSet = this._index.get(entity);
          if (chunkSet) {
            chunkSet.forEach(idx => {
              scores.set(idx, (scores.get(idx) || 0) + 5.0);
            });
          }
        }
      }
    }

    // Token 匹配
    for (const token of queryTokens) {
      const chunkSet = this._index.get(token);
      if (chunkSet) {
        const idf = Math.log(this._chunks.length / chunkSet.size);
        chunkSet.forEach(idx => {
          scores.set(idx, (scores.get(idx) || 0) + idf + 1.0);
        });
      }
    }

    // 2. 标题匹配加分
    for (let i = 0; i < this._chunks.length; i++) {
      const heading = this._chunks[i].heading;
      if (heading !== '(前言)') {
        for (const token of queryTokens) {
          if (heading.includes(token)) {
            scores.set(i, (scores.get(i) || 0) + 2.0);
          }
        }
      }
    }

    // 3. 排序并返回 topK
    const ranked = [...scores.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, topK);

    return ranked.map(([idx, score]) => ({
      content: this._chunks[idx].text,
      score: parseFloat(score.toFixed(2)),
      source: this._chunks[idx].source,
      heading: this._chunks[idx].heading,
      id: this._chunks[idx].id
    }));
  },

  /** 实体别名表（用于增强检索） */
  _entityAliases: {
    '细尾獴': ['细尾獴', '狐獴', '丁满', '迷你沙丘'],
    '猎豹': ['猎豹', '猫科星球'],
    '狞猫': ['狞猫'],
    '美洲豹': ['美洲豹', '小布', '里昂'],
    '薮猫': ['薮猫'],
    '考拉': ['考拉', '青柠'],
    '狼': ['狼', '天涯', '沃夫'],
    '长颈鹿': ['长颈鹿', '瑞妮', '大草原'],
    '熊猫': ['熊猫', '平平', '和和', '九九'],
    '猩猩': ['猩猩', '大猩猩', '黑猩猩'],
    '水獭': ['水獭'],
    '扬子鳄': ['扬子鳄', '鳄鱼'],
    '虎': ['虎', '老虎'],
    '熊': ['熊', '黑熊', '棕熊'],
    '小熊猫': ['小熊猫', '高黎贡'],
    '丰容': ['丰容', '行为丰容'],
    '哨兵': ['哨兵', '放哨'],
    '天敌': ['天敌'],
    '斑纹': ['斑纹', '实心点', '花瓣', '铜钱'],
    '本土物种': ['本土物种', '保育区', '救助', '放归'],
    '冈瓦纳': ['冈瓦纳'],
    '非洲': ['非洲', '非洲之歌'],
    '澳洲': ['澳洲', '袋鼠', '澳大利亚'],
  },

  /**
   * 构建 RAG 上下文文本（供 LLM system prompt 注入）
   * @param {string} query - 用户查询
   * @param {number} topK - 检索条数
   * @returns {Promise<string>} 格式化的知识上下文
   */
  async getContext(query, topK = 3) {
    const results = await this.retrieve(query, topK);
    if (results.length === 0) {
      return '';
    }

    let context = '\n【知识库参考】\n';
    results.forEach((r, i) => {
      context += `\n[${i + 1}] (来源: ${r.source === 'tuiwen' ? '推文' : '讲解稿'} | ${r.heading})\n`;
      context += r.content.substring(0, 500) + (r.content.length > 500 ? '...' : '');
      context += '\n';
    });

    return context;
  },

  /**
   * 获取知识库统计信息
   */
  getStats() {
    return {
      total_chunks: this._chunks.length,
      total_keywords: this._index ? this._index.size : 0,
      sources: this._kb ? this._kb.sources : [],
      loaded: this._loaded
    };
  }
};
