/**
 * Google Scholar 平台配置
 * 包含页面选择器和相关配置信息
 */

import { PLATFORM_KEYS } from '../../../constants.js';

export const googleScholarConfig = {
  // 平台标识
  platformKey: PLATFORM_KEYS.GOOGLE_SCHOLAR,
  
  // 平台信息
  platformInfo: {
    name: 'Google Scholar',
    baseUrl: 'https://scholar.google.com',
    description: 'Google Scholar 学术搜索引擎'
  },

  // 其他配置
  options: {
    // 最大提取论文数量
    maxPapersPerPage: 10,
    
    // 是否启用详细日志
    enableVerboseLogging: false,
    
    // 元素加载等待时间(毫秒)
    loadWaitTime: 1000,
    
    // 重试次数
    retryCount: 3
  }
};

export default googleScholarConfig;
