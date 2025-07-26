/**
 * Selector.js
 * 
 * 选择器的抽象基类，定义了所有选择器共有的接口和属性。
 */

import { PAGE_TYPE } from '../constants.js';

/**
 * @typedef {Object} ValidationCriteria
 * @property {string} contentRegex - 内容验证的正则表达式
 * @property {number} minCount - 选择到的合法结果项的数量下限
 * @property {number} maxCount - 选择到的合法结果项的数量上限
 */

/**
 * @typedef {Object} SelectorProperties
 * @property {string} domain - 网站一级域名（如：scholar.google.com）
 * @property {string} pageType - 网页类型（search_results 或 paper_detail）
 * @property {string} description - 选择器用途描述
 * @property {ValidationCriteria} validation - 验证标准
 * @property {boolean} enabled - 是否启用该选择器
 * @property {Object} metadata - 额外的元数据信息
 */

export class Selector {
  /**
   * 创建Selector实例。
   * @param {Partial<SelectorProperties>} initialData - 初始数据
   */
  constructor(initialData = {}) {
    /** @type {string} */
    this.domain = initialData.domain || '';
    /** @type {string} */
    this.pageType = initialData.pageType || PAGE_TYPE.SEARCH_RESULTS;
    /** @type {string} */
    this.description = initialData.description || '';
    /** @type {ValidationCriteria} */
    this.validation = {
      contentRegex: initialData.validation?.contentRegex || '.*',
      minCount: initialData.validation?.minCount || 0,
      maxCount: initialData.validation?.maxCount || Number.MAX_SAFE_INTEGER
    };
    /** @type {boolean} */
    this.enabled = initialData.enabled !== undefined ? initialData.enabled : true;
    /** @type {Object} */
    this.metadata = initialData.metadata || {};
    /** @type {string} */
    this.createdAt = initialData.createdAt || new Date().toISOString();
    /** @type {string} */
    this.updatedAt = initialData.updatedAt || new Date().toISOString();
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
   * 检查URL和页面类型是否匹配
   * @param {string} targetUrl - 目标URL
   * @param {string} pageType - 页面类型
   * @returns {boolean} 是否匹配
   */
  matches(targetUrl, pageType) {
    const targetDomain = Selector.extractDomain(targetUrl);
    return this.domain === targetDomain && this.pageType === pageType;
  }

  /**
   * 更新选择器配置
   * @param {Partial<SelectorProperties>} updates - 更新数据
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
   * @returns {{valid: boolean, errors: string[]}} 验证结果
   */
  validate() {
    const errors = [];
    
    if (!this.domain) {
      errors.push('域名不能为空');
    }
    
    if (!Object.values(PAGE_TYPE).includes(this.pageType)) {
      errors.push(`无效的页面类型: ${this.pageType}`);
    }
    
    if (this.validation.minCount < 0) {
      errors.push('最小数量不能小于0');
    }
    
    if (this.validation.maxCount < this.validation.minCount) {
      errors.push('最大数量不能小于最小数量');
    }
    
    try {
      new RegExp(this.validation.contentRegex);
    } catch (error) {
      errors.push(`无效的内容验证正则表达式: ${this.validation.contentRegex}`);
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
      description: this.description,
      validation: this.validation,
      enabled: this.enabled,
      metadata: this.metadata,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  /**
   * 抽象方法：执行提取
   * @param {string|HTMLElement} content - 待提取的内容
   * @returns {string[]} 提取结果数组
   * @abstract
   */
  extract(content) {
    throw new Error('该方法必须由子类实现');
  }

  /**
   * 抽象方法：克隆实例
   * @returns {Selector} 新的选择器实例
   * @abstract
   */
  clone() {
    throw new Error('该方法必须由子类实现');
  }
} 