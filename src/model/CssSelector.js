/**
 * CssSelector.js
 * 
 * CSS选择器配置数据模型
 */

import { PAGE_TYPE} from '../constants.js';

/**
 * @typedef {Object} ValidationCriteria
 * @property {string} regex - 每一项需要满足的正则表达式
 * @property {number} minCount - 选择到的合法结果项的数量下限
 * @property {number} maxCount - 选择到的合法结果项的数量上限
 */

/**
 * @typedef {Object} CssSelectorProperties
 * @property {string} domain - 网站一级域名（如：scholar.google.com）
 * @property {string} pageType - 网页类型（search_results 或 paper_detail）
 * @property {string} selector - CSS选择器字符串
 * @property {string} description - 选择器用途描述
 * @property {ValidationCriteria} validation - 验证标准
 * @property {string} createdAt - 创建时间
 * @property {string} updatedAt - 最后更新时间
 * @property {boolean} enabled - 是否启用该选择器
 * @property {Object} metadata - 额外的元数据信息
 */

/**
 * 表示一个CSS选择器配置。
 */
export class CssSelector {
  /**
   * 预定义的验证配置
   * @type {Object<string, ValidationCriteria>}
   */
  static PREDEFINED_VALIDATIONS = {
    VALIDATE_PAPER_LIST: {
      regex: '.{6,}', // 长度大于5（至少6个字符）
      minCount: 3,    // 最小计数3
      maxCount: 30    // 最大计数30
    }
  };

  /**
   * 创建CssSelector实例。
   * @param {Partial<CssSelectorProperties>} initialData - 初始数据
   */
  constructor(initialData = {}) {
    /** @type {string} */
    this.domain = initialData.domain || '';
    /** @type {string} */
    this.pageType = initialData.pageType || PAGE_TYPE.SEARCH_RESULTS;
    /** @type {string} */
    this.selector = initialData.selector || '';
    /** @type {string} */
    this.description = initialData.description || '';
    /** @type {ValidationCriteria} */
    this.validation = {
      regex: initialData.validation?.regex || '.*',
      minCount: initialData.validation?.minCount || 0,
      maxCount: initialData.validation?.maxCount || Number.MAX_SAFE_INTEGER
    };
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
   * 验证选择器结果
   * @param {string[]} results - 选择器查询到的结果数组
   * @returns {Object} 验证结果 {valid: boolean, errors: string[], validCount: number, totalCount: number}
   */
  validateResults(results) {
    const errors = [];
    const regexPattern = new RegExp(this.validation.regex);
    
    // 检查数量范围
    if (results.length < this.validation.minCount) {
      errors.push(`结果数量不足：期望至少 ${this.validation.minCount} 项，实际 ${results.length} 项`);
    }
    
    if (results.length > this.validation.maxCount) {
      errors.push(`结果数量超限：期望最多 ${this.validation.maxCount} 项，实际 ${results.length} 项`);
    }
    
    // 检查每项是否符合正则表达式
    const invalidItems = [];
    results.forEach((result, index) => {
      if (!regexPattern.test(result)) {
        invalidItems.push(`项 ${index + 1}: "${result}"`);
      }
    });
    
    if (invalidItems.length > 0) {
      errors.push(`以下项目不符合正则表达式 "${this.validation.regex}": ${invalidItems.join(', ')}`);
    }
    
    return {
      valid: errors.length === 0
    };
  }

  /**
   * 使用预定义的validation配置验证解析结果
   * @param {string[]} results - 解析结果列表
   * @param {string} validationName - 预定义validation的名称
   * @returns {boolean} 验证是否通过
   */
  static validateWithPredefined(results, validationName) {
    const validation = CssSelector.PREDEFINED_VALIDATIONS[validationName];
    if (!validation) {
      console.warn(`预定义的validation "${validationName}" 不存在`);
      return false;
    }

    const regexPattern = new RegExp(validation.regex);
    
    // 检查数量范围
    if (results.length < validation.minCount || results.length > validation.maxCount) {
      return false;
    }
    
    // 检查每项是否符合正则表达式
    return results.every(result => regexPattern.test(result));
  }

  /**
   * 检查URL和页面类型是否匹配
   * @param {string} targetUrl - 目标URL
   * @param {string} pageType - 页面类型
   * @returns {boolean} 是否匹配
   */
  matches(targetUrl, pageType) {
    const targetDomain = CssSelector.extractDomain(targetUrl);
    return this.domain === targetDomain && this.pageType === pageType;
  }

  /**
   * 更新选择器配置
   * @param {Partial<CssSelectorProperties>} updates - 更新数据
   */
  update(updates) {
    Object.keys(updates).forEach(key => {
        if (key === 'validation' && typeof updates[key] === 'object') {
          this.validation = { ...this.validation, ...updates[key] };
        } else {
          this[key] = updates[key];
        }

    });
    this.updatedAt = new Date().toISOString();
  }

  /**
   * 验证配置的完整性
   * @returns {Object} 验证结果 {valid: boolean, errors: string[]}
   */
  validate() {
    const errors = [];
    
    if (!this.domain) {
      errors.push('域名不能为空');
    }
    
    if (!Object.values(PAGE_TYPE).includes(this.pageType)) {
      errors.push(`无效的页面类型: ${this.pageType}`);
    }
    
    if (!this.selector) {
      errors.push('CSS选择器不能为空');
    }
    
    if (this.validation.minCount < 0) {
      errors.push('最小数量不能小于0');
    }
    
    if (this.validation.maxCount < this.validation.minCount) {
      errors.push('最大数量不能小于最小数量');
    }
    
    // 验证正则表达式
    try {
      new RegExp(this.validation.regex);
    } catch (error) {
      errors.push(`无效的正则表达式: ${this.validation.regex}`);
    }
    
    return {
      valid: errors.length === 0,
      errors: errors
    };
  }

  /**
   * 转换为JSON对象
   * @returns {Object} JSON对象
   */
  toJSON() {
    return {
      domain: this.domain,
      pageType: this.pageType,
      selector: this.selector,
      description: this.description,
      validation: this.validation,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      enabled: this.enabled,
      metadata: this.metadata
    };
  }

  /**
   * 创建CSS选择器配置的副本
   * @returns {CssSelector} 新的选择器实例
   */
  clone() {
    return new CssSelector(this.toJSON());
  }
} 