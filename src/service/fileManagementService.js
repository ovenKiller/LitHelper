/**
 * fileManagementService.js
 * 
 * 文件管理服务 - 统一管理工作目录、子目录创建和文件下载
 * 前后台都可以调用此服务
 */

import { logger } from '../util/logger.js';
import { downloadService } from '../background/util/downloadService.js';

/**
 * 文件管理服务类
 */
class FileManagementService {
  constructor() {
    // 预设的工作目录名称（写死）
    this.WORKING_DIRECTORY_NAME = 'LitHelperData';
    
    // 支持的文件类型
    this.SUPPORTED_FILE_TYPES = {
      PDF: 'pdf',
      TXT: 'txt',
      JSON: 'json'
    };
  }

  /**
   * 获取预设的工作目录名称
   * @returns {string} 工作目录名称
   */
  getWorkingDirectoryName() {
    return this.WORKING_DIRECTORY_NAME;
  }

  /**
   * 构建完整的工作路径
   * @param {string} taskDirectory 任务目录名称
   * @returns {string} 完整路径
   */
  buildFullPath(taskDirectory) {
    if (!taskDirectory || typeof taskDirectory !== 'string') {
      throw new Error('任务目录名称不能为空');
    }
    
    // 清理任务目录名称，移除不合法字符
    const cleanTaskDir = this._sanitizeDirectoryName(taskDirectory);
    return `${this.WORKING_DIRECTORY_NAME}/${cleanTaskDir}`;
  }

  /**
   * 获取工作目录下的所有子目录
   * 注意：由于浏览器环境限制，此方法主要用于后台脚本
   * @returns {Promise<Array<string>>} 子目录列表
   */
  async getSubDirectories() {
    try {
      logger.log('[FileManagementService] 获取工作目录下的子目录');
      
      // 在浏览器环境中，我们无法直接访问文件系统
      // 这里返回一个空数组，实际实现需要通过其他方式
      // 比如维护一个已创建目录的记录
      logger.warn('[FileManagementService] 浏览器环境无法直接访问文件系统，返回空列表');
      return [];
    } catch (error) {
      logger.error('[FileManagementService] 获取子目录失败:', error);
      throw new Error(`获取子目录失败: ${error.message}`);
    }
  }

  /**
   * 在工作目录下创建子目录
   * 注意：由于浏览器环境限制，此方法主要用于记录目录结构
   * @param {string} taskDirectory 任务目录名称
   * @returns {Promise<Object>} 创建结果
   */
  async createSubDirectory(taskDirectory) {
    try {
      if (!taskDirectory || typeof taskDirectory !== 'string') {
        throw new Error('任务目录名称不能为空');
      }

      const cleanTaskDir = this._sanitizeDirectoryName(taskDirectory);
      const fullPath = this.buildFullPath(cleanTaskDir);
      
      logger.log(`[FileManagementService] 创建子目录: ${fullPath}`);
      
      // 在浏览器环境中，我们无法直接创建文件系统目录
      // 但可以记录这个目录结构，用于后续文件下载时的路径构建
      
      return {
        success: true,
        taskDirectory: cleanTaskDir,
        fullPath: fullPath,
        message: `目录路径已准备: ${fullPath}`
      };
    } catch (error) {
      logger.error('[FileManagementService] 创建子目录失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 在指定目录下下载文件
   * @param {string} url 文件下载链接
   * @param {string} filename 文件名
   * @param {string} taskDirectory 任务目录名称
   * @param {Object} options 下载选项
   * @returns {Promise<Object>} 下载结果
   */
  async downloadFileToDirectory(url, filename, taskDirectory, options = {}) {
    try {
      if (!url || !filename || !taskDirectory) {
        throw new Error('下载参数不完整：需要URL、文件名和任务目录');
      }

      // 构建完整的下载路径
      const fullPath = this.buildFullPath(taskDirectory);
      const downloadPath = `${fullPath}/${filename}`;
      
      logger.log(`[FileManagementService] 开始下载文件到: ${downloadPath}`);
      
      // 使用downloadService进行实际下载
      const downloadResult = await downloadService.downloadFile(url, downloadPath, options);
      
      if (downloadResult.success) {
        logger.log(`[FileManagementService] 文件下载成功: ${downloadPath}`);
        return {
          success: true,
          downloadId: downloadResult.downloadId,
          filename: filename,
          taskDirectory: taskDirectory,
          fullPath: downloadPath,
          url: url
        };
      } else {
        throw new Error(downloadResult.error || '下载失败');
      }
    } catch (error) {
      logger.error('[FileManagementService] 下载文件失败:', error);
      return {
        success: false,
        error: error.message,
        filename: filename,
        taskDirectory: taskDirectory,
        url: url
      };
    }
  }

  /**
   * 下载PDF文件的便捷方法
   * @param {string} pdfUrl PDF下载链接
   * @param {string} paperTitle 论文标题（用于生成文件名）
   * @param {string} taskDirectory 任务目录名称
   * @returns {Promise<Object>} 下载结果
   */
  async downloadPdf(pdfUrl, paperTitle, taskDirectory) {
    try {
      if (!pdfUrl || !paperTitle || !taskDirectory) {
        throw new Error('PDF下载参数不完整');
      }

      // 生成PDF文件名
      const filename = this._generatePdfFilename(paperTitle);
      
      logger.log(`[FileManagementService] 下载PDF: ${filename} 到目录: ${taskDirectory}`);
      
      return await this.downloadFileToDirectory(pdfUrl, filename, taskDirectory, {
        conflictAction: 'uniquify' // 如果文件已存在，自动重命名
      });
    } catch (error) {
      logger.error('[FileManagementService] PDF下载失败:', error);
      return {
        success: false,
        error: error.message,
        pdfUrl: pdfUrl,
        paperTitle: paperTitle,
        taskDirectory: taskDirectory
      };
    }
  }

  /**
   * 清理目录名称，移除不合法字符
   * @param {string} dirName 原始目录名称
   * @returns {string} 清理后的目录名称
   * @private
   */
  _sanitizeDirectoryName(dirName) {
    if (!dirName || typeof dirName !== 'string') {
      return 'default';
    }
    
    return dirName
      .replace(/[<>:"/\\|?*]/g, '_') // 替换不合法的文件名字符
      .replace(/\s+/g, '_') // 替换空格为下划线
      .replace(/_{2,}/g, '_') // 合并多个下划线
      .replace(/^_|_$/g, '') // 移除开头和结尾的下划线
      .substring(0, 50) || 'default'; // 限制长度并提供默认值
  }

  /**
   * 生成PDF文件名
   * @param {string} paperTitle 论文标题
   * @returns {string} PDF文件名
   * @private
   */
  _generatePdfFilename(paperTitle) {
    if (!paperTitle || typeof paperTitle !== 'string') {
      return `paper_${Date.now()}.pdf`;
    }
    
    // 清理标题并生成文件名
    const cleanTitle = paperTitle
      .replace(/[<>:"/\\|?*]/g, '_') // 替换不合法字符
      .replace(/\s+/g, '_') // 替换空格
      .replace(/_{2,}/g, '_') // 合并多个下划线
      .replace(/^_|_$/g, '') // 移除开头和结尾的下划线
      .substring(0, 100); // 限制长度
    
    return `${cleanTitle || 'paper'}.pdf`;
  }

  /**
   * 获取支持的文件类型
   * @returns {Object} 支持的文件类型
   */
  getSupportedFileTypes() {
    return { ...this.SUPPORTED_FILE_TYPES };
  }

  /**
   * 验证文件类型是否支持
   * @param {string} filename 文件名
   * @returns {boolean} 是否支持
   */
  isSupportedFileType(filename) {
    if (!filename || typeof filename !== 'string') {
      return false;
    }

    const extension = filename.toLowerCase().split('.').pop();
    return Object.values(this.SUPPORTED_FILE_TYPES).includes(extension);
  }

  /**
   * 在文件管理器中显示工作目录
   * 逻辑：
   * - 精确在工作目录根定位（需要根下至少有一个文件）
   * - 若根下无文件：创建占位文件 README.txt 再定位
   */
  async showWorkingDirectory() {
    try {
      logger.log('[FileManagementService] 尝试显示工作目录');

      // 先尝试在根目录下查找任何文件
      const found = await this._showBySearching(this.WORKING_DIRECTORY_NAME, { rootOnly: true });
      if (found.success) return found;

      // 根目录没有文件：创建占位文件并展示
      await this._ensureDirectoryByPlaceholder(this.WORKING_DIRECTORY_NAME);
      return await this._showBySearching(this.WORKING_DIRECTORY_NAME, { rootOnly: true });
    } catch (error) {
      logger.error('[FileManagementService] 显示工作目录失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 在文件管理器中显示指定任务目录
   */
  async showTaskDirectory(taskDirectory) {
    try {
      if (!taskDirectory || typeof taskDirectory !== 'string') {
        throw new Error('任务目录名称不能为空');
      }
      logger.log(`[FileManagementService] 尝试显示任务目录: ${taskDirectory}`);

      const fullPath = this.buildFullPath(taskDirectory);
      const found = await this._showBySearching(fullPath, { rootOnly: false });
      if (found.success) return found;

      await this._ensureDirectoryByPlaceholder(fullPath);
      return await this._showBySearching(fullPath, { rootOnly: false });
    } catch (error) {
      logger.error('[FileManagementService] 显示任务目录失败:', error);
      return { success: false, error: error.message, taskDirectory };
    }
  }

  /**
   * 通过下载历史搜索并在文件管理器中显示
   */
  async _showBySearching(directoryPath, { rootOnly }) {
    const escaped = directoryPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const looseRegex = `.*${escaped}.*`;
    const strictRegex = `.*[\\/]+${escaped}[\\/][^\\/]+$`;
    const filenameRegex = rootOnly ? strictRegex : looseRegex;

    const downloads = await chrome.downloads.search({
      filenameRegex,
      orderBy: ['-startTime'],
      limit: 20
    });
    if (downloads.length > 0) {
      const latest = downloads[0];
      await chrome.downloads.show(latest.id);
      return { success: true, filename: latest.filename, downloadId: latest.id, message: `已打开: ${directoryPath}` };
    }
    return { success: false, message: '未找到匹配下载记录' };
  }

  /**
   * 通过下载 data:URL 占位文件确保目录存在
   */
  async _ensureDirectoryByPlaceholder(directoryPath) {
    const { downloadService } = await import('../background/util/downloadService.js');

    // 优先 README.txt，失败则 placeholder.txt
    const text = `# ${directoryPath} 工作目录\n\n此文件用于确保目录结构存在，可以安全删除。\n创建时间: ${new Date().toISOString()}`;
    const dataUrl = `data:text/plain;charset=utf-8,${encodeURIComponent(text)}`;

    const tryDownload = async (filename) => {
      return await chrome.downloads.download({ url: dataUrl, filename, conflictAction: 'overwrite' });
    };

    const tryFilenames = [
      `${directoryPath}/README.txt`,
      `${directoryPath}/placeholder.txt`
    ];

    let downloadId = null;
    let lastErr = null;
    for (const name of tryFilenames) {
      try {
        downloadId = await tryDownload(name);
        break;
      } catch (e) {
        lastErr = e;
      }
    }
    if (!downloadId) {
      throw new Error(`创建占位文件失败: ${lastErr?.message || lastErr}`);
    }

    // 等待完成
    await new Promise((resolve, reject) => {
      const check = async () => {
        try {
          const list = await chrome.downloads.search({ id: downloadId });
          if (list.length > 0) {
            const d = list[0];
            if (d.state === 'complete') return resolve();
            if (d.state === 'interrupted') return reject(new Error('下载被中断'));
          }
          setTimeout(check, 120);
        } catch (e) { reject(e); }
      };
      check();
    });

    return true;
  }
}

// 创建单例实例
export const fileManagementService = new FileManagementService();
export default fileManagementService;
