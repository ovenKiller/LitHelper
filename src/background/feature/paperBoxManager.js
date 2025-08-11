/**
 * 功能定位：
 * 管理论文信息表数据（即本次任务处理列表中的所有论文的详细信息）
 * 底层依赖于RunTimeDataService进行数据存取
 * 可能会异步调用
 */

import { logger } from '../../util/logger.js';
import { runTimeDataService } from '../../service/runTimeDataService.js';
import { messageService } from '../service/messageService.js';
import { MessageActions } from '../../util/message.js';

// 内部状态，存储论文盒数据
let paperBox = {};

// 加载论文盒数据 (在服务启动时或需要时调用)
async function loadInitialPaperBoxData() {
  try {
    logger.log('[PaperBoxManager] Attempting to load PaperBox data...');
    const savedPapers = await runTimeDataService.getPaperBoxData();
    logger.debug('[PaperBoxManager] runTimeDataService.getPaperBoxData() RAW RESULT:', savedPapers);

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

    const saveSuccess = await runTimeDataService.savePaperBoxData(paperBox);
    if (!saveSuccess) {
      throw new Error('Failed to save PaperBox data to storage');
    }

    logger.log('[PaperBoxManager] PaperBox data saved successfully.');
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

    logger.log('[PaperBoxManager] Attempting to add paper:', paperData.id, paperData.title);

    // 使用 runTimeDataService 添加论文
    const result = await runTimeDataService.addPaperToBox(paperData);

    if (result.success) {
      // 更新内存中的 paperBox
      paperBox[paperData.id] = paperData;

      // 发送通知给所有标签页
      await messageService.notifyAllTabs(MessageActions.PAPER_BOX_UPDATED, { papers: { ...paperBox } }, 'PaperBoxManager');

      logger.log('[PaperBoxManager] Paper added successfully. Current count:', result.paperCount);

      // 注意：移除了异步获取论文详情的调用，因为 paperMetadataService.getPaperDetails 方法不存在
      // 如果需要获取论文详情，应该通过其他方式实现

      return result;
    } else {
      logger.error('[PaperBoxManager] Failed to add paper to PaperBox:', result.error);
      return result;
    }
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

    // 使用 runTimeDataService 移除论文
    const result = await runTimeDataService.removePaperFromBox(paperId);

    if (result.success) {
      // 更新内存中的 paperBox
      delete paperBox[paperId];

      // 发送通知给所有标签页
      await messageService.notifyAllTabs(MessageActions.PAPER_BOX_UPDATED, { papers: { ...paperBox } }, 'PaperBoxManager');

      logger.log('[PaperBoxManager] Paper removed successfully. Current count:', result.paperCount);
      return result;
    } else {
      logger.error('[PaperBoxManager] Failed to remove paper from PaperBox:', result.error);
      return result;
    }
  } catch (error) {
    logger.error('[PaperBoxManager] Failed to remove paper from PaperBox:', error);
    return { success: false, error: error.message || 'Failed to remove paper' };
  }
}

async function clearAllPapers() {
  try {
    logger.log('[PaperBoxManager] Attempting to clear all papers from PaperBox.');

    // 使用 runTimeDataService 清空论文盒子
    const result = await runTimeDataService.clearPaperBox();

    if (result.success) {
      // 更新内存中的 paperBox
      paperBox = {};

      // 发送通知给所有标签页
      await messageService.notifyAllTabs(MessageActions.PAPER_BOX_UPDATED, { papers: { ...paperBox } }, 'PaperBoxManager');

      logger.log('[PaperBoxManager] PaperBox cleared successfully.');
      return result;
    } else {
      logger.error('[PaperBoxManager] Failed to clear PaperBox:', result.error);
      return result;
    }
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