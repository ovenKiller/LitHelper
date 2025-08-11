/**
 * Paper.js
 * 
 * Defines the data structure for a research paper
 */

/**
 * @typedef {Object} PaperProperties
 * @property {string} id - Unique identifier for the paper
 * @property {string} title - Title of the paper
 * @property {string} authors - Authors string
 * @property {string} abstract - Abstract of the paper
 * @property {string[]} urls - URLs to the paper
 * @property {string} pdfUrl - URL to download the PDF
 * @property {string} publicationDate - Publication date
 * @property {string} venue - Conference or journal name
 * @property {string[]} keywords - Keywords associated with the paper
 * @property {number} citationCount - Number of citations
 * @property {string} platform - Platform identifier (e.g., "googleScholar", "ieee")
 * @property {string} allVersionsUrl - URL to all versions of the paper
 * @property {Object} metadata - Additional platform-specific metadata
 */

/**
 * Represents a research paper.
 */
class Paper {
  /**
   * Creates an instance of Paper.
   * @param {Partial<PaperProperties & { element: HTMLElement, sourceUrl: string }>} initialData - Initial data for the paper.
   */
  constructor(initialData = {}) {
    /** @type {string} */
    this.id = initialData.id || ''; //注意不同平台之间的数据，id应该保证唯一性
    /** @type {string} */
    this.title = initialData.title || '';
    /** @type {string} */
    this.authors = typeof initialData.authors === 'string' ? initialData.authors : (Array.isArray(initialData.authors) ? initialData.authors.join(', ') : '');
    /** @type {string} */
    this.abstract = initialData.abstract || '';
    /** @type {string[]} */
    this.urls = initialData.urls || []; // 修复：添加缺失的urls属性初始化
    /** @type {string} */
    this.pdfUrl = initialData.pdfUrl || '';
    /** @type {string[]} */
    this.keywords = initialData.keywords || [];
    /** @type {number} */
    this.citationCount = initialData.citationCount || 0;
    /** @type {string} */
    this.platform = initialData.platform || initialData.source || '';
    /** @type {string}  专门在googleScholar平台下使用*/
    this.allVersionsUrl = initialData.allVersionsUrl || '';
    /** @type {HTMLElement | null} */
    this.element = initialData.element || null;
    /** @type {string} */
    this.sourceUrl = initialData.sourceUrl || '';
    /** @type {string} */
    this.updateTime = initialData.updateTime || new Date().toISOString();
    /** @type {boolean} 标记当前论文是否在处理中*/
    this.processing = initialData.processing || false;
  }

  /**
   * 获取论文的主URL
   * @returns {string} 主URL，如果不存在则返回空字符串
   */
  getMainUrl() {
    return this.urls.length > 0 ? this.urls[0] : '';
  }

  /**
   * 添加URL到urls数组
   * @param {string} url 要添加的URL
   * @returns {boolean} 是否添加成功
   */
  addUrl(url) {
    if (!url || typeof url !== 'string') return false;
    if (!this.urls.includes(url)) {
      this.urls.push(url);
      return true;
    }
    return false;
  }

  /**
   * 从普通对象创建Paper实例（用于从存储中恢复数据）
   * @param {Object} data - 普通对象数据
   * @returns {Paper} Paper实例
   */
  static fromObject(data) {
    if (!data || typeof data !== 'object') {
      return new Paper();
    }

    // 创建新的Paper实例，确保所有属性都被正确设置
    const paper = new Paper({
      id: data.id,
      title: data.title,
      authors: Array.isArray(data.authors) ? data.authors.join(', ') : (data.authors || ''),
      abstract: data.abstract,
      urls: Array.isArray(data.urls) ? data.urls : [],
      pdfUrl: data.pdfUrl,
      keywords: Array.isArray(data.keywords) ? data.keywords : [],
      citationCount: data.citationCount,
      platform: data.platform || data.source,
      allVersionsUrl: data.allVersionsUrl,
      sourceUrl: data.sourceUrl,
      updateTime: data.updateTime,
      processing: data.processing
    });

    // element属性不能被序列化，所以不需要恢复
    return paper;
  }

  /**
   * 检查是否有PDF链接
   * @returns {boolean} 是否有PDF链接
   */
  hasPdf() {
    return !!this.pdfUrl && this.pdfUrl.trim() !== '';
  }

  //未来可以在这里添加更多与Paper对象交互的方法
  //例如：
  // hasPdf() {
  //   return !!this.pdfUrl;
  // }
  //
  // generateId() {
  //   if (this.title && this.authors.length > 0) {
  //     const key = `${this.platform}-${this.title}-${this.authors.join(',')}`;
  //     // This is a placeholder for a more robust ID generation strategy
  //     // For example, using a hashing function like SHA-256
  //     // For simplicity, using btoa for now if in a browser context, or a simple string otherwise
  //     try {
  //       return typeof window !== 'undefined' && window.btoa ? window.btoa(key) : key;
  //     } catch (e) {
  //       return key; // Fallback if btoa fails or is not available
  //     }
  //   }
  //   return '';
  // }
}

/**
 * @typedef {Object} PaperSummary
 * @property {string} paperId - ID of the summarized paper
 * @property {string} summary - Generated summary
 * @property {Object} categories - Categorization results
 * @property {string} createdAt - Timestamp when the summary was created
 * @property {string} llmProvider - The LLM provider used for summarization
 * @property {Object} additionalInfo - Any additional information
 */

export { Paper }; 