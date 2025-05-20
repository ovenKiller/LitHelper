/**
 * background.js
 * 
 * 扩展的后台服务脚本，处理跨页面数据和API调用
 */

// 导入存储服务
// import { storage } from '../utils/storage.js'; // 由 configManager 和 paperBoxManager 等内部使用
import { notificationService } from './services/notificationService.js';
import { contextMenuService } from './services/contextMenuService.js';
import { configManager } from './features/configManager.js'; // 新增导入
import { logger } from './utils/logger.js'; // 导入 logger
import { paperBoxManager } from './features/paperBoxManager.js'; // 新增导入
import { messageDispatcher } from './services/messageDispatcher.js'; // 新增导入
// import { paperMetadataService } from './features/paperMetadataService.js'; // 不再直接被 background.js 中的遗留函数使用

// 存储摘要、分类和下载的论文
// const storedData = {
//   // summaries: {}, // 由 summarizationHandler 管理
//   downloads: {}
//   // paperBox: {} // 由 paperBoxManager 管理
// };

// 导入LLM提供商工厂(将在实际实现中导入)
// import { getLLMProvider } from '../api/llmProviders/index.js';

// 初始化配置
// let config = { ... }; // 由 configManager 管理

// 背景脚本启动时立即加载数据
(async () => {
  logger.log('[BG_TRACE] IIFE: Service Worker 开始启动流程...');
  try {
    // 初始化配置管理器 (加载配置)
    await configManager.loadInitialConfig();
    
    // 初始化论文盒管理器 (加载论文盒数据)
    await paperBoxManager.loadInitialPaperBoxData(); 
    
    // paperMetadataService, summarizationHandler, downloadHandler 
    // 目前是按需在 messageDispatcher 中调用，它们内部管理自己的内存缓存，
    // 如果需要持久化或启动时加载，它们的模块内部需要添加类似 loadInitialData 的方法。
    // 对于当前的模拟实现（内存缓存），它们不需要在启动时执行特定加载。

    // 初始化上下文菜单
    contextMenuService.initializeContextMenus();
    
    // 初始化消息监听器 (它将使用所有已配置的 handlers/managers)
    messageDispatcher.initializeMessageListener();
    
    logger.log('[BG_TRACE] IIFE: Service Worker 初始化完成。所有核心服务已启动。'); 
  } catch (error) {
    logger.error('[BG_TRACE] IIFE: Service Worker 初始化过程中发生严重错误:', error);
  }
})();

// 当扩展安装或更新时初始化
chrome.runtime.onInstalled.addListener(async (details) => {
  logger.log('[BG_TRACE] onInstalled: 事件触发，原因:', details.reason);
  
  // 确保上下文菜单在安装/更新时设置 (initializeContextMenus 内部处理重复移除)
  // contextMenuService.initializeContextMenus();

  if (details.reason === 'install') {
    logger.log('[BG_TRACE] onInstalled: 插件首次安装。');
    // configManager.loadInitialConfig() 在 IIFE 中已处理首次保存默认配置。
    // paperBoxManager.loadInitialPaperBoxData() (或 clearAllPapers) 在 IIFE 或 onInstalled 中确保了初始状态。
    // 如果 clearAllPapers 不是在 loadInitialPaperBoxData 内部隐式完成的，可以显式调用：
    // await paperBoxManager.clearAllPapers(); // 确保首次安装时论文盒为空并保存
  } else if (details.reason === 'update') {
    logger.log('[BG_TRACE] onInstalled: 插件已更新。');
    // 配置和数据已在 IIFE 中的 loadInitial... 调用中处理。
    // 如果更新时需要特定逻辑（例如数据迁移），应在此处添加。
  }
  logger.log('[BG_TRACE] onInstalled: 处理完毕。');
});

// 加载存储的配置
// async function loadConfig() { ... } // 移除，由 configManager 处理

// 加载论文盒数据
// async function loadPaperBoxData() { ... } // 移除

// 保存论文盒数据
// async function savePaperBoxData() { ... } // 移除

// 保存配置到存储
// async function saveConfig(newConfig) { ... } // 移除，由 configManager 处理

// 监听来自内容脚本或弹出窗口的消息
// chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
//   logger.log('[BG_MSG] Received message:', message, 'from:', sender.tab ? `tab ${sender.tab.id}` : 'extension context');
//   
//   if (!message || !message.action) {
//     logger.error('[BG_MSG] Invalid message format received.');
//     sendResponse({ success: false, error: '无效的消息格式' });
//     return true; 
//   }
//   
//   handleAction(message, sender)
//     .then(response => {
//       logger.log('[BG_MSG] Sending response for action', message.action, ':', response);
//       sendResponse(response);
//     })
//     .catch(error => {
//       logger.error('[BG_MSG] Error handling action', message.action, ':', error);
//       sendResponse({ success: false, error: error.message || '未知错误' });
//     });
//   
//   return true; // 表示我们将异步回应
// });

// 处理不同类型的操作
// async function handleAction(message, sender) { ... } // 移除，由 messageDispatcher 处理

// 以下函数暂时保留在 background.js 并导出，
// 因为 messageDispatcher.js 目前直接从这里导入它们。
// 它们将在后续步骤中被迁移到各自的特性模块。

// export async function getPaperDetails(paperId) { ... } // 移除，已迁移到 paperMetadataService

// export async function findPDFUrl(paper) { ... }
// export async function downloadPDF(paper) { ... }
// export async function batchDownloadPapers(papers) { ... }

logger.log('[BG_TRACE] Research Summarizer Background Service Worker 脚本已执行完毕 (顶层解析)。'); 