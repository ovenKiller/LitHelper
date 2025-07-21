/**
 * 配置服务
 * 提供易用的配置管理接口，底层调用storage.js
 */

import { logger } from '../util/logger.js';
import { storage } from '../util/storage.js';

class ConfigService {
  constructor() {
    // 配置缓存
    this.configCache = new Map();
  }



  /**
   * 保存用户配置
   * @param {string} key - 配置键
   * @param {any} value - 配置值
   * @returns {Promise<boolean>} 是否保存成功
   */
  async saveUserConfig(key, value) {
    try {
      logger.log(`[CONFIG] saveUserConfig: 保存用户配置 "${key}"`);
      const result = await storage.saveData(`userConfig.${key}`, value);
      
      // 清除缓存
      this.configCache.delete(key);
      
      return result;
    } catch (error) {
      logger.error(`[CONFIG] saveUserConfig: 保存用户配置失败 "${key}":`, error);
      return false;
    }
  }

  /**
   * 获取用户配置
   * @param {string} key - 配置键
   * @param {any} defaultValue - 默认值
   * @returns {Promise<any>} 配置值
   */
  async getUserConfig(key, defaultValue = null) {
    try {
      // 先查缓存
      if (this.configCache.has(key)) {
        logger.log(`[CONFIG] getUserConfig: 从缓存获取用户配置 "${key}"`);
        return this.configCache.get(key);
      }
      
      logger.log(`[CONFIG] getUserConfig: 获取用户配置 "${key}"`);
      const value = await storage.get(`userConfig.${key}`);
      
      // 如果没有找到配置，返回默认值
      const result = value !== undefined ? value : defaultValue;
      
      // 缓存结果
      this.configCache.set(key, result);
      
      return result;
    } catch (error) {
      logger.error(`[CONFIG] getUserConfig: 获取用户配置失败 "${key}":`, error);
      return defaultValue;
    }
  }

  /**
   * 移除用户配置
   * @param {string} key - 配置键
   * @returns {Promise<boolean>} 是否移除成功
   */
  async removeUserConfig(key) {
    try {
      logger.log(`[CONFIG] removeUserConfig: 移除用户配置 "${key}"`);
      const result = await storage.remove(`userConfig.${key}`);
      
      // 清除缓存
      this.configCache.delete(key);
      
      return result;
    } catch (error) {
      logger.error(`[CONFIG] removeUserConfig: 移除用户配置失败 "${key}":`, error);
      return false;
    }
  }

  /**
   * 获取所有用户配置
   * @returns {Promise<Object>} 所有用户配置
   */
  async getAllUserConfigs() {
    try {
      logger.log('[CONFIG] getAllUserConfigs: 获取所有用户配置');
      const allData = await chrome.storage.local.get(null);
      const userConfigs = {};
      
      for (const key in allData) {
        if (key.startsWith('userConfig.')) {
          const configKey = key.replace('userConfig.', '');
          userConfigs[configKey] = allData[key];
        }
      }
      
      return userConfigs;
    } catch (error) {
      logger.error('[CONFIG] getAllUserConfigs: 获取所有用户配置失败:', error);
      return {};
    }
  }

  /**
   * 清除所有用户配置
   * @returns {Promise<boolean>} 是否清除成功
   */
  async clearAllUserConfigs() {
    try {
      logger.log('[CONFIG] clearAllUserConfigs: 清除所有用户配置');
      const result = await storage.clearByPrefix('userConfig.');
      
      // 清除缓存
      this.configCache.clear();
      
      return result;
    } catch (error) {
      logger.error('[CONFIG] clearAllUserConfigs: 清除所有用户配置失败:', error);
      return false;
    }
  }


}

// 创建并导出单例实例
export const configService = new ConfigService();
export default configService;
