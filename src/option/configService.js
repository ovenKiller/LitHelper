/**
 * configService.js
 * 
 * 配置管理的核心服务。
 * 负责加载、获取、更新和持久化插件的配置。
 * 这是一个单例服务，为整个插件提供统一的配置访问点。
 */
import { storage } from '../util/storage.js';
import { defaultConfig } from './model.js';
import { logger } from '../util/logger.js';

const CONFIG_KEY = 'extension_config';

class ConfigService {
  constructor() {
    this.currentConfig = null;
    this.initPromise = null;
  }

  /**
   * 初始化配置。
   * 从存储中加载配置，如果不存在，则使用默认配置。
   * @private
   */
  async _initialize() {
    if (this.currentConfig) {
      return;
    }
    

    // 防止并发初始化
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      try {
        let storedConfig = await storage.get(CONFIG_KEY);
        if (!storedConfig || Object.keys(storedConfig).length === 0) {
          logger.log('[ConfigService] 未找到存储的配置，使用默认配置。');
          this.currentConfig = this._deepClone(defaultConfig);
          await this._save();
        } else {
          logger.log('[ConfigService] 从存储中加载配置成功。');
          this.currentConfig = storedConfig;
        }
      } catch (error) {
        logger.error('[ConfigService] 初始化配置失败，将使用默认配置:', error);
        this.currentConfig = this._deepClone(defaultConfig);
      } finally {
        this.initPromise = null;
      }
    })();
    return this.initPromise;
  }

  /**
   * 深拷贝一个对象。
   * @param {Object} obj 要拷贝的对象
   * @returns {Object} 拷贝后的新对象
   * @private
   */
  _deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  /**
   * 内部保存方法，将当前内存中的配置持久化。
   * @private
   */
  async _save() {
    if (!this.currentConfig) return false;
    return await storage.set(CONFIG_KEY, this.currentConfig);
  }

  // --- 核心配置管理 ---

  async getConfig() {
    await this._initialize();
    return this.currentConfig;
  }

  async saveConfig() {
    return await this._save();
  }

  async resetConfig() {
    this.currentConfig = this._deepClone(defaultConfig);
    await this._save();
    logger.log('[ConfigService] 配置已重置为默认值。');
  }

  // --- AI模型配置 ---

  async getAiModels() {
    const config = await this.getConfig();
    return config.aiModels || [];
  }

  async updateModel(index, updates) {
    const config = await this.getConfig();
    if (config.aiModels && config.aiModels[index]) {
      Object.assign(config.aiModels[index], updates);
      await this._save();
      return true;
    }
    return false;
  }

  async addCustomModel(modelConfig) {
    const config = await this.getConfig();
    if (!config.aiModels) {
      config.aiModels = [];
    }
    config.aiModels.push({ ...modelConfig, isCustom: true });
    await this._save();
  }

  async deleteModel(index) {
    const config = await this.getConfig();
    if (config.aiModels && config.aiModels[index]) {
      config.aiModels.splice(index, 1);
      await this._save();
      return true;
    }
    return false;
  }
  
  async toggleModelActive(index, isActive) {
      const config = await this.getConfig();
      if (config.aiModels && config.aiModels[index]) {
        config.aiModels[index].active = isActive;
        await this._save();
        return true;
      }
      return false;
  }


  // --- 默认模型 ---

  async getSelectedAiModelName() {
    const config = await this.getConfig();
    return config.selectedAiModel;
  }

  async setSelectedAiModelName(modelName) {
    const config = await this.getConfig();
    config.selectedAiModel = modelName;
    await this._save();
  }

  async getSelectedAiModel() {
    const config = await this.getConfig();
    const modelName = config.selectedAiModel;
    return (config.aiModels || []).find(m => m.name === modelName);
  }

  async getEnabledModels() {
    const config = await this.getConfig();
    return (config.aiModels || []).filter(m => m.active && m.apiKey);
  }

  // --- 其他配置 ---

  async getSummarizePrompt() {
    const config = await this.getConfig();
    return config.summarizePrompt;
  }

  async setSummarizePrompt(prompt) {
    const config = await this.getConfig();
    config.summarizePrompt = prompt;
    await this._save();
  }

  async getLanguage() {
    const config = await this.getConfig();
    return config.language;
  }

  async setLanguage(lang) {
    const config = await this.getConfig();
    config.language = lang;
    await this._save();
  }
}

export const configService = new ConfigService(); 