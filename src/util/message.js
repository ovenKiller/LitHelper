/**
 * message.js
 * 
 * 统一管理扩展内部的消息通信
 */

/**
 * 定义所有消息操作类型，消除魔法字符串
 * @enum {string}
 */
export const MessageActions = {
  // Paperbox related (论文盒子相关)
  GET_PAPER_BOX_DATA: 'getPaperBoxData',
  PAPER_BOX_UPDATED: 'paperBoxUpdated',
  ADD_PAPER_TO_BOX: 'addPaperToBox',
  REMOVE_PAPER_FROM_BOX: 'removePaperFromBox',

  // Summarization related (摘要相关)
  SUMMARIZE_PAPER: 'summarizePaper',
  SUMMARIZE_ALL_PAPERS: 'summarizeAllPapers',
  GET_ALL_SUMMARIES: 'getAllSummaries',

  // Download related (下载相关)
  DOWNLOAD_PAPER: 'downloadPaper',
  DOWNLOAD_ALL_PAPERS: 'downloadAllPapers',

  // Config related (配置相关)
  UPDATE_CONFIG: 'updateConfig',

  // Content script related (内容脚本相关)
  GET_PAPERS: 'getPapers',

  // Task related (任务相关)
  ADD_TASK_TO_QUEUE: 'addTaskToQueue',
  TASK_COMPLETION_NOTIFICATION: 'taskCompletionNotification',
  CLEAR_ALL_TASK_DATA: 'clearAllTaskData',

  // Paper metadata processing (论文元数据处理相关)
  PROCESS_PAPERS: 'processPapers',
  PAPER_PREPROCESSING_COMPLETED: 'paperPreprocessingCompleted',

  // Internal/System actions (内部/系统操作)
  OPEN_SETTINGS: 'openSettings',
  
  // Notification actions (通知操作)
  SHOW_NOTIFICATION: 'showNotification',
};

/**
 * 创建一个消息对象
 * @param {MessageActions} action - 消息动作
 * @param {any} [data] - 附带的数据
 * @returns {{action: MessageActions, data: any}}
 */
export function createMessage(action, data) {
  return { action, data };
}

/**
 * 向后台脚本发送消息
 * @param {MessageActions} action - 消息动作
 * @param {any} [data] - 附带的数据
 * @returns {Promise<any>}
 */
export async function sendMessageToBackend(action, data) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(createMessage(action, data), (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(response);
      }
    });
  });
}

/**
 * 向指定标签页的内容脚本发送消息
 * @param {number} tabId - 目标标签页ID
 * @param {MessageActions} action - 消息动作
 * @param {any} [data] - 附带的数据
 * @returns {Promise<any>}
 */
export async function sendMessageToContentScript(tabId, action, data) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, createMessage(action, data), (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(response);
      }
    });
  });
}

/**
 * 添加消息监听器 (用于后台脚本)
 * @param {Map<MessageActions, Function>} handlers - 动作处理器映射
 */
export function addRuntimeMessageListener(handlers) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message && message.action && handlers.has(message.action)) {
      const handler = handlers.get(message.action);
      handler(message.data, sender, sendResponse);
      return true; // 异步响应
    }
  });
}

// 全局处理器映射，用于合并多个监听器
let globalContentScriptHandlers = new Map();
let contentScriptListenerSetup = false;

/**
 * 添加消息监听器 (用于内容脚本)
 * @param {Map<MessageActions, Function>} handlers - 动作处理器映射
 */
export function addContentScriptMessageListener(handlers) {
  // 将新的处理器合并到全局映射中
  for (const [action, handler] of handlers) {
    globalContentScriptHandlers.set(action, handler);
  }
  
  // 只在第一次调用时设置监听器
  if (!contentScriptListenerSetup) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message && message.action && globalContentScriptHandlers.has(message.action)) {
        const handler = globalContentScriptHandlers.get(message.action);
        handler(message.data, sender, sendResponse);
        return true; // 异步响应
      }
    });
    contentScriptListenerSetup = true;
  }
}
