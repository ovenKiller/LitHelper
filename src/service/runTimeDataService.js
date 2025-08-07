/**
 * 运行时数据服务
 * 负责管理平台选择器、默认配置和运行时数据
 */

import { logger } from '../util/logger.js';
import { PlatformSelector } from '../model/PlatformSelector.js';
import { storage } from '../util/storage.js';

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

      // 使用StorageService保存数据
      await storage.saveData(key, data);
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
      const result = await storage.getMultiple([key]);

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
      const allData = await storage.getAll();
      const keysToRemove = [];
      const statistics = {
        taskQueues: 0,
        totalKeys: 0
      };

      // 找到所有任务相关的键
      for (const key in allData) {
        if (key.startsWith('task_queue_')) {
          keysToRemove.push(key);
          statistics.taskQueues++;
        }
      }

      statistics.totalKeys = keysToRemove.length;

      if (keysToRemove.length > 0) {
        // 删除所有任务相关数据
        await storage.removeMultiple(keysToRemove);
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
      
      // 保存到存储
      logger.log(`[RunTimeDataService] 💾 开始保存到存储...`);
      await storage.saveData(storageKey, saveData);

      // 验证保存结果
      const verifyResult = await storage.getMultiple([storageKey]);
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
      
      const result = await storage.getMultiple([storageKey]);

      logger.log(`[RunTimeDataService] 存储查询结果:`, {
        storageKey: storageKey,
        exists: !!result[storageKey],
        data: result[storageKey] ? 'found' : 'not found'
      });

      if (!result[storageKey]) {
        logger.log(`[RunTimeDataService] PlatformSelector ${key} 不存在`);


        
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

  // ===== CSS选择器管理方法 =====

  /**
   * 获取CSS选择器配置
   * @param {string} domain 域名
   * @param {string} pageType 页面类型
   */
  async getCssSelector(domain, pageType) {
    const key = `${domain}_${pageType}`;
    return await storage.get(`cssSelectors.${key}`);
  }

  /**
   * 根据URL和页面类型获取CSS选择器
   * @param {string} url 目标URL
   * @param {string} pageType 页面类型
   */
  async getCssSelectorForPage(url, pageType) {
    try {
      const domain = new URL(url).hostname;
      return await this.getCssSelector(domain, pageType);
    } catch (error) {
      logger.error('[RunTimeDataService] getCssSelectorForPage: URL解析失败:', error);
      return null;
    }
  }

  /**
   * 保存CSS选择器配置
   * @param {Object} cssSelector CSS选择器配置对象
   */
  async saveCssSelector(cssSelector) {
    if (!cssSelector || !cssSelector.domain || !cssSelector.pageType) {
      logger.error('[RunTimeDataService] saveCssSelector: 无效的CSS选择器数据');
      return false;
    }
    const key = `${cssSelector.domain}_${cssSelector.pageType}`;
    logger.log(`[RunTimeDataService] saveCssSelector: 保存CSS选择器 ${key}`);
    return await storage.saveData(`cssSelectors.${key}`, cssSelector);
  }

  /**
   * 获取所有CSS选择器配置
   */
  async getAllCssSelectors() {
    try {
      logger.log('[RunTimeDataService] getAllCssSelectors: 开始获取所有CSS选择器');
      const allData = await storage.getAll();
      const selectors = [];

      for (const key in allData) {
        if (key.startsWith('cssSelectors.')) {
          selectors.push(allData[key]);
        }
      }

      logger.log(`[RunTimeDataService] getAllCssSelectors: 找到 ${selectors.length} 个CSS选择器`);
      return selectors;
    } catch (error) {
      logger.error('[RunTimeDataService] getAllCssSelectors: 获取所有CSS选择器失败:', error);
      return [];
    }
  }

  /**
   * 删除CSS选择器配置
   * @param {string} domain 域名
   * @param {string} pageType 页面类型
   */
  async removeCssSelector(domain, pageType) {
    const key = `${domain}_${pageType}`;
    logger.log(`[RunTimeDataService] removeCssSelector: 删除CSS选择器 ${key}`);
    return await storage.remove(`cssSelectors.${key}`);
  }

  /**
   * 清除所有CSS选择器
   * @returns {Object} 包含成功状态和删除数量的对象
   */
  async clearAllCssSelectors() {
    try {
      logger.log('[RunTimeDataService] clearAllCssSelectors: 开始清除所有CSS选择器');
      const result = await storage.clearByPrefix('cssSelectors.');
      if (result.success) {
        logger.log(`[RunTimeDataService] clearAllCssSelectors: 成功清除 ${result.deletedCount} 个CSS选择器`);
      }
      return result;
    } catch (error) {
      logger.error('[RunTimeDataService] clearAllCssSelectors: 清除CSS选择器失败:', error);
      return { success: false, error: error.message };
    }
  }

  // ===== 论文盒子数据管理方法 =====

  /**
   * 获取论文盒子数据
   * @returns {Object} 论文盒子数据对象
   */
  async getPaperBoxData() {
    try {
      logger.log('[RunTimeDataService] getPaperBoxData: 开始获取论文盒子数据');
      const result = await storage.get('savedPapers');

      if (result && typeof result === 'object' && result !== null) {
        try {
          // 安全地获取对象键数量
          const keyCount = Object.keys(result).length;
          logger.log(`[RunTimeDataService] getPaperBoxData: 获取论文盒子数据成功，论文数量: ${keyCount}`);
        } catch (keyError) {
          // 如果 Object.keys() 失败，记录错误但继续返回数据
          logger.warn('[RunTimeDataService] getPaperBoxData: 无法获取对象键数量，但数据有效:', keyError);
          logger.log('[RunTimeDataService] getPaperBoxData: 获取论文盒子数据成功（无法统计数量）');
        }
        return result;
      } else {
        logger.log('[RunTimeDataService] getPaperBoxData: 论文盒子数据不存在或无效，返回空对象');
        return {};
      }
    } catch (error) {
      logger.error('[RunTimeDataService] getPaperBoxData: 获取论文盒子数据失败:', error);
      return {};
    }
  }

  /**
   * 保存论文盒子数据
   * @param {Object} paperBoxData - 论文盒子数据对象
   * @returns {boolean} 是否保存成功
   */
  async savePaperBoxData(paperBoxData) {
    try {
      if (!paperBoxData || typeof paperBoxData !== 'object') {
        logger.error('[RunTimeDataService] savePaperBoxData: 无效的论文盒子数据');
        return false;
      }

      try {
        const paperCount = Object.keys(paperBoxData).length;
        logger.log(`[RunTimeDataService] savePaperBoxData: 开始保存论文盒子数据，论文数量: ${paperCount}`);
      } catch (keyError) {
        logger.log('[RunTimeDataService] savePaperBoxData: 开始保存论文盒子数据（无法统计数量）');
      }
      const success = await storage.saveData('savedPapers', paperBoxData);

      if (success) {
        logger.log('[RunTimeDataService] savePaperBoxData: 论文盒子数据保存成功');
        return true;
      } else {
        logger.error('[RunTimeDataService] savePaperBoxData: 论文盒子数据保存失败');
        return false;
      }
    } catch (error) {
      logger.error('[RunTimeDataService] savePaperBoxData: 保存论文盒子数据时发生异常:', error);
      return false;
    }
  }

  /**
   * 添加论文到论文盒子
   * @param {Object} paper - 论文对象
   * @returns {Object} 操作结果
   */
  async addPaperToBox(paper) {
    try {
      if (!paper || !paper.id) {
        logger.error('[RunTimeDataService] addPaperToBox: 无效的论文数据');
        return { success: false, error: 'Invalid paper data' };
      }

      logger.log(`[RunTimeDataService] addPaperToBox: 添加论文 ${paper.id} (${paper.title})`);

      // 获取当前论文盒子数据
      const currentPaperBox = await this.getPaperBoxData();

      // 添加新论文
      currentPaperBox[paper.id] = paper;

      // 保存更新后的数据
      const saveSuccess = await this.savePaperBoxData(currentPaperBox);

      if (saveSuccess) {
        try {
          const paperCount = Object.keys(currentPaperBox).length;
          logger.log(`[RunTimeDataService] addPaperToBox: 论文添加成功，当前论文数量: ${paperCount}`);
          return {
            success: true,
            paperCount: paperCount,
            paper: paper
          };
        } catch (keyError) {
          logger.log('[RunTimeDataService] addPaperToBox: 论文添加成功（无法统计数量）');
          return {
            success: true,
            paperCount: -1, // 表示无法统计
            paper: paper
          };
        }
      } else {
        logger.error('[RunTimeDataService] addPaperToBox: 保存论文盒子数据失败');
        return { success: false, error: 'Failed to save paper box data' };
      }
    } catch (error) {
      logger.error('[RunTimeDataService] addPaperToBox: 添加论文时发生异常:', error);
      return { success: false, error: error.message || 'Failed to add paper' };
    }
  }

  /**
   * 从论文盒子移除论文
   * @param {string} paperId - 论文ID
   * @returns {Object} 操作结果
   */
  async removePaperFromBox(paperId) {
    try {
      if (!paperId) {
        logger.error('[RunTimeDataService] removePaperFromBox: 无效的论文ID');
        return { success: false, error: 'Invalid paper ID' };
      }

      logger.log(`[RunTimeDataService] removePaperFromBox: 移除论文 ${paperId}`);

      // 获取当前论文盒子数据
      const currentPaperBox = await this.getPaperBoxData();

      // 检查论文是否存在
      if (!currentPaperBox[paperId]) {
        logger.warn(`[RunTimeDataService] removePaperFromBox: 论文 ${paperId} 不存在`);
        return { success: false, error: 'Paper not found' };
      }

      // 移除论文
      delete currentPaperBox[paperId];

      // 保存更新后的数据
      const saveSuccess = await this.savePaperBoxData(currentPaperBox);

      if (saveSuccess) {
        try {
          const paperCount = Object.keys(currentPaperBox).length;
          logger.log(`[RunTimeDataService] removePaperFromBox: 论文移除成功，当前论文数量: ${paperCount}`);
          return {
            success: true,
            paperCount: paperCount
          };
        } catch (keyError) {
          logger.log('[RunTimeDataService] removePaperFromBox: 论文移除成功（无法统计数量）');
          return {
            success: true,
            paperCount: -1 // 表示无法统计
          };
        }
      } else {
        logger.error('[RunTimeDataService] removePaperFromBox: 保存论文盒子数据失败');
        return { success: false, error: 'Failed to save paper box data' };
      }
    } catch (error) {
      logger.error('[RunTimeDataService] removePaperFromBox: 移除论文时发生异常:', error);
      return { success: false, error: error.message || 'Failed to remove paper' };
    }
  }

  /**
   * 清空论文盒子
   * @returns {Object} 操作结果
   */
  async clearPaperBox() {
    try {
      logger.log('[RunTimeDataService] clearPaperBox: 开始清空论文盒子');

      const saveSuccess = await this.savePaperBoxData({});

      if (saveSuccess) {
        logger.log('[RunTimeDataService] clearPaperBox: 论文盒子清空成功');
        return { success: true };
      } else {
        logger.error('[RunTimeDataService] clearPaperBox: 清空论文盒子失败');
        return { success: false, error: 'Failed to clear paper box' };
      }
    } catch (error) {
      logger.error('[RunTimeDataService] clearPaperBox: 清空论文盒子时发生异常:', error);
      return { success: false, error: error.message || 'Failed to clear paper box' };
    }
  }
}

// 创建并导出单例实例
export const runTimeDataService = new RunTimeDataService();
export default runTimeDataService;
