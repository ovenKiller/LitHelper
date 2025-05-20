/**
 * SettingsModel.js (原 config.js)
 * 
 * 模型(Model)层：统一的配置管理模块，负责存储和管理扩展的所有设置
 */

import { storage } from '../utils/storage';
import { logger } from '../background/utils/logger.js';

// 默认配置
const DEFAULT_CONFIG = {
  aiModels: [
  {
    name: 'DeepSeek',
    apiKey: '',
    url: 'https://api.deepseek.com',
    models: 'deepseek-chat',
    selectedModel: 'deepseek-chat',
    maxTokens: 2000,
    temperature: 0.7,
    active: false
  },
  {
    name: 'OpenAI',
    apiKey: '',
    url: 'https://api.openai.com',
    models: ['gpt-4', 'gpt-3.5-turbo'],
    selectedModel: 'gpt-4',
    maxTokens: 2000,
    temperature: 0.7,
    active: false
  },
  {
    name: 'Claude',
    apiKey: '',
    url: 'https://api.anthropic.com',
    models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
    selectedModel: 'claude-3-opus',
    maxTokens: 2000,
    temperature: 0.7,
    active: false
  },
  {
    name: 'Gemini',
    apiKey: '',
    url: 'https://api.google.com',
    models: ['gemini-pro', 'gemini-pro-2'],
    selectedModel: 'gemini-pro',
    maxTokens: 2000,
    temperature: 0.7,
    active: false
  }
  ],
  selectedAiModel: null,
  summarization: {
    categories: [
      { id: 'methodology', name: 'Methodology', enabled: true },
      { id: 'findings', name: 'Key Findings', enabled: true },
      { id: 'limitations', name: 'Limitations', enabled: true },
      { id: 'futureWork', name: 'Future Work', enabled: true }
    ],
    maxPapersPerBatch: 10,
    includeAbstract: true,
    includeCitations: true
  }
};

/**
 * 配置类 - 管理扩展的所有设置
 */
class Config {
  constructor() {
    this.storage = storage;
    this.currentConfig = null;
  }

  /**
   * 初始化配置，从存储中加载或使用默认值
   * @returns {Promise<Object>} 当前配置
   */
  async init() {
    try {
      const savedConfig = await this.storage.get('config');
      this.currentConfig = savedConfig ? 
        this._mergeWithDefaults(savedConfig) : 
        { ...DEFAULT_CONFIG };
      return this.currentConfig;
    } catch (error) {
      logger.error('初始化配置失败:', error);
      this.currentConfig = { ...DEFAULT_CONFIG };
      return this.currentConfig;
    }
  }

  /**
   * 获取当前配置
   * @returns {Object} 当前配置
   */
  getConfig() {
    if (!this.currentConfig) {
      // 如果未初始化，返回默认值副本
      return { ...DEFAULT_CONFIG };
    }
    return { ...this.currentConfig };
  }

  /**
   * 更新配置
   * @param {Object} newConfig - 要应用的新配置值
   * @returns {Promise<Object>} 更新后的配置
   */
  async updateConfig(newConfig) {
    if (!this.currentConfig) {
      await this.init();
    }
    
    // 深度合并现有配置与新值
    this.currentConfig = this._deepMerge(this.currentConfig, newConfig);
    
    // 保存到存储
    await this.storage.saveData('config', this.currentConfig);
    
    return { ...this.currentConfig };
  }

  /**
   * 重置配置为默认值
   * @returns {Promise<Object>} 默认配置
   */
  async resetConfig() {
    this.currentConfig = { ...DEFAULT_CONFIG };
    await this.storage.saveData('config', this.currentConfig);
    return this.currentConfig;
  }

  /**
   * 获取配置的特定部分
   * @param {string} section - 部分名称 (例如 'llm', 'summarization')
   * @returns {Object} 请求的配置部分
   */
  getSection(section) {
    if (!this.currentConfig) {
      return { ...DEFAULT_CONFIG[section] };
    }
    return { ...(this.currentConfig[section] || DEFAULT_CONFIG[section]) };
  }

  /**
   * 获取当前启用的AI模型
   * @returns {Object|null} 已启用的AI模型配置，如果没有则返回null
   */
  getEnabledAiModel() {
    if (!this.currentConfig || !this.currentConfig.aiModels || !Array.isArray(this.currentConfig.aiModels) || this.currentConfig.aiModels.length === 0) {
      return null;
    }
    
    const models = this.currentConfig.aiModels;
    const selectedModelName = this.currentConfig.selectedAiModel;

    // 1. 优先处理用户选择的模型 (假设 selectedAiModel 存储的是模型名称)
    if (selectedModelName) {
      const userSelectedModel = models.find(model => model.name === selectedModelName);
      if (userSelectedModel && userSelectedModel.active && userSelectedModel.apiKey) {
        return {
          provider: userSelectedModel.name, // 使用模型名称作为 provider
          ...userSelectedModel
        };
      }
      // 如果用户选择的模型无效 (例如, apiKey 未设置或模型非 active),
      // 程序会继续尝试查找下一个可用的模型。
    }

    // 2. 如果没有选择模型，或者选择的模型不可用，则查找第一个 active 且有 apiKey 的模型
    for (const model of models) {
      if (model.active && model.apiKey) {
        return {
          provider: model.name, // 使用模型名称作为 provider
          ...model
        };
      }
    }
    
    return null; // 没有找到符合条件的模型
  }

  /**
   * 将保存的配置与默认值合并，确保所有必需字段存在
   * @param {Object} savedConfig - 存储中的配置
   * @returns {Object} 合并后的配置
   * @private
   */
  _mergeWithDefaults(savedConfig) {
    return this._deepMerge({ ...DEFAULT_CONFIG }, savedConfig);
  }

  /**
   * 深度合并两个对象
   * @param {Object} target - 目标对象
   * @param {Object} source - 要合并的源对象
   * @returns {Object} 合并后的对象
   * @private
   */
  _deepMerge(target, source) {
    const output = { ...target };
    
    if (source && typeof source === 'object' && !Array.isArray(source)) {
      Object.keys(source).forEach(key => {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          if (target[key]) {
            output[key] = this._deepMerge(target[key], source[key]);
          } else {
            output[key] = { ...source[key] };
          }
        } else {
          output[key] = source[key];
        }
      });
    }
    
    return output;
  }
}

// 导出单例实例
const configInstance = new Config();
export default configInstance;
export { DEFAULT_CONFIG }; 