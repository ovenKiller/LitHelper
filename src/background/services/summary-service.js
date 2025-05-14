/**
 * summary-service.js
 * 
 * 提供论文摘要服务
 */

import { Summary } from '../../models/summary.js';

export class SummaryService {
  /**
   * @param {import('../../utils/storage.js').StorageService} storageService 存储服务
   * @param {import('../../api/llm/llm-service.js').LLMService} llmService LLM服务
   * @param {import('../config/config-manager.js').ConfigManager} configManager 配置管理器
   */
  constructor(storageService, llmService, configManager) {
    this.storageService = storageService;
    this.llmService = llmService;
    this.configManager = configManager;
  }

  /**
   * 获取论文摘要
   * @param {string} paperId 论文ID
   * @returns {Promise<Summary|null>} 摘要对象
   */
  async getSummary(paperId) {
    const summaryData = await this.storageService.getSummary(paperId);
    if (!summaryData) {
      return null;
    }
    
    return new Summary(summaryData);
  }

  /**
   * 获取所有摘要
   * @returns {Promise<Summary[]>} 摘要列表
   */
  async getAllSummaries() {
    const summariesData = await this.storageService.getAllSummaries();
    return summariesData.map(data => new Summary(data));
  }

  /**
   * 生成论文摘要
   * @param {import('../../models/Paper.js').Paper} paper 论文对象
   * @param {Object} options 选项
   * @param {boolean} options.categorize 是否分类
   * @returns {Promise<Summary>} 摘要对象
   */
  async summarizePaper(paper, options = {}) {
    console.log('开始摘要论文:', paper.title, '选项:', options);
    
    try {
      // 存储论文以供后续参考
      await this.storageService.savePaper(paper);
      
      // 获取配置的摘要分类
      const categories = this.configManager.getConfig().summarization.categories
        .filter(category => category.enabled)
        .map(category => category.id);
      
      // 调用LLM生成摘要
      const summaryResult = await this.llmService.generateSummary(
        paper, 
        options.categorize ? categories : []
      );
      
      // 创建摘要对象
      const summary = new Summary({
        paperId: paper.id,
        summary: summaryResult.summary,
        categories: summaryResult.categories,
        createdAt: new Date().toISOString()
      });
      
      // 存储摘要
      await this.storageService.saveSummary(summary);
      
      return summary;
    } catch (error) {
      console.error('摘要论文失败:', error);
      throw error;
    }
  }

  /**
   * 批量生成论文摘要
   * @param {import('../../models/Paper.js').Paper[]} papers 论文列表
   * @param {Object} options 选项
   * @returns {Promise<{paper: Paper, summary: Summary}[]>} 结果列表
   */
  async batchSummarizePapers(papers, options = {}) {
    console.log('开始批量摘要', papers.length, '篇论文');
    
    try {
      const results = [];
      
      // 为每篇论文生成摘要
      for (const paper of papers) {
        try {
          const summary = await this.summarizePaper(paper, options);
          results.push({
            paper,
            summary
          });
        } catch (error) {
          console.error(`摘要论文 ${paper.title} 失败:`, error);
          // 继续处理下一篇论文
        }
      }
      
      return results;
    } catch (error) {
      console.error('批量摘要失败:', error);
      throw error;
    }
  }
} 