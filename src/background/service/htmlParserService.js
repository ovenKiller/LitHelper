/**
 * htmlParserService.js
 * 
 * HTML解析服务，利用offscreen提供HTML解析和CSS选择器提取功能
 */

import { logger } from '../../util/logger.js';

/**
 * HTML解析服务类
 * 利用offscreen document来解析HTML和提取元素
 */
export class HtmlParserService {
  constructor() {
    this.isInitialized = false;
  }

  /**
   * 初始化HTML解析服务
   */
  async initialize() {
    if (this.isInitialized) {
      logger.warn('[HtmlParserService] Already initialized');
      return;
    }

    try {
      logger.log('[HtmlParserService] Initializing HTML parser service...');
      
      // 确保 Offscreen 文档存在
      await this.ensureOffscreenDocument();
      
      this.isInitialized = true;
      logger.log('[HtmlParserService] HTML parser service initialized successfully');
    } catch (error) {
      logger.error('[HtmlParserService] Failed to initialize HTML parser service:', error);
      throw error;
    }
  }

  /**
   * 解析HTML并提取指定CSS选择器的元素
   * @param {string} html - HTML字符串
   * @param {string} selector - CSS选择器
   * @returns {Promise<Array<string>>} 提取到的元素文本内容列表
   */
  async extractTextContent(html, selector) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const result = await this.extractElements(html, selector);
      
      if (!result.success) {
        throw new Error(result.error);
      }

      // 返回文本内容列表
      return result.data.elements.map(element => element.textContent);
    } catch (error) {
      logger.error('[HtmlParserService] Failed to extract text content:', error);
      throw error;
    }
  }

  /**
   * 解析HTML并提取指定CSS选择器的元素（完整信息）
   * @param {string} html - HTML字符串
   * @param {string} selector - CSS选择器
   * @returns {Promise<Object>} 提取结果，包含完整的元素信息
   */
  async extractElements(html, selector) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      if (!html || typeof html !== 'string') {
        throw new Error('HTML parameter is required and must be a string');
      }

      if (!selector || typeof selector !== 'string') {
        throw new Error('Selector parameter is required and must be a string');
      }

      logger.log(`[HtmlParserService] Extracting elements with selector: ${selector}`);
      
      // 发送消息到 Offscreen 文档进行解析
      const response = await chrome.runtime.sendMessage({
        target: 'offscreen',
        action: 'extractElements',
        data: {
          html,
          selector
        }
      });

      if (response && response.success) {
        logger.log(`[HtmlParserService] Successfully extracted ${response.data.matchCount} elements`);
        return response;
      } else {
        throw new Error(response?.error || 'Unknown error occurred during extraction');
      }
    } catch (error) {
      logger.error('[HtmlParserService] Failed to extract elements:', error);
      throw error;
    }
  }

  /**
   * 解析HTML并提取指定CSS选择器的元素HTML内容
   * @param {string} html - HTML字符串
   * @param {string} selector - CSS选择器
   * @returns {Promise<Array<string>>} 提取到的元素HTML内容列表
   */
  async extractInnerHTML(html, selector) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const result = await this.extractElements(html, selector);
      
      if (!result.success) {
        throw new Error(result.error);
      }

      // 返回innerHTML内容列表
      return result.data.elements.map(element => element.innerHTML);
    } catch (error) {
      logger.error('[HtmlParserService] Failed to extract innerHTML:', error);
      throw error;
    }
  }

  /**
   * 解析HTML并提取指定CSS选择器的元素外层HTML内容
   * @param {string} html - HTML字符串
   * @param {string} selector - CSS选择器
   * @returns {Promise<Array<string>>} 提取到的元素outerHTML内容列表
   */
  async extractOuterHTML(html, selector) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const result = await this.extractElements(html, selector);
      
      if (!result.success) {
        throw new Error(result.error);
      }

      // 返回outerHTML内容列表
      return result.data.elements.map(element => element.outerHTML);
    } catch (error) {
      logger.error('[HtmlParserService] Failed to extract outerHTML:', error);
      throw error;
    }
  }

  /**
   * 获取元素数量
   * @param {string} html - HTML字符串
   * @param {string} selector - CSS选择器
   * @returns {Promise<number>} 匹配的元素数量
   */
  async getElementCount(html, selector) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const result = await this.extractElements(html, selector);
      
      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data.matchCount;
    } catch (error) {
      logger.error('[HtmlParserService] Failed to get element count:', error);
      throw error;
    }
  }

  /**
   * 确保 Offscreen 文档存在
   * @returns {Promise<void>}
   */
  async ensureOffscreenDocument() {
    try {
      // 检查是否已存在 Offscreen 文档
      const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT']
      });
      
      if (existingContexts.length === 0) {
        // 创建 Offscreen 文档
        await chrome.offscreen.createDocument({
          url: 'offscreen.html',
          reasons: ['DOM_PARSER'],
          justification: 'Parse HTML content using DOMParser for CSS selector extraction'
        });
        
        logger.log('[HtmlParserService] Offscreen document created');
      } else {
        logger.log('[HtmlParserService] Offscreen document already exists');
      }
    } catch (error) {
      logger.error('[HtmlParserService] Failed to ensure offscreen document:', error);
      throw error;
    }
  }

  /**
   * 销毁服务，清理资源
   */
  async destroy() {
    try {
      // 可以在这里添加清理逻辑
      this.isInitialized = false;
      logger.log('[HtmlParserService] Service destroyed');
    } catch (error) {
      logger.error('[HtmlParserService] Error during destruction:', error);
    }
  }
}

// 创建单例实例
export const htmlParserService = new HtmlParserService(); 