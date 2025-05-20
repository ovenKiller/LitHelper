/**
 * PaperControls.js
 * 
 * Component for paper controls (summarize and download buttons)
 */

class PaperControls {
  constructor(paperId, container) {
    this.paperId = paperId;
    this.container = container;
    this.element = null;
    this.summarizeButton = null;
    this.downloadButton = null;
    this.addButton = null;
  }

  /**
   * Load CSS file for the paper controls
   * @private
   */
  _loadStyles() {
    const cssPath = chrome.runtime.getURL('content/ui/styles/PaperControls.css');
    if (!document.querySelector(`link[href="${cssPath}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.type = 'text/css';
      link.href = cssPath;
      document.head.appendChild(link);
    }
  }

  /**
   * Initialize the paper controls
   * @param {Object} options - 配置选项
   * @param {boolean} options.hasPdf - 是否有PDF可用
   * @param {Function} options.onSummarize - 点击总结按钮的回调
   * @param {Function} options.onDownload - 点击下载按钮的回调
   * @param {Function} options.onAddToPaperBox - 点击添加到论文盒按钮的回调
   * @returns {Promise<void>}
   */
  async initialize(options = { hasPdf: false }) {
    this._loadStyles();
    this.element = this.createElement(options);
    this.container.appendChild(this.element);
  }

  /**
   * Create the paper controls element
   * @param {Object} options - 配置选项
   * @param {boolean} options.hasPdf - 是否有PDF可用
   * @param {Function} options.onSummarize - 点击总结按钮的回调
   * @param {Function} options.onDownload - 点击下载按钮的回调
   * @param {Function} options.onAddToPaperBox - 点击添加到论文盒按钮的回调
   * @returns {HTMLElement}
   */
  createElement(options = { hasPdf: false }) {
    // Create controls container
    const container = document.createElement('div');
    container.className = 'rs-controls';
    container.dataset.paperId = this.paperId;
    
    // Create summarize button
    this.summarizeButton = document.createElement('button');
    this.summarizeButton.className = 'rs-summarize-btn';
    this.summarizeButton.dataset.paperId = this.paperId;
    this.summarizeButton.title = '总结这篇论文';
    this.summarizeButton.textContent = '总结';
    this.summarizeButton.addEventListener('click', () => {
      if (options.onSummarize) {
        options.onSummarize(this.paperId);
      }
    });
    container.appendChild(this.summarizeButton);
    
    // Create download button
    this.downloadButton = document.createElement('button');
    this.downloadButton.className = 'rs-download-btn';
    this.downloadButton.dataset.paperId = this.paperId;
    this.downloadButton.title = '下载PDF';
    this.downloadButton.textContent = '下载';
    
    // Disable download button if no PDF link
    if (!options.hasPdf) {
      this.downloadButton.disabled = true;
      this.downloadButton.title = '没有可用的PDF';
    } else {
      this.downloadButton.addEventListener('click', () => {
        if (options.onDownload) {
          options.onDownload(this.paperId);
        }
      });
    }
    container.appendChild(this.downloadButton);
    
    // 创建"添加到论文盒"按钮
    this.addButton = document.createElement('button');
    this.addButton.className = 'rs-add-btn';
    this.addButton.dataset.paperId = this.paperId;
    this.addButton.title = '添加到论文盒';
    this.addButton.textContent = '添加';
    this.addButton.addEventListener('click', () => {
      if (options.onAddToPaperBox) {
        options.onAddToPaperBox(this.paperId);
      }
    });
    container.appendChild(this.addButton);
    
    return container;
  }

  /**
   * Show loading indicator for summarize button
   */
  showSummarizeLoading() {
    if (!this.summarizeButton) return;
    
    // Save original text
    this.summarizeButton.dataset.originalText = this.summarizeButton.textContent;
    
    // Show loading state
    this.summarizeButton.textContent = '总结中...';
    this.summarizeButton.disabled = true;
    this.summarizeButton.classList.add('rs-loading');
  }

  /**
   * Hide loading indicator for summarize button
   */
  hideSummarizeLoading() {
    if (!this.summarizeButton) return;
    
    // Restore original text
    if (this.summarizeButton.dataset.originalText) {
      this.summarizeButton.textContent = this.summarizeButton.dataset.originalText;
    } else {
      this.summarizeButton.textContent = '总结';
    }
    
    // Restore state
    this.summarizeButton.disabled = false;
    this.summarizeButton.classList.remove('rs-loading');
  }

  /**
   * Show loading indicator for download button
   */
  showDownloadLoading() {
    if (!this.downloadButton || this.downloadButton.disabled) return;
    
    // Save original text
    this.downloadButton.dataset.originalText = this.downloadButton.textContent;
    
    // Show loading state
    this.downloadButton.textContent = '下载中...';
    this.downloadButton.disabled = true;
    this.downloadButton.classList.add('rs-loading');
  }

  /**
   * Hide loading indicator for download button
   */
  hideDownloadLoading() {
    if (!this.downloadButton) return;
    
    // Restore original text
    if (this.downloadButton.dataset.originalText) {
      this.downloadButton.textContent = this.downloadButton.dataset.originalText;
    } else {
      this.downloadButton.textContent = '下载';
    }
    
    // Restore state
    this.downloadButton.disabled = false;
    this.downloadButton.classList.remove('rs-loading');
  }

  /**
   * Show download success
   */
  showDownloadSuccess() {
    if (!this.downloadButton) return;
    
    // Show success state
    this.downloadButton.textContent = '已下载';
    this.downloadButton.classList.add('rs-success');
    
    // Restore after 2 seconds
    setTimeout(() => {
      this.downloadButton.textContent = '下载';
      this.downloadButton.classList.remove('rs-success');
    }, 2000);
  }

  /**
   * 显示添加成功状态
   */
  showAddSuccess() {
    if (!this.addButton) return;
    
    // 显示成功状态
    this.addButton.textContent = '已添加';
    this.addButton.classList.add('rs-success');
    
    // 2秒后恢复
    setTimeout(() => {
      this.addButton.textContent = '添加';
      this.addButton.classList.remove('rs-success');
    }, 2000);
  }

  /**
   * Remove the paper controls
   */
  remove() {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
}

export default PaperControls; 