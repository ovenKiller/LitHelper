/**
 * content.js
 * 
 * Content script for the Research Paper Summarizer extension.
 * Responsible for detecting supported platforms and injecting
 * the appropriate platform adapter.
 */

import ConfigManager from './core/ConfigManager';
import MessageHandler from './core/MessageHandler';
import PlatformAdapter from './platforms/base/PlatformAdapter';
import GoogleScholarAdapter from './platforms/search/GoogleScholarAdapter';
import UIManager from './ui/UIManager';
/**
 * Main class for content script
 */
class ContentScript {
  constructor() {
    this.configManager = new ConfigManager();
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
      console.log('Research Summarizer content script initializing...');
      
      await this.configManager.loadConfig();
      
      this.adapter = this.findAdapter();
      if (this.adapter) {
        console.log(`Platform detected: ${this.adapter.getPlatformName()}`);
        
        await this.adapter.initialize();
        this.messageHandler = new MessageHandler(this.adapter, this.adapter.uiManager);
        this.messageHandler.initialize();
        
        this.setupObserver();
        
        if (this.adapter.uiManager && this.adapter.uiManager.floatingButton) {
          this.adapter.uiManager.floatingButton.show();
        } else {
          console.warn('Cannot show floating button: element is null');
          console.warn(this.adapter.uiManager);
        }
        
        console.log('Research Summarizer content script initialized');
      } else {
        console.log('No supported platform detected');
      }
    } catch (error) {
      console.error('Failed to initialize content script:', error);
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