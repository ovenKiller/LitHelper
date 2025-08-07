/**
 * 任务服务类
 * 轻量级任务调度器，负责Handler注册、任务分发和全局状态管理
 */

import { Task } from '../../model/task.js';
import { BaseHandler } from './baseHandler.js';

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
}

// 创建并导出单例实例
export const taskService = new TaskService();
export default taskService;
