/**
 * Result.js
 * 
 * 通用结果对象，用于封装操作结果
 */

export class Result {
  /**
   * @param {Object} data 结果数据
   * @param {string} data.message 操作结果消息
   * @param {string|number} data.code 操作结果代码
   * @param {*} [data.data] 结果数据
   * @param {boolean} [data.success] 是否成功
   */
  constructor(data) {
    this.message = data.message || '';
    this.code = data.code || 0;
    this.data = data.data || null;
    this.success = data.success !== undefined ? data.success : true;
    this.timestamp = data.timestamp || new Date().toISOString();
  }

  /**
   * 创建成功结果
   * @param {string} message 成功消息
   * @param {*} data 结果数据
   * @param {string|number} code 成功代码，默认为'SUCCESS'
   * @returns {Result} 成功结果对象
   */
  static success(message, data = null, code = 'SUCCESS') {
    return new Result({
      message,
      code,
      data,
      success: true
    });
  }

  /**
   * 创建失败结果
   * @param {string} message 失败消息
   * @param {string|number} code 失败代码，默认为'ERROR'
   * @param {*} data 错误数据
   * @returns {Result} 失败结果对象
   */
  static error(message, code = 'ERROR', data = null) {
    return new Result({
      message,
      code,
      data,
      success: false
    });
  }

  /**
   * 判断是否成功
   * @returns {boolean} 是否成功
   */
  isSuccess() {
    return this.success;
  }

  /**
   * 判断是否失败
   * @returns {boolean} 是否失败
   */
  isError() {
    return !this.success;
  }

  /**
   * 转换为JSON对象
   * @returns {Object} JSON对象
   */
  toJSON() {
    return {
      message: this.message,
      code: this.code,
      data: this.data,
      success: this.success,
      timestamp: this.timestamp
    };
  }
}

export default Result; 