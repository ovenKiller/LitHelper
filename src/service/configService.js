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
  language: "zh",

  // 翻译语言配置
  translationLanguages: [
    { code: 'zh-CN', name: '简体中文' },
    { code: 'zh-TW', name: '繁體中文' },
    { code: 'en', name: 'English' },
    { code: 'ja', name: '日本語' },
    { code: 'ko', name: '한국어' },
    { code: 'fr', name: 'Français' },
    { code: 'de', name: 'Deutsch' },
    { code: 'es', name: 'Español' },
    { code: 'ru', name: 'Русский' },
    { code: 'ar', name: 'العربية' }
  ],

  // 分类标准配置
  classificationStandards: [
    {
      id: 'research_method',
      title: '研究方法分类',
      prompt: '请根据研究方法对以下论文进行分类，可选类别包括：实验研究、理论分析、文献综述、案例研究、调查研究等。请说明分类依据。'
    },
    {
      id: 'research_field',
      title: '研究领域分类',
      prompt: '请根据研究领域对以下论文进行分类，如：计算机科学、生物医学、物理学、化学、工程学、社会科学等。请说明分类依据。'
    },
    {
      id: 'research_impact',
      title: '研究影响力分类',
      prompt: '请根据研究的潜在影响力对以下论文进行分类：高影响力（突破性发现）、中等影响力（重要进展）、一般影响力（常规研究）。请说明分类依据。'
    }
  ],

  // 整理论文的默认配置
  organizeDefaults: {
    downloadPdf: false,
    translation: {
      enabled: false,
      targetLanguage: 'zh-CN'
    },
    classification: {
      enabled: false,
      selectedStandard: 'research_method'
    }
  }
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
          // 合并存储的配置和默认配置，确保新添加的配置项被包含
          this.currentConfig = this._mergeConfigs(defaultConfig, storedConfig);
          // 保存合并后的配置，确保新配置项被持久化
          await this._save();
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

  // --- 翻译语言配置管理 ---

  /**
   * 获取所有翻译语言选项
   * @returns {Promise<Array>} 翻译语言列表
   */
  async getTranslationLanguages() {
    const config = await this.getConfig();
    return config.translationLanguages || [];
  }

  /**
   * 根据语言代码获取语言名称
   * @param {string} languageCode 语言代码
   * @returns {Promise<string>} 语言名称
   */
  async getLanguageName(languageCode) {
    const languages = await this.getTranslationLanguages();
    const language = languages.find(lang => lang.code === languageCode);
    return language ? language.name : languageCode;
  }

  // --- 分类标准配置管理 ---

  /**
   * 获取所有分类标准
   * @returns {Promise<Array>} 分类标准列表
   */
  async getClassificationStandards() {
    const config = await this.getConfig();
    return config.classificationStandards || [];
  }

  /**
   * 根据ID获取分类标准
   * @param {string} standardId 分类标准ID
   * @returns {Promise<Object|null>} 分类标准对象
   */
  async getClassificationStandard(standardId) {
    const standards = await this.getClassificationStandards();
    return standards.find(standard => standard.id === standardId) || null;
  }

  /**
   * 添加新的分类标准
   * @param {Object} standard 分类标准对象 {title, prompt}
   * @returns {Promise<string>} 新创建的分类标准ID
   */
  async addClassificationStandard(standard) {
    const config = await this.getConfig();
    if (!config.classificationStandards) {
      config.classificationStandards = [];
    }

    // 生成唯一ID
    const id = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const newStandard = {
      id,
      title: standard.title,
      prompt: standard.prompt,
      isCustom: true
    };

    config.classificationStandards.push(newStandard);
    await this._save();
    return id;
  }

  /**
   * 更新分类标准
   * @param {string} standardId 分类标准ID
   * @param {Object} updates 更新的字段
   * @returns {Promise<boolean>} 是否更新成功
   */
  async updateClassificationStandard(standardId, updates) {
    const config = await this.getConfig();
    const standards = config.classificationStandards || [];
    const index = standards.findIndex(standard => standard.id === standardId);

    if (index === -1) {
      return false;
    }

    // 只允许更新 title 和 prompt
    if (updates.title !== undefined) {
      standards[index].title = updates.title;
    }
    if (updates.prompt !== undefined) {
      standards[index].prompt = updates.prompt;
    }

    await this._save();
    return true;
  }

  /**
   * 删除分类标准（只能删除自定义的）
   * @param {string} standardId 分类标准ID
   * @returns {Promise<boolean>} 是否删除成功
   */
  async deleteClassificationStandard(standardId) {
    const config = await this.getConfig();
    const standards = config.classificationStandards || [];
    const index = standards.findIndex(standard => standard.id === standardId);

    if (index === -1) {
      return false;
    }

    // 只允许删除自定义的分类标准
    if (!standards[index].isCustom) {
      throw new Error('不能删除系统预设的分类标准');
    }

    standards.splice(index, 1);
    await this._save();
    return true;
  }

  // --- 整理论文默认配置管理 ---

  /**
   * 获取整理论文的默认配置
   * @returns {Promise<Object>} 默认配置对象
   */
  async getOrganizeDefaults() {
    const config = await this.getConfig();
    return config.organizeDefaults || {
      downloadPdf: false,
      translation: {
        enabled: false,
        targetLanguage: 'zh-CN'
      },
      classification: {
        enabled: false,
        selectedStandard: 'research_method'
      }
    };
  }

  /**
   * 更新整理论文的默认配置
   * @param {Object} defaults 新的默认配置
   * @returns {Promise<boolean>} 是否更新成功
   */
  async updateOrganizeDefaults(defaults) {
    const config = await this.getConfig();
    config.organizeDefaults = { ...config.organizeDefaults, ...defaults };
    await this._save();
    return true;
  }

  // --- 辅助方法 ---

  /**
   * 深度合并两个配置对象
   * @param {Object} defaultConfig 默认配置
   * @param {Object} storedConfig 存储的配置
   * @returns {Object} 合并后的配置
   * @private
   */
  _mergeConfigs(defaultConfig, storedConfig) {
    const merged = this._deepClone(defaultConfig);

    // 递归合并配置
    const mergeRecursive = (target, source) => {
      for (const key in source) {
        if (source.hasOwnProperty(key)) {
          if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            // 如果是对象，递归合并
            if (!target[key] || typeof target[key] !== 'object') {
              target[key] = {};
            }
            mergeRecursive(target[key], source[key]);
          } else {
            // 直接赋值（包括数组和基本类型）
            target[key] = source[key];
          }
        }
      }
    };

    mergeRecursive(merged, storedConfig);
    return merged;
  }
}

// 创建并导出单例实例
export const configService = new ConfigService();
export default configService;
