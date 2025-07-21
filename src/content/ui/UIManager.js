/**
 * UIManager.js
 * 
 * Responsible for managing all UI components
 */

import FloatingButton from './components/FloatingButton';
import PopupWindow from './components/PopupWindow';
import PaperControls from './components/PaperControls';
import { storage } from '../../util/storage.js';
import { Paper } from '../../model/Paper.js'; // Import Paper class
import { logger } from '../../util/logger.js';
import { MessageActions, sendMessageToBackend, addContentScriptMessageListener } from '../../util/message.js';

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
      
      // 🚀 并行化初始化：将不相互依赖的操作同时执行
      logger.log("[UI_TRACE] initialize: 开始并行初始化操作...");
      
      const [papersData] = await Promise.all([
        // 网络请求：从后台加载论文数据（异步，可能耗时）
        // this.loadPapersFromBackground(),
        
        // DOM操作：初始化弹出窗口（同步，较快）
        this.initializePopupWindow(),
        
        // DOM操作：初始化悬浮按钮（同步，较快）
        this.initializeFloatingButton(),
        
        // 平台特定组件初始化（通常较快）
        this.initializePlatformComponents(platform),
        
        // 消息监听器设置（同步，很快）
        this.setupMessageListener()
      ]);

      // 更新悬浮按钮的论文数量（依赖于论文数据，所以放在并行操作完成后）
      if (this.floatingButton) {
        this.floatingButton.setPaperCount(this.papers.size);
        logger.log(`[UI_TRACE] initialize: 已更新悬浮按钮论文数量: ${this.papers.size}`);
      }
      
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
      
      sendMessageToBackend(MessageActions.GET_PAPER_BOX_DATA)
        .then(response => {
          clearTimeout(timeoutId); // 清除超时
          
          // 打印更多诊断信息
          logger.log('[UI_TRACE] loadPapersFromBackground: 后台脚本响应:', response || '无响应');
          
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
        })
        .catch(error => {
            clearTimeout(timeoutId);
            logger.error('[UI_TRACE] loadPapersFromBackground: 获取论文盒数据失败:', error);
            this.papers = new Map(); // 初始化为空Map
            resolve();
        });
    });
  }
  
  /**
   * 设置消息监听器以接收后台脚本的更新
   */
  setupMessageListener() {
    return new Promise((resolve) => {
      logger.log("[UI_TRACE] setupMessageListener: 设置消息监听器");
      
      const handlers = new Map();
      handlers.set(MessageActions.PAPER_BOX_UPDATED, (data, sender, sendResponse) => {
        logger.log('[UI_TRACE] setupMessageListener: 收到论文盒更新消息, 数据数量:', 
                   Object.keys(data.papers).length);
        
        this.papers = new Map(Object.entries(data.papers));
        
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
      });

      addContentScriptMessageListener(handlers);
      resolve(); // 立即resolve，因为消息监听器设置是同步的
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
    try {
      const response = await sendMessageToBackend(MessageActions.ADD_PAPER_TO_BOX, { paper });
      if (response && response.success) {
        logger.log(`[UI_TRACE] handleAddPaper: 论文已成功添加，当前共有 ${response.paperCount} 篇论文`);
      } else {
        logger.error('[UI_TRACE] handleAddPaper: 添加论文到论文盒失败:', response?.error || '未知错误');
      }
    } catch (error) {
        logger.error('[UI_TRACE] handleAddPaper: 添加论文到论文盒失败:', error);
    }
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
    logger.log(`[UI_TRACE] handleRemovePaper: 准备从UI中移除论文 ${paperId}`);

    // 发送消息到后台移除论文
    try {
      const response = await sendMessageToBackend(MessageActions.REMOVE_PAPER_FROM_BOX, { paperId });
      if (response && response.success) {
        logger.log(`[UI_TRACE] handleRemovePaper: 后台成功移除论文 ${paperId}`);
        // UI的更新会通过PAPER_BOX_UPDATED消息触发，所以这里不需要手动更新
      } else {
        logger.error(`[UI_TRACE] handleRemovePaper: 后台移除论文 ${paperId} 失败:`, response?.error);
      }
    } catch (error) {
      logger.error(`[UI_TRACE] handleRemovePaper: 发送移除论文消息失败 ${paperId}:`, error);
    }

    // 可以在这里立即从UI上移除，以提高响应速度
    if (this.papers.has(paperId)) {
      this.papers.delete(paperId);
      this.selectedPapers.delete(paperId); // 如果被选中，也从选中集合中移除
      
      // 更新悬浮按钮计数
      if (this.floatingButton) {
        this.floatingButton.setPaperCount(this.papers.size);
      }

      // 如果弹窗可见，则更新列表
      if (this.popupWindow && this.popupWindow.isVisible) {
        this.popupWindow.updatePaperList(
          Array.from(this.papers.values()),
          (id) => this.handleSummarizeClick(id),
          (id) => this.handleDownloadClick(id),
          (id, selected) => this.handlePaperSelection(id, selected),
          (id) => this.handleRemovePaper(id)
        );
      }
      logger.log(`[UI_TRACE] handleRemovePaper: 已从UI中移除论文 ${paperId}`);
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
    logger.log(`[UI_TRACE] handleSummarizeClick: 论文ID: ${paperId}`);
    
    const paper = this.papers.get(paperId);
    if (!paper) {
      logger.error(`[UI_TRACE] handleSummarizeClick: 找不到论文: ${paperId}`);
      return;
    }

    try {
      this.showSummaryLoadingIndicator(paperId);
      
      logger.log("[UI_TRACE] handleSummarizeClick: 发送请求到 background.js", paper);
      const response = await sendMessageToBackend(MessageActions.SUMMARIZE_PAPER, { paper });

      if (response && response.success) {
        logger.log(`[UI_TRACE] handleSummarizeClick: 收到 ${paperId} 的摘要`, response.summary);
        this.showSummary(paperId, response.summary);
      } else {
        logger.error(`[UI_TRACE] handleSummarizeClick: 摘要生成失败 ${paperId}:`, response.error);
        this.showSummaryError(paperId, response.error);
      }
    } catch (error) {
      logger.error(`[UI_TRACE] handleSummarizeClick: 摘要生成时发生错误 ${paperId}:`, error);
      this.showSummaryError(paperId, error.message);
    } finally {
      this.hideSummaryLoadingIndicator(paperId);
    }
  }

  /**
   * Handle download click
   * @param {string} paperId - Paper ID
   * @param {Object} platform - Platform adapter instance (optional)
   */
  async handleDownloadClick(paperId, platform) {
    logger.log(`[UI_TRACE] handleDownloadClick: 论文ID: ${paperId}`);
    
    const paper = this.papers.get(paperId);
    if (!paper) {
      logger.error(`[UI_TRACE] handleDownloadClick: 找不到论文: ${paperId}`);
      return;
    }
    
    try {
      this.showDownloadLoadingIndicator(paperId);
      logger.log("[UI_TRACE] handleDownloadClick: 发送请求到 background.js", paper);

      const response = await sendMessageToBackend(MessageActions.DOWNLOAD_PAPER, { paper });

      if (response && response.success) {
        logger.log(`[UI_TRACE] handleDownloadClick: 论文 ${paperId} 下载成功.`);
        this.showDownloadSuccess(paperId);
      } else {
        logger.error(`[UI_TRACE] handleDownloadClick: 论文下载失败 ${paperId}:`, response.error);
        this.showDownloadError(paperId, response.error);
      }
    } catch (error) {
      logger.error(`[UI_TRACE] handleDownloadClick: 论文下载时发生错误 ${paperId}:`, error);
      this.showDownloadError(paperId, error.message);
    } finally {
      this.hideDownloadLoadingIndicator(paperId);
    }
  }

  /**
   * Handle summarize all
   * @param {Object} platform - Platform adapter instance
   */
  async handleSummarizeAll(platform) {
    logger.log("[UI_TRACE] handleSummarizeAll: 开始批量摘要");
    const papersToSummarize = Array.from(this.selectedPapers).map(id => this.papers.get(id));
    
    if (papersToSummarize.length === 0) {
      logger.warn("[UI_TRACE] handleSummarizeAll: 没有选中的论文可供摘要");
      return;
    }
    
    try {
      const response = await sendMessageToBackend(MessageActions.SUMMARIZE_ALL_PAPERS, { papers: papersToSummarize });
      
      if (response && response.success) {
        logger.log("[UI_TRACE] handleSummarizeAll: 批量摘要任务已启动");
        // 可能需要一个UI提示，告知用户后台正在处理
      } else {
        logger.error("[UI_TRACE] handleSummarizeAll: 启动批量摘要失败:", response.error);
      }
    } catch (error) {
      logger.error("[UI_TRACE] handleSummarizeAll: 启动批量摘要时发生错误:", error);
    }
  }

  /**
   * Handle download all
   * @param {Object} platform - Platform adapter instance
   */
  async handleDownloadAll(platform) {
    logger.log("[UI_TRACE] handleDownloadAll: 开始批量下载");
    const papersToDownload = Array.from(this.selectedPapers).map(id => this.papers.get(id));
    
    if (papersToDownload.length === 0) {
      logger.warn("[UI_TRACE] handleDownloadAll: 没有选中的论文可供下载");
      return;
    }
    
    try {
      const response = await sendMessageToBackend(MessageActions.DOWNLOAD_ALL_PAPERS, { papers: papersToDownload });
      
      if (response && response.success) {
        logger.log("[UI_TRACE] handleDownloadAll: 批量下载任务已启动");
        // UI提示
      } else {
        logger.error("[UI_TRACE] handleDownloadAll: 启动批量下载失败:", response.error);
      }
    } catch (error) {
      logger.error("[UI_TRACE] handleDownloadAll: 启动批量下载时发生错误:", error);
    }
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

  /**
   * 获取已注册组件的数量
   * @returns {number} 已注册组件的总数
   */
  getRegisteredComponentsCount() {
    const componentCount = this.components.size;
    const controlsComponentCount = this.controlsComponents.size;
    return componentCount + controlsComponentCount;
  }
}

export default UIManager; 