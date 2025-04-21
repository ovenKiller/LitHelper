/**
 * PopupWindow.js
 * 
 * A popup window component that can be used across different platforms
 */

// 从public目录加载SVG图标
const DELETE_ICON_PATH = 'public/icons/delete-icon.svg';

class PopupWindow {
  constructor() {
    this.element = null;
    this.header = null;
    this.content = null;
    this.paperList = null;
    this.actionButtons = null;
    this.isVisible = false;
    this.selectedOptions = {
      downloadPdf: false,
      aiTranslate: false, 
      generateMindMap: false
    };
    console.log('PopupWindow constructor');
  }

  /**
   * Load CSS file for the popup window
   * @private
   */
  _loadStyles() {
    const cssPath = chrome.runtime.getURL('content/ui/styles/PopupWindow.css');
    if (!document.querySelector(`link[href="${cssPath}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.type = 'text/css';
      link.href = cssPath;
      document.head.appendChild(link);
    }
  }

  /**
   * Initialize the popup window
   * @param {Object} options - Configuration options
   * @param {string} options.title - Popup title
   * @param {string} options.query - Current search query
   * @param {Function} options.onClose - Callback when popup is closed
   * @param {Function} options.onStartOrganize - Callback for "开始整理" action
   * @param {Function} options.onRemovePaper - Callback for removing a paper
   * @returns {Promise<void>}
   */
  async initialize(options) {
    this._loadStyles();
    this.element = this.createElement(options);
    document.body.appendChild(this.element);
    this.isVisible = false;
    this.element.style.display = 'none';
  }

  /**
   * 创建popup窗口
   * @param {Object} options - Configuration options
   * @returns {HTMLElement}
   */
  createElement(options) {
    // Create popup container
    const popup = document.createElement('div');
    popup.className = 'rs-popup';
    popup.style.display = 'flex'; // Ensure flex display
    
    // Create wrapper for content (everything except action buttons)
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'rs-popup-content-wrapper';
    popup.appendChild(contentWrapper);
    
    // Create header
    this.header = this.createHeader(options.title, options.onClose);
    contentWrapper.appendChild(this.header);
    
    // Create content
    this.content = document.createElement('div');
    this.content.className = 'rs-popup-content';
    
    // Create query info
    const queryInfo = document.createElement('div');
    queryInfo.className = 'rs-popup-query';
    queryInfo.textContent = `Current search: "${options.query || 'Unknown query'}"`;
    this.content.appendChild(queryInfo);
    
    
    // Create scrollable paper list container
    const paperListContainer = document.createElement('div');
    paperListContainer.className = 'rs-popup-paper-list-container';
    
    // Create paper list
    this.paperList = document.createElement('div');
    this.paperList.className = 'rs-popup-paper-list';
    paperListContainer.appendChild(this.paperList);
    this.content.appendChild(paperListContainer);
    
    // Add content to wrapper
    contentWrapper.appendChild(this.content);
    
    // Create action buttons section as a separate fixed section
    this.actionButtons = this.createActionButtons(options.onStartOrganize);
    this.actionButtons.className = 'rs-action-buttons rs-action-buttons-fixed';
    popup.appendChild(this.actionButtons);
    
    return popup;
  }

  /**
   * Create the popup header
   * @param {string} title - Popup title
   * @param {Function} onClose - Callback when popup is closed
   * @returns {HTMLElement}
   */
  createHeader(title, onClose) {
    const header = document.createElement('div');
    header.className = 'rs-popup-header';
    
    // Create title
    const titleElement = document.createElement('h2');
    titleElement.textContent = title || 'Research Summarizer';
    header.appendChild(titleElement);
    
    // Create close button
    const closeButton = document.createElement('button');
    closeButton.className = 'rs-popup-close';
    closeButton.textContent = '×';
    closeButton.addEventListener('click', () => {
      this.hide();
      if (onClose) {
        onClose();
      }
    });
    header.appendChild(closeButton);
    
    return header;
  }

  /**
   * Create action buttons section
   * @param {Function} onStartOrganize - Callback for "开始整理" action
   * @returns {HTMLElement}
   */
  createActionButtons(onStartOrganize) {
    const actionButtons = document.createElement('div');
    actionButtons.className = 'rs-action-buttons';
    
    // Create toggle options
    const options = [
      { id: 'downloadPdf', label: '下载PDF' },
      { id: 'aiTranslate', label: 'AI翻译' },
      { id: 'generateMindMap', label: '生成思维导图' }
    ];
    
    options.forEach(option => {
      const toggleOption = document.createElement('div');
      toggleOption.className = 'rs-toggle-option';
      
      const label = document.createElement('label');
      label.textContent = option.label;
      toggleOption.appendChild(label);
      
      const toggleSwitch = document.createElement('label');
      toggleSwitch.className = 'rs-toggle-switch';
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = `rs-${option.id}`;
      checkbox.addEventListener('change', (e) => {
        this.selectedOptions[option.id] = e.target.checked;
      });
      
      const slider = document.createElement('span');
      slider.className = 'rs-toggle-slider';
      
      toggleSwitch.appendChild(checkbox);
      toggleSwitch.appendChild(slider);
      
      toggleOption.appendChild(toggleSwitch);
      actionButtons.appendChild(toggleOption);
    });
    
    // Create "开始整理" button
    const startOrganizeButton = document.createElement('button');
    startOrganizeButton.className = 'rs-start-organize-btn';
    startOrganizeButton.textContent = '开始整理';
    startOrganizeButton.addEventListener('click', () => {
      if (onStartOrganize) {
        onStartOrganize(this.selectedOptions);
      }
    });
    actionButtons.appendChild(startOrganizeButton);
    
    return actionButtons;
  }

  /**
   * Update the paper list
   * @param {Array} papers - Array of paper objects
   * @param {Function} onRemovePaper - Callback for paper removal
   */
  updatePaperList(papers, onRemovePaper) {
    if (!this.paperList) return;
    
    
    // Clear existing list
    this.paperList.innerHTML = '';
    
    // Add papers to list
    papers.forEach(paper => {
      const paperItem = this.createPaperItem(paper, onRemovePaper);
      this.paperList.appendChild(paperItem);
    });
  }

  /**
   * Create a paper item element
   * @param {Object} paper - Paper object
   * @param {Function} onRemovePaper - Callback for paper removal
   * @returns {HTMLElement}
   */
  createPaperItem(paper, onRemovePaper) {
    const paperItem = document.createElement('div');
    paperItem.className = 'rs-popup-paper-item';
    paperItem.dataset.paperId = paper.id;
    
    // Create paper info
    const paperInfo = document.createElement('div');
    paperInfo.className = 'rs-popup-paper-info';
    
    const paperTitle = document.createElement('div');
    paperTitle.className = 'rs-popup-paper-title';
    paperTitle.textContent = paper.title;
    paperInfo.appendChild(paperTitle);
    
    const paperAuthors = document.createElement('div');
    paperAuthors.className = 'rs-popup-paper-authors';
    paperAuthors.textContent = paper.authors;
    paperInfo.appendChild(paperAuthors);
    
    const paperYear = document.createElement('div');
    paperYear.className = 'rs-popup-paper-year';
    paperYear.textContent = paper.year;
    paperInfo.appendChild(paperYear);
    
    paperItem.appendChild(paperInfo);
    
    // Create remove button (SVG icon)
    const removeButton = document.createElement('div');
    removeButton.className = 'rs-popup-paper-remove';
    
    // 使用图片标签加载SVG
    const img = document.createElement('img');
    img.src = chrome.runtime.getURL(DELETE_ICON_PATH);
    img.alt = 'Delete';
    img.className = 'rs-delete-icon';
    removeButton.appendChild(img);
    
    removeButton.addEventListener('click', async () => {
      try {
        if (onRemovePaper) {
          // 先调用回调函数，等待删除操作完成
          await onRemovePaper(paper.id);
          // 移除DOM元素
          paperItem.remove();
        }
      } catch (error) {
        console.error(`Failed to remove paper ${paper.id}:`, error);
        // 添加错误提示UI
        const errorMessage = document.createElement('div');
        errorMessage.className = 'rs-error-message';
        errorMessage.textContent = 'Failed to remove paper. Please try again.';
        errorMessage.style.color = 'red';
        errorMessage.style.fontSize = '12px';
        errorMessage.style.marginTop = '4px';
        
        // 将错误消息插入到paperItem中
        paperItem.appendChild(errorMessage);
        
        // 3秒后移除错误消息
        setTimeout(() => {
          errorMessage.remove();
        }, 3000);
      }
    });
    paperItem.appendChild(removeButton);
    
    return paperItem;
  }

  /**
   * Show the popup window
   */
  show() {
    if (this.element) {
      this.element.style.display = 'flex';
      this.isVisible = true;
    }
  }

  /**
   * Hide the popup window
   */
  hide() {
    if (this.element) {
      this.element.style.display = 'none';
      this.isVisible = false;
    }
  }

  /**
   * Remove the popup window
   */
  remove() {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }

  /**
   * Get the selected options
   * @returns {Object} The selected options
   */
  getSelectedOptions() {
    return this.selectedOptions;
  }
}

export default PopupWindow; 