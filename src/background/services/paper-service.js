/**
 * paper-service.js
 * 
 * 提供论文管理服务
 */

import { Paper } from '../../models/Paper.js';

export class PaperService {
  /**
   * @param {import('../../utils/storage.js').StorageService} storageService 存储服务
   */
  constructor(storageService) {
    this.storageService = storageService;
  }

  /**
   * 获取论文详情
   * @param {string} paperId 论文ID
   * @returns {Promise<Paper|null>} 论文对象
   */
  async getPaperDetails(paperId) {
    const paperData = await this.storageService.getPaper(paperId);
    if (!paperData) {
      return null;
    }
    
    return new Paper(paperData);
  }

  /**
   * 保存论文
   * @param {Paper} paper 论文对象
   * @returns {Promise<boolean>} 是否成功
   */
  async savePaper(paper) {
    return await this.storageService.savePaper(paper);
  }

  /**
   * 获取网页内容 - 解决CORS问题
   * @param {string} url 网页URL
   * @returns {Promise<string|null>} 网页内容
   */
  async fetchPageContent(url) {
    console.log('获取网页内容:', url);
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP错误: ${response.status}`);
      }
      
      return await response.text();
    } catch (error) {
      console.error('获取网页内容失败:', error);
      return null;
    }
  }

  /**
   * 从HTML内容中提取论文信息
   * @param {string} html HTML内容
   * @param {string} sourceType 来源类型
   * @returns {Promise<Paper|null>} 论文对象
   */
  async extractPaperFromHTML(html, sourceType) {
    // 在实际实现中，这里会根据不同的sourceType调用不同的解析逻辑
    console.log(`从${sourceType}提取论文信息`);
    
    // 示例实现，实际应根据不同平台编写特定的解析逻辑
    // 例如从arXiv、ACM、IEEE等不同平台提取论文信息
    return null;
  }
} 