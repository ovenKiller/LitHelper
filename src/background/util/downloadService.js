/**
 * downloadService.js
 * 
 * 底层下载服务，专门封装 chrome.downloads API
 * 不包含任何业务逻辑，只提供纯粹的下载操作
 */

import { logger } from '../../util/logger.js';

/**
 * 使用 chrome.downloads API 下载文件
 * @param {string} url 要下载的文件URL
 * @param {string} filename 保存的文件名
 * @param {Object} options 可选参数
 * @returns {Promise<Object>} 下载结果
 */
async function downloadFile(url, filename, options = {}) {
  try {
    logger.debug(`[DownloadService] 开始下载: ${filename} from ${url}`);
    
    const downloadOptions = {
      url: url,
      filename: filename,
      ...options
    };
    
    // 使用 chrome.downloads API 下载文件
    const downloadId = await chrome.downloads.download(downloadOptions);
    
    logger.debug(`[DownloadService] 下载任务已创建: ${downloadId}`);
    
    return {
      success: true,
      downloadId: downloadId,
      filename: filename,
      url: url
    };
  } catch (error) {
    logger.error(`[DownloadService] 下载失败 [${filename}]:`, error);
    return {
      success: false,
      error: error.message || '下载失败',
      filename: filename,
      url: url
    };
  }
}

/**
 * 查询下载状态
 * @param {number} downloadId 下载ID
 * @returns {Promise<Object>} 下载状态信息
 */
async function getDownloadStatus(downloadId) {
  try {
    logger.debug(`[DownloadService] 查询下载状态: ${downloadId}`);
    
    const downloads = await chrome.downloads.search({ id: downloadId });
    
    if (downloads.length === 0) {
      return {
        success: false,
        error: '下载任务不存在'
      };
    }
    
    const download = downloads[0];
    logger.debug(`[DownloadService] 下载状态: ${download.state}`);
    
    return {
      success: true,
      status: download.state,
      filename: download.filename,
      url: download.url,
      bytesReceived: download.bytesReceived,
      totalBytes: download.totalBytes
    };
  } catch (error) {
    logger.error(`[DownloadService] 查询下载状态失败 [${downloadId}]:`, error);
    return {
      success: false,
      error: error.message || '查询下载状态失败'
    };
  }
}

/**
 * 取消下载
 * @param {number} downloadId 下载ID
 * @returns {Promise<boolean>} 是否取消成功
 */
async function cancelDownload(downloadId) {
  try {
    logger.debug(`[DownloadService] 取消下载: ${downloadId}`);
    await chrome.downloads.cancel(downloadId);
    logger.debug(`[DownloadService] 下载已取消: ${downloadId}`);
    return true;
  } catch (error) {
    logger.error(`[DownloadService] 取消下载失败 [${downloadId}]:`, error);
    return false;
  }
}

export const downloadService = {
  downloadFile,
  getDownloadStatus,
  cancelDownload
}; 