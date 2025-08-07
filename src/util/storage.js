/**
 * storage.js
 * 
 * 提供数据持久化存储服务
 */

import { logger } from './logger.js';

export class StorageService {
  /**
   * 保存数据到存储
   * @param {string} key 存储键
   * @param {any} data 要存储的数据
   */
  async saveData(key, data) {
    try {
      logger.log(`[STORAGE] saveData: 开始保存数据 "${key}"`, typeof data === 'object' ? JSON.stringify(data) : data);
      const saveObj = {};
      saveObj[key] = data;
      await chrome.storage.local.set(saveObj);
      logger.log(`[STORAGE] saveData: 数据 "${key}" 保存成功`);
      return true;
    } catch (error) {
      logger.error(`[STORAGE] saveData: 保存数据失败[${key}]:`, error);
      return false;
    }
  }

  /**
   * 保存数据到存储（saveData 的别名）
   * @param {string} key 存储键
   * @param {any} data 要存储的数据
   */
  async set(key, data) {
    return await this.saveData(key, data);
  }

  /**
   * 获取存储的数据
   * @param {string} key 存储键
   * @returns {Promise<any>} 存储的数据
   */
  async get(key) {
    try {
      logger.log(`[STORAGE] get: 开始获取数据 "${key}"`);
      const result = await chrome.storage.local.get(key);
      logger.log(`[STORAGE] get: 数据 "${key}" 获取结果:`, result[key] !== undefined ? (
        typeof result[key] === 'object' ? JSON.stringify(result[key]) : result[key]
      ) : 'undefined');
      return result[key];
    } catch (error) {
      logger.error(`[STORAGE] get: 获取数据失败[${key}]:`, error);
      return null;
    }
  }

  /**
   * 删除存储的数据
   * @param {string} key 存储键
   */
  async remove(key) {
    try {
      logger.log(`[STORAGE] remove: 开始删除数据 "${key}"`);
      await chrome.storage.local.remove(key);
      logger.log(`[STORAGE] remove: 数据 "${key}" 删除成功`);
      return true;
    } catch (error) {
      logger.error(`[STORAGE] remove: 删除数据失败[${key}]:`, error);
      return false;
    }
  }





  /**
   * 保存论文数据
   * @param {Object} paper 论文对象
   */
  async savePaper(paper) {
    if (!paper || !paper.id) {
      logger.error('[STORAGE] savePaper: 无效的论文数据');
      return false;
    }
    logger.log(`[STORAGE] savePaper: 保存论文 ${paper.id} (${paper.title})`);
    return await this.saveData(`papers.${paper.id}`, paper);
  }

  /**
   * 获取论文数据
   * @param {string} paperId 论文ID
   */
  async getPaper(paperId) {
    return await this.get(`papers.${paperId}`);
  }

  /**
   * 保存论文摘要
   * @param {Object} summary 摘要对象
   */
  async saveSummary(summary) {
    if (!summary || !summary.paperId) {
      logger.error('[STORAGE] saveSummary: 无效的摘要数据');
      return false;
    }
    logger.log(`[STORAGE] saveSummary: 保存摘要 ${summary.paperId}`);
    return await this.saveData(`summaries.${summary.paperId}`, summary);
  }

  /**
   * 获取论文摘要
   * @param {string} paperId 论文ID
   */
  async getSummary(paperId) {
    return await this.get(`summaries.${paperId}`);
  }

  /**
   * 获取所有摘要
   */
  async getAllSummaries() {
    try {
      logger.log('[STORAGE] getAllSummaries: 开始获取所有摘要');
      const allData = await this.getAll();
      const summaries = [];

      for (const key in allData) {
        if (key.startsWith('summaries.')) {
          summaries.push(allData[key]);
        }
      }

      logger.log(`[STORAGE] getAllSummaries: 找到 ${summaries.length} 条摘要`);
      return summaries;
    } catch (error) {
      logger.error('[STORAGE] getAllSummaries: 获取所有摘要失败:', error);
      return [];
    }
  }

  /**
   * 记录论文下载
   * @param {Object} downloadInfo 下载信息
   */
  async recordDownload(downloadInfo) {
    if (!downloadInfo || !downloadInfo.paperId) {
      logger.error('[STORAGE] recordDownload: 无效的下载信息');
      return false;
    }
    logger.log(`[STORAGE] recordDownload: 记录下载 ${downloadInfo.paperId}`);
    return await this.saveData(`downloads.${downloadInfo.paperId}`, downloadInfo);
  }

  /**
   * 清空指定前缀的所有数据
   * @param {string} prefix 键前缀
   */
  async clearByPrefix(prefix) {
    try {
      logger.log(`[STORAGE] clearByPrefix: 开始清空前缀为 "${prefix}" 的数据`);
      const allData = await chrome.storage.local.get(null);
      const keysToRemove = [];

      for (const key in allData) {
        if (key.startsWith(prefix)) {
          keysToRemove.push(key);
        }
      }

      if (keysToRemove.length > 0) {
        await chrome.storage.local.remove(keysToRemove);
        logger.log(`[STORAGE] clearByPrefix: 已删除 ${keysToRemove.length} 条数据`);
      } else {
        logger.log(`[STORAGE] clearByPrefix: 未找到匹配前缀 "${prefix}" 的数据`);
      }

      return { success: true, deletedCount: keysToRemove.length };
    } catch (error) {
      logger.error(`[STORAGE] clearByPrefix: 清空数据失败[${prefix}]:`, error);
      return { success: false, error: error.message };
    }
  }



  /**
   * 获取所有存储数据
   * @returns {Object} 所有存储的数据
   */
  async getAll() {
    try {
      logger.log('[STORAGE] getAll: 开始获取所有存储数据');
      const allData = await chrome.storage.local.get(null);
      logger.log(`[STORAGE] getAll: 获取到 ${Object.keys(allData).length} 个数据项`);
      return allData;
    } catch (error) {
      logger.error('[STORAGE] getAll: 获取所有数据失败:', error);
      throw error;
    }
  }

  /**
   * 获取多个键的数据
   * @param {Array<string>} keys 要获取的键数组
   * @returns {Object} 包含请求键的数据对象
   */
  async getMultiple(keys) {
    try {
      logger.log(`[STORAGE] getMultiple: 开始获取多个键的数据`, keys);
      const result = await chrome.storage.local.get(keys);
      logger.log(`[STORAGE] getMultiple: 获取到 ${Object.keys(result).length} 个数据项`);
      return result;
    } catch (error) {
      logger.error('[STORAGE] getMultiple: 获取多个键数据失败:', error);
      throw error;
    }
  }

  /**
   * 删除多个键
   * @param {Array<string>} keys 要删除的键数组
   * @returns {Promise<boolean>} 删除是否成功
   */
  async removeMultiple(keys) {
    try {
      logger.log(`[STORAGE] removeMultiple: 开始删除多个键`, keys);
      await chrome.storage.local.remove(keys);
      logger.log(`[STORAGE] removeMultiple: 成功删除 ${keys.length} 个键`);
      return true;
    } catch (error) {
      logger.error('[STORAGE] removeMultiple: 删除多个键失败:', error);
      return false;
    }
  }
}

// 创建并导出单例实例，兼容旧代码
export const storage = new StorageService(); 