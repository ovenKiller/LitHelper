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

  // 页面选择器配置
  selectors: {
    // 搜索结果容器
    resultsContainer: ['#gs_res_ccl_mid', '#gs_res_ccl'],
    
    // 论文条目元素
    paperItems: ['.gs_r.gs_or.gs_scl', '.gs_ri'],
    
    // 论文标题
    paperTitle: '.gs_rt a',
    
    // 论文作者信息
    paperAuthors: '.gs_a',
    
    // 论文摘要
    paperAbstract: '.gs_rs',
    
    // 论文链接区域
    paperLinks: '.gs_fl a',
    
    // 引用次数
    citationCount: '.gs_fl a:contains("引用")',
    
    // 相关文章
    relatedArticles: '.gs_fl a:contains("相关文章")',
    
    // PDF链接
    pdfLink: '.gs_or_ggsm a[href$=".pdf"]',
    
    // 版本信息
    versionInfo: '.gs_fl a:contains("版本")'
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
