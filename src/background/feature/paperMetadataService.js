/**
 * 功能定位：
 * 论文数据填充，即根据论文的URL，获取到该论文的详细信息。同时维护爬虫的所有select路径信息。
 * 底层依赖于httpParseService(爬虫)、AIService（自动信息提取）、storageService（保存爬虫路径）、configManager（调用AI模型前需要模型配置）
 * 
 */

import { logger } from '../../util/logger.js';
import { httpService } from '../util/httpService.js';
import { Paper } from '../../model/Paper.js';
// 内部状态，存储论文元数据
let papersCache = {};

// 请求队列相关配置
const requestQueue = [];
let processingQueue = false;
const MAX_CONCURRENT_REQUESTS = 3; // 最大并发请求数
let activeRequests = 0; // 当前活跃请求数

/**
 * 获取特定论文的详情。
 * 上层业务调用方法，实现队列控制和缓存检查。
 * @param {Object|Paper} paper - 论文对象，至少包含id属性。
 * @returns {Promise<object>} 包含操作结果和论文数据（如果成功）。
 */
async function getPaperDetails(paper) {
  // 确保传入的是有效对象并且至少有id
  if (!paper || !paper.id) {
    logger.error('[PaperMetadataService] Invalid paper object provided to getPaperDetails');
    return {
      success: false,
      error: '无效的论文对象'
    };
  }
  
  // 规范化为Paper实例
  const paperObj = paper instanceof Paper ? paper : new Paper(paper);
  const paperId = paperObj.id;
  
  logger.debug('[PaperMetadataService] Requesting details for paper:', paperId, paperObj.title || '(无标题)');
  
  // 先检查缓存
  if (papersCache[paperId]) {
    logger.log('[PaperMetadataService] Returning cached details for paperId:', paperId);
    const cachedPaper = papersCache[paperId] instanceof Paper ? 
      papersCache[paperId] : new Paper(papersCache[paperId]);
    return {
      success: true,
      paper: cachedPaper
    };
  }
  
  // 缓存中没有，需要获取数据，使用队列系统
  return new Promise((resolve, reject) => {
    // 添加到请求队列
    requestQueue.push({
      paper: paperObj,
      resolve,
      reject
    });
    
    // 开始处理队列（如果尚未开始）
    if (!processingQueue) {
      processRequestQueue();
    }
  });
}

/**
 * 处理请求队列
 * 保证同时不超过MAX_CONCURRENT_REQUESTS个请求在执行
 */
async function processRequestQueue() {
  if (processingQueue) return; // 防止重复处理
  
  processingQueue = true;
  logger.debug('[PaperMetadataService] Processing request queue. Queue length:', requestQueue.length);
  
  try {
    while (requestQueue.length > 0) {
      // 如果达到最大并发限制，等待
      if (activeRequests >= MAX_CONCURRENT_REQUESTS) {
        await new Promise(resolve => setTimeout(resolve, 100)); // 等待100ms后再检查
        continue;
      }
      
      // 取出队列中的下一个请求
      const request = requestQueue.shift();
      activeRequests++;
      
      // 异步处理请求，不等待完成
      _fetchPaperDetails(request.paper)
        .then(result => {
          request.resolve(result);
        })
        .catch(error => {
          request.reject(error);
        })
        .finally(() => {
          activeRequests--;
        });
    }
  } catch (error) {
    logger.error('[PaperMetadataService] Error processing request queue:', error);
  } finally {
    processingQueue = false;
    
    // 如果队列又有新项目，继续处理
    if (requestQueue.length > 0) {
      processRequestQueue();
    }
  }
}

/**
 * 获取特定论文的详情。
 * 下层实际执行获取论文详情的方法。
 * @param {Paper} paper - 论文对象。
 * @returns {Promise<object>} 包含操作结果和论文数据（如果成功）。
 * @private 内部使用
 */
async function _fetchPaperDetails(paper) {
  logger.debug('[PaperMetadataService] Fetching details for paper:', paper.id, paper.title || '(无标题)');
  
  try {
    let result;

    // 根据不同来源获取论文详情
    if(paper.source === 'google_scholar'){
      result = await fetchDetailsFromGoogleScholar(paper);
    } else {
      // 如果没有指定来源或不支持的来源，使用默认策略
      result = await fetchPaperDetailsDefault(paper);
    }

    if (result && result.success) {
      // 存储到缓存
      storePaperDetails(result.paper);
      return {
        success: true,
        paper: result.paper
      };
    } else {
      return {
        success: false,
        error: (result && result.error) || '获取论文详情失败'
      };
    }
  } catch (error) {
    logger.error('[PaperMetadataService] Error fetching paper details:', error);
    return {
      success: false,
      error: error.message || '获取论文详情时发生错误'
    };
  }
}

// 从Google Scholar获取论文详情
async function fetchDetailsFromGoogleScholar(paper) {
  try {
    logger.log('[PaperMetadataService] Fetching details from Google Scholar for paper:', paper.id);
    
    // 检查是否有Google Scholar版本URL
    if (!paper.googleScholarVersionsUrl) {
      return {
        success: false,
        error: '缺少Google Scholar版本URL'
      };
    }
    
    // 使用httpService获取所有版本页面
    const allVersionPage = await httpService.fetchPageContent(paper.googleScholarVersionsUrl);
    if (!allVersionPage.success) {
      return {
        success: false,
        error: `获取Google Scholar版本页面失败: ${allVersionPage.error}`
      };
    }
    
    // TODO: 解析页面内容，提取论文详情
    logger.debug('[PaperMetadataService] Google Scholar page content fetched, length:', 
                allVersionPage.content ? allVersionPage.content.length : 0);
    
    // 这里应该实现页面解析逻辑，从HTML中提取论文详情
    // 例如：摘要、引用数量、PDF链接等
    
    // 当前是简单的模拟实现，后续需要替换为真实解析逻辑
    const enrichedData = {
      ...paper,
      // 补充从Google Scholar页面提取的信息
      abstract: paper.abstract || '从Google Scholar提取摘要（待实现）',
      citationCount: paper.citationCount || 0,
      // 添加更多从页面解析的字段
    };
    
    // 创建新的Paper实例
    const enrichedPaper = new Paper(enrichedData);
    
    return {
      success: true,
      paper: enrichedPaper
    };
  } catch (error) {
    logger.error('[PaperMetadataService] Error fetching details from Google Scholar:', error);
    return {
      success: false,
      error: error.message || '获取Google Scholar论文详情时发生错误'
    };
  }
}

// 使用默认策略获取论文详情
async function fetchPaperDetailsDefault(paper) {
  try {
    logger.log('[PaperMetadataService] Fetching details using default strategy for paper:', paper.id);
    
    // 当前是简单的模拟实现，后续需要根据实际需求实现
    // 例如，根据论文的URLs访问不同的学术网站
    
    // 模拟处理时间
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const enrichedData = {
      ...paper,
      abstract: paper.abstract || '使用默认策略获取的摘要（待实现）',
      citationCount: paper.citationCount || 0,
    };
    
    const enrichedPaper = new Paper(enrichedData);
    
    return {
      success: true,
      paper: enrichedPaper
    };
  } catch (error) {
    logger.error('[PaperMetadataService] Error fetching details using default strategy:', error);
    return {
      success: false,
      error: error.message || '使用默认策略获取论文详情时发生错误'
    };
  }
}

/**
 * 获取页面内容（提供给外部调用）
 * @param {string} url 页面URL
 * @returns {Promise<object>} 页面内容结果
 */
async function fetchPageContent(url) {
  logger.log('[PaperMetadataService] 获取URL页面内容:', url);
  
  // 委托给httpService处理
  const result = await httpService.fetchPageContent(url);
  
  if (result.success) {
    logger.log('[PaperMetadataService] 成功获取页面内容:', url);
    return {
      success: true,
      content: result.content,
      contentType: result.contentType
    };
  } else {
    logger.error('[PaperMetadataService] 获取页面内容失败:', url, result.error);
    return {
      success: false,
      error: result.error || '获取页面内容失败'
    };
  }
}

/**
 * 将论文数据存储或更新到缓存中。
 * 这个函数主要被其他模块（如 SummarizationHandler）在处理论文前调用。
 * @param {object} paperData - 要存储的论文对象，必须包含 id。
 * @returns {boolean} 操作是否成功
 */
function storePaperDetails(paperData) {
  if (paperData && paperData.id) {
    // 确保使用Paper类实例
    const paper = paperData instanceof Paper ? paperData : new Paper(paperData);
    
    // 如果是旧数据格式，将url迁移到urls数组中
    if (paperData.url && !paperData.urls) {
      paper.addUrl(paperData.url);
    }
    
    logger.log('[PaperMetadataService] Storing/updating paper details in cache for paperId:', paper.id);
    papersCache[paper.id] = paper;
    return true;
  } else {
    logger.warn('[PaperMetadataService] Attempted to store paper with invalid data:', paperData);
    return false;
  }
}

/**
 * (可选) 清空论文详情缓存。
 */
function clearPaperCache() {
  logger.log('[PaperMetadataService] Clearing all paper details from cache.');
  papersCache = {};
}

export const paperMetadataService = {
  getPaperDetails,
  fetchPageContent,
  storePaperDetails, // 暴露给其他模块（如摘要模块）使用
  clearPaperCache    // 可选，用于测试或特定重置场景
}; 