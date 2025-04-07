/**
 * MessageHandler.js
 * 
 * Responsible for handling extension message communication
 */

class MessageHandler {
  constructor(uiManager) {
    this.uiManager = uiManager;
  }

  /**
   * Initialize message listeners
   */
  initialize() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (!message || !message.action) {
        return;
      }
      
      this.handleMessage(message)
        .then(response => sendResponse(response))
        .catch(error => {
          console.error('Failed to handle message:', error);
          sendResponse({ 
            success: false, 
            error: error.message || 'Unknown error' 
          });
        });
      
      return true;
    });
  }

  /**
   * Handle incoming messages
   * @param {Object} message - Message to handle
   * @returns {Promise<Object>} Response to send back
   */
  async handleMessage(message) {
    const { action, data } = message;
    
    switch (action) {
      case 'extractPapers':
        return { 
          success: true, 
          // papers: this.paperExtractor.papers 
        };
        
      case 'showSummary':
        await this.uiManager.showSummary(data.paperId, data.summary);
        return { success: true };
        
      case 'showSummaryError':
        await this.uiManager.showSummaryError(data.paperId, data.error);
        return { success: true };
        
      case 'updateLoadingStatus':
        await this.uiManager.updateLoadingStatus(data.paperId, data.status);
        return { success: true };
        
      case 'updateDownloadStatus':
        await this.uiManager.updateDownloadStatus(data.paperId, data.status, data.error);
        return { success: true };
        
      case 'annotateWithCategories':
        await this.uiManager.annotateWithCategories(data.paperCategories);
        return { success: true };
        
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }
}

export default MessageHandler; 