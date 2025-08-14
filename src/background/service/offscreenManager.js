/**
 * offscreenManager.js
 * 
 * 统一管理 offscreen 文档的创建和生命周期
 * 避免多个服务重复创建 offscreen 文档导致冲突
 */

import { logger } from '../../util/logger.js';

class OffscreenManager {
  constructor() {
    this.isCreating = false; // 防止并发创建
    this.createPromise = null; // 存储创建过程的 Promise
  }

  /**
   * 确保 offscreen 文档存在
   * @returns {Promise<void>}
   */
  async ensureOffscreenDocument() {
    // 如果正在创建中，等待创建完成
    if (this.isCreating && this.createPromise) {
      logger.log('[OffscreenManager] 正在创建 offscreen 文档，等待完成...');
      return this.createPromise;
    }

    try {
      // 检查是否已存在 offscreen 文档
      const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT']
      });
      
      if (existingContexts.length > 0) {
        logger.log('[OffscreenManager] offscreen 文档已存在，复用现有文档');
        return;
      }

      // 开始创建过程
      this.isCreating = true;
      this.createPromise = this._createOffscreenDocument();
      
      await this.createPromise;
      
    } finally {
      this.isCreating = false;
      this.createPromise = null;
    }
  }

  /**
   * 内部方法：创建 offscreen 文档
   * @returns {Promise<void>}
   * @private
   */
  async _createOffscreenDocument() {
    try {
      logger.log('[OffscreenManager] 开始创建统一 offscreen 文档...');
      
      await chrome.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: ['DOM_SCRAPING', 'DOM_PARSER'],
        justification: '获取网页内容、支持JavaScript渲染和HTML解析'
      });
      
      // 等待文档加载
      await this._delay(1000);
      
      logger.log('[OffscreenManager] 统一 offscreen 文档创建成功');
      
    } catch (error) {
      if (error.message.includes('Only a single offscreen document may be created')) {
        logger.log('[OffscreenManager] offscreen 文档已存在，继续使用现有文档');
        // 这不是真正的错误，只是表示文档已经存在
        return;
      } else {
        logger.error('[OffscreenManager] 创建 offscreen 文档失败:', error);
        throw error;
      }
    }
  }

  /**
   * 检查 offscreen 文档是否存在
   * @returns {Promise<boolean>}
   */
  async isOffscreenDocumentExists() {
    try {
      const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT']
      });
      return existingContexts.length > 0;
    } catch (error) {
      logger.error('[OffscreenManager] 检查 offscreen 文档状态失败:', error);
      return false;
    }
  }

  /**
   * 关闭 offscreen 文档
   * @returns {Promise<void>}
   */
  async closeOffscreenDocument() {
    try {
      const exists = await this.isOffscreenDocumentExists();
      if (exists) {
        await chrome.offscreen.closeDocument();
        logger.log('[OffscreenManager] offscreen 文档已关闭');
      } else {
        logger.log('[OffscreenManager] 没有需要关闭的 offscreen 文档');
      }
    } catch (error) {
      logger.error('[OffscreenManager] 关闭 offscreen 文档失败:', error);
      throw error;
    }
  }

  /**
   * 延迟指定时间
   * @param {number} ms - 延迟时间（毫秒）
   * @returns {Promise<void>}
   * @private
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 获取 offscreen 文档的状态信息
   * @returns {Promise<Object>}
   */
  async getStatus() {
    try {
      const exists = await this.isOffscreenDocumentExists();
      const contexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT']
      });
      
      return {
        exists,
        count: contexts.length,
        isCreating: this.isCreating,
        contexts: contexts.map(ctx => ({
          documentId: ctx.documentId,
          origin: ctx.documentOrigin,
          url: ctx.documentUrl
        }))
      };
    } catch (error) {
      logger.error('[OffscreenManager] 获取状态失败:', error);
      return {
        exists: false,
        count: 0,
        isCreating: this.isCreating,
        error: error.message
      };
    }
  }
}

// 创建单例实例
export const offscreenManager = new OffscreenManager();
export default offscreenManager;
