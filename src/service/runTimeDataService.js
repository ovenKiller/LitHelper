/**
 * 运行时数据服务
 * 负责管理平台选择器、默认配置和运行时数据
 */

import { logger } from '../util/logger.js';
import { PLATFORM_KEYS } from '../constants.js';

// 导入平台配置
import { googleScholarConfig } from '../model/config/website/googleScholarConfig.js';
import { CssSelector } from '../model/CssSelector.js';

class RunTimeDataService {
  constructor() {
    // 平台配置映射
    this.platformConfigs = {
      [PLATFORM_KEYS.GOOGLE_SCHOLAR]: googleScholarConfig
    };
    
    // 运行时数据缓存
    this.runtimeCache = new Map();
    
    // CSS选择器缓存
    this.cssSelectorCache = new Map();
    
    // 初始化
    this.initialize();
  }

  /**
   * 初始化运行时数据服务
   */
  initialize() {
    logger.log('[RunTimeDataService] 初始化运行时数据服务');
    
    // 预加载平台配置到缓存
    Object.keys(this.platformConfigs).forEach(platformKey => {
      this.loadPlatformSelectors(platformKey);
    });
  }

  /**
   * 获取平台配置
   * @param {string} platformKey - 平台键名
   * @returns {Object|null} 平台配置对象
   */
  getPlatformConfig(platformKey) {
    try {
      const config = this.platformConfigs[platformKey];
      if (!config) {
        logger.warn(`[RunTimeDataService] 未找到平台配置 "${platformKey}"`);
        return null;
      }
      
      logger.log(`[RunTimeDataService] 获取平台配置 "${platformKey}"`);
      return config;
    } catch (error) {
      logger.error(`[RunTimeDataService] 获取平台配置失败 "${platformKey}":`, error);
      return null;
    }
  }

  /**
   * 获取平台选择器
   * @param {string} platformKey - 平台键名
   * @returns {Object|null} 选择器配置
   */
  getPlatformSelectors(platformKey) {
    try {
      // 先从缓存中获取
      const cacheKey = `selectors_${platformKey}`;
      if (this.runtimeCache.has(cacheKey)) {
        logger.log(`[RunTimeDataService] 从缓存获取平台选择器 "${platformKey}"`);
        return this.runtimeCache.get(cacheKey);
      }
      
      // 从配置中获取
      const config = this.getPlatformConfig(platformKey);
      if (!config || !config.selectors) {
        logger.warn(`[RunTimeDataService] 未找到平台选择器 "${platformKey}"`);
        return this.getDefaultSelectors(platformKey);
      }
      
      // 缓存并返回
      this.runtimeCache.set(cacheKey, config.selectors);
      logger.log(`[RunTimeDataService] 获取平台选择器 "${platformKey}"`);
      return config.selectors;
    } catch (error) {
      logger.error(`[RunTimeDataService] 获取平台选择器失败 "${platformKey}":`, error);
      return this.getDefaultSelectors(platformKey);
    }
  }

  /**
   * 获取默认选择器配置
   * @param {string} platformKey - 平台键名
   * @returns {Object} 默认选择器配置
   */
  getDefaultSelectors(platformKey) {
    try {
      logger.log(`[RunTimeDataService] 获取默认选择器配置 "${platformKey}"`);
      
      switch (platformKey) {
        case PLATFORM_KEYS.GOOGLE_SCHOLAR:
          return this.getGoogleScholarDefaultSelectors();
        default:
          logger.warn(`[RunTimeDataService] 未知平台 "${platformKey}"，返回空配置`);
          return {};
      }
    } catch (error) {
      logger.error(`[RunTimeDataService] 获取默认选择器配置失败 "${platformKey}":`, error);
      return {};
    }
  }

  /**
   * 获取 Google Scholar 默认选择器配置
   * @returns {Object} Google Scholar 默认选择器配置
   */
  getGoogleScholarDefaultSelectors() {
    return {
      resultsContainer: ['#gs_res_ccl_mid', '#gs_res_ccl'],
      paperItems: ['.gs_r.gs_or.gs_scl', '.gs_ri'],
      paperTitle: '.gs_rt a',
      paperAuthors: '.gs_a',
      paperAbstract: '.gs_rs',
      paperLinks: '.gs_fl a',
      citationCount: '.gs_fl a:contains("引用")',
      relatedArticles: '.gs_fl a:contains("相关文章")',
      pdfLink: '.gs_or_ggsm a[href$=".pdf"]',
      versionInfo: '.gs_fl a:contains("版本")'
    };
  }

  /**
   * 预加载平台选择器
   * @param {string} platformKey - 平台键名
   */
  loadPlatformSelectors(platformKey) {
    try {
      const selectors = this.getPlatformSelectors(platformKey);
      logger.log(`[RunTimeDataService] 预加载平台选择器 "${platformKey}":`, selectors);
      return selectors;
    } catch (error) {
      logger.error(`[RunTimeDataService] 预加载平台选择器失败 "${platformKey}":`, error);
      return null;
    }
  }

  /**
   * 更新平台选择器
   * @param {string} platformKey - 平台键名
   * @param {Object} selectors - 新的选择器配置
   */
  updatePlatformSelectors(platformKey, selectors) {
    try {
      const cacheKey = `selectors_${platformKey}`;
      this.runtimeCache.set(cacheKey, selectors);
      logger.log(`[RunTimeDataService] 更新平台选择器 "${platformKey}"`);
    } catch (error) {
      logger.error(`[RunTimeDataService] 更新平台选择器失败 "${platformKey}":`, error);
    }
  }

  /**
   * 重置平台选择器到默认配置
   * @param {string} platformKey - 平台键名
   */
  resetPlatformSelectors(platformKey) {
    try {
      const cacheKey = `selectors_${platformKey}`;
      this.runtimeCache.delete(cacheKey);
      
      // 重新加载默认配置
      this.loadPlatformSelectors(platformKey);
      logger.log(`[RunTimeDataService] 重置平台选择器 "${platformKey}"`);
    } catch (error) {
      logger.error(`[RunTimeDataService] 重置平台选择器失败 "${platformKey}":`, error);
    }
  }

  /**
   * 获取平台选项
   * @param {string} platformKey - 平台键名
   * @returns {Object} 选项配置
   */
  getPlatformOptions(platformKey) {
    try {
      const config = this.getPlatformConfig(platformKey);
      if (!config || !config.options) {
        logger.warn(`[RunTimeDataService] 未找到平台选项 "${platformKey}"`);
        return {};
      }
      
      logger.log(`[RunTimeDataService] 获取平台选项 "${platformKey}"`);
      return config.options;
    } catch (error) {
      logger.error(`[RunTimeDataService] 获取平台选项失败 "${platformKey}":`, error);
      return {};
    }
  }

  /**
   * 保存CSS选择器配置
   * @param {CssSelector} cssSelector - CSS选择器对象
   * @returns {boolean} 是否保存成功
   */
  async saveCssSelector(cssSelector) {
    try {
      if (!cssSelector || !cssSelector.domain || !cssSelector.pageType) {
        logger.error('[RunTimeDataService] saveCssSelector: 无效的CSS选择器数据');
        return false;
      }
      
      const key = cssSelector.getKey();
      const storageKey = `cssSelectors.${key}`;
      
      logger.log(`[RunTimeDataService] 保存CSS选择器 ${key}`);
      
      // 保存到Chrome存储
      await chrome.storage.local.set({ [storageKey]: cssSelector.toJSON() });
      
      // 更新缓存
      this.cssSelectorCache.set(key, cssSelector);
      
      logger.log(`[RunTimeDataService] CSS选择器 ${key} 保存成功`);
      return true;
    } catch (error) {
      logger.error('[RunTimeDataService] saveCssSelector: 保存CSS选择器失败:', error);
      return false;
    }
  }

  /**
   * 获取CSS选择器配置
   * @param {string} domain - 域名
   * @param {string} pageType - 页面类型
   * @returns {CssSelector|null} CSS选择器对象
   */
  async getCssSelector(domain, pageType) {
    try {
      const key = `${domain}_${pageType}`;
      
      // 先从缓存中获取
      if (this.cssSelectorCache.has(key)) {
        logger.log(`[RunTimeDataService] 从缓存获取CSS选择器 ${key}`);
        return this.cssSelectorCache.get(key);
      }
      
      // 从存储中获取
      const storageKey = `cssSelectors.${key}`;
      const result = await chrome.storage.local.get([storageKey]);
      
      if (!result[storageKey]) {
        logger.log(`[RunTimeDataService] CSS选择器 ${key} 不存在`);
        return null;
      }
      
      // 创建CssSelector实例
      const cssSelector = new CssSelector(result[storageKey]);
      
      // 更新缓存
      this.cssSelectorCache.set(key, cssSelector);
      
      logger.log(`[RunTimeDataService] 获取CSS选择器 ${key} 成功`);
      return cssSelector;
    } catch (error) {
      logger.error(`[RunTimeDataService] getCssSelector: 获取CSS选择器失败[${domain}_${pageType}]:`, error);
      return null;
    }
  }

  /**
   * 根据URL和页面类型获取CSS选择器
   * @param {string} url - 目标URL
   * @param {string} pageType - 页面类型
   * @returns {CssSelector|null} CSS选择器对象
   */
  async getCssSelectorForPage(url, pageType) {
    try {
      const domain = CssSelector.extractDomain(url);
      if (!domain) {
        logger.error('[RunTimeDataService] getCssSelectorForPage: URL解析失败:', url);
        return null;
      }
      
      return await this.getCssSelector(domain, pageType);
    } catch (error) {
      logger.error('[RunTimeDataService] getCssSelectorForPage: 获取CSS选择器失败:', error);
      return null;
    }
  }

  /**
   * 根据域名获取所有CSS选择器
   * @param {string} domain - 域名
   * @returns {Array<CssSelector>} CSS选择器数组
   */
  async getCssSelectorsByDomain(domain) {
    try {
      logger.log(`[RunTimeDataService] 查找域名 "${domain}" 的选择器`);
      
      // 获取所有存储数据
      const allData = await chrome.storage.local.get(null);
      const domainSelectors = [];
      
      for (const key in allData) {
        if (key.startsWith('cssSelectors.') && key.includes(`${domain}_`)) {
          const cssSelector = new CssSelector(allData[key]);
          domainSelectors.push(cssSelector);
          
          // 更新缓存
          const cacheKey = cssSelector.getKey();
          this.cssSelectorCache.set(cacheKey, cssSelector);
        }
      }
      
      logger.log(`[RunTimeDataService] 找到 ${domainSelectors.length} 个匹配选择器`);
      return domainSelectors;
    } catch (error) {
      logger.error('[RunTimeDataService] getCssSelectorsByDomain: 查找选择器失败:', error);
      return [];
    }
  }

  /**
   * 获取所有CSS选择器配置
   * @returns {Array<CssSelector>} 所有CSS选择器数组
   */
  async getAllCssSelectors() {
    try {
      logger.log('[RunTimeDataService] 开始获取所有CSS选择器');
      
      const allData = await chrome.storage.local.get(null);
      const selectors = [];
      
      for (const key in allData) {
        if (key.startsWith('cssSelectors.')) {
          const cssSelector = new CssSelector(allData[key]);
          selectors.push(cssSelector);
          
          // 更新缓存
          const cacheKey = cssSelector.getKey();
          this.cssSelectorCache.set(cacheKey, cssSelector);
        }
      }
      
      logger.log(`[RunTimeDataService] 找到 ${selectors.length} 个CSS选择器`);
      return selectors;
    } catch (error) {
      logger.error('[RunTimeDataService] getAllCssSelectors: 获取所有CSS选择器失败:', error);
      return [];
    }
  }

  /**
   * 更新CSS选择器配置
   * @param {CssSelector} cssSelector - 要更新的CSS选择器对象
   * @returns {boolean} 是否更新成功
   */
  async updateCssSelector(cssSelector) {
    try {
      if (!cssSelector || !cssSelector.domain || !cssSelector.pageType) {
        logger.error('[RunTimeDataService] updateCssSelector: 无效的CSS选择器数据');
        return false;
      }
      
      // 更新时间戳
      cssSelector.updatedAt = new Date().toISOString();
      
      const key = cssSelector.getKey();
      const storageKey = `cssSelectors.${key}`;
      
      logger.log(`[RunTimeDataService] 更新CSS选择器 ${key}`);
      
      // 更新存储
      await chrome.storage.local.set({ [storageKey]: cssSelector.toJSON() });
      
      // 更新缓存
      this.cssSelectorCache.set(key, cssSelector);
      
      logger.log(`[RunTimeDataService] CSS选择器 ${key} 更新成功`);
      return true;
    } catch (error) {
      logger.error('[RunTimeDataService] updateCssSelector: 更新CSS选择器失败:', error);
      return false;
    }
  }

  /**
   * 删除CSS选择器配置
   * @param {string} domain - 域名
   * @param {string} pageType - 页面类型
   * @returns {boolean} 是否删除成功
   */
  async removeCssSelector(domain, pageType) {
    try {
      const key = `${domain}_${pageType}`;
      const storageKey = `cssSelectors.${key}`;
      
      logger.log(`[RunTimeDataService] 删除CSS选择器 ${key}`);
      
      // 从存储中删除
      await chrome.storage.local.remove([storageKey]);
      
      // 从缓存中删除
      this.cssSelectorCache.delete(key);
      
      logger.log(`[RunTimeDataService] CSS选择器 ${key} 删除成功`);
      return true;
    } catch (error) {
      logger.error(`[RunTimeDataService] removeCssSelector: 删除CSS选择器失败[${domain}_${pageType}]:`, error);
      return false;
    }
  }

  /**
   * 清空指定前缀的所有CSS选择器数据
   * @param {string} domainPrefix - 域名前缀，如果不提供则清空所有CSS选择器
   * @returns {boolean} 是否清空成功
   */
  async clearCssSelectors(domainPrefix = null) {
    try {
      const allData = await chrome.storage.local.get(null);
      const keysToRemove = [];
      const cacheKeysToRemove = [];
      
      for (const key in allData) {
        if (key.startsWith('cssSelectors.')) {
          if (!domainPrefix || key.includes(domainPrefix)) {
            keysToRemove.push(key);
            // 提取缓存键
            const cacheKey = key.replace('cssSelectors.', '');
            cacheKeysToRemove.push(cacheKey);
          }
        }
      }
      
      if (keysToRemove.length > 0) {
        // 从存储中删除
        await chrome.storage.local.remove(keysToRemove);
        
        // 从缓存中删除
        cacheKeysToRemove.forEach(cacheKey => {
          this.cssSelectorCache.delete(cacheKey);
        });
        
        logger.log(`[RunTimeDataService] 清空CSS选择器数据，删除了 ${keysToRemove.length} 条记录`);
      } else {
        logger.log(`[RunTimeDataService] 未找到匹配的CSS选择器数据`);
      }
      
      return true;
    } catch (error) {
      logger.error('[RunTimeDataService] clearCssSelectors: 清空CSS选择器数据失败:', error);
      return false;
    }
  }

  /**
   * 获取CSS选择器缓存状态
   * @returns {Object} 缓存状态信息
   */
  getCssSelectorCacheStatus() {
    return {
      size: this.cssSelectorCache.size,
      keys: Array.from(this.cssSelectorCache.keys())
    };
  }

  /**
   * 清除CSS选择器缓存
   * @param {string} key - 要清除的特定键，如果不提供则清除所有CSS选择器缓存
   */
  clearCssSelectorCache(key = null) {
    try {
      if (key) {
        this.cssSelectorCache.delete(key);
        logger.log(`[RunTimeDataService] 清除CSS选择器缓存 "${key}"`);
      } else {
        this.cssSelectorCache.clear();
        logger.log('[RunTimeDataService] 清除所有CSS选择器缓存');
      }
    } catch (error) {
      logger.error('[RunTimeDataService] 清除CSS选择器缓存失败:', error);
    }
  }

  /**
   * 清除运行时缓存
   * @param {string} platformKey - 平台键名，如果不提供则清除所有缓存
   */
  clearCache(platformKey = null) {
    try {
      if (platformKey) {
        const cacheKey = `selectors_${platformKey}`;
        this.runtimeCache.delete(cacheKey);
        logger.log(`[RunTimeDataService] 清除平台缓存 "${platformKey}"`);
      } else {
        this.runtimeCache.clear();
        // 同时清除CSS选择器缓存
        this.cssSelectorCache.clear();
        logger.log('[RunTimeDataService] 清除所有运行时缓存');
      }
    } catch (error) {
      logger.error('[RunTimeDataService] 清除缓存失败:', error);
    }
  }

  /**
   * 获取缓存状态
   * @returns {Object} 缓存状态信息
   */
  getCacheStatus() {
    return {
      runtimeCache: {
        size: this.runtimeCache.size,
        keys: Array.from(this.runtimeCache.keys())
      },
      cssSelectorCache: {
        size: this.cssSelectorCache.size,
        keys: Array.from(this.cssSelectorCache.keys())
      }
    };
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
   * 清理任务队列
   * @param {string} queueType - 队列类型
   */
  async clearTaskQueue(queueType) {
    try {
      const key = `task_queue_${queueType}`;
      await chrome.storage.local.remove([key]);
      logger.log(`[RunTimeDataService] 清理任务队列 "${queueType}"`);
    } catch (error) {
      logger.error(`[RunTimeDataService] 清理任务队列失败 "${queueType}":`, error);
    }
  }

  /**
   * 获取任务历史记录
   * @param {number} days - 查询天数
   * @returns {Array} 任务历史数组
   */
  async getTaskHistory(days = 7) {
    try {
      const key = 'task_history';
      const result = await chrome.storage.local.get([key]);
      
      if (!result[key]) {
        logger.log('[RunTimeDataService] 任务历史记录不存在，返回空数组');
        return [];
      }
      
      const history = result[key];
      const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
      
      // 过滤出指定天数内的记录
      const filteredHistory = history.filter(record => record.timestamp >= cutoffTime);
      
      logger.log(`[RunTimeDataService] 获取任务历史记录，天数: ${days}, 记录数: ${filteredHistory.length}`);
      return filteredHistory;
    } catch (error) {
      logger.error('[RunTimeDataService] 获取任务历史记录失败:', error);
      return [];
    }
  }

  /**
   * 保存任务历史记录
   * @param {Object} taskRecord - 任务记录
   */
  async saveTaskHistory(taskRecord) {
    try {
      const key = 'task_history';
      const result = await chrome.storage.local.get([key]);
      
      let history = result[key] || [];
      
      // 添加新记录
      history.push({
        ...taskRecord,
        timestamp: Date.now()
      });
      
      // 保留最近1000条记录
      if (history.length > 1000) {
        history = history.slice(-1000);
      }
      
      await chrome.storage.local.set({ [key]: history });
      logger.log('[RunTimeDataService] 保存任务历史记录');
    } catch (error) {
      logger.error('[RunTimeDataService] 保存任务历史记录失败:', error);
    }
  }

  /**
   * 获取任务统计信息
   * @param {number} days - 统计天数
   * @returns {Object} 统计信息
   */
  async getTaskStatistics(days = 7) {
    try {
      const history = await this.getTaskHistory(days);
      
      const statistics = {
        totalTasks: history.length,
        completedTasks: 0,
        failedTasks: 0,
        tasksByType: {},
        tasksByStatus: {},
        averageExecutionTime: 0,
        timeRange: {
          start: Date.now() - (days * 24 * 60 * 60 * 1000),
          end: Date.now()
        }
      };
      
      let totalExecutionTime = 0;
      let taskWithExecutionTime = 0;
      
      history.forEach(record => {
        // 按状态统计
        statistics.tasksByStatus[record.status] = (statistics.tasksByStatus[record.status] || 0) + 1;
        
        // 按类型统计
        statistics.tasksByType[record.type] = (statistics.tasksByType[record.type] || 0) + 1;
        
        // 计算平均执行时间
        if (record.executionTime) {
          totalExecutionTime += record.executionTime;
          taskWithExecutionTime++;
        }
        
        // 完成和失败计数
        if (record.status === 'completed') {
          statistics.completedTasks++;
        } else if (record.status === 'failed') {
          statistics.failedTasks++;
        }
      });
      
      // 计算平均执行时间
      if (taskWithExecutionTime > 0) {
        statistics.averageExecutionTime = totalExecutionTime / taskWithExecutionTime;
      }
      
      logger.log(`[RunTimeDataService] 获取任务统计信息，天数: ${days}`);
      return statistics;
    } catch (error) {
      logger.error('[RunTimeDataService] 获取任务统计信息失败:', error);
      return null;
    }
  }

  /**
   * 清理过期的任务数据
   * @param {number} days - 保留天数
   */
  async cleanupExpiredTasks(days = 30) {
    try {
      const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
      
      // 清理任务历史
      const key = 'task_history';
      const result = await chrome.storage.local.get([key]);
      
      if (result[key]) {
        const history = result[key];
        const filteredHistory = history.filter(record => record.timestamp >= cutoffTime);
        
        await chrome.storage.local.set({ [key]: filteredHistory });
        logger.log(`[RunTimeDataService] 清理过期任务数据，保留天数: ${days}, 清理前: ${history.length}, 清理后: ${filteredHistory.length}`);
      }
    } catch (error) {
      logger.error('[RunTimeDataService] 清理过期任务数据失败:', error);
    }
  }
}

// 创建并导出单例实例
export const runTimeDataService = new RunTimeDataService();
export default runTimeDataService;
