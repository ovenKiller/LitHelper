import { storage } from '../../utils/storage';
import { logger } from '../utils/logger.js';
import { notificationService } from '../services/notificationService.js';
import { paperMetadataService } from './paperMetadataService.js';
// 内部状态，存储论文盒数据
let paperBox = {};

// 加载论文盒数据 (在服务启动时或需要时调用)
async function loadInitialPaperBoxData() {
  try {
    logger.log('[PaperBoxManager] Attempting to load PaperBox data...');
    const savedPapers = await storage.get('savedPapers');
    logger.debug('[PaperBoxManager] storage.get("savedPapers") RAW RESULT:', savedPapers);

    if (savedPapers && typeof savedPapers === 'object' && savedPapers !== null) {
      paperBox = savedPapers;
      logger.log(`[PaperBoxManager] PaperBox data loaded successfully. Count: ${Object.keys(paperBox).length}.`);
    } else {
      logger.log('[PaperBoxManager] No "savedPapers" found or value is invalid/not an object. Initializing to empty PaperBox.');
      paperBox = {};
      // 如果没有找到数据，立即初始化一个空对象并保存
      await saveCurrentPaperBox(); 
    }
  } catch (error) {
    logger.error('[PaperBoxManager] Exception during PaperBox data loading:', error);
    paperBox = {}; // Ensure it's an empty object on error
    // Attempt to re-initialize on error
    try {
      await saveCurrentPaperBox();
    } catch (saveError) {
      logger.error('[PaperBoxManager] Exception during re-initialization of empty PaperBox data:', saveError);
    }
  }
  return { ...paperBox };
}

// 保存当前论文盒数据到存储
async function saveCurrentPaperBox() {
  try {
    logger.log('[PaperBoxManager] Attempting to save PaperBox data. Content:', paperBox);
    
    if (!paperBox || typeof paperBox !== 'object') {
      logger.warn('[PaperBoxManager] paperBox is invalid, re-initializing to empty object before saving.');
      paperBox = {};
    }
    
    await storage.set('savedPapers', paperBox);
    
    // Verification read
    const verificationResult = await storage.get('savedPapers');
    logger.debug('[PaperBoxManager] Data set. Verification read from storage:', verificationResult);
    
    if (JSON.stringify(verificationResult) !== JSON.stringify(paperBox)) {
        logger.warn('[PaperBoxManager] Verification FAILED! Saved data mismatch with in-memory data.');
        // Potentially re-try or handle error more robustly
    } else {
        logger.log('[PaperBoxManager] PaperBox data saved and verified successfully.');
    }
  } catch (error) {
    logger.error('[PaperBoxManager] Failed to save PaperBox data:', error);
    // Fallback attempt using direct Chrome API (as in original code)
    try {
      logger.log('[PaperBoxManager] Attempting save using direct API call as fallback...');
      await chrome.storage.local.set({ 'savedPapers': paperBox });
      logger.log('[PaperBoxManager] Direct API call save successful.');
    } catch (fallbackError) {
      logger.error('[PaperBoxManager] Fallback save method also failed:', fallbackError);
    }
    throw error; // Re-throw original error to be caught by caller if needed
  }
}

function getPaperBox() {
  logger.debug('[PaperBoxManager] getPaperBox called, returning current PaperBox. Count:', Object.keys(paperBox).length);
  return { ...paperBox }; // Return a copy
}

async function addPaper(paperData) {
  try {
    if (!paperData || !paperData.id) {
      logger.error('[PaperBoxManager] Invalid paper data for addPaper.', paperData);
      return { success: false, error: 'Invalid paper data' };
    }
    
    // 正确处理getPaperDetails返回的Promise
    try {
      // 异步获取论文详情，但不阻塞论文保存流程
      paperMetadataService.getPaperDetails(paperData).then(result => {
        if (result.success) {
          logger.log('[PaperBoxManager] Successfully fetched paper details for:', paperData.id);
          // 更新paperBox中的论文数据（如果论文仍在论文盒中）
          if (paperBox[paperData.id]) {
            paperBox[paperData.id] = result.paper;
            saveCurrentPaperBox().catch(err => {
              logger.error('[PaperBoxManager] Failed to save updated paper details:', err);
            });
          }
        } else {
          logger.warn('[PaperBoxManager] Failed to fetch paper details:', result.error);
        }
      }).catch(error => {
        logger.error('[PaperBoxManager] Exception when fetching paper details:', error);
      });
    } catch (detailsError) {
      logger.error('[PaperBoxManager] Exception setting up paper details fetch:', detailsError);
      // 继续执行，不阻止论文保存
    }
    
    logger.log('[PaperBoxManager] Attempting to add paper:', paperData.id, paperData.title);
    paperBox[paperData.id] = paperData;
    await saveCurrentPaperBox();
    
    await notificationService.notifyAllTabs('paperBoxUpdated', { papers: { ...paperBox } }, 'PaperBoxManager');
    logger.log('[PaperBoxManager] Paper added successfully. Current count:', Object.keys(paperBox).length);
    return { success: true, paperCount: Object.keys(paperBox).length, paper: paperData };
  } catch (error) {
    logger.error('[PaperBoxManager] Failed to add paper to PaperBox:', error);
    return { success: false, error: error.message || 'Failed to add paper' };
  }
}

async function removePaper(paperId) {
  try {
    if (!paperId) {
      logger.error('[PaperBoxManager] Invalid paper ID for removePaper.');
      return { success: false, error: 'Invalid paper ID' };
    }
    logger.log('[PaperBoxManager] Attempting to remove paper:', paperId);
    if (!paperBox[paperId]) {
      logger.warn('[PaperBoxManager] Paper ID not found for removal:', paperId);
      return { success: false, error: 'Paper not found' }; 
    }
    delete paperBox[paperId];
    await saveCurrentPaperBox();
    await notificationService.notifyAllTabs('paperBoxUpdated', { papers: { ...paperBox } }, 'PaperBoxManager');
    logger.log('[PaperBoxManager] Paper removed successfully. Current count:', Object.keys(paperBox).length);
    return { success: true, paperCount: Object.keys(paperBox).length };
  } catch (error) {
    logger.error('[PaperBoxManager] Failed to remove paper from PaperBox:', error);
    return { success: false, error: error.message || 'Failed to remove paper' };
  }
}

async function clearAllPapers() {
  try {
    logger.log('[PaperBoxManager] Attempting to clear all papers from PaperBox.');
    paperBox = {};
    await saveCurrentPaperBox();
    await notificationService.notifyAllTabs('paperBoxUpdated', { papers: { ...paperBox } }, 'PaperBoxManager');
    logger.log('[PaperBoxManager] PaperBox cleared successfully.');
    return { success: true };
  } catch (error) {
    logger.error('[PaperBoxManager] Failed to clear PaperBox:', error);
    return { success: false, error: error.message || 'Failed to clear PaperBox' };
  }
}

export const paperBoxManager = {
  loadInitialPaperBoxData,
  saveCurrentPaperBox, // Expose for specific cases like initial install
  getPaperBox,
  addPaper,
  removePaper,
  clearAllPapers
}; 