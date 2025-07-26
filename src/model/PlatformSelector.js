/**
 * PlatformSelector.js
 * 
 * 平台选择器配置数据模型
 * 包含四个提取器：论文项提取器、题目提取器、PDF提取器、摘要提取器
 */

import { PLATFORM_KEYS, PLATFORM_TYPES, EXTRACTOR_TYPE, SELECTOR_MODE, PAGE_TYPE } from '../constants.js';
import { CssSelector } from './CssSelector.js';
import { RegexSelector } from './RegexSelector.js';


/**
 * @typedef {Object} PlatformSelectorProperties
 * @property {string} domain - 网站一级域名（如：scholar.google.com）
 * @property {string} pageType - 网页类型（search_results 或 paper_detail）
 * @property {Object<string, ExtractorConfig>} extractors - 提取器配置
 */

/**
 * 表示一个平台选择器配置，包含多个提取器。
 */
export class PlatformSelector {
  /**
   * 预定义的验证配置
   * @type {Object<string, import('./Selector.js').ValidationCriteria>}
   */
  static PREDEFINED_VALIDATIONS = {
    VALIDATE_PAPER_LIST: {
      contentRegex: '.{6,}', // 长度大于5（至少6个字符）
      minCount: 3,           // 最小计数3
      maxCount: 30           // 最大计数30
    },
    VALIDATE_TITLE: {
      contentRegex: '.{10,}', // 标题长度大于10
      minCount: 1,            // 最小计数1
      maxCount: 1             // 最大计数1
    },
    VALIDATE_PDF_URL: {
      contentRegex: '.*\\.pdf.*|.*filetype.*pdf.*', // PDF相关URL
      minCount: 0,            // 最小计数0（可能没有PDF）
      maxCount: 5             // 最大计数5
    },
    VALIDATE_ABSTRACT: {
      contentRegex: '.{50,}', // 摘要长度大于50
      minCount: 0,            // 最小计数0（可能没有摘要）
      maxCount: 1             // 最大计数1
    },
    VALIDATE_ALL_VERSIONS_LINK: {
      contentRegex: '.*versions?.*|.*version.*\\d+.*', // 包含version相关关键词
      minCount: 0,            // 最小计数0（可能没有版本链接）
      maxCount: 1             // 最大计数1
    }
  };


  /**
   * 创建PlatformSelector实例。
   * @param {Partial<PlatformSelectorProperties>} initialData - 初始数据
   */
  constructor(initialData = {}) {
    /** @type {string} */
    this.domain = initialData.domain || '';
    /** @type {string} */
    this.pageType = initialData.pageType || PAGE_TYPE.SEARCH_RESULTS;
    /** @type {Object<string, ExtractorConfig>} */
    this.extractors = {};
    
    // 重建提取器配置（从存储恢复时重建选择器对象实例）
    if (initialData.extractors) {
      this._rebuildExtractors(initialData.extractors);
    }
  }

  /**
   * 重建提取器配置（从JSON数据重建选择器对象实例）
   * @param {Object} extractorsData - 提取器数据
   * @private
   */
  _rebuildExtractors(extractorsData) {
    Object.entries(extractorsData).forEach(([extractorType, config]) => {
      if (config && config.selector) {
        // 重建选择器对象实例
        const selectorInstance = this._createSelector(extractorType, config.mode, config.selector);
        
        this.extractors[extractorType] = {
          mode: config.mode,
          selector: selectorInstance,
          enabled: config.enabled !== undefined ? config.enabled : true,
          description: config.description || this._getDefaultDescription(extractorType, config.mode),
          validation: config.validation || selectorInstance.validation
        };
      }
    });
  }

  /**
   * 创建选择器实例
   * @param {string} extractorType - 提取器类型
   * @param {string} mode - 选择器模式
   * @param {Object} selectorConfig - 选择器配置
   * @returns {CssSelector|RegexSelector} 选择器实例
   * @private
   */
  _createSelector(extractorType, mode, selectorConfig = {}) {
    const baseConfig = {
      domain: this.domain,
      pageType: this.pageType,
      ...selectorConfig
    };

    if (mode === SELECTOR_MODE.CSS) {
      return new CssSelector(baseConfig);
    } else if (mode === SELECTOR_MODE.REGEX) {
      return new RegexSelector(baseConfig);
    }
    
    throw new Error(`不支持的选择器模式: ${mode}`);
  }

  /**
   * 获取默认描述
   * @param {string} extractorType - 提取器类型
   * @param {string} mode - 选择器模式
   * @returns {string} 默认描述
   * @private
   */
  _getDefaultDescription(extractorType, mode) {
    const descriptions = {
      [EXTRACTOR_TYPE.PAPER_ITEM]: `论文项${mode === SELECTOR_MODE.CSS ? 'CSS选择器' : '正则提取器'}`,
      [EXTRACTOR_TYPE.TITLE]: `标题${mode === SELECTOR_MODE.CSS ? 'CSS选择器' : '正则提取器'}`,
      [EXTRACTOR_TYPE.PDF]: `PDF链接${mode === SELECTOR_MODE.CSS ? 'CSS选择器' : '正则提取器'}`,
      [EXTRACTOR_TYPE.ABSTRACT]: `摘要${mode === SELECTOR_MODE.CSS ? 'CSS选择器' : '正则提取器'}`
    };
    return descriptions[extractorType] || `${extractorType}提取器`;
  }

  /**
   * 获取配置的唯一标识符（domain + pageType）
   * @returns {string} 唯一标识符
   */
  getKey() {
    return `${this.domain}_${this.pageType}`;
  }

  /**
   * 从URL提取一级域名
   * @param {string} url - 完整URL
   * @returns {string} 一级域名
   */
  static extractDomain(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch (error) {
      return '';
    }
  }

  /**
   * 获取指定类型的提取器
   * @param {string} extractorType - 提取器类型
   * @returns {ExtractorConfig|null} 提取器配置
   */
  getExtractor(extractorType) {
    return this.extractors[extractorType] || null;
  }

  /**
   * 设置指定类型提取器的模式
   * @param {string} extractorType - 提取器类型
   * @param {string} mode - 新的模式（css 或 regex）
   * @param {Object} selectorConfig - 选择器配置
   */
  setExtractorMode(extractorType, mode, selectorConfig = {}) {
    if (!Object.values(EXTRACTOR_TYPE).includes(extractorType)) {
      throw new Error(`无效的提取器类型: ${extractorType}`);
    }
    
    if (!Object.values(SELECTOR_MODE).includes(mode)) {
      throw new Error(`无效的选择器模式: ${mode}`);
    }

    // 创建或更新提取器
    this.extractors[extractorType] = {
      ...this.extractors[extractorType], // 保留现有属性（如enabled）
      mode: mode,
      selector: this._createSelector(extractorType, mode, selectorConfig),
      description: selectorConfig.description || this._getDefaultDescription(extractorType, mode),
      validation: selectorConfig.validation,
      enabled: true // 默认启用
    };
  }



  /**
   * 执行指定类型的提取
   * @param {string} extractorType - 提取器类型
   * @param {string|HTMLElement} content - 待提取的内容
   * @returns {string[]|null} 提取结果数组，如果提取器不存在或未启用则返回null
   */
  extract(extractorType, content) {
    const extractor = this.extractors[extractorType];
    if (!extractor || !extractor.enabled) {
      return null;
    }
    
    return extractor.selector.extract(content);
  }

    /**
   * 验证提取结果
   * @param {string[]} results - 提取结果数组
   * @param {string} extractorType - 提取器类型
   * @returns {{valid: boolean, errors: string[]}}
   */
  validateResults(results, extractorType) {
    const extractor = this.getExtractor(extractorType);
    if (!extractor) {
      return { valid: false, errors: [`提取器 ${extractorType} 不存在`] };
    }
    const validation = extractor.selector.validation;
    const errors = [];
    const contentRegexPattern = new RegExp(validation.contentRegex);
    
    // 检查数量范围
    if (results.length < validation.minCount) {
      errors.push(`结果数量不足：期望至少 ${validation.minCount} 项，实际 ${results.length} 项`);
    }
    
    if (results.length > validation.maxCount) {
      errors.push(`结果数量超限：期望最多 ${validation.maxCount} 项，实际 ${results.length} 项`);
    }
    
    // 检查每项是否符合内容验证正则表达式
    const invalidItems = results.filter(result => !contentRegexPattern.test(result));
    
    if (invalidItems.length > 0) {
      errors.push(`有 ${invalidItems.length} 项内容不符合验证规则 "${validation.contentRegex}"`);
    }
    
    return {
      valid: errors.length === 0,
      errors: errors
    };
  }

  /**
   * 使用预定义的validation配置验证提取结果
   * @param {string[]} results - 提取结果列表
   * @param {string} validationName - 预定义validation的名称
   * @returns {boolean} 验证是否通过
   */
  static validateWithPredefined(results, validationName) {
    const validation = PlatformSelector.PREDEFINED_VALIDATIONS[validationName];
    if (!validation) {
      console.warn(`预定义的validation "${validationName}" 不存在`);
      return false;
    }

    const contentRegexPattern = new RegExp(validation.contentRegex);
    
    // 检查数量范围
    if (results.length < validation.minCount || results.length > validation.maxCount) {
      return false;
    }
    
    // 检查每项是否符合内容正则表达式
    return results.every(result => contentRegexPattern.test(result));
  }

  /**
   * 验证所有提取器的配置
   * @returns {Object} 验证结果 {valid: boolean, errors: Object<string, string[]>}
   */
  validate() {
    const errors = {};
    let allValid = true;

    // 验证基本属性
    if (!this.domain) {
      errors.platform = errors.platform || [];
      errors.platform.push('域名不能为空');
      allValid = false;
    }

    if (!Object.values(PAGE_TYPE).includes(this.pageType)) {
      errors.platform = errors.platform || [];
      errors.platform.push(`无效的页面类型: ${this.pageType}`);
      allValid = false;
    }

    // 验证每个提取器
    Object.entries(this.extractors).forEach(([extractorType, config]) => {
      const validationResult = config.selector.validate();
      if (!validationResult.valid) {
        errors[extractorType] = validationResult.errors;
        allValid = false;
      }
    });

    return {
      valid: allValid,
      errors: errors
    };
  }

  /**
   * 检查URL和页面类型是否匹配
   * @param {string} targetUrl - 目标URL
   * @param {string} pageType - 页面类型
   * @returns {boolean} 是否匹配
   */
  matches(targetUrl, pageType) {
    const targetDomain = PlatformSelector.extractDomain(targetUrl);
    return this.domain === targetDomain && this.pageType === pageType;
  }

  /**
   * 更新平台选择器配置
   * @param {Partial<PlatformSelectorProperties>} updates - 更新数据
   */
  update(updates) {
    Object.keys(updates).forEach(key => {
      if (key === 'extractors' && typeof updates[key] === 'object') {
        // 更新提取器配置
        Object.entries(updates[key]).forEach(([extractorType, config]) => {
          if (this.extractors[extractorType] && config) {
            Object.assign(this.extractors[extractorType], config);
          }
        });
      } else {
        this[key] = updates[key];
      }
    });
  }

  /**
   * 转换为JSON对象
   * @returns {Object} JSON对象
   */
  toJSON() {
    const extractorsData = {};
    Object.entries(this.extractors).forEach(([type, config]) => {
      extractorsData[type] = {
        mode: config.mode,
        selector: config.selector.toJSON(),
        description: config.description
      };
    });

    return {
      domain: this.domain,
      pageType: this.pageType,
      extractors: extractorsData,
    };
  }

  /**
   * 创建平台选择器配置的副本
   * @returns {PlatformSelector} 新的选择器实例
   */
  clone() {
    return new PlatformSelector(this.toJSON());
  }
} 