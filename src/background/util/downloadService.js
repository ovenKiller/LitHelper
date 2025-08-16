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

/**
 * 在文件管理器中显示下载的文件
 * @param {number} downloadId 下载ID
 * @returns {Promise<Object>} 操作结果
 */
async function showDownloadInFolder(downloadId) {
  try {
    logger.debug(`[DownloadService] 在文件管理器中显示下载: ${downloadId}`);

    // 使用 chrome.downloads.show() 在系统文件管理器中显示文件
    await chrome.downloads.show(downloadId);

    logger.debug(`[DownloadService] 文件已在文件管理器中显示: ${downloadId}`);
    return {
      success: true,
      downloadId: downloadId
    };
  } catch (error) {
    logger.error(`[DownloadService] 显示文件失败 [${downloadId}]:`, error);
    return {
      success: false,
      error: error.message || '无法在文件管理器中显示文件',
      downloadId: downloadId
    };
  }
}



/**
 * 打开下载文件夹（显示下载目录）
 * @returns {Promise<Object>} 操作结果
 */
async function openDownloadsFolder() {
  try {
    logger.debug(`[DownloadService] 打开下载文件夹`);

    // 获取最近的下载项来定位下载文件夹
    const recentDownloads = await chrome.downloads.search({
      limit: 1,
      orderBy: ['-startTime']
    });

    if (recentDownloads.length > 0) {
      // 使用最近的下载项来显示下载文件夹
      await chrome.downloads.show(recentDownloads[0].id);
      return {
        success: true,
        message: '已打开下载文件夹'
      };
    } else {
      // 如果没有下载历史，打开Chrome下载页面
      throw new Error('没有下载历史记录');
    }
  } catch (error) {
    logger.error(`[DownloadService] 打开下载文件夹失败:`, error);
    // 降级方案：打开Chrome下载页面
    try {
      await chrome.tabs.create({ url: 'chrome://downloads/' });
      return {
        success: true,
        message: '已打开Chrome下载页面，请手动查找文件'
      };
    } catch (tabError) {
      return {
        success: false,
        error: '无法打开下载文件夹或下载页面'
      };
    }
  }
}

export const downloadService = {
  downloadFile,
  getDownloadStatus,
  cancelDownload,
  showDownloadInFolder,
  openDownloadsFolder
};