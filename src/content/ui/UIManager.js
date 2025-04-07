/**
 * UIManager.js
 * 
 * Responsible for managing all UI components
 */

import FloatingButton from './components/FloatingButton';
import PopupWindow from './components/PopupWindow';
import PaperControls from './components/PaperControls';
import SummaryContainer from './components/SummaryContainer';

class UIManager {
  constructor() {
    this.components = new Map();
    this.floatingButton = null;
    this.popupWindow = null;
    this.selectedPapers = new Set();
  }

  /**
   * Initialize UI components
   * @param {Object} platform - Platform adapter instance
   * @returns {Promise<void>}
   */
  async initialize(platform) {
    // Initialize platform-specific UI components
    await this.initializePlatformComponents(platform);
    
    // Initialize floating button
    this.floatingButton = new FloatingButton();
    await this.floatingButton.initialize(() => this.togglePopup(platform));
    
    // 确保悬浮按钮可见
    this.floatingButton.show();
    
    // Initialize popup window
    this.popupWindow = new PopupWindow();
    await this.popupWindow.initialize({
      title: 'Research Summarizer',
      query: this.getCurrentQuery(),
      paperCount: platform.getPaperCount(),
      currentPaperNumber: platform.getCurrentPaperNumber(),
      onClose: () => this.hidePopup(),
      onSummarizeAll: () => this.handleSummarizeAll(platform),
      onDownloadAll: () => this.handleDownloadAll(platform),
      onCompare: () => this.handleCompare(platform)
    });
  }

  /**
   * Initialize platform-specific UI components
   * @param {Object} platform - Platform adapter instance
   * @returns {Promise<void>}
   */
  async initializePlatformComponents(platform) {
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
   * @param {Object} platform - Platform adapter instance
   */
  togglePopup(platform) {
    if (this.popupWindow.isVisible) {
      this.hidePopup();
    } else {
      this.showPopup(platform);
    }
  }

  /**
   * Show the popup window
   * @param {Object} platform - Platform adapter instance
   */
  async showPopup(platform) {
    if (!this.popupWindow) return;
    
    // Get papers from the platform
    const papers = await platform.extractPapers();
    
    // Update the popup window with papers
    this.popupWindow.updatePaperList(
      papers,
      (paperId) => this.handleSummarizeClick(paperId, platform),
      (paperId) => this.handleDownloadClick(paperId, platform),
      (paperId, selected) => this.handlePaperSelection(paperId, selected)
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
   * @param {Object} platform - Platform adapter instance
   */
  async handleSummarizeClick(paperId, platform) {
    try {
      // Get paper
      const papers = await platform.extractPapers();
      const paper = papers.find(p => p.id === paperId);
      
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
   * @param {Object} platform - Platform adapter instance
   */
  async handleDownloadClick(paperId, platform) {
    try {
      // Get paper
      const papers = await platform.extractPapers();
      const paper = papers.find(p => p.id === paperId);
      
      if (!paper) {
        console.error(`Paper with ID ${paperId} not found`);
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
    const papers = await platform.extractPapers();
    
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
    const papers = (await platform.extractPapers()).filter(paper => paper.pdfUrl);
    
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