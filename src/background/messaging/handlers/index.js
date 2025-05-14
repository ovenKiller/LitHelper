/**
 * index.js
 * 
 * 注册所有消息处理器
 */

/**
 * 设置消息处理器
 * @param {import('../message-router.js').MessageRouter} messageRouter 消息路由器
 * @param {import('../../config/config-manager.js').ConfigManager} configManager 配置管理器
 * @param {import('../../services/paper-service.js').PaperService} paperService 论文服务
 * @param {import('../../services/summary-service.js').SummaryService} summaryService 摘要服务
 * @param {import('../../services/download-service.js').DownloadService} downloadService 下载服务
 */
export function setupMessageHandlers(
  messageRouter,
  configManager,
  paperService,
  summaryService,
  downloadService
) {
  // 配置相关处理器
  messageRouter.registerHandler('getConfig', async () => {
    return { 
      success: true, 
      config: configManager.getConfig() 
    };
  });
  
  messageRouter.registerHandler('updateConfig', async (data) => {
    const success = await configManager.updateConfig(data);
    if (success) {
      await configManager.notifyConfigUpdate(data);
    }
    return { success };
  });
  
  // 论文相关处理器
  messageRouter.registerHandler('fetchPageContent', async (data) => {
    const content = await paperService.fetchPageContent(data.url);
    return content 
      ? { success: true, data: content }
      : { success: false, error: '获取网页内容失败' };
  });
  
  messageRouter.registerHandler('getPaperDetails', async (data) => {
    const paper = await paperService.getPaperDetails(data.paperId);
    return paper 
      ? { success: true, paper }
      : { success: false, error: '未找到论文' };
  });
  
  // 摘要相关处理器
  messageRouter.registerHandler('summarizePaper', async (data) => {
    try {
      const summary = await summaryService.summarizePaper(data.paper, data.options);
      return { 
        success: true, 
        summary: summary.summary, 
        categories: summary.categories 
      };
    } catch (error) {
      return { 
        success: false, 
        error: error.message || '摘要生成失败' 
      };
    }
  });
  
  messageRouter.registerHandler('batchSummarizePapers', async (data) => {
    try {
      const results = await summaryService.batchSummarizePapers(data.papers, data.options);
      return { success: true, results };
    } catch (error) {
      return { 
        success: false, 
        error: error.message || '批量摘要失败' 
      };
    }
  });
  
  messageRouter.registerHandler('getStoredSummaries', async () => {
    const summaries = await summaryService.getAllSummaries();
    return { success: true, summaries };
  });
  
  // 下载相关处理器
  messageRouter.registerHandler('downloadPDF', async (data) => {
    const result = await downloadService.downloadPDF(data.paper);
    return result;
  });
  
  messageRouter.registerHandler('batchDownloadPapers', async (data) => {
    try {
      const results = await downloadService.batchDownloadPapers(data.papers);
      return { success: true, results };
    } catch (error) {
      return { 
        success: false, 
        error: error.message || '批量下载失败' 
      };
    }
  });
  
  // 其他处理器
  messageRouter.registerHandler('openPopup', async () => {
    // 在实际实现中会处理打开弹出窗口并跳转到特定标签
    return { success: true };
  });
} 