/**
 * 任务类
 * 定义任务的数据模型和相关操作
 */

import { TASK_STATUS, TASK_TYPE, AI_CRAWLER_SUPPORTED_TASK_TYPES, AI_EXTRACTOR_SUPPORTED_TASK_TYPES } from '../constants.js';

export class Task {
  /**
   * 构造函数
   * @param {string} key - 任务唯一标识
   * @param {string} type - 任务类型
   * @param {Object} params - 任务执行参数
   */
  constructor(key, type, params = {}) {
    this.key = key;
    this.type = type;
    this.status = TASK_STATUS.PENDING;
    this.params = params;
    this.result = null;
    this.error = null;
    this.createTime = new Date().getTime();
    this.updateTime = this.createTime;
  }

  /**
   * 更新任务状态
   * @param {string} status - 新状态
   * @param {*} result - 执行结果
   * @param {Error} error - 错误信息
   */
  updateStatus(status, result = null, error = null) {
    this.status = status;
    this.result = result;
    this.error = error;
    this.updateTime = new Date().getTime();
  }

  /**
   * 标记任务为执行中
   */
  markAsExecuting() {
    this.updateStatus(TASK_STATUS.EXECUTING);
  }

  /**
   * 标记任务为完成
   * @param {*} result - 执行结果
   */
  markAsCompleted(result) {
    this.updateStatus(TASK_STATUS.COMPLETED, result);
  }

  /**
   * 标记任务为失败
   * @param {Error} error - 错误信息
   */
  markAsFailed(error) {
    this.updateStatus(TASK_STATUS.FAILED, null, error);
  }






  /**
   * 检查任务是否过期
   * @param {number} days - 过期天数
   * @returns {boolean} 是否过期
   */
  isExpired(minutes) {
    const expireTime = this.createTime + (minutes * 60 * 1000);
    return Date.now() > expireTime;
  }

  /**
   * 获取任务运行时长(毫秒)
   * @returns {number} 运行时长
   */
  getExecutionTime() {
    return this.updateTime - this.createTime;
  }

  /**
   * 检查任务是否处于最终状态
   * @returns {boolean} 是否为最终状态
   */
  isFinalStatus() {
    return this.status === TASK_STATUS.COMPLETED || this.status === TASK_STATUS.FAILED;
  }

  /**
   * 检查任务是否成功
   * @returns {boolean} 是否成功
   */
  isSuccessful() {
    return this.status === TASK_STATUS.COMPLETED;
  }

  /**
   * 检查任务是否失败
   * @returns {boolean} 是否失败
   */
  isFailed() {
    return this.status === TASK_STATUS.FAILED;
  }

  /**
   * 检查任务是否正在执行
   * @returns {boolean} 是否正在执行
   */
  isExecuting() {
    return this.status === TASK_STATUS.EXECUTING;
  }

  /**
   * 检查任务是否等待执行
   * @returns {boolean} 是否等待执行
   */
  isPending() {
    return this.status === TASK_STATUS.PENDING;
  }


  /**
   * 验证任务参数
   * @returns {boolean} 参数是否有效
   */
  validateParams() {
    if (!this.key || typeof this.key !== 'string') {
      return false;
    }
    // 验证任务类型，支持通用任务类型和 AI 任务类型
    const allTaskTypes = [
      ...Object.values(TASK_TYPE), 
      ...Object.values(AI_CRAWLER_SUPPORTED_TASK_TYPES),
      ...Object.values(AI_EXTRACTOR_SUPPORTED_TASK_TYPES)
    ];
    if (!this.type || !allTaskTypes.includes(this.type)) {
      return false;
    }
    return true;
  }

  /**
   * 序列化任务
   * @returns {Object} 序列化后的任务数据
   */
  toJSON() {
    return {
      key: this.key,
      type: this.type,
      status: this.status,
      params: this.params,
      result: this.result,
      error: this.error ? {
        message: this.error.message,
        stack: this.error.stack,
        name: this.error.name
      } : null,
      createTime: this.createTime,
      updateTime: this.updateTime
    };
  }

  /**
   * 从JSON数据创建任务实例
   * @param {Object} data - JSON数据
   * @returns {Task} 任务实例
   */
  static fromJSON(data) {
    const task = new Task(data.key, data.type, data.params);
    task.status = data.status;
    task.result = data.result;
    task.error = data.error ? new Error(data.error.message) : null;
    task.createTime = data.createTime;
    task.updateTime = data.updateTime;
    return task;
  }

  /**
   * 生成任务唯一标识
   * @param {string} type - 任务类型
   * @param {string} identifier - 标识符
   * @returns {string} 任务key
   */
  static generateKey(type, identifier) {
    const timestamp = Date.now();
    return `${type}_${identifier}_${timestamp}`;
  }

  /**
   * 创建任务实例
   * @param {string} type - 任务类型
   * @param {Object} params - 任务参数
   * @param {string} identifier - 标识符(可选)
   * @returns {Task} 任务实例
   */
  static create(type, params, identifier = null) {
    const key = identifier 
      ? Task.generateKey(type, identifier)
      : Task.generateKey(type, Math.random().toString(36).substr(2, 9));
    return new Task(key, type, params);
  }
}

export default Task; 