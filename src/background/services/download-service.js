/**
 * download-service.js
 * 
 * 提供论文PDF下载服务
 */

export class DownloadService {
  /**
   * @param {import('../../utils/storage.js').StorageService} storageService 存储服务
   */
  constructor(storageService) {
    this.storageService = storageService;
  }

  /**
   * 下载论文PDF
   * @param {import('../../models/Paper.js').Paper} paper 论文对象
   * @returns {Promise<{success: boolean, downloadId?: number, error?: string}>} 下载结果
   */
  async downloadPDF(paper) {
    console.log('尝试下载PDF:', paper.title);
    
    try {
      // 存储论文以供后续参考
      await this.storageService.savePaper(paper);
      
      // 获取PDF URL
      const pdfUrl = paper.pdfUrl || await this.findPDFUrl(paper);
      
      if (!pdfUrl) {
        return {
          success: false,
          error: '找不到PDF链接'
        };
      }
      
      // 记录下载
      await this.storageService.recordDownload({
        paperId: paper.id,
        pdfUrl,
        downloadedAt: new Date().toISOString()
      });
      
      // 使用Chrome下载API下载PDF
      const downloadId = await chrome.downloads.download({
        url: pdfUrl,
        filename: `${paper.title.replace(/[\\/:*?"<>|]/g, '_')}.pdf`,
        saveAs: false
      });
      
      return {
        success: true,
        downloadId
      };
    } catch (error) {
      console.error('下载PDF失败:', error);
      return {
        success: false,
        error: error.message || '下载PDF失败'
      };
    }
  }

  /**
   * 批量下载论文PDF
   * @param {import('../../models/Paper.js').Paper[]} papers 论文列表
   * @returns {Promise<{paper: Paper, success: boolean, error?: string}[]>} 下载结果列表
   */
  async batchDownloadPapers(papers) {
    console.log('开始批量下载', papers.length, '篇论文的PDF');
    
    try {
      const results = [];
      
      // 为每篇论文下载PDF
      for (const paper of papers) {
        if (paper.pdfUrl) {
          const result = await this.downloadPDF(paper);
          results.push({
            paper,
            success: result.success,
            error: result.error
          });
        } else {
          results.push({
            paper,
            success: false,
            error: '缺少PDF链接'
          });
        }
      }
      
      return results;
    } catch (error) {
      console.error('批量下载失败:', error);
      throw error;
    }
  }

  /**
   * 查找PDF URL的辅助函数
   * @param {import('../../models/Paper.js').Paper} paper 论文对象
   * @returns {Promise<string|null>} PDF URL
   */
  async findPDFUrl(paper) {
    // 在实际实现中，这将尝试从论文页面或其他来源查找PDF URL
    return paper.pdfUrl || null;
  }
} 