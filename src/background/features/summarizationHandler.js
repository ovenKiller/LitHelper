import { logger } from '../utils/logger.js';
import { paperMetadataService } from './paperMetadataService.js';
// import { storage } from '../utils/storage.js'; // 如果 summaries 需要持久化存储

// 内部状态，存储论文摘要
// 同样，如果需要持久化，则应使用 storage.js
let summariesCache = {};

/**
 * 摘要单篇论文 - 模拟实现。
 * @param {object} paper - 要摘要的论文对象。
 * @param {object} options - 摘要选项，例如是否分类。
 * @returns {Promise<object>} 包含操作结果和摘要数据（如果成功）。
 */
async function summarizePaper(paper, options) {
  logger.log('[SummarizationHandler] Starting to summarize paper:', paper?.title, 'Options:', options);
  
  if (!paper || !paper.id) {
    logger.error('[SummarizationHandler] Invalid paper data received for summarization.', paper);
    return { success: false, error: '无效的论文数据以进行摘要' };
  }

  try {
    // 确保论文元数据被缓存/存储
    paperMetadataService.storePaperDetails(paper);
    logger.debug('[SummarizationHandler] Paper details stored/updated via PaperMetadataService for ID:', paper.id);
    
    // 模拟摘要生成过程 (实际应调用 LLM API)
    logger.log('[SummarizationHandler] Simulating LLM call for paper:', paper.title);
    await new Promise(resolve => setTimeout(resolve, 2000)); // 模拟网络延迟和处理时间
    
    const summaryData = {
      paperId: paper.id,
      summary: `这是《${paper.title}》的 AI 生成摘要（模拟）。实际摘要将更详细和准确。`,
      createdAt: new Date().toISOString()
    };
    
    if (options?.categorize) {
      logger.debug('[SummarizationHandler] Categorization enabled for paper:', paper.title);
      summaryData.categories = {
        methodology: { score: Math.floor(Math.random() * 2) + 4, explanation: '该论文的方法论看起来是合理的（模拟评分）。' },
        findings: { score: Math.floor(Math.random() * 2) + 4, explanation: '论文的发现具有一定的启发性（模拟评分）。' },
        limitations: { score: Math.floor(Math.random() * 2) + 3, explanation: '论文可能未充分讨论所有潜在局限性（模拟评分）。' },
        futureWork: { score: Math.floor(Math.random() * 2) + 3, explanation: '对未来工作的展望提供了一些方向（模拟评分）。' }
      };
    }
    
    summariesCache[paper.id] = summaryData;
    logger.log('[SummarizationHandler] Summary created and cached for paperId:', paper.id);
    
    return {
      success: true,
      summary: summaryData.summary,
      categories: summaryData.categories
    };
  } catch (error) {
    logger.error('[SummarizationHandler] Failed to generate summary for paper:', paper?.title, error);
    return {
      success: false,
      error: error.message || '论文摘要生成失败'
    };
  }
}

/**
 * 批量摘要多篇论文。
 * @param {Array<object>} papers - 要摘要的论文对象数组。
 * @param {object} options - 摘要选项。
 * @returns {Promise<object>} 包含操作结果和批量摘要结果（如果成功）。
 */
async function batchSummarizePapers(papers, options) {
  logger.log('[SummarizationHandler] Starting batch summarization for', papers?.length, 'papers.');
  if (!papers || !Array.isArray(papers) || papers.length === 0) {
    logger.warn('[SummarizationHandler] Invalid or empty papers array for batch summarization.');
    return { success: false, error: '无效的论文列表用于批量摘要' };
  }
  
  try {
    const results = [];
    for (const paper of papers) {
      // 注意：如果一个论文摘要失败，我们仍然继续处理其他的
      const result = await summarizePaper(paper, options);
      results.push({
        paperId: paper.id,
        title: paper.title, // 添加 title 到结果中，方便前端显示
        success: result.success,
        summary: result.success ? result.summary : null,
        categories: result.success ? result.categories : null,
        error: result.success ? null : result.error
      });
    }
    logger.log('[SummarizationHandler] Batch summarization completed. Results count:', results.length);
    return {
      success: true,
      results
    };
  } catch (error) {
    logger.error('[SummarizationHandler] Error during batch summarization process:', error);
    return { 
      success: false,
      error: error.message || '批量摘要过程中发生错误'
    };
  }
}

/**
 * 获取特定论文的已存储摘要。
 * @param {string} paperId 
 * @returns {object | null} 返回摘要对象或null
 */
function getCachedSummary(paperId) {
  logger.debug('[SummarizationHandler] Requesting cached summary for paperId:', paperId);
  if (summariesCache[paperId]) {
    return { ...summariesCache[paperId] }; // 返回副本
  }
  return null;
}

/**
 * 获取所有已存储的摘要。
 * @returns {Array<object>} 所有摘要的数组
 */
function getAllCachedSummaries() {
  logger.debug('[SummarizationHandler] Requesting all cached summaries. Count:', Object.keys(summariesCache).length);
  return Object.values(summariesCache).map(s => ({...s})); // 返回副本数组
}

export const summarizationHandler = {
  summarizePaper,
  batchSummarizePapers,
  getCachedSummary, // 可选，如果其他地方需要直接访问摘要缓存
  getAllCachedSummaries // 用于处理 getStoredSummaries action
}; 