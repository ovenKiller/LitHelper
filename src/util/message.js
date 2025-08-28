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
  CLEAR_PAPER_BOX: 'clearPaperBox',

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

  // Storage related (存储相关)
  CLEAR_ALL_CSS_SELECTORS: 'clearAllCssSelectors',

  // Paper metadata processing (论文元数据处理相关)
  PROCESS_PAPERS: 'processPapers',
  PROCESS_PAPER_ELEMENT_LIST: 'processPaperElementList',
  PAPER_PREPROCESSING_COMPLETED: 'paperPreprocessingCompleted',


  // Organize related (整理论文相关)
  ORGANIZE_PAPERS: 'organizePapers',
  // Offscreen document actions (离屏文档操作)
  PARSE_HTML: 'parseHTML',
  EXTRACT_ELEMENTS: 'extractElements',
  COMPRESS_HTML: 'compressHtml',
  EXTRACT_LARGE_TEXT_BLOCKS: 'extractLargeTextBlocks',
  EXTRACT_LARGE_TEXT_BLOCKS_CLEAN: 'EXTRACT_LARGE_TEXT_BLOCKS_CLEAN',

  // Internal/System actions (内部/系统操作)
  OPEN_SETTINGS: 'openSettings',
  OPEN_SETTINGS_SECTION: 'openSettingsSection',
  OPEN_WORKING_DIRECTORY: 'openWorkingDirectory',
  OPEN_FILE_DIRECTORY: 'openFileDirectory',
  SHOW_DOWNLOAD_IN_FOLDER: 'showDownloadInFolder',

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

/**
 * 向所有标签页发送消息
 * @param {MessageActions} action - 消息动作
 * @param {any} data - 要发送的数据
 * @param {string} source - 发送源标识（用于日志，可选）
 * @returns {Promise<{success: boolean, results: Array}>}
 */
export async function broadcastToAllTabs(action, data, source = 'Unknown') {
  try {
    console.log(`[${source}] 准备广播消息给所有标签页: action=${action}`);

    // 获取所有标签页
    const tabs = await chrome.tabs.query({});
    console.log(`[${source}] 找到 ${tabs.length} 个标签页`);

    const results = [];

    // 向所有标签页发送消息
    for (const tab of tabs) {
      try {
        await sendMessageToContentScript(tab.id, action, data);
        results.push({ tabId: tab.id, success: true });
        console.debug(`[${source}] 标签页 ${tab.id} 消息发送成功`);
      } catch (error) {
        results.push({ tabId: tab.id, success: false, error: error.message });
        console.debug(`[${source}] 向标签页 ${tab.id} 发送消息失败:`, error.message);
      }
    }

    console.log(`[${source}] 广播完成，成功: ${results.filter(r => r.success).length}/${results.length}`);

    return {
      success: true,
      results,
      totalTabs: tabs.length,
      successCount: results.filter(r => r.success).length
    };
  } catch (error) {
    console.error(`[${source}] 广播消息时发生错误:`, error);
    return {
      success: false,
      error: error.message,
      results: []
    };
  }
}

/**
 * 向匹配指定URL的标签页发送消息
 * @param {string} targetUrl - 目标URL
 * @param {MessageActions} action - 消息动作
 * @param {any} data - 要发送的数据
 * @param {string} source - 发送源标识（用于日志，可选）
 * @returns {Promise<{success: boolean, results: Array, matchingTabs: Array}>}
 */
export async function sendToMatchingTabs(targetUrl, action, data, source = 'Unknown') {
  try {
    console.log(`[${source}] 准备发送消息给匹配URL的标签页: ${targetUrl}`);

    // 获取所有标签页
    const tabs = await chrome.tabs.query({});
    console.log(`[${source}] 找到 ${tabs.length} 个标签页`);

    // 查找匹配URL的标签页
    const matchingTabs = tabs.filter(tab => {
      if (!tab.url) {
        return false;
      }

      try {
        const tabUrl = new URL(tab.url);
        const target = new URL(targetUrl);

        // 比较域名和路径（忽略查询参数和锚点）
        return tabUrl.hostname === target.hostname && tabUrl.pathname === target.pathname;
      } catch (error) {
        console.error(`[${source}] URL解析错误:`, error);
        return false;
      }
    });

    console.log(`[${source}] 找到 ${matchingTabs.length} 个匹配的标签页`);

    const results = [];

    // 向匹配的标签页发送消息
    for (const tab of matchingTabs) {
      try {
        await sendMessageToContentScript(tab.id, action, data);
        results.push({ tabId: tab.id, success: true });
        console.log(`[${source}] 标签页 ${tab.id} 消息发送成功`);
      } catch (error) {
        results.push({ tabId: tab.id, success: false, error: error.message });
        console.error(`[${source}] 向标签页 ${tab.id} 发送消息失败:`, error);
      }
    }

    if (matchingTabs.length === 0) {
      console.warn(`[${source}] 没有找到匹配URL的标签页: ${targetUrl}`);
    }

    return {
      success: true,
      results,
      matchingTabs: matchingTabs.map(tab => ({ id: tab.id, url: tab.url })),
      totalMatching: matchingTabs.length,
      successCount: results.filter(r => r.success).length
    };
  } catch (error) {
    console.error(`[${source}] 发送消息到匹配标签页时发生错误:`, error);
    return {
      success: false,
      error: error.message,
      results: [],
      matchingTabs: []
    };
  }
}
