/**
 * UIManager.js
 * 
 * Responsible for managing all UI components
 */

import FloatingButton from './components/FloatingButton';
import PopupWindow from './components/PopupWindow';
import PaperControls from './components/PaperControls';
import { storage } from '../../utils/storage';
import { Paper } from '../../models/Paper'; // Import Paper class
import { logger } from '../../background/utils/logger.js';

class UIManager {
  constructor() {
    this.components = new Map();
    this.controlsComponents = new Map(); // 存储 PaperControls 实例的映射
    this.floatingButton = null;
    this.popupWindow = null;
    this.papers = new Map();
    this.storage = storage;
    this.selectedPapers = new Set(); // 添加选中的论文集合
  }

  /**
   * Initialize UI components
   * @param {Object} platform - Platform adapter instance
   * @returns {Promise<void>}
   */
  async initialize(platform) {
    try {
      logger.log("[UI_TRACE] initialize: UI manager对象初始化");
      
      // 调试信息：开始加载存储数据
      logger.log("[UI_TRACE] initialize: 开始从后台脚本加载论文数据...");
      
      // 从后台脚本加载论文数据，而不是直接从存储加载
      await this.loadPapersFromBackground();
      
      // 初始化弹出窗口
      await this.initializePopupWindow();

      // 初始化平台特定组件
      await this.initializePlatformComponents(platform);

      // 初始化悬浮按钮
      await this.initializeFloatingButton();

      // 更新悬浮按钮的论文数量
      if (this.floatingButton) {
        this.floatingButton.setPaperCount(this.papers.size);
        logger.log(`[UI_TRACE] initialize: 已更新悬浮按钮论文数量: ${this.papers.size}`);
      }
      
      // 监听后台脚本的论文盒更新消息
      this.setupMessageListener();
      
      logger.log("[UI_TRACE] initialize: UI初始化完成");
    } catch (error) {
      logger.error('[UI_TRACE] initialize: 初始化UI失败:', error);
      throw error;
    }
  }
  
  /**
   * 从后台脚本加载论文数据
   */
  async loadPapersFromBackground() {
    return new Promise((resolve, reject) => {
      logger.log("[UI_TRACE] loadPapersFromBackground: 开始向后台请求论文盒数据");
      
      // 添加超时处理
      const timeoutId = setTimeout(() => {
        logger.warn('[UI_TRACE] loadPapersFromBackground: 请求论文盒数据超时');
        this.papers = new Map(); // 初始化为空Map
        resolve(); // 继续执行后续流程
      }, 3000); // 3秒超时
      
      chrome.runtime.sendMessage({ action: 'getPaperBoxData' }, (response) => {
        clearTimeout(timeoutId); // 清除超时
        
        // 打印更多诊断信息
        logger.log('[UI_TRACE] loadPapersFromBackground: 后台脚本响应:', response || '无响应', 
                   '错误:', chrome.runtime.lastError || '无错误');
        
        if (chrome.runtime.lastError) {
          logger.error('[UI_TRACE] loadPapersFromBackground: 获取论文盒数据失败:', chrome.runtime.lastError);
          this.papers = new Map(); // 初始化为空Map
          resolve();
          return;
        }
        
        if (response && response.success && response.papers) {
          logger.log('[UI_TRACE] loadPapersFromBackground: 从后台脚本接收到论文盒数据:', response.papers);
          this.papers = new Map(Object.entries(response.papers));
          logger.log(`[UI_TRACE] loadPapersFromBackground: 已加载 ${this.papers.size} 篇论文到论文盒`);
          if (this.papers.size > 0) {
            logger.log("[UI_TRACE] loadPapersFromBackground: 论文列表:", Array.from(this.papers.values()).map(p => p.title));
          }
        } else {
          logger.warn('[UI_TRACE] loadPapersFromBackground: 后台脚本没有返回有效的论文盒数据');
          this.papers = new Map(); // 初始化为空Map
        }
        resolve();
      });
    });
  }
  
  /**
   * 设置消息监听器以接收后台脚本的更新
   */
  setupMessageListener() {
    logger.log("[UI_TRACE] setupMessageListener: 设置消息监听器");
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      logger.log('[UI_TRACE] setupMessageListener: 收到消息:', message?.action);
      
      if (message.action === 'paperBoxUpdated' && message.data && message.data.papers) {
        logger.log('[UI_TRACE] setupMessageListener: 收到论文盒更新消息, 数据数量:', 
                   Object.keys(message.data.papers).length);
        
        this.papers = new Map(Object.entries(message.data.papers));
        
        // 更新悬浮按钮的论文数量
        if (this.floatingButton) {
          this.floatingButton.setPaperCount(this.papers.size);
          logger.log(`[UI_TRACE] setupMessageListener: 更新悬浮按钮论文数量: ${this.papers.size}`);
        }
        
        // 如果弹窗打开，更新弹窗内容
        if (this.popupWindow && this.popupWindow.isVisible) {
          logger.log('[UI_TRACE] setupMessageListener: 更新弹窗内容');
          this.popupWindow.updatePaperList(
            Array.from(this.papers.values()),
            (paperId) => this.handleSummarizeClick(paperId),
            (paperId) => this.handleDownloadClick(paperId),
            (paperId, selected) => this.handlePaperSelection(paperId, selected),
            (paperId) => this.handleRemovePaper(paperId)  // 添加删除回调
          );
        }
        sendResponse({ success: true });
      }
      return true;
    });
  }

  /**
   * Initialize popup window
   * @returns {Promise<void>}
   */
  async initializePopupWindow() {
    try {
      logger.log('[UI_TRACE] initializePopupWindow: 开始初始化弹出窗口');
      this.popupWindow = new PopupWindow();
      await this.popupWindow.initialize({
        title: 'Research Summarizer',
        query: this.getCurrentQuery(),
        onClose: () => this.hidePopup(),
        onRemovePaper: (paperId) => this.handleRemovePaper(paperId)
      });
      logger.log('[UI_TRACE] initializePopupWindow: 弹出窗口初始化完成');
    } catch (error) {
      logger.error('[UI_TRACE] initializePopupWindow: 初始化弹出窗口失败:', error);
      throw error;
    }
  }

  /**
   * Initialize floating button
   * @returns {Promise<void>}
   */
  async initializeFloatingButton() {
    try {
      this.floatingButton = new FloatingButton();
      await this.floatingButton.initialize(() => this.handleFloatingButtonClick());
      this.floatingButton.setPaperCount(this.papers.size);
      this.floatingButton.show();
      logger.log('[UI_TRACE] initializeFloatingButton: 悬浮按钮初始化完成');
    } catch (error) {
      logger.error('[UI_TRACE] initializeFloatingButton: 初始化悬浮按钮失败:', error);
      throw error;
    }
  }

  /**
   * Handle floating button click
   */
  handleFloatingButtonClick() {
    logger.log('[UI_TRACE] handleFloatingButtonClick: 悬浮按钮被点击');
    
    if (this.popupWindow) {
      if (this.popupWindow.isVisible) {
        this.popupWindow.hide();
      } else {
        this.popupWindow.show();
        
        // 确保所有回调函数都正确传递
        logger.log('[UI_TRACE] handleFloatingButtonClick: 更新论文列表，当前论文数量:', this.papers.size);
        this.popupWindow.updatePaperList(
          Array.from(this.papers.values()),
          (paperId) => this.handleSummarizeClick(paperId),
          (paperId) => this.handleDownloadClick(paperId),
          (paperId, selected) => this.handlePaperSelection(paperId, selected),
          (paperId) => this.handleRemovePaper(paperId)  // 确保这个回调被传递
        );
      }
    }
  }

  /**
   * Handle adding a single paper to popup
   * @param {Object} paper - Paper object to add
   */
  async handleAddPaper(paper) {
    logger.log("[UI_TRACE] handleAddPaper: 添加论文到论文盒:", paper.title);
    
    // 发送消息给后台脚本，而不是直接操作存储
    chrome.runtime.sendMessage(
      { action: 'addPaperToBox', data: { paper } },
      (response) => {
        if (chrome.runtime.lastError) {
          logger.error('[UI_TRACE] handleAddPaper: 添加论文到论文盒失败:', chrome.runtime.lastError);
          return;
        }
        
        if (response && response.success) {
          logger.log(`[UI_TRACE] handleAddPaper: 论文已成功添加，当前共有 ${response.paperCount} 篇论文`);
        } else {
          logger.error('[UI_TRACE] handleAddPaper: 添加论文到论文盒失败:', response?.error || '未知错误');
        }
      }
    );
  }

  /**
   * Initialize platform-specific UI components
   * @param {Object} platform - Platform adapter instance
   * @returns {Promise<void>}
   */
  async initializePlatformComponents() {
    // This will be implemented by platform-specific adapters
  }

  /**
   * Get the current search query
   * @returns {string}
   */
  getCurrentQuery() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('q') || 'Unknown query';
  }

  /**
   * Toggle the popup window
   */
  togglePopup() {
    logger.log("popup toggled")
    if (this.popupWindow.isVisible) {
      this.hidePopup();
    } else {
      this.showPopup();
    }
  }

  /**
   * Show the popup window 显示弹窗
   */
  async showPopup() {
    if (!this.popupWindow) return;
    
    logger.log('[UI_TRACE] showPopup: 显示弹窗窗口，更新论文列表');
    
    // Update the popup window with papers
    this.popupWindow.updatePaperList(
      Array.from(this.papers.values()),
      (paperId) => this.handleSummarizeClick(paperId),
      (paperId) => this.handleDownloadClick(paperId),
      (paperId, selected) => this.handlePaperSelection(paperId, selected),
      (paperId) => this.handleRemovePaper(paperId)
    );
    
    // Show the popup window
    this.popupWindow.show();
  }

  /**
   * Hide the popup window
   */
  hidePopup() {
    if (this.popupWindow) {
      this.popupWindow.hide();
    }
  }

  /**
   * Handle removing a paper from the popup window
   * @param {string} paperId - Paper ID
   * @returns {Promise<void>}
   */
  async handleRemovePaper(paperId) {
    try {
      logger.log('[UI_TRACE] handleRemovePaper: 开始删除论文:', paperId);
      
      if (!paperId) {
        logger.error('[UI_TRACE] handleRemovePaper: 论文ID无效');
        throw new Error('无效的论文ID');
      }

      // 发送消息给后台脚本，而不是直接操作存储
      return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          { action: 'removePaperFromBox', data: { paperId } },
          (response) => {
            if (chrome.runtime.lastError) {
              logger.error('[UI_TRACE] handleRemovePaper: 从论文盒中移除论文失败:', chrome.runtime.lastError);
              reject(chrome.runtime.lastError);
              return;
            }
            
            if (response && response.success) {
              logger.log(`[UI_TRACE] handleRemovePaper: 论文已成功移除，当前共有 ${response.paperCount} 篇论文`);
              
              // 如果存在本地缓存，也要移除
              if (this.papers && this.papers.has(paperId)) {
                this.papers.delete(paperId);
                logger.log(`[UI_TRACE] handleRemovePaper: 已从本地缓存移除论文 ${paperId}`);
              }
              
              resolve(response);
            } else {
              const error = response?.error || '未知错误';
              logger.error('[UI_TRACE] handleRemovePaper: 从论文盒中移除论文失败:', error);
              reject(new Error(error));
            }
          }
        );
      });
    } catch (error) {
      logger.error('[UI_TRACE] handleRemovePaper: 删除论文过程中发生异常:', error);
      throw error;
    }
  }
  

  /**
   * Handle paper selection
   * @param {string} paperId - Paper ID
   * @param {boolean} selected - Whether the paper is selected
   */
  handlePaperSelection(paperId, selected) {
    logger.log(`[UI_TRACE] handlePaperSelection: 论文 ${paperId} 选择状态变更为: ${selected}`);
    
    if (selected) {
      this.selectedPapers.add(paperId);
    } else {
      this.selectedPapers.delete(paperId);
    }
    
    // Update compare button state
    if (this.popupWindow) {
      this.popupWindow.updateCompareButton(this.selectedPapers.size >= 2);
      logger.log(`[UI_TRACE] handlePaperSelection: 已选择 ${this.selectedPapers.size} 篇论文`);
    }
  }

  /**
   * Handle summarize click
   * @param {string} paperId - Paper ID
   * @param {Object} platform - Platform adapter instance (optional)
   */
  async handleSummarizeClick(paperId, platform) {
    try {
      let paper;
      
      // Try to find paper in platform if provided
      if (platform) {
        const papers = await platform.extractPapers();
        paper = papers.find(p => p.id === paperId);
      }
      
      // If platform not provided or paper not found in platform papers,
      // try to find it directly from the popup window (for papers added via "Add to Research Summarizer" button)
      if (!paper && this.popupWindow) {
        // Find paper in the popup window's currently displayed papers
        const paperElement = this.popupWindow.element.querySelector(`[data-paper-id="${paperId}"]`);
        if (paperElement) {
          // Extract necessary data from the paper element
          const titleElement = paperElement.querySelector('.rs-popup-paper-title');
          const authorsElement = paperElement.querySelector('.rs-popup-paper-authors');
          const yearElement = paperElement.querySelector('.rs-popup-paper-year');
          
          const paperData = {
            id: paperId,
            title: titleElement ? titleElement.textContent : 'Unknown Title',
            authors: [],
            publicationDate: yearElement ? yearElement.textContent : ''
          };
          if (authorsElement && authorsElement.textContent) {
            paperData.authors = authorsElement.textContent.split(',').map(a => a.trim()).filter(a => a);
          }
          paper = new Paper(paperData);
        }
      }
      
      if (!paper) {
        logger.error(`Paper with ID ${paperId} not found`);
        return;
      }
      
      // Show loading indicator
      this.showSummaryLoadingIndicator(paperId);
      
      // Send message to background script to generate summary
      chrome.runtime.sendMessage({
        action: 'summarizePaper',
        data: {
          paper,
          options: {
            categorize: true
          }
        }
      }, response => {
        // Hide loading indicator
        this.hideSummaryLoadingIndicator(paperId);
        
        if (response && response.success) {
          // Show summary
          this.showSummary(paperId, response.summary);
        } else {
          // Show error
          this.showSummaryError(paperId, response?.error || 'Failed to generate summary');
        }
      });
    } catch (error) {
      logger.error('Error handling summarize click:', error);
      this.hideSummaryLoadingIndicator(paperId);
      this.showSummaryError(paperId, error.message);
    }
  }

  /**
   * Handle download click
   * @param {string} paperId - Paper ID
   * @param {Object} platform - Platform adapter instance (optional)
   */
  async handleDownloadClick(paperId, platform) {
    try {
      let paper;
      
      // Try to find paper in platform if provided
      if (platform) {
        const papers = await platform.extractPapers();
        paper = papers.find(p => p.id === paperId);
      }
      
      // If platform not provided or paper not found in platform papers,
      // try to find it directly from the popup window (for papers added via "Add to Research Summarizer" button)
      if (!paper && this.popupWindow) {
        // Find paper in the popup window's currently displayed papers
        const paperElement = this.popupWindow.element.querySelector(`[data-paper-id="${paperId}"]`);
        if (paperElement) {
          // Extract necessary data from the paper element
          const titleElement = paperElement.querySelector('.rs-popup-paper-title');
          const downloadButton = paperElement.querySelector(`.rs-download-btn[data-paper-id="${paperId}"]`);
          
          const paperData = {
            id: paperId,
            title: titleElement ? titleElement.textContent : 'Unknown Title',
            pdfUrl: downloadButton && !downloadButton.disabled ? downloadButton.dataset.pdfUrl : null
            // Authors and year are not strictly needed for download, but can be added for consistency if desired
          };
          paper = new Paper(paperData);
        }
      }
      
      if (!paper) {
        logger.error(`Paper with ID ${paperId} not found`);
        return;
      }
      
      // If no PDF URL, show error
      if (!paper.pdfUrl) {
        this.showDownloadError(paperId, 'No PDF available for this paper');
        return;
      }
      
      // Show loading indicator
      this.showDownloadLoadingIndicator(paperId);
      
      // Send message to background script to download PDF
      chrome.runtime.sendMessage({
        action: 'downloadPDF',
        data: { paper }
      }, response => {
        // Hide loading indicator
        this.hideDownloadLoadingIndicator(paperId);
        
        if (response && response.success) {
          // Show success
          this.showDownloadSuccess(paperId);
        } else {
          // Show error
          this.showDownloadError(paperId, response?.error || 'Failed to download PDF');
        }
      });
    } catch (error) {
      logger.error('Error handling download click:', error);
      this.hideDownloadLoadingIndicator(paperId);
      this.showDownloadError(paperId, error.message);
    }
  }

  /**
   * Handle summarize all
   * @param {Object} platform - Platform adapter instance
   */
  async handleSummarizeAll(platform) {
    // Get all papers
    // const papers = await platform.extractPapers();
    
    // Show loading indicator for all papers
    papers.forEach(paper => {
      this.showSummaryLoadingIndicator(paper.id);
    });
    
    // Send message to background script to batch generate summaries
    chrome.runtime.sendMessage({
      action: 'batchSummarizePapers',
      data: {
        papers,
        options: {
          categorize: true
        }
      }
    }, response => {
      // Hide all loading indicators
      papers.forEach(paper => {
        this.hideSummaryLoadingIndicator(paper.id);
      });
      
      if (response && response.success) {
        // Show all summaries
        response.results.forEach(result => {
          this.showSummary(result.paper.id, result.summary);
        });
      } else {
        // Show error for all papers
        papers.forEach(paper => {
          this.showSummaryError(paper.id, response?.error || 'Failed to generate summaries');
        });
      }
    });
  }

  /**
   * Handle download all
   * @param {Object} platform - Platform adapter instance
   */
  async handleDownloadAll(platform) {
    // Get all papers with PDF links
    // const papers = (await platform.extractPapers()).filter(paper => paper.pdfUrl);
    
    if (papers.length === 0) {
      alert('No papers with PDF links found');
      return;
    }
    
    // Show loading indicator for all papers
    papers.forEach(paper => {
      this.showDownloadLoadingIndicator(paper.id);
    });
    
    // Send message to background script to batch download PDFs
    chrome.runtime.sendMessage({
      action: 'batchDownloadPapers',
      data: { papers }
    }, response => {
      // Hide all loading indicators
      papers.forEach(paper => {
        this.hideDownloadLoadingIndicator(paper.id);
      });
      
      if (response && response.success) {
        // Show all download results
        response.results.forEach(result => {
          if (result.success) {
            this.showDownloadSuccess(result.paper.id);
          } else {
            this.showDownloadError(result.paper.id, result.error);
          }
        });
      } else {
        // Show error for all papers
        papers.forEach(paper => {
          this.showDownloadError(paper.id, response?.error || 'Failed to download PDFs');
        });
      }
    });
  }

  /**
   * Handle compare
   * @param {Object} platform - Platform adapter instance
   */
  handleCompare(platform) {
    alert('Paper comparison feature is not implemented yet');
  }

  /**
   * Show summary for a paper
   * @param {string} paperId - Paper ID
   * @param {string} summary - Paper summary
   * @returns {Promise<void>}
   */
  async showSummary(paperId, summary) {
    const component = this.components.get(paperId);
    if (component) {
      await component.showSummary(summary);
    }
  }

  /**
   * Show summary error for a paper
   * @param {string} paperId - Paper ID
   * @param {string} error - Error message
   * @returns {Promise<void>}
   */
  async showSummaryError(paperId, error) {
    const component = this.components.get(paperId);
    if (component) {
      await component.showSummaryError(error);
    }
  }

  /**
   * Show summary loading indicator for a paper
   * @param {string} paperId - Paper ID
   * @returns {Promise<void>}
   */
  async showSummaryLoadingIndicator(paperId) {
    const component = this.components.get(paperId);
    if (component) {
      await component.updateLoadingStatus('loading');
    }
  }

  /**
   * Hide summary loading indicator for a paper
   * @param {string} paperId - Paper ID
   * @returns {Promise<void>}
   */
  async hideSummaryLoadingIndicator(paperId) {
    const component = this.components.get(paperId);
    if (component) {
      await component.updateLoadingStatus('complete');
    }
  }

  /**
   * Show download loading indicator for a paper
   * @param {string} paperId - Paper ID
   * @returns {Promise<void>}
   */
  async showDownloadLoadingIndicator(paperId) {
    const component = this.components.get(paperId);
    if (component) {
      await component.updateDownloadStatus('loading');
    }
  }

  /**
   * Hide download loading indicator for a paper
   * @param {string} paperId - Paper ID
   * @returns {Promise<void>}
   */
  async hideDownloadLoadingIndicator(paperId) {
    const component = this.components.get(paperId);
    if (component) {
      await component.updateDownloadStatus('complete');
    }
  }

  /**
   * Show download success for a paper
   * @param {string} paperId - Paper ID
   * @returns {Promise<void>}
   */
  async showDownloadSuccess(paperId) {
    const component = this.components.get(paperId);
    if (component) {
      await component.updateDownloadStatus('success');
    }
  }

  /**
   * Show download error for a paper
   * @param {string} paperId - Paper ID
   * @param {string} error - Error message
   * @returns {Promise<void>}
   */
  async showDownloadError(paperId, error) {
    const component = this.components.get(paperId);
    if (component) {
      await component.updateDownloadStatus('error', error);
    }
  }

  /**
   * Update loading status for a paper
   * @param {string} paperId - Paper ID
   * @param {string} status - Loading status
   * @returns {Promise<void>}
   */
  async updateLoadingStatus(paperId, status) {
    const component = this.components.get(paperId);
    if (component) {
      await component.updateLoadingStatus(status);
    }
  }

  /**
   * Update download status for a paper
   * @param {string} paperId - Paper ID
   * @param {string} status - Download status
   * @param {string} error - Error message if any
   * @returns {Promise<void>}
   */
  async updateDownloadStatus(paperId, status, error) {
    const component = this.components.get(paperId);
    if (component) {
      await component.updateDownloadStatus(status, error);
    }
  }

  /**
   * Annotate papers with categories
   * @param {Object} paperCategories - Paper categories data
   * @returns {Promise<void>}
   */
  async annotateWithCategories(paperCategories) {
    for (const [paperId, categories] of Object.entries(paperCategories)) {
      const component = this.components.get(paperId);
      if (component) {
        await component.annotateWithCategories(categories);
      }
    }
  }

  /**
   * Register a UI component
   * @param {string} paperId - Paper ID
   * @param {Object} component - UI component instance
   */
  registerComponent(paperId, component) {
    this.components.set(paperId, component);
  }

  /**
   * Remove a UI component
   * @param {string} paperId - Paper ID
   */
  removeComponent(paperId) {
    this.components.delete(paperId);
  }

  /**
   * Remove all UI components
   */
  removeAllComponents() {
    logger.log("all component removed")
    this.components.clear();
    
    if (this.floatingButton) {
      this.floatingButton.remove();
      this.floatingButton = null;
    }
    
    if (this.popupWindow) {
      this.popupWindow.remove();
      this.popupWindow = null;
    }
  }

  /**
   * 注册 PaperControls 组件
   * @param {string} paperId - 论文ID
   * @param {PaperControls} controlsComponent - PaperControls 实例
   */
  registerControlsComponent(paperId, controlsComponent) {
    this.controlsComponents.set(paperId, controlsComponent);
  }

  /**
   * 获取 PaperControls 组件
   * @param {string} paperId - 论文ID
   * @returns {PaperControls|null} PaperControls 实例或 null
   */
  getControlsComponent(paperId) {
    return this.controlsComponents.get(paperId) || null;
  }
}

export default UIManager; 