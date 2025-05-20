/**
 * content.js
 * 
 * Content script for the Research Paper Summarizer extension.
 * Responsible for detecting supported platforms and injecting
 * the appropriate platform adapter.
 */

import PlatformAdapter from './platforms/base/PlatformAdapter';
import GoogleScholarAdapter from './platforms/search/GoogleScholarAdapter';
import UIManager from './ui/UIManager';
import { logger } from '../background/utils/logger.js';

/**
 * Main class for content script
 */
class ContentScript {
  constructor() {
    this.adapter = null;
    this.messageHandler = null;
    this.observer = null;
    
    // Platform adapters
    this.platformAdapters = [
      new GoogleScholarAdapter()
    ];
  }
  
  async initialize() {
    try {
      logger.log('Research Summarizer content script initializing...');
      
      
      this.adapter = this.findAdapter();
      if (this.adapter) {
        logger.log(`Platform detected: ${this.adapter.getPlatformName()}`);
        
        await this.adapter.initialize();
        
        this.setupObserver();
        
        if (this.adapter.uiManager && this.adapter.uiManager.floatingButton) {
          this.adapter.uiManager.floatingButton.show();
        } else {
          logger.warn('Cannot show floating button: element is null');
          logger.warn(this.adapter.uiManager);
        }
        
        logger.log('Research Summarizer content script initialized');
      } else {
        logger.log('No supported platform detected');
      }
    } catch (error) {
      logger.error('Failed to initialize content script:', error);
    }
  }
  
  findAdapter() {
    for (const adapter of this.platformAdapters) {
      if (adapter.isPageSupported()) {
        return adapter;
      }
    }
    return null;
  }
  


  setupObserver() {
    if (!this.adapter) return;
    
    const targetNode = this.adapter.getResultsContainer();
    if (!targetNode) return;
    
    const observerConfig = { 
      childList: true, 
      subtree: true 
    };
    
    this.observer = new MutationObserver((mutations) => {
      if (this.adapter.shouldReextractOnMutation(mutations)) {
        this.adapter.handlePageChange();
      }
    });
    
    this.observer.observe(targetNode, observerConfig);
  }
}

// Initialize content script when the page loads
const contentScript = new ContentScript();
contentScript.initialize(); 