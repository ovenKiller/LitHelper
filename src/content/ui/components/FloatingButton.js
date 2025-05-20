/**
 * FloatingButton.js
 * 控制悬浮按钮的显示和隐藏
 * A floating button component that can be used across different platforms
 */

import { logger } from '../../../background/utils/logger.js';

class FloatingButton {
  constructor() {
    this.element = null;
    this.tooltip = null;
    this.onClickCallback = null;
    this.counterBadge = null;
    this.paperCount = 0;
  }

  /**
   * Load CSS file for the floating button
   * @private
   */
  _loadStyles() {
    const cssPath = chrome.runtime.getURL('content/ui/styles/FloatingButton.css');
    if (!document.querySelector(`link[href="${cssPath}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.type = 'text/css';
      link.href = cssPath;
      document.head.appendChild(link);
    }
  }

  /**
   * 参数是点击的动作，目前实现中，点击会调用togglePopup，使得popupWindow显示或隐藏
   * @param {Function} onClickCallback - Callback function when button is clicked
   * @returns {Promise<void>}
   */
  async initialize(onClickCallback) {
    this._loadStyles();
    this.onClickCallback = onClickCallback;
    this.element = this.createElement();
    document.body.appendChild(this.element);
  }

  /**
   * Create the floating button element
   * @returns {HTMLElement}
   */
  createElement() {
    // Create button element
    const button = document.createElement('button');
    button.className = 'rs-floating-button';
    button.title = 'Research Summarizer';
    button.textContent = 'RS';

    // Create counter badge
    this.counterBadge = document.createElement('div');
    this.counterBadge.className = 'rs-counter-badge';
    this.counterBadge.style.display = 'none';
    button.appendChild(this.counterBadge);
    logger.log("按钮元素创建了");
    // Add click event
    button.addEventListener('click', () => {
      logger.log("floating button is clicked");
      if (this.onClickCallback) {
        this.onClickCallback();
      }
    });
    
    return button;
  }

  /**
   * Show the floating button
   */
  show() {
    logger.log('show floating button');
    if (this.element) {
      this.element.style.display = 'flex';
      logger.log('Floating button shown');
    } else {
      logger.warn('Cannot show floating button: element is null');
    }
  }

  /**
   * Hide the floating button
   */
  hide() {
    if (this.element) {
      this.element.style.display = 'none';
    }
  }

  /**
   * Remove the floating button
   */
  remove() {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }

  /**
   * Set the number of collected papers and update the counter badge
   * @param {number} count - Number of collected papers
   */
  setPaperCount(count) {
    if (typeof count !== 'number') {
      logger.warn('Invalid paper count provided:', count);
      count = 0;
    }
    
    this.paperCount = count;
    
    if (this.counterBadge) {
      if (this.paperCount > 0) {
        this.counterBadge.textContent = this.paperCount.toString();
        this.counterBadge.style.display = 'flex';
      } else {
        this.counterBadge.style.display = 'none';
      }
    }
  }
}

export default FloatingButton; 