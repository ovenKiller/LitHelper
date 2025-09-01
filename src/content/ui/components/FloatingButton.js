/**
 * FloatingButton.js
 * 控制悬浮按钮的显示和隐藏
 * A floating button component that can be used across different platforms
 */

import { logger } from '../../../util/logger.js';
import { sendMessageToBackend, MessageActions, addContentScriptMessageListener } from '../../../util/message.js';

class FloatingButton {
  constructor() {
    this.element = null;
    this.tooltip = null;
    this.onClickCallback = null;
    this.counterBadge = null;
    this.paperCount = 0;

    // 任务状态管理
    this.isProcessing = false;
    this.activeTasksCount = 0;
    this.statusCheckInterval = null;
    this.statusCheckIntervalMs = 10000; // 10秒检查一次
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

    // 设置任务状态监听和定时检查
    this._setupTaskStatusListeners();
    this._startStatusPolling();

    // 初始检查任务状态
    await this._checkTaskStatus();
  }

  /**
   * Create the floating button element
   * @returns {HTMLElement}
   */
  createElement() {
    // Create button element
    const button = document.createElement('button');
    button.className = 'rs-floating-button';
    button.title = '';

    // Set logo as background image
    const logoUrl = chrome.runtime.getURL('icons/logo256.png');
    button.style.backgroundImage = `url("${logoUrl}")`;

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

  /**
   * 设置任务状态监听器
   * @private
   */
  _setupTaskStatusListeners() {
    const handlers = new Map();

    // 监听批次开始消息 - 有任务开始时增加计数
    handlers.set('BATCH_PROCESSING_STARTED', (data) => {
      logger.log('[FloatingButton] 收到批次开始通知:', data);
      this.activeTasksCount++;
      this._updateProcessingState({ hasActiveTasks: true, totalActiveBatches: this.activeTasksCount });
    });

    // 监听批次完成消息 - 有任务完成时减少计数
    handlers.set('BATCH_PROCESSING_COMPLETED', (data) => {
      logger.log('[FloatingButton] 收到批次完成通知:', data);
      this.activeTasksCount = Math.max(0, this.activeTasksCount - 1);
      this._updateProcessingState({ hasActiveTasks: this.activeTasksCount > 0, totalActiveBatches: this.activeTasksCount });
    });

    addContentScriptMessageListener(handlers);
  }

  /**
   * 开始定时状态轮询
   * @private
   */
  _startStatusPolling() {
    // 清除现有的定时器
    if (this.statusCheckInterval) {
      clearInterval(this.statusCheckInterval);
    }

    // 设置新的定时器
    this.statusCheckInterval = setInterval(() => {
      this._checkTaskStatus();
    }, this.statusCheckIntervalMs);

    logger.log('[FloatingButton] 开始任务状态定时检查');
  }

  /**
   * 停止定时状态轮询
   * @private
   */
  _stopStatusPolling() {
    if (this.statusCheckInterval) {
      clearInterval(this.statusCheckInterval);
      this.statusCheckInterval = null;
      logger.log('[FloatingButton] 停止任务状态定时检查');
    }
  }

  /**
   * 检查任务状态
   * @private
   */
  async _checkTaskStatus() {
    try {
      const response = await sendMessageToBackend(MessageActions.GET_ACTIVE_TASKS_STATUS);

      if (response && response.success) {
        this._updateProcessingState(response.data);
        // 同步计数器，以防推送消息丢失
        this.activeTasksCount = response.data.totalActiveBatches || 0;
      } else {
        logger.warn('[FloatingButton] 获取任务状态失败:', response?.error);
      }
    } catch (error) {
      logger.error('[FloatingButton] 检查任务状态时出错:', error);
    }
  }

  /**
   * 更新处理状态
   * @param {Object} statusInfo - 状态信息
   * @private
   */
  _updateProcessingState(statusInfo) {
    const wasProcessing = this.isProcessing;
    this.isProcessing = statusInfo.hasActiveTasks;

    // 如果状态发生变化，更新UI
    if (wasProcessing !== this.isProcessing) {
      this._updateProcessingAnimation();
      logger.log(`[FloatingButton] 处理状态变化: ${wasProcessing} -> ${this.isProcessing}, 活跃任务数: ${statusInfo.totalActiveBatches || 0}`);
    }
  }

  /**
   * 更新处理动画
   * @private
   */
  _updateProcessingAnimation() {
    if (!this.element) return;

    if (this.isProcessing) {
      this.element.classList.add('processing');
      logger.log('[FloatingButton] 开始处理动画');
    } else {
      this.element.classList.remove('processing');
      logger.log('[FloatingButton] 停止处理动画');
    }
  }

  /**
   * Remove the floating button
   */
  remove() {
    // 停止状态轮询
    this._stopStatusPolling();

    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
}

export default FloatingButton;