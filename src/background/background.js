/**
 * background.js
 * 
 * The main background script for the extension.
 * Initializes all services and managers, and handles message passing.
 */
import { logger } from '../util/logger.js';
import { messageService } from './service/messageService.js';
import { contextMenuService } from './view/contextMenuService.js';

// --- Initialization ---

async function initialize() {
  logger.log('Background service initializing...');
  
  try {
    // Initialize message service (handles all message processing)
    await messageService.initialize();
    
    // Initialize services that have a startup routine
    contextMenuService.initializeContextMenus();
    
    logger.log('Background service initialized successfully.');
  } catch (error) {
    logger.error('Failed to initialize background service:', error);
  }
}

// --- Script Execution ---

initialize();
