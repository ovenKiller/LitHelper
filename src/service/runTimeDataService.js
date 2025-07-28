/**
 * 运行时数据服务
 * 负责管理平台选择器、默认配置和运行时数据
 */

import { logger } from '../util/logger.js';
import { PlatformSelector } from '../model/PlatformSelector.js';

class RunTimeDataService {
  constructor() {
    // PlatformSelector缓存
    this.platformSelectorCache = new Map();
    
    // 初始化
    this.initialize();
  }

  /**
   * 初始化运行时数据服务
   */
  initialize() {
    logger.log('[RunTimeDataService] 初始化运行时数据服务');
    
  }

  /**
   * 保存任务队列到存储
   * @param {string} queueType - 队列类型
   * @param {Array} tasks - 任务数组
   */
  async saveTaskQueue(queueType, tasks) {
    try {
      const key = `task_queue_${queueType}`;
      const data = {
        queueType,
        tasks: tasks.map(task => task.toJSON ? task.toJSON() : task),
        timestamp: Date.now()
      };
      
      // 使用Chrome存储API保存数据
      await chrome.storage.local.set({ [key]: data });
      logger.log(`[RunTimeDataService] 保存任务队列 "${queueType}", 任务数量: ${tasks.length}`);
    } catch (error) {
      logger.error(`[RunTimeDataService] 保存任务队列失败 "${queueType}":`, error);
      throw error;
    }
  }

  /**
   * 从存储加载任务队列
   * @param {string} queueType - 队列类型
   * @returns {Array} 任务数组
   */
  async loadTaskQueue(queueType) {
    try {
      const key = `task_queue_${queueType}`;
      const result = await chrome.storage.local.get([key]);
      
      if (!result[key]) {
        // 首次运行时队列不存在是正常的，使用debug级别日志
        logger.debug(`[RunTimeDataService] 任务队列 "${queueType}" 首次初始化，返回空数组`);
        return [];
      }
      
      const data = result[key];
      logger.log(`[RunTimeDataService] 加载任务队列 "${queueType}", 任务数量: ${data.tasks.length}`);
      return data.tasks;
    } catch (error) {
      logger.error(`[RunTimeDataService] 加载任务队列失败 "${queueType}":`, error);
      return [];
    }
  }


  /**
   * 删除所有任务相关数据
   * @returns {Object} 删除结果，包含删除的数据统计
   */
  async clearAllTaskData() {
    try {
      logger.log('[RunTimeDataService] 开始删除所有数据');
      
      // 获取所有存储数据
      const allData = await chrome.storage.local.get(null);
      const keysToRemove = [];
      const statistics = {
        taskQueues: 0,
        totalKeys: 0
      };
      
      // 找到所有任务相关的键
      for (const key in allData) {
        // 任务队列数据
          keysToRemove.push(key);
          statistics.taskQueues++;
      }
      
      statistics.totalKeys = keysToRemove.length;
      
      if (keysToRemove.length > 0) {
        // 删除所有任务相关数据
        await chrome.storage.local.remove(keysToRemove);
        logger.log(`[RunTimeDataService] 成功删除所有任务数据，统计:`, {
          删除的键数量: statistics.totalKeys,
          任务队列数量: statistics.taskQueues
        });
      } else {
        logger.log('[RunTimeDataService] 未找到任务相关数据');
      }
      
      return {
        success: true,
        statistics: statistics,
        message: `成功删除 ${statistics.totalKeys} 个任务数据项`
      };
      
    } catch (error) {
      logger.error('[RunTimeDataService] 删除所有任务数据失败:', error);
      return {
        success: false,
        error: error.message,
        statistics: { taskQueues: 0, totalKeys: 0 }
      };
    }
  }

  /**
   * 保存PlatformSelector配置
   * @param {PlatformSelector} platformSelector - PlatformSelector对象
   * @returns {boolean} 是否保存成功
   */
  async savePlatformSelector(platformSelector) {
    try {
      if (!platformSelector || !platformSelector.domain || !platformSelector.pageType) {
        logger.error('[RunTimeDataService] savePlatformSelector: 无效的PlatformSelector数据');
        return false;
      }
      
      const key = platformSelector.getKey();
      const storageKey = `platformSelectors.${key}`;
      const saveData = platformSelector.toJSON();
      
      logger.log(`[RunTimeDataService] 📝 准备保存PlatformSelector:`);
      logger.log(`  - Key: ${key}`);
      logger.log(`  - Storage Key: ${storageKey}`);
      logger.log(`  - Domain: ${platformSelector.domain}`);
      logger.log(`  - Page Type: ${platformSelector.pageType}`);
      logger.log(`  - Platform Key: ${platformSelector.platformKey || 'undefined'}`);
      
      logger.log(`[RunTimeDataService] 📄 完整保存数据:`, saveData);
      
      // 详细显示每个提取器的配置
      if (saveData.extractors && Object.keys(saveData.extractors).length > 0) {
        logger.log(`[RunTimeDataService] 🔧 提取器配置详情:`);
        for (const [extractorType, extractorConfig] of Object.entries(saveData.extractors)) {
          logger.log(`  - ${extractorType}:`, {
            mode: extractorConfig.mode,
            selector: extractorConfig.selector,
            description: extractorConfig.description,
            hasValidation: !!extractorConfig.validation
          });
        }
      } else {
        logger.warn(`[RunTimeDataService] ⚠️  没有提取器配置数据`);
      }
      
      // 保存到Chrome存储
      logger.log(`[RunTimeDataService] 💾 开始保存到Chrome存储...`);
      await chrome.storage.local.set({ [storageKey]: saveData });
      
      // 验证保存结果
      const verifyResult = await chrome.storage.local.get([storageKey]);
      if (verifyResult[storageKey]) {
        logger.log(`[RunTimeDataService] ✅ 保存验证成功，数据已确认写入存储`);
        logger.log(`[RunTimeDataService] 📋 验证数据摘要:`, {
          domain: verifyResult[storageKey].domain,
          pageType: verifyResult[storageKey].pageType,
          extractorCount: verifyResult[storageKey].extractors ? Object.keys(verifyResult[storageKey].extractors).length : 0
        });
      } else {
        logger.error(`[RunTimeDataService] ❌ 保存验证失败，数据未能写入存储`);
        return false;
      }
      
      // 更新缓存
      this.platformSelectorCache.set(key, platformSelector);
      logger.log(`[RunTimeDataService] 📦 缓存已更新，缓存大小: ${this.platformSelectorCache.size}`);
      
      logger.log(`[RunTimeDataService] ✅ PlatformSelector ${key} 保存成功`);
      return true;
    } catch (error) {
      logger.error('[RunTimeDataService] savePlatformSelector: 保存PlatformSelector失败:', error);
      return false;
    }
  }

  /**
   * 获取PlatformSelector配置
   * @param {string} domain - 域名
   * @param {string} pageType - 页面类型
   * @returns {PlatformSelector|null} PlatformSelector对象
   */
  async getPlatformSelector(domain, pageType) {
    try {
      const key = `${domain}_${pageType}`;
      
      logger.log(`[RunTimeDataService] getPlatformSelector: domain=${domain}, pageType=${pageType}, key=${key}`);
      
      // 先从缓存中获取
      if (this.platformSelectorCache.has(key)) {
        logger.log(`[RunTimeDataService] 从缓存获取PlatformSelector ${key}`);
        return this.platformSelectorCache.get(key);
      }
      
      // 从存储中获取
      const storageKey = `platformSelectors.${key}`;
      logger.log(`[RunTimeDataService] 从存储查找: ${storageKey}`);
      
      const result = await chrome.storage.local.get([storageKey]);
      
      logger.log(`[RunTimeDataService] 存储查询结果:`, {
        storageKey: storageKey,
        exists: !!result[storageKey],
        data: result[storageKey] ? 'found' : 'not found'
      });
      
      if (!result[storageKey]) {
        logger.log(`[RunTimeDataService] PlatformSelector ${key} 不存在`);
        
        // 额外调试：列出所有存储的 platformSelectors
        try {
          const allStorage = await chrome.storage.local.get(null);
          const allPlatformSelectorKeys = Object.keys(allStorage).filter(k => k.startsWith('platformSelectors.'));
          logger.log(`[RunTimeDataService] 所有已存储的PlatformSelector keys:`, allPlatformSelectorKeys);
        } catch (debugError) {
          logger.error(`[RunTimeDataService] 调试信息获取失败:`, debugError);
        }
        
        return null;
      }
      
      // 创建PlatformSelector实例
      logger.log(`[RunTimeDataService] 创建PlatformSelector实例，数据:`, result[storageKey]);
      const platformSelector = new PlatformSelector(result[storageKey]);
      
      // 更新缓存
      this.platformSelectorCache.set(key, platformSelector);
      
      logger.log(`[RunTimeDataService] 获取PlatformSelector ${key} 成功`);
      return platformSelector;
    } catch (error) {
      logger.error(`[RunTimeDataService] getPlatformSelector: 获取PlatformSelector失败[${domain}_${pageType}]:`, error);
      return null;
    }
  }

  /**
   * 根据URL和页面类型获取PlatformSelector
   * @param {string} url - 目标URL
   * @param {string} pageType - 页面类型
   * @returns {PlatformSelector|null} PlatformSelector对象
   */
  async getPlatformSelectorForPage(url, pageType) {
    try {
      logger.log(`[RunTimeDataService] getPlatformSelectorForPage 开始: url=${url}, pageType=${pageType}`);
      
      const domain = PlatformSelector.extractDomain(url);
      if (!domain) {
        logger.error('[RunTimeDataService] getPlatformSelectorForPage: URL解析失败:', url);
        return null;
      }
      
      logger.log(`[RunTimeDataService] 提取的域名: ${domain}`);
      
      const result = await this.getPlatformSelector(domain, pageType);
      
      if (result) {
        logger.log(`[RunTimeDataService] getPlatformSelectorForPage 成功: ${result.getKey()}`);
      } else {
        logger.log(`[RunTimeDataService] getPlatformSelectorForPage 未找到匹配的PlatformSelector`);
      }
      
      return result;
    } catch (error) {
      logger.error('[RunTimeDataService] getPlatformSelectorForPage: 获取PlatformSelector失败:', error);
      return null;
    }
  }
}

// 创建并导出单例实例
export const runTimeDataService = new RunTimeDataService();
export default runTimeDataService;
