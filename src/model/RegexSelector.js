/**
 * RegexSelector.js
 * 
 * 正则表达式选择器配置数据模型
 */

import { Selector } from './Selector.js';

/**
 * @typedef {import('./Selector.js').SelectorProperties & {
 *   regex: string,
 *   groupIndex?: number,
 *   flags?: string
 * }} RegexSelectorProperties
 */

/**
 * 表示一个正则表达式选择器配置。
 * @extends {Selector}
 */
export class RegexSelector extends Selector {
  /**
   * 创建RegexSelector实例。
   * @param {Partial<RegexSelectorProperties>} initialData - 初始数据
   */
  constructor(initialData = {}) {
    super(initialData);
    /** @type {string} */
    this.regex = initialData.regex || '';
    /** @type {number} */
    this.groupIndex = initialData.groupIndex || 0;
    /** @type {string} */
    this.flags = initialData.flags || 'g';
  }

  /**
   * 执行正则表达式提取
   * @param {string} content - 待提取的内容
   * @returns {string[]} 提取结果数组
   */
  extract(content) {
    try {
      const regexPattern = new RegExp(this.regex, this.flags);
      const matches = [];
      let match;

      while ((match = regexPattern.exec(content)) !== null) {
        const result = match[this.groupIndex] || match[0];
        matches.push(result);
        
        // 防止无限循环（当正则表达式不包含'g'标志时）
        if (!this.flags.includes('g')) {
          break;
        }
      }

      return matches;
    } catch (error) {
      console.error('正则表达式执行失败:', error);
      return [];
    }
  }

  /**
   * 验证配置的完整性
   * @returns {{valid: boolean, errors: string[]}} 验证结果
   */
  validate() {
    const baseValidation = super.validate();
    const errors = [...baseValidation.errors];

    if (!this.regex) {
      errors.push('正则表达式不能为空');
    }
    
    // 验证正则表达式语法
    try {
      new RegExp(this.regex, this.flags);
    } catch (error) {
      errors.push(`无效的正则表达式: ${this.regex}, 错误: ${error.message}`);
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
      ...super.toJSON(),
      regex: this.regex,
      groupIndex: this.groupIndex,
      flags: this.flags,
    };
  }

  /**
   * 创建正则选择器配置的副本
   * @returns {RegexSelector} 新的选择器实例
   */
  clone() {
    return new RegexSelector(this.toJSON());
  }
} 