/**
 * GoogleScholarElementExtractor.js
 * 
 * Google Scholar 页面元素提取器
 * 负责从 Google Scholar 页面中提取论文相关的 DOM 元素
 */

import { logger } from '../../../util/logger.js';
import { runTimeDataService } from '../../../service/runTimeDataService.js';
import { PLATFORM_KEYS } from '../../../constants.js';

class GoogleScholarElementExtractor {
  constructor() {
    // 从配置服务获取选择器
    this.selectors = this.loadSelectors();
  }

  /**
   * 加载选择器配置
   * @returns {Object} 选择器配置对象
   */
  loadSelectors() {
    // try {
    //   const selectors = runTimeDataService.getPlatformSelectors(PLATFORM_KEYS.GOOGLE_SCHOLAR);
    //   if (!selectors) {
    //     logger.error('[GoogleScholarElementExtractor] 无法加载选择器配置，使用默认配置');
    //     // 如果无法加载配置，使用默认选择器
    //     return runTimeDataService.getDefaultSelectors(PLATFORM_KEYS.GOOGLE_SCHOLAR);
    //   }
      
    //   logger.log('[GoogleScholarElementExtractor] 成功加载选择器配置');
    //   return selectors;
    // } catch (error) {
    //   logger.error('[GoogleScholarElementExtractor] 加载选择器配置失败:', error);
    //   return runTimeDataService.getDefaultSelectors(PLATFORM_KEYS.GOOGLE_SCHOLAR);
    // }
  }



  /**
   * 提取论文元素
   * @param {HTMLElement} containerElement - 容器 DOM 元素
   * @returns {Array<HTMLElement>} 论文元素列表
   */
  extractPaperElements(containerElement) {
    try {
      // 如果没有传入容器元素，尝试从页面中获取
      if (!containerElement) {
        containerElement = this.getResultsContainer();
      }

      if (!containerElement) {
        logger.warn('[GoogleScholarElementExtractor] No container element found for paper extraction');
        return [];
      }

      // 尝试不同的选择器来获取论文元素
      let paperElements = [];
      
      for (const selector of this.selectors.paperItems) {
        paperElements = Array.from(containerElement.querySelectorAll(selector));
        if (paperElements.length > 0) {
          logger.log(`[GoogleScholarElementExtractor] Found ${paperElements.length} paper elements using selector: ${selector}`);
          break;
        }
      }

      // 过滤掉无效的元素
      paperElements = paperElements.filter(element => this.isValidPaperElement(element));

      logger.log(`[GoogleScholarElementExtractor] Successfully extracted ${paperElements.length} valid paper elements`);
      return paperElements;

    } catch (error) {
      logger.error('[GoogleScholarElementExtractor] Error extracting paper elements:', error);
      return [];
    }
  }

  /**
   * 获取搜索结果容器
   * @returns {HTMLElement|null} 搜索结果容器元素
   */
  getResultsContainer() {
    for (const selector of this.selectors.resultsContainer) {
      const container = document.querySelector(selector);
      if (container) {
        return container;
      }
    }
    return null;
  }

  /**
   * 验证是否为有效的论文元素
   * @param {HTMLElement} element - 要验证的元素
   * @returns {boolean} 是否为有效的论文元素
   */
  isValidPaperElement(element) {
    // 检查元素是否包含论文标题
    const titleElement = element.querySelector(this.selectors.paperTitle);
    if (!titleElement || !titleElement.textContent.trim()) {
      return false;
    }

    // 检查元素是否可见
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      return false;
    }

    return true;
  }

  /**
   * 从页面中提取所有论文元素
   * @returns {Array<HTMLElement>} 论文元素列表
   */
  extractAllPaperElements() {
    const container = this.getResultsContainer();
    return this.extractPaperElements(container);
  }

  /**
   * 检查页面是否包含论文结果
   * @returns {boolean} 是否包含论文结果
   */
  hasPaperResults() {
    const container = this.getResultsContainer();
    if (!container) return false;
    
    const paperElements = this.extractPaperElements(container);
    return paperElements.length > 0;
  }

  /**
   * 获取论文元素的索引
   * @param {HTMLElement} paperElement - 论文元素
   * @returns {number} 元素索引，如果未找到返回 -1
   */
  getPaperElementIndex(paperElement) {
    const allElements = this.extractAllPaperElements();
    return allElements.indexOf(paperElement);
  }

  /**
   * 重新加载选择器配置
   * 用于动态更新配置
   */
  reloadSelectors() {
    this.selectors = this.loadSelectors();
    logger.log('[GoogleScholarElementExtractor] 选择器配置已重新加载');
  }
}

export default GoogleScholarElementExtractor;
