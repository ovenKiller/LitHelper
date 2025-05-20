import { logger } from '../utils/logger.js';
// import { storage } from '../utils/storage.js'; // 如果 downloads 需要持久化存储

// 内部状态，存储下载信息
// 同样，如果需要持久化，则应使用 storage.js
let downloadsCache = {};

/**
 * 模拟查找PDF URL。
 * @param {object} paper - 论文对象，至少包含 id。
 * @returns {Promise<string>} PDF的URL。
 */
async function findPDFUrl(paper) {
  logger.debug('[DownloadHandler] Finding PDF URL for paper:', paper?.id);
  // 模拟,实际会从paper的urls访问页面解析获取PDF链接
  // (在真实实现中，paper 对象可能需要包含 urls 属性或其他用于查找PDF的信息)
  if (!paper || !paper.id) {
    logger.warn('[DownloadHandler] Cannot find PDF URL without paper ID.');
    return null;
  }
  
  // 如果paper已经有pdfUrl，直接返回
  if (paper.pdfUrl) {
    return paper.pdfUrl;
  }
  
  // 如果有urls可用，尝试从中查找PDF
  if (paper.urls && paper.urls.length > 0) {
    const mainUrl = paper.getMainUrl();
    logger.debug('[DownloadHandler] Attempting to locate PDF from main URL:', mainUrl);
    // 这里是模拟实现，实际应该访问URL解析页面
    return `https://example.com/papers/${paper.id}.pdf`;
  }
  
  return null;
}

/**
 * 下载单篇论文 - 模拟实现。
 * @param {object} paper - 要下载的论文对象，包含 id 和 title。
 * @returns {Promise<object>} 包含操作结果。
 */
async function downloadPDF(paper) {
  logger.log('[DownloadHandler] Starting download for paper:', paper?.title);
  
  if (!paper || !paper.id || !paper.title) {
    logger.error('[DownloadHandler] Invalid paper data for download.', paper);
    return { success: false, error: '无效的论文数据用于下载' };
  }

  try {
    const pdfUrl = await findPDFUrl(paper);
    if (!pdfUrl) {
      throw new Error('未找到PDF链接');
    }
    
    logger.log('[DownloadHandler] Simulating download from URL:', pdfUrl);
    await new Promise(resolve => setTimeout(resolve, 1000)); // 模拟下载时间
    
    const downloadRecord = {
      paperId: paper.id,
      title: paper.title,
      downloadedAt: new Date().toISOString(),
      url: pdfUrl
    };
    downloadsCache[paper.id] = downloadRecord;
    logger.log('[DownloadHandler] Paper download recorded:', paper.title);
    
    return {
      success: true,
      message: `已下载论文 "${paper.title}" (模拟)`
    };
  } catch (error) {
    logger.error('[DownloadHandler] Failed to download paper:', paper?.title, error);
    return {
      success: false,
      error: error.message || '下载论文失败'
    };
  }
}

/**
 * 批量下载多篇论文。
 * @param {Array<object>} papers - 要下载的论文对象数组。
 * @returns {Promise<object>} 包含操作结果和批量下载结果。
 */
async function batchDownloadPapers(papers) {
  logger.log('[DownloadHandler] Starting batch download for', papers?.length, 'papers.');
  if (!papers || !Array.isArray(papers) || papers.length === 0) {
    logger.warn('[DownloadHandler] Invalid or empty papers array for batch download.');
    return { success: false, error: '无效的论文列表用于批量下载' };
  }
  
  try {
    const results = [];
    for (const paper of papers) {
      const result = await downloadPDF(paper);
      results.push({
        paperId: paper.id,
        title: paper.title,
        success: result.success,
        message: result.success ? result.message : result.error,
        error: result.success ? null : result.error // 显式添加error字段
      });
    }
    logger.log('[DownloadHandler] Batch download completed. Results count:', results.length);
    return {
      success: true,
      results
    };
  } catch (error) {
    logger.error('[DownloadHandler] Error during batch download process:', error);
    return { 
      success: false,
      error: error.message || '批量下载过程中发生错误'
    };
  }
}

/**
 * 获取特定论文的已存储下载信息。
 * @param {string} paperId 
 * @returns {object | null} 返回下载信息对象或null
 */
function getCachedDownload(paperId) {
  logger.debug('[DownloadHandler] Requesting cached download info for paperId:', paperId);
  if (downloadsCache[paperId]) {
    return { ...downloadsCache[paperId] }; // 返回副本
  }
  return null;
}

/**
 * 获取所有已存储的下载信息。
 * @returns {Array<object>} 所有下载信息的数组
 */
function getAllCachedDownloads() {
  logger.debug('[DownloadHandler] Requesting all cached download info. Count:', Object.keys(downloadsCache).length);
  return Object.values(downloadsCache).map(d => ({...d})); // 返回副本数组
}

export const downloadHandler = {
  findPDFUrl, // 可能由其他模块调用，例如在显示论文详情时预先查找链接
  downloadPDF,
  batchDownloadPapers,
  getCachedDownload,   // 可选
  getAllCachedDownloads // 如果有 "getStoredDownloads" action
}; 