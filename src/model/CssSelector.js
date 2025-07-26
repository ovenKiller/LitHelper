/**
 * CssSelector.js
 * 
 * CSS选择器配置数据模型
 */

import { Selector } from './Selector.js';

/**
 * @typedef {import('./Selector.js').SelectorProperties & {
 *   selector: string
 * }} CssSelectorProperties
 */

/**
 * 表示一个CSS选择器配置。
 * @extends {Selector}
 */
export class CssSelector extends Selector {
  /**
   * 创建CssSelector实例。
   * @param {Partial<CssSelectorProperties>} initialData - 初始数据
   */
  constructor(initialData = {}) {
    super(initialData);
    /** @type {string} */
    this.selector = initialData.selector || '';
  }

  /**
   * 使用CSS选择器从DOM元素中提取内容。
   * @param {HTMLElement} element - 待提取内容的DOM元素
   * @returns {string[]} 提取结果数组
   */
  extract(element) {
    if (!element || typeof element.querySelectorAll !== 'function') {
      return [];
    }
    return element.querySelectorAll(this.selector);
  }
  
  /**
   * 验证配置的完整性
   * @returns {{valid: boolean, errors: string[]}}
   */
  validate() {
    const baseValidation = super.validate();
    const errors = [...baseValidation.errors];

    if (!this.selector) {
      errors.push('CSS选择器不能为空');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 转换为JSON对象
   * @returns {Object} JSON对象
   */
  toJSON() {
    return {
      ...super.toJSON(),
      selector: this.selector
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