/**
 * UIManager.js
 * 
 * Responsible for managing all UI components
 */

import FloatingButton from './components/FloatingButton';
import PopupWindow from './components/PopupWindow';
import PaperControls from './components/PaperControls';
import SummaryContainer from './components/SummaryContainer';
import { storage } from '../../utils/storage';

class UIManager {
  constructor() {
    this.components = new Map();
    this.floatingButton = null;
    this.popupWindow = null;
    this.papers = new Map();
    this.storage = storage;
  }

  /**
   * Initialize UI components
   * @param {Object} platform - Platform adapter instance
   * @returns {Promise<void>}
   */
  async initialize(platform) {
    try {
      console.log("UI manager对象初始化")
      // 初始化存储
      const savedData = await this.storage.get('savedPapers') || {};
      this.papers = new Map(Object.entries(savedData));

      // 初始化弹出窗口
      await this.initializePopupWindow();

      // 初始化平台特定组件
      await this.initializePlatformComponents(platform);

      // 初始化悬浮按钮
      await this.initializeFloatingButton();

      // 更新悬浮按钮的论文数量
      if (this.floatingButton) {
        this.floatingButton.setPaperCount(this.papers.size);
      }
    } catch (error) {
      console.error('Failed to initialize UI:', error);
      throw error;
    }
  }

  /**
   * Initialize popup window
   * @param {Object} platform - Platform adapter instance
   * @returns {Promise<void>}
   */
  async initializePopupWindow() {
    this.popupWindow = new PopupWindow();
    await this.popupWindow.initialize({
      title: 'Research Summarizer',
      query: this.getCurrentQuery(),
      onClose: () => this.hidePopup(),
      onRemovePaper: (paperId) => this.handleRemovePaper(paperId)
    });
  }

  /**
   * Initialize floating button
   * @param {Object} platform - Platform adapter instance
   * @returns {Promise<void>}
   */
  async initializeFloatingButton() {
    console.log("悬浮按钮元素创建")
    this.floatingButton = new FloatingButton();
    await this.floatingButton.initialize(() => this.togglePopup());
    this.floatingButton.show();
  }

  /**
   * Handle adding a single paper to popup
   * @param {Object} paper - Paper object to add
   */
  async handleAddPaper(paper) {
    console.log(paper)
    // 保存论文到存储
    try {
      // 检查论文是否已存在
      if (!this.papers.has(paper.id)) {
        // 添加论文到已保存的论文列表
        this.papers.set(paper.id, paper);
        // 将 Map 转换为对象后存储
        await this.storage.set('savedPapers', Object.fromEntries(this.papers));
        console.log(`论文 "${paper.title}" 已保存到存储`);
      } else {
        console.log(`论文 "${paper.title}" 已存在于存储中`);
      }
    } catch (error) {
      console.error('保存论文到存储时出错:', error);
    }

    if (!this.popupWindow) return;
    
    // Update the popup window with the single paper
    this.popupWindow.updatePaperList(
      Array.from(this.papers.values()),
      (paperId) => this.handleSummarizeClick(paperId),
      (paperId) => this.handleDownloadClick(paperId),
      (paperId, selected) => this.handlePaperSelection(paperId, selected)
    );
    this.floatingButton.setPaperCount(this.papers.size);
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
    console.log("popup toggled")
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
    
    // Get papers from the platform
    // const papers = await platform.extractPapers();
    
    // Update the popup window with papers
    this.popupWindow.updatePaperList(
      Array.from(this.papers.values()),
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

  //论文删除后更新存储。而弹窗的更新放在popupWindow中
  async handleRemovePaper(paperId) {
    if (!this.papers) {
      console.warn('Papers map is not initialized');
      return;
    }

    this.papers.delete(paperId);
    
    // Update floating button count
    if (this.floatingButton) {
      this.floatingButton.setPaperCount(this.papers.size);
    }

    // Update storage
    try {
      await this.storage.set('savedPapers', Object.fromEntries(this.papers));
      console.log(`Paper ${paperId} successfully removed`);
    } catch (error) {
      console.error('Error updating storage after paper removal:', error);
    }
  }
  

  /**
   * Handle paper selection
   * @param {string} paperId - Paper ID
   * @param {boolean} selected - Whether the paper is selected
   */
  handlePaperSelection(paperId, selected) {
    if (selected) {
      this.selectedPapers.add(paperId);
    } else {
      this.selectedPapers.delete(paperId);
    }
    
    // Update compare button state
    if (this.popupWindow) {
      this.popupWindow.updateCompareButton(this.selectedPapers.size >= 2);
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
          
          paper = {
            id: paperId,
            title: titleElement ? titleElement.textContent : 'Unknown Title',
            authors: authorsElement ? authorsElement.textContent : '',
            year: yearElement ? yearElement.textContent : '',
          };
        }
      }
      
      if (!paper) {
        console.error(`Paper with ID ${paperId} not found`);
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
      console.error('Error handling summarize click:', error);
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
          
          paper = {
            id: paperId,
            title: titleElement ? titleElement.textContent : 'Unknown Title',
            pdfUrl: downloadButton && !downloadButton.disabled ? downloadButton.dataset.pdfUrl : null
          };
        }
      }
      
      if (!paper) {
        console.error(`Paper with ID ${paperId} not found`);
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
      console.error('Error handling download click:', error);
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
    console.log("all component removed")
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
}

export default UIManager; 