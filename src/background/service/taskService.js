/**
 * 任务服务类
 * 轻量级任务调度器，负责Handler注册、任务分发和全局状态管理
 */

import { Task } from '../../model/task.js';
import { BaseHandler } from './baseHandler.js';
import { TASK_TYPE } from '../../constants.js';

export class TaskService {
  /**
   * 构造函数
   */
  constructor() {
    // Handler注册表
    this.handlerRegistry = new Map();

    // 服务状态
    this.isRunning = false;

    // 初始化
    this.initialize();
  }

  /**
   * 初始化任务服务
   */
  async initialize() {
    console.log('[TaskService] 初始化任务调度器');
    console.log('[TaskService] 任务调度器初始化完成');
  }

  /**
   * 注册任务处理器
   * @param {string} taskType - 任务类型
   * @param {BaseHandler} handler - 处理器实例
   */
  registerHandler(taskType, handler) {
    if (!(handler instanceof BaseHandler)) {
      throw new Error('Handler 必须继承自 BaseHandler');
    }

    if (!handler.canHandle(taskType)) {
      throw new Error(`Handler "${handler.handlerName}" 不支持任务类型 "${taskType}"`);
    }

    this.handlerRegistry.set(taskType, handler);
    console.log(`[TaskService] 注册处理器: ${taskType} -> ${handler.handlerName}`);
  }

  /**
   * 获取任务处理器
   * @param {string} taskType - 任务类型
   * @returns {BaseHandler|null} 处理器实例
   */
  getHandler(taskType) {
    return this.handlerRegistry.get(taskType) || null;
  }

  /**
   * 添加任务
   * @param {Task|Object} task - 任务对象
   * @returns {Task} 添加的任务
   */
  addTask(task) {
    
    if (task instanceof Task) {
      task = task;
    } else {
        console.log("传入的对象不是Task对象",task);
        return;
    }

    // 获取对应的处理器
    const handler = this.getHandler(task.type);
    if (!handler) {
      throw new Error(`[TaskService] 未找到任务类型 "${task.type}" 的处理器`);
    }

    // 将任务分发到对应的处理器
    console.log(`[TaskService] 将任务分发到处理器 "${handler.handlerName}": ${task.key}`);
    return handler.addTask(task);
  }

  /**
   * 获取任务
   * @param {string} taskKey - 任务键名
   * @returns {Task|null} 任务对象
   */
  getTask(taskKey) {
    // 遍历所有处理器查找任务
    for (const handler of this.handlerRegistry.values()) {
      const task = handler.getTask(taskKey);
      if (task) {
        return task;
      }
    }
    return null;
  }

  /**
   * 移除任务
   * @param {string} taskKey - 任务键名
   * @returns {boolean} 是否成功移除
   */
  removeTask(taskKey) {
    // 遍历所有处理器尝试移除任务
    for (const handler of this.handlerRegistry.values()) {
      if (handler.removeTask(taskKey)) {
        console.log(`[TaskService] 任务已从处理器 "${handler.handlerName}" 中移除: ${taskKey}`);
        return true;
      }
    }
    
    console.warn(`[TaskService] 未找到任务: ${taskKey}`);
    return false;
  }

  /**
   * 启动任务服务
   */
  async start() {
    if (this.isRunning) {
      console.warn('[TaskService] 任务调度器已经在运行');
      return;
    }

    this.isRunning = true;
    
    // 启动所有已注册的处理器
    const startPromises = [];
    for (const handler of this.handlerRegistry.values()) {
      startPromises.push(handler.start());
    }
    
    await Promise.all(startPromises);
    console.log('[TaskService] 任务调度器已启动，所有处理器已启动');
  }

  /**
   * 停止任务服务
   */
  async stop() {
    if (!this.isRunning) {
      console.warn('[TaskService] 任务调度器未在运行');
      return;
    }

    this.isRunning = false;
    
    // 停止所有处理器
    const stopPromises = [];
    for (const handler of this.handlerRegistry.values()) {
      stopPromises.push(handler.stop());
    }
    
    await Promise.all(stopPromises);
    console.log('[TaskService] 任务调度器已停止，所有处理器已停止');
  }

  /**
   * 暂停任务服务
   */
  pause() {
    if (!this.isRunning) {
      console.warn('[TaskService] 任务调度器未在运行');
      return;
    }

    // 暂停所有处理器
    for (const handler of this.handlerRegistry.values()) {
      handler.pause();
    }
    
    console.log('[TaskService] 任务调度器已暂停，所有处理器已暂停');
  }

  /**
   * 恢复任务服务
   */
  resume() {
    if (!this.isRunning) {
      console.warn('[TaskService] 任务调度器未在运行');
      return;
    }

    // 恢复所有处理器
    for (const handler of this.handlerRegistry.values()) {
      handler.resume();
    }
    
    console.log('[TaskService] 任务调度器已恢复，所有处理器已恢复');
  }



  /**
   * 获取服务状态
   * @returns {Object} 服务状态信息
   */
  getStatus() {
    const handlerStatuses = {};
    let totalTasks = 0;
    
    // 聚合所有处理器的状态
    for (const [type, handler] of this.handlerRegistry.entries()) {
      const handlerStatus = handler.getHandlerStatus();
      handlerStatuses[type] = handlerStatus;
      totalTasks += handlerStatus.totalTasks;
    }
    
    return {
      isRunning: this.isRunning,
      totalTasks: totalTasks,
      registeredHandlers: Array.from(this.handlerRegistry.keys()),
      handlerStatuses: handlerStatuses
    };
  }

  /**
   * 获取队列信息
   * @returns {Object} 队列信息
   */
  getQueueInfo() {
    const queueInfo = {};
    
    // 聚合所有处理器的队列信息
    for (const [type, handler] of this.handlerRegistry.entries()) {
      queueInfo[type] = handler.getQueueInfo();
    }
    
    return queueInfo;
  }

  /**
   * 获取任务统计信息
   * @param {number} days - 统计天数
   * @returns {Promise<Object>} 统计信息
   */
  async getTaskStatistics(days = 7) {
    const statistics = {};
    
    // 聚合所有处理器的统计信息
    for (const [type, handler] of this.handlerRegistry.entries()) {
      statistics[type] = await handler.getTaskStatistics(days);
    }
    
    return statistics;
  }

  /**
   * 获取指定处理器的状态
   * @param {string} handlerName - 处理器名称
   * @returns {Object|null} 处理器状态
   */
  getHandlerStatus(handlerName) {
    for (const handler of this.handlerRegistry.values()) {
      if (handler.handlerName === handlerName) {
        return handler.getHandlerStatus();
      }
    }
    return null;
  }

  /**
   * 获取所有处理器列表
   * @returns {Array} 处理器信息数组
   */
  getAllHandlers() {
    return Array.from(this.handlerRegistry.values()).map(handler => ({
      handlerName: handler.handlerName,
      taskTypes: handler.getSupportedTaskTypes(),
      status: handler.getHandlerStatus()
    }));
  }
}

// 创建并导出单例实例
export const taskService = new TaskService();
export default taskService;
