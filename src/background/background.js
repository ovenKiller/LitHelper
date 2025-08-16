/**
 * background.js
 * 
 * The main background script for the extension.
 * Initializes all services and managers, and handles message passing.
 */
import { logger } from '../util/logger.js';
import { messageService } from './service/messageService.js';
import { contextMenuService } from './view/contextMenuService.js';
import { paperBoxManager } from './feature/paperBoxManager.js';

// --- Initialization ---

async function initialize() {
  logger.log('Background service initializing...');

  try {
    await paperBoxManager.loadInitialPaperBoxData();

    await messageService.initialize();

    contextMenuService.initializeContextMenus();
  } catch (error) {
    logger.error('Failed to initialize background service:', error);
    // 即使初始化失败，也要确保基本服务可用
    try {
      if (!messageService.isInitialized) {
        await messageService.initialize();
      }
    } catch (fallbackError) {
      logger.error('Fallback initialization also failed:', fallbackError);
    }
  }
}

// --- Script Execution ---

initialize();
