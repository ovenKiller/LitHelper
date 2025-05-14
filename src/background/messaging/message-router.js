/**
 * message-router.js
 * 
 * 处理扩展内部消息路由
 */

export class MessageRouter {
  constructor() {
    this.handlers = new Map();
    this.setupMessageListener();
  }

  /**
   * 设置消息监听器
   */
  setupMessageListener() {
    // 监听来自内容脚本或弹出窗口的消息
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log('收到消息:', message, '来自:', sender);
      
      if (!message || !message.action) {
        sendResponse({ success: false, error: '无效的消息格式' });
        return;
      }
      
      // 处理消息
      this.handleMessage(message, sender)
        .then(response => sendResponse(response))
        .catch(error => {
          console.error('处理消息失败:', error);
          sendResponse({ 
            success: false, 
            error: error.message || '未知错误' 
          });
        });
      
      // 表示我们将异步回应
      return true;
    });
  }

  /**
   * 注册消息处理器
   * @param {string} action 操作类型
   * @param {Function} handler 处理函数
   */
  registerHandler(action, handler) {
    this.handlers.set(action, handler);
  }

  /**
   * 处理消息
   * @param {Object} message 消息对象
   * @param {Object} sender 发送者信息
   * @returns {Promise<Object>} 处理结果
   */
  async handleMessage(message, sender) {
    const { action, data } = message;
    
    const handler = this.handlers.get(action);
    if (handler) {
      return await handler(data, sender);
    }
    
    throw new Error(`未知操作: ${action}`);
  }
} 