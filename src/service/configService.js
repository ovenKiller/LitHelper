/**
 * 配置服务
 * 提供易用的配置管理接口，底层调用storage.js
 * 包含用户配置管理和插件配置管理功能
 */

import { logger } from '../util/logger.js';
import { storage } from '../util/storage.js';

// 导入默认配置
const defaultConfig = {
  selectedAiModel: "DeepSeek",
  aiModels: [
    {
      name: "OpenAI",  
      provider: "OpenAI",
      isCustom: false,
      active: true,
      apiKey: "",
      url: "https://api.openai.com",
      selectedModel: "gpt-3.5-turbo",
      supportedModels: ["gpt-4-turbo-preview", "gpt-4", "gpt-3.5-turbo"],
      maxTokens: 4096,
      temperature: 0.7
    },
    {
      name: "Google",
      provider: "Google",
      isCustom: false,
      active: true,
      apiKey: "",
      url: "https://generativelanguage.googleapis.com",
      selectedModel: "gemini-pro",
      supportedModels: ["gemini-pro", "gemini-1.5-pro-latest"],
      maxTokens: 4096,
      temperature: 0.7
    },
    {
      name: "Anthropic",
      provider: "Anthropic",
      isCustom: false,
      active: true,
      apiKey: "",
      url: "https://api.anthropic.com",
      selectedModel: "claude-3-opus-20240229",
      supportedModels: [
        "claude-3-opus-20240229",
        "claude-3-sonnet-20240229",
        "claude-2.1",
        "claude-2.0",
        "claude-instant-1.2"
      ],
      maxTokens: 4096,
      temperature: 0.7
    },
    {
      name: "DeepSeek",
      provider: "DeepSeek",
      isCustom: false,
      active: true,
      apiKey: "",
      url: "https://api.deepseek.com",
      selectedModel: "deepseek-chat",
      supportedModels: ["deepseek-chat", "deepseek-coder"],
      maxTokens: 4096,
      temperature: 0.7
    }
  ],
  summarizePrompt: "请总结以下论文，并以markdown格式呈现，要求包含'论文题目'，'研究背景'，'研究方法'，'研究结论'等部分。",
  paperListPageSize: 10,
  language: "zh"
};

const CONFIG_KEY = 'extension_config';

class ConfigService {
  constructor() {
    // 配置缓存
    this.configCache = new Map();
    // 插件配置相关
    this.currentConfig = null;
    this.initPromise = null;
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
  // ==================== 插件配置管理 ====================

  /**
   * 初始化插件配置。
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
      if ('name' in updates) {
        const newName = updates.name;
        const existingNames = config.aiModels
          .map((m, i) => i !== index ? m.name : null)
          .filter(Boolean);
        if (existingNames.includes(newName)) {
          throw new Error(`Model name "${newName}" already exists.`);
        }
      }
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
    if (config.aiModels.some(m => m.name === modelConfig.name)) {
      throw new Error(`Model name "${modelConfig.name}" already exists.`);
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

  /**
   * 获取默认AI模型的完整配置
   * @returns {Promise<Object>} 默认AI模型的配置对象
   * @throws {Error} 如果找不到默认模型配置或配置不完整
   */
  async getDefaultAiModel() {
    const config = await this.getConfig();
    const modelName = config.selectedAiModel;
    
    if (!modelName) {
      throw new Error('未设置默认AI模型');
    }

    const modelConfig = (config.aiModels || []).find(m => m.name === modelName);
    
    if (!modelConfig) {
      throw new Error(`找不到名为"${modelName}"的AI模型配置`);
    }

    if (!modelConfig.active) {
      throw new Error(`AI模型"${modelName}"未激活`);
    }

    if (!modelConfig.apiKey) {
      throw new Error(`AI模型"${modelName}"缺少API密钥`);
    }

    if (!modelConfig.url || !modelConfig.selectedModel) {
      throw new Error(`AI模型"${modelName}"配置不完整，缺少url或selectedModel`);
    }

    return modelConfig;
  }
}

// 创建并导出单例实例
export const configService = new ConfigService();
export default configService;
