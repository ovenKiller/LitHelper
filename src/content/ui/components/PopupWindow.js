/**
 * PopupWindow.js
 * 
 * A popup window component that can be used across different platforms
 */

import { logger } from '../../../util/logger.js';

// 正确的路径，与manifest.json中的web_accessible_resources配置一致
const DELETE_ICON_PATH = 'icons/delete-icon.svg';

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
    logger.log('PopupWindow constructor');
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
    try {
      // 加载样式
      this._loadStyles();

      // 创建元素
      this.element = this.createElement(options);
      document.body.appendChild(this.element);
      
      // 设置初始状态
      this.isVisible = false;
      this.element.style.display = 'none';
    } catch (error) {
      logger.error('Failed to initialize popup window:', error);
      throw error;
    }
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
   * @param {Function} onSummarizeClick - Callback for paper summarization
   * @param {Function} onDownloadClick - Callback for paper download
   * @param {Function} onPaperSelection - Callback for paper selection
   * @param {Function} onRemovePaper - Callback for paper removal
   */
  updatePaperList(papers, onSummarizeClick, onDownloadClick, onPaperSelection, onRemovePaper) {
    if (!this.paperList) {
      logger.error('[POPUP] updatePaperList: paperList 元素不存在');
      return;
    }
    
    if (!papers || !Array.isArray(papers)) {
      logger.error('[POPUP] updatePaperList: 无效的论文数组:', papers);
      return;
    }
    
    logger.log('[POPUP] updatePaperList: 更新论文列表，数量:', papers.length);
    logger.log('[POPUP] updatePaperList: onRemovePaper是否存在:', !!onRemovePaper);
    
    // 设置默认的移除回调函数，防止错误
    const defaultRemoveCallback = (paperId) => {
      logger.warn('[POPUP] 未提供移除论文回调函数，无法删除论文:', paperId);
      return Promise.reject(new Error('未提供删除回调函数'));
    };
    
    // 使用提供的回调或默认回调
    const safeRemoveCallback = typeof onRemovePaper === 'function' ? onRemovePaper : defaultRemoveCallback;
    
    // Clear existing list
    this.paperList.innerHTML = '';
    
    // Add papers to list
    papers.forEach(paper => {
      try {
        if (!paper || !paper.id) {
          logger.warn('[POPUP] updatePaperList: 跳过无效论文:', paper);
          return;
        }
        
        const paperItem = this.createPaperItem(paper, safeRemoveCallback);
        this.paperList.appendChild(paperItem);
      } catch (error) {
        logger.error('[POPUP] updatePaperList: 创建论文项目失败:', error);
      }
    });
  }

  /**
   * Create a paper item element
   * @param {Object} paper - Paper object
   * @param {Function} onRemovePaper - Callback for paper removal
   * @returns {HTMLElement}
   */
  createPaperItem(paper, onRemovePaper) {
    if (!paper || !paper.id) {
      logger.error('[POPUP] createPaperItem: 无效的论文对象', paper);
      throw new Error('无效的论文对象');
    }
    
    logger.log('[POPUP] createPaperItem: 创建论文项', paper.id, paper.title);
    
    const paperItem = document.createElement('div');
    paperItem.className = 'rs-popup-paper-item';
    paperItem.dataset.paperId = paper.id;
    
    // Create paper info
    const paperInfo = document.createElement('div');
    paperInfo.className = 'rs-popup-paper-info';
    
    const paperTitle = document.createElement('div');
    paperTitle.className = 'rs-popup-paper-title';
    paperTitle.textContent = paper.title || 'Untitled Paper';
    paperInfo.appendChild(paperTitle);
    
    const paperAuthors = document.createElement('div');
    paperAuthors.className = 'rs-popup-paper-authors';
    paperAuthors.textContent = paper.authors || 'Unknown Authors';
    paperInfo.appendChild(paperAuthors);
    
    const paperYear = document.createElement('div');
    paperYear.className = 'rs-popup-paper-year';
    paperYear.textContent = paper.year || '';
    paperInfo.appendChild(paperYear);
    
    paperItem.appendChild(paperInfo);
    
    // Create remove button (SVG icon)
    const removeButton = document.createElement('div');
    removeButton.className = 'rs-popup-paper-remove';
    
    // 添加明显的删除按钮样式
    removeButton.style.cursor = 'pointer';
    removeButton.style.minWidth = '30px';
    removeButton.style.minHeight = '30px';
    removeButton.style.display = 'flex';
    removeButton.style.alignItems = 'center';
    removeButton.style.justifyContent = 'center';
    removeButton.style.borderRadius = '50%';
    removeButton.style.backgroundColor = 'rgba(255, 0, 0, 0.1)';
    removeButton.style.margin = '0 0 0 10px';
    removeButton.title = '删除此论文';
    
    try {
      // 使用图片标签加载SVG
      const iconUrl = chrome.runtime.getURL(DELETE_ICON_PATH);
      logger.log('[POPUP] createPaperItem: 删除图标URL:', iconUrl);
      
      const img = document.createElement('img');
      img.src = iconUrl;
      img.alt = 'Delete';
      img.className = 'rs-delete-icon';
      img.style.width = '20px';
      img.style.height = '20px';
      removeButton.appendChild(img);
    } catch (error) {
      logger.error('[POPUP] createPaperItem: 无法加载删除图标:', error);
      // 如果图标加载失败，使用文字替代
      removeButton.textContent = '×';
      removeButton.style.fontSize = '20px';
      removeButton.style.fontWeight = 'bold';
      removeButton.style.color = 'red';
    }
    
    // 确保回调函数存在
    if (typeof onRemovePaper !== 'function') {
      logger.error('[POPUP] createPaperItem: onRemovePaper 不是一个函数', onRemovePaper);
      // 即使没有回调，也添加删除按钮的视觉样式，但不添加功能
      paperItem.appendChild(removeButton);
      return paperItem;
    }
    
    // 通过debugger和更详细的logger.log来调试
    logger.log('[POPUP] createPaperItem: 为论文添加删除按钮事件监听器:', paper.id);
    
    // 直接使用点击事件，而不是异步包装
    removeButton.addEventListener('click', function(event) {
      // 阻止事件冒泡
      event.stopPropagation();
      
      logger.log('[POPUP] 删除按钮被点击:', paper.id);
      logger.log('[POPUP] 删除回调函数:', onRemovePaper);
      
      // 视觉反馈
      this.style.backgroundColor = 'rgba(255, 0, 0, 0.3)';
      
      try {
        // 显示加载状态
        const loadingText = document.createElement('span');
        loadingText.textContent = '...';
        loadingText.style.fontSize = '16px';
        this.innerHTML = '';
        this.appendChild(loadingText);
        
        // 先调用回调函数
        onRemovePaper(paper.id)
          .then(() => {
            logger.log('[POPUP] 论文删除成功，移除UI元素:', paper.id);
            // 删除成功后移除DOM元素
            if (paperItem.parentNode) {
              paperItem.parentNode.removeChild(paperItem);
            }
          })
          .catch(error => {
            logger.error(`[POPUP] 删除论文失败 ${paper.id}:`, error);
            // 恢复按钮状态
            this.style.backgroundColor = 'rgba(255, 0, 0, 0.1)';
            this.innerHTML = '';
            this.textContent = '×';
            this.style.fontSize = '20px';
            this.style.fontWeight = 'bold';
            
            // 添加错误提示UI
            const errorMessage = document.createElement('div');
            errorMessage.className = 'rs-error-message';
            errorMessage.textContent = '删除论文失败，请重试。';
            errorMessage.style.color = 'red';
            errorMessage.style.fontSize = '12px';
            errorMessage.style.marginTop = '4px';
            
            // 将错误消息插入到paperItem中
            paperItem.appendChild(errorMessage);
            
            // 3秒后移除错误消息
            setTimeout(() => {
              if (errorMessage.parentNode) {
                errorMessage.parentNode.removeChild(errorMessage);
              }
            }, 3000);
          });
      } catch (error) {
        logger.error(`[POPUP] 调用删除回调时出错 ${paper.id}:`, error);
        // 恢复按钮状态
        this.style.backgroundColor = 'rgba(255, 0, 0, 0.1)';
        this.textContent = '×';
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