import { logger } from '../utils/logger.js';
import { configManager } from '../features/configManager.js';
import { paperBoxManager } from '../features/paperBoxManager.js';
import { paperMetadataService } from '../features/paperMetadataService.js';
import { summarizationHandler } from '../features/summarizationHandler.js';
import { downloadHandler } from '../features/downloadHandler.js';

async function handleAction(message, sender) {
  const { action, data } = message;
  logger.log('[MessageDispatcher] Handling action:', action, 'with data:', data, 'from sender:', sender);
  
  switch (action) {
    // Config Manager Actions
    case 'getConfig':
      return { success: true, config: configManager.getConfig() };
    case 'updateConfig':
      return await configManager.updateConfig(data);

    // PaperBox Manager Actions
    case 'getPaperBoxData':
      return { success: true, papers: paperBoxManager.getPaperBox() };
    case 'addPaperToBox':
      logger.log('[MessageDispatcher] addPaperToBox');
      return await paperBoxManager.addPaper(data.paper);
    case 'removePaperFromBox':
      return await paperBoxManager.removePaper(data.paperId);
    case 'clearPaperBox':
      return await paperBoxManager.clearAllPapers();

    // Paper Metadata Service Actions
    case 'fetchPageContent':
      return await paperMetadataService.fetchPageContent(data.url);
    case 'getPaperDetails':
      return await paperMetadataService.getPaperDetails(data.paperId);

    // Summarization Handler Actions
    case 'summarizePaper':
      return await summarizationHandler.summarizePaper(data.paper, data.options);
    case 'batchSummarizePapers':
      return await summarizationHandler.batchSummarizePapers(data.papers, data.options);
    case 'getStoredSummaries':
      return { success: true, summaries: summarizationHandler.getAllCachedSummaries() };

    // Download Handler Actions
    case 'downloadPDF':
      return await downloadHandler.downloadPDF(data.paper);
    case 'batchDownloadPapers':
      return await downloadHandler.batchDownloadPapers(data.papers);
    
    case 'openSettings': 
      chrome.runtime.openOptionsPage();
      return { success: true };
      
    default:
      logger.error('[MessageDispatcher] Unknown action received:', action);
      return { success: false, error: `未知操作: ${action}` };
  }
}

/**
 * 初始化消息监听器，处理从内容脚本或弹出窗口发来的消息
 */
function initializeMessageListener() {
  logger.log('[MessageDispatcher] 初始化消息监听器');
  
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    logger.log('[MessageDispatcher] 接收到消息:', message, '来自:', sender.tab ? `标签页 ${sender.tab.id}` : '扩展上下文');
    
    if (!message || !message.action) {
      logger.error('[MessageDispatcher] 接收到无效的消息格式');
      sendResponse({ success: false, error: '无效的消息格式' });
      return true; 
    }
    
    handleAction(message, sender)
      .then(response => {
        logger.log('[MessageDispatcher] 发送响应，操作:', message.action, '响应:', response);
        sendResponse(response);
      })
      .catch(error => {
        logger.error('[MessageDispatcher] 处理操作出错', message.action, '错误:', error);
        sendResponse({ success: false, error: error.message || '未知错误' });
      });
    
    return true; // 表示我们将异步回应
  });
  
  logger.log('[MessageDispatcher] 消息监听器初始化完成');
}

export const messageDispatcher = {
  initializeMessageListener,
}; 