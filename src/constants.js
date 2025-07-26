/**
 * 平台常量定义
 * 避免在代码中使用魔法值
 */

export const PLATFORM_KEYS = {
  // 搜索平台
  GOOGLE_SCHOLAR: 'googleScholar',
  SEMANTIC_SCHOLAR: 'semanticScholar',
  
  // 论文库平台
  ARXIV: 'arxiv',
  IEEE: 'ieee',
  SCIENCE_DIRECT: 'scienceDirect',
  SPRINGER: 'springer',
  ACM: 'acm'
};

export const PLATFORM_DISPLAY_NAMES = {
  [PLATFORM_KEYS.GOOGLE_SCHOLAR]: 'Google Scholar',
  [PLATFORM_KEYS.SEMANTIC_SCHOLAR]: 'Semantic Scholar',
  [PLATFORM_KEYS.ARXIV]: 'arXiv',
  [PLATFORM_KEYS.IEEE]: 'IEEE Xplore',
  [PLATFORM_KEYS.SCIENCE_DIRECT]: 'ScienceDirect',
  [PLATFORM_KEYS.SPRINGER]: 'Springer',
  [PLATFORM_KEYS.ACM]: 'ACM Digital Library'
};

export const PLATFORM_TYPES = {
  SEARCH: 'search',
  REPOSITORY: 'repository'
};

/**
 * 任务状态常量
 */
export const TASK_STATUS = {
  PENDING: 'pending',          // 等待执行
  EXECUTING: 'executing',      // 正在执行
  COMPLETED: 'completed',      // 已成功执行
  FAILED: 'failed'            // 已执行出错
};

/**
 * 任务类型常量
 */
export const TASK_TYPE = {
  SUMMARIZATION: 'summarization',        // 总结任务
  DOWNLOAD: 'download',                  // 下载任务
  METADATA_EXTRACTION: 'metadata_extraction',  // 元数据提取任务
  PAPER_ANALYSIS: 'paper_analysis',      // 论文分析任务
  CITATION_EXTRACTION: 'citation_extraction'   // 引用提取任务
};

/**
 * AI爬虫任务类型常量
 */
export const SUPPORTED_TASK_TYPES = {
  PAPER_ELEMENT_CRAWLER: 'paper_element_crawler'
};

/**
 * 队列配置常量
 */
export const QUEUE_CONFIG = {
  DEFAULT_EXECUTION_QUEUE_SIZE: 3,       // 默认执行队列大小
  DEFAULT_WAITING_QUEUE_SIZE: 10,        // 默认等待队列大小
  PROCESSING_INTERVAL: 1000,             // 队列处理间隔(毫秒)
  MAX_RETRY_TIMES: 3                     // 最大重试次数
};

/**
 * 持久化策略常量
 */
export const PERSISTENCE_STRATEGY = {
  NONE: 'none',                          // 不持久化
  FIXED_DAYS: 'fixed_days',             // 保存固定天数
  FIXED_COUNT: 'fixed_count'            // 保存固定条数
};

/**
 * 队列类型常量
 */
export const QUEUE_TYPE = {
  EXECUTION: 'execution',                // 执行队列
  WAITING: 'waiting',                    // 等待队列
  COMPLETED: 'completed',                // 已完成队列
  FAILED: 'failed'                       // 失败队列
};

/**
 * 获取平台显示名称
 * @param {string} platformKey - 平台键名
 * @returns {string} 显示名称
 */
export function getPlatformDisplayName(platformKey) {
  return PLATFORM_DISPLAY_NAMES[platformKey] || platformKey;
}

/**
 * 根据显示名称获取平台键名
 * @param {string} displayName - 显示名称
 * @returns {string|null} 平台键名
 */
export function getPlatformKeyByDisplayName(displayName) {
  for (const [key, name] of Object.entries(PLATFORM_DISPLAY_NAMES)) {
    if (name === displayName) {
      return key;
    }
  }
  return null;
}

/**
 * 获取任务状态显示名称
 * @param {string} status - 任务状态
 * @returns {string} 显示名称
 */
export function getTaskStatusDisplayName(status) {
  const statusNames = {
    [TASK_STATUS.PENDING]: '等待执行',
    [TASK_STATUS.EXECUTING]: '正在执行',
    [TASK_STATUS.COMPLETED]: '已完成',
    [TASK_STATUS.FAILED]: '执行失败'
  };
  return statusNames[status] || status;
}

/**
 * 获取任务类型显示名称
 * @param {string} type - 任务类型
 * @returns {string} 显示名称
 */
export function getTaskTypeDisplayName(type) {
  const typeNames = {
    [TASK_TYPE.SUMMARIZATION]: '论文总结',
    [TASK_TYPE.DOWNLOAD]: '文件下载',
    [TASK_TYPE.METADATA_EXTRACTION]: '元数据提取',
    [TASK_TYPE.PAPER_ANALYSIS]: '论文分析',
    [TASK_TYPE.CITATION_EXTRACTION]: '引用提取'
  };
  return typeNames[type] || type;
}

/**
 * 网页类型常量
 */
export const PAGE_TYPE = {
  SEARCH_RESULTS: 'search_results',      // 搜索结果页
  PAPER_DETAIL: 'paper_detail'           // 论文详情页
};

/**
 * 提取器类型常量
 */
export const EXTRACTOR_TYPE = {
  PAPER_ITEM: 'paper_item',              // 论文项提取器
  TITLE: 'title',                        // 题目提取器
  PDF: 'pdf',                            // PDF提取器
  ABSTRACT: 'abstract',                  // 摘要提取器
  ALL_VERSIONS_LINK: 'all_versions_link' // 所有版本链接提取器
};

/**
 * 选择器模式常量
 */
export const SELECTOR_MODE = {
  CSS: 'css',                            // CSS选择器模式
  REGEX: 'regex'                         // 正则表达式模式
};
