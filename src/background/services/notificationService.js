import { logger } from '../utils/logger.js'; // 假设我们有一个 logger 工具

/**
 * 向所有符合条件的标签页发送消息。
 * @param {string} action - 消息的操作类型。
 * @param {object} data - 要发送的数据。
 * @param {string} loggingContext - 用于日志记录的上下文名称。
 */
async function notifyAllTabs(action, data, loggingContext = 'NotificationService') {
  logger.log(`[${loggingContext}] Preparing to send message. Action: ${action}, Data:`, data);
  try {
    const tabs = await chrome.tabs.query({ url: ["http://*/*", "https://*/*"] });
    if (tabs.length === 0) {
      logger.log(`[${loggingContext}] No matching active tabs found to send update for action: ${action}.`);
      return;
    }

    let sentToAtLeastOneTab = false;
    for (const tab of tabs) {
      if (tab.id) {
        try {
          logger.log(`[${loggingContext}] Attempting to send to Tab ID: ${tab.id} for action: ${action}`);
          await chrome.tabs.sendMessage(tab.id, {
            action: action,
            data: data
          });
          sentToAtLeastOneTab = true;
          logger.log(`[${loggingContext}] Successfully sent to Tab ID: ${tab.id} for action: ${action}`);
        } catch (e) {
          if (e.message && !e.message.toLowerCase().includes("could not establish connection") && !e.message.toLowerCase().includes("receiving end does not exist")) {
            logger.warn(`[${loggingContext}] Failed to send message to tab ${tab.id} (${tab.url}) for action ${action}:`, e.message);
          } else {
            // Common case, no need to log as warning unless debugging
            logger.debug(`[${loggingContext}] Tab ${tab.id} (${tab.url}) had no receiving end or connection failed for action ${action} (common).`);
          }
        }
      }
    }

    if (sentToAtLeastOneTab) {
      logger.log(`[${loggingContext}] Message for action ${action} sent to at least one relevant tab.`);
    } else {
      logger.log(`[${loggingContext}] Message for action ${action} was not successfully sent to any active tabs.`);
    }
  } catch (error) {
    logger.error(`[${loggingContext}] Outer error during notification for action ${action}:`, error);
  }
}

export const notificationService = {
  notifyAllTabs
}; 