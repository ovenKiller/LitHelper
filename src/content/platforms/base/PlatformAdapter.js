/**
 * PlatformAdapter.js
 * 
 * Base class for platform-specific adapters
 */

import UIManager from '../../ui/UIManager';

import { logger } from '../../../background/utils/logger';
class PlatformAdapter {
  constructor() {
    this.uiManager = null;
  }

  /**
   * Initialize the platform adapter
   * @returns {Promise<void>}
   */
  async initialize() {
    if (!this.isPageSupported()) {
      throw new Error('Page not supported');
    }
    logger.log("platform adapter初始化")
    // 在initialize方法中创建UIManager
    this.uiManager = new UIManager();
    await this.uiManager.initialize(this);
    await this.injectUI();
  }

  /**
   * Check if current page is supported
   * @returns {boolean}
   */
  isPageSupported() {
    // This should be implemented by subclasses
    return false;
  }

  /**
   * Extract papers from elements
   * @param {NodeList|Element[]} resultItems - Paper result elements
   * @param {string} sourceTag - Source tag for the papers
   * @param {string} idPrefix - ID prefix for the papers
   * @returns {Array} Extracted papers
   */
  extractPapersFromElements(resultItems, sourceTag, idPrefix) {
    // This should be implemented by subclasses
    return [];
  }

  /**
   * Extract papers from current page
   * @returns {Promise<Array>} Extracted papers
   */
  async extractPapers() {
    // This should be implemented by subclasses
    return [];
  }

  /**
   * Extract papers from HTML content
   * @param {string} html - HTML content
   * @returns {Array} Extracted papers
   */
  extractPapersFromHTML(html) {
    // This should be implemented by subclasses
    return [];
  }

  /**
   * Get papers by URL
   * @param {string} url - URL to fetch papers from
   * @returns {Promise<Array>} Fetched papers
   */
  async getPapersByUrl(url) {
    // This should be implemented by subclasses
    return [];
  }

  /**
   * Inject UI components into the page
   * @returns {Promise<void>}
   */
  async injectUI() {
    
  }
  /*
  搜索结果中的所有论文数量
  */
  getPaperCount(){
    return 0;
  }

  /*
  当前论文在搜索结果中的位置
  */
  getCurrentPaperNumber(){
    return 0;
  }
  /**
   * Remove injected UI components
   * @returns {Promise<void>}
   */
  async removeInjectedUI() {
    if (this.uiManager) {
      this.uiManager.removeAllComponents();
    }
  }

  /**
   * Get the container element for paper results
   * @returns {HTMLElement|null}
   */
  getResultsContainer() {
    // This should be implemented by subclasses
    return null;
  }

  /**
   * Check if papers should be re-extracted on mutation
   * @param {MutationRecord[]} mutations - DOM mutations
   * @returns {boolean}
   */
  shouldReextractOnMutation(mutations) {
    // This should be implemented by subclasses
    return false;
  }

  /**
   * Get the name of the platform
   * @returns {string} The platform name
   */
  getPlatformName() {
    // This should be implemented by subclasses
    return '';
  }

  /**
   * Handle page content changes
   * @returns {Promise<void>}
   */
  async handlePageChange() {
    if (!this.uiManager) return;

    // 保存当前悬浮按钮的状态
    const floatingButtonVisible = this.uiManager.floatingButton && 
      this.uiManager.floatingButton.element && 
      this.uiManager.floatingButton.element.style.display !== 'none';
    
    // 移除所有UI组件
    await this.removeInjectedUI();
    
    // 重新注入UI
    await this.injectUI();
    
    // 如果之前悬浮按钮是可见的，则重新显示
    if (floatingButtonVisible && this.uiManager.floatingButton) {
      this.uiManager.floatingButton.show();
    }
  }
}

export default PlatformAdapter; 