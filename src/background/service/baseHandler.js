/**
 * 基础任务处理器类 - 事件驱动版本
 * 使用事件驱动架构 + Chrome Alarms API 替代定时任务
 * 可以用于快速创建一个任务的处理器，独享队列。
 */

import { TASK_STATUS, QUEUE_CONFIG, QUEUE_TYPE, PERSISTENCE_STRATEGY } from '../../constants.js';
import { runTimeDataService } from '../../service/runTimeDataService.js';
import { Task } from '../../model/task.js';
import { logger } from '../../util/logger.js';

// 全局事件总线 - 更精确的消息路由
class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  on(eventType, handlerName, callback) {
    const key = `${eventType}:${handlerName}`;
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key).add(callback);
  }

  off(eventType, handlerName, callback) {
    const key = `${eventType}:${handlerName}`;
    if (this.listeners.has(key)) {
      this.listeners.get(key).delete(callback);
      if (this.listeners.get(key).size === 0) {
        this.listeners.delete(key);
      }
    }
  }

  emit(eventType, handlerName, data) {
    const key = `${eventType}:${handlerName}`;
    if (this.listeners.has(key)) {
      this.listeners.get(key).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[EventBus] 事件处理失败:`, error);
        }
      });
    }
  }
}

// 全局事件总线实例
const eventBus = new EventBus();

export class BaseHandler {
  /**
   * 构造函数
   * @param {string} handlerName - 处理器名称
   * @param {Object} config - 处理器配置
   */
  constructor(handlerName, config = {}) {
    this.handlerName = handlerName;
    this.processingCount = 0;
    this.maxConcurrency = config.maxConcurrency || 1;
    
    // 队列配置
    this.queueConfig = {
      executionQueueSize: config.queueConfig?.executionQueueSize || QUEUE_CONFIG.DEFAULT_EXECUTION_QUEUE_SIZE,
      waitingQueueSize: config.queueConfig?.waitingQueueSize || QUEUE_CONFIG.DEFAULT_WAITING_QUEUE_SIZE
    };

    // 持久化配置
    this.persistenceConfig = {
      strategy: config.persistenceConfig?.strategy || PERSISTENCE_STRATEGY.FIXED_DAYS,
      fixedMinutes: config.persistenceConfig?.fixedMinutes || 100
    };

    // 任务队列
    this.executionQueue = [];
    this.waitingQueue = [];
    this.completedQueue = [];
    this.failedQueue = [];

    // 任务映射表
    this.taskMap = new Map();

    // 处理器状态
    this.isRunning = false;
    this.isPaused = false;
    this.processingPromise = null;
    this.processingTimer = null;
    this.alarmName = `${this.handlerName}_processor`;

    // 事件驱动标识
    this.isProcessing = false;
    this.pendingProcessing = false;

    // 事件监听器引用，用于清理
    this.messageListener = null;
    this.alarmListener = null;
    this.eventBusCallback = null;

    // 延迟初始化
    this.initializePromise = null;
  }

  /**
   * 初始化处理器
   */
  async initialize() {
    if (this.initializePromise) {
      return this.initializePromise;
    }

    this.initializePromise = this._doInitialize();
    return this.initializePromise;
  }

  /**
   * 实际的初始化逻辑
   * @private
   */
  async _doInitialize() {
          logger.log(`[${this.handlerName}] 初始化处理器`);
    
    try {
      // 恢复队列数据
      await this.loadQueues();
      
      // 清理过期任务
      await this.clearExpiredTasks();
      
      // 设置事件监听器
      this.setupEventListeners();
      
      logger.log(`[${this.handlerName}] 处理器初始化完成`);
    } catch (error) {
      logger.error(`[${this.handlerName}] 初始化处理器失败:`, error);
      throw error;
    }
  }

  /**
   * 设置事件监听器 - 改进版本
   */
  setupEventListeners() {

    // 清理现有监听器
    this.cleanupEventListeners();

    // 设置事件总线监听器，用于处理外部触发的事件
    this.eventBusCallback = (data) => {
      // 添加防抖逻辑，避免过于频繁的处理
      if (this.isRunning && !this.isPaused && !this.isProcessing && !this.pendingProcessing) {
        this.scheduleProcessing();
      }
    };
    eventBus.on('TASK_ADDED', this.handlerName, this.eventBusCallback);

    // 监听闹钟事件
    if (chrome.alarms) {
      this.alarmListener = (alarm) => {
        if (alarm.name === this.alarmName) {
          this.processQueue();
        }
      };
      chrome.alarms.onAlarm.addListener(this.alarmListener);
    }
  }

  /**
   * 清理事件监听器
   */
  cleanupEventListeners() {
    // 清理事件总线监听器
    if (this.eventBusCallback) {
      eventBus.off('TASK_ADDED', this.handlerName, this.eventBusCallback);
      this.eventBusCallback = null;
    }

    // 清理 Chrome 消息监听器
    if (this.messageListener) {
      chrome.runtime.onMessage.removeListener(this.messageListener);
      this.messageListener = null;
    }

    // 清理闹钟监听器
    if (this.alarmListener && chrome.alarms) {
      chrome.alarms.onAlarm.removeListener(this.alarmListener);
      this.alarmListener = null;
    }
  }

  /**
   * 抽象方法：执行任务
   * 子类必须实现此方法
   * @param {Task} task - 要执行的任务
   * @returns {Promise<*>} 执行结果
   */
  async execute(task) {
    throw new Error(`Handler "${this.handlerName}" 必须实现 execute 方法`);
  }

  /**
   * 添加任务到处理器
   * @param {Task|Object} taskOrData - 任务对象或任务数据
   * @returns {Promise<Task>} 添加的任务
   */
  async addTask(taskOrData) {
    // 确保处理器已初始化
    await this.initialize();

    let task;
    
    if (taskOrData instanceof Task) {
      task = taskOrData;
    } else {
      // 从数据创建任务
      task = new Task(taskOrData.key, taskOrData.type, taskOrData.params);
    }

    // 检查是否可以处理该任务类型
    if (!this.canHandle(task.type)) {
      throw new Error(`[${this.handlerName}] 不支持任务类型: ${task.type}`);
    }

    // // 检查任务是否已存在
    // if (this.taskMap.has(task.key)) {
    //   throw new Error(`[${this.handlerName}] 任务已存在: ${task.key}`);
    // }

    // 添加到任务映射表
    this.taskMap.set(task.key, task);

    // 添加到执行队列或等待队列
    if (this.executionQueue.length < this.queueConfig.executionQueueSize) {
      this.executionQueue.push(task);
      logger.log(`[${this.handlerName}] 任务添加到执行队列: ${task.key}`);
    } else if (this.waitingQueue.length < this.queueConfig.waitingQueueSize) {
      this.waitingQueue.push(task);
      logger.log(`[${this.handlerName}] 任务添加到等待队列: ${task.key}`);
    } else {
      // 如果队列已满，需要从映射表中移除
      this.taskMap.delete(task.key);
      throw new Error(`[${this.handlerName}] 任务队列已满`);
    }

    // 触发处理 - 改进版本
    this.triggerProcessing();

    return task;
  }

  /**
   * 触发处理 - 改进版本，直接处理队列而不是触发事件
   */
  triggerProcessing() {
    if (!this.isRunning || this.isPaused || this.isProcessing || this.pendingProcessing) {
      return;
    }
    
    // 使用 setImmediate 或 setTimeout 确保真正的异步执行
    this.scheduleProcessing();
  }

  /**
   * 调度处理 - 使用真正的异步调用
   * @private
   */
  scheduleProcessing() {
    if (this.pendingProcessing) {
      return;
    }
    
    this.pendingProcessing = true;
    
    // 使用 setTimeout 确保异步执行，避免递归调用
    setTimeout(async () => {
      this.pendingProcessing = false;
      
      if (!this.isRunning || this.isPaused || this.isProcessing) {
        return;
      }

      try {
        await this.processQueue();
      } catch (error) {
        logger.error(`[${this.handlerName}] 调度队列处理失败:`, error);
      }
    }, 0);
  }

  /**
   * 启动处理器
   */
  async start() {
    if (this.isRunning) {
      logger.warn(`[${this.handlerName}] 处理器已经在运行`);
      return;
    }

    // 确保处理器已初始化
    await this.initialize();

    this.isRunning = true;
    this.isPaused = false;
    // 事件驱动模式：立即处理现有任务
    this.scheduleProcessing();

    
    logger.log(`[${this.handlerName}] 处理器已启动`);
  }

  /**
   * 停止处理器
   */
  async stop() {
    if (!this.isRunning) {
      logger.warn(`[${this.handlerName}] 处理器未在运行`);
      return;
    }

    this.isRunning = false;
    this.isPaused = false;
    
    // 停止定时器
    this.stopProcessing();
    
    // 清理闹钟
    if (chrome.alarms) {
      try {
        await chrome.alarms.clear(this.alarmName);
      } catch (error) {
        logger.warn(`[${this.handlerName}] 清理闹钟失败:`, error);
      }
    }

    // 清理事件监听器
    this.cleanupEventListeners();
    
    // 等待当前处理完成
    if (this.processingPromise) {
      try {
        await this.processingPromise;
      } catch (error) {
        logger.warn(`[${this.handlerName}] 等待处理完成失败:`, error);
      }
    }
    
    // 保存队列数据
    await this.saveQueues();
    
    logger.log(`[${this.handlerName}] 处理器已停止`);
  }

  /**
   * 暂停处理器
   */
  pause() {
    if (!this.isRunning) {
      logger.warn(`[${this.handlerName}] 处理器未在运行`);
      return;
    }

    this.isPaused = true;
    logger.log(`[${this.handlerName}] 处理器已暂停`);
  }

  /**
   * 恢复处理器
   */
  resume() {
    if (!this.isRunning) {
      logger.warn(`[${this.handlerName}] 处理器未在运行`);
      return;
    }

    this.isPaused = false;
    
    // 恢复时触发处理
    this.scheduleProcessing();
    
    logger.log(`[${this.handlerName}] 处理器已恢复`);
  }

  /**
   * 停止处理队列
   */
  stopProcessing() {
    if (this.processingTimer) {
      clearInterval(this.processingTimer);
      this.processingTimer = null;
    }
  }

  /**
   * 处理队列
   */
  async processQueue() {
    if (!this.isRunning || this.isPaused || this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    this.processingPromise = this._doProcessQueue(); // 修复：保存处理 Promise
    
    try {
      await this.processingPromise;
    } finally {
      this.isProcessing = false;
      this.processingPromise = null;
    }
  }

  /**
   * 实际的队列处理逻辑
   * @private
   */
  async _doProcessQueue() {
    try {
      // 处理执行队列
      await this.processExecutionQueue();

      // 从等待队列移动任务到执行队列
      await this.moveWaitingToExecution();

      // 定期保存队列状态
      await this.saveQueues();

      // 如果还有待处理任务，调度下一次处理（避免递归）
      if (this.hasQueuedTasks()) {
        // 使用较长的延迟，避免过于频繁的处理和递归调用
        setTimeout(() => {
          if (this.isRunning && !this.isPaused && !this.isProcessing && !this.pendingProcessing) {
            this.scheduleProcessing();
          }
        }, 500); // 增加延迟到500ms，减少CPU占用和避免递归
      }
    } catch (error) {
      logger.error(`[${this.handlerName}] 队列处理失败:`, error);
      
      // 在错误情况下，也要确保队列可以继续处理，但要避免递归
      if (this.hasQueuedTasks() && this.isRunning && !this.isPaused) {
        setTimeout(() => {
          if (this.isRunning && !this.isPaused && !this.isProcessing && !this.pendingProcessing) {
            this.scheduleProcessing();
          }
        }, 2000); // 错误后延迟2秒重试
      }
      
      throw error;
    }
  }

  /**
   * 检查是否有待处理任务
   */
  hasQueuedTasks() {
    return this.executionQueue.some(task => task.isPending()) || 
           this.waitingQueue.length > 0;
  }

  /**
   * 处理执行队列
   */
  async processExecutionQueue() {
    // 首先清理已完成或失败的任务
    this.executionQueue = this.executionQueue.filter(task => task.isPending());
    
    const pendingTasks = this.executionQueue.filter(task => task.isPending());
    
    // 修复并发控制：只有在当前并发数小于限制时才启动新任务
    for (const task of pendingTasks) {
      if (!this.isRunning || this.isPaused) {
        break;
      }

      // 检查并发限制 - 这里需要实时检查，因为可能有任务正在异步执行
      if (this.processingCount >= this.maxConcurrency) {
        logger.log(`[${this.handlerName}] 达到最大并发限制 ${this.maxConcurrency}，当前处理中: ${this.processingCount}`);
        break;
      }

      // 立即增加处理计数，防止在异步启动过程中被重复启动
      this.processingCount++;
      
      // 异步启动任务，在任务完成时减少计数
      this.executeTaskWithConcurrencyControl(task).catch(error => {
        logger.error(`[${this.handlerName}] 任务执行异常: ${task.key}`, error);
      });
    }
  }

  /**
   * 执行任务并控制并发数
   * @param {Task} task - 任务对象
   */
  async executeTaskWithConcurrencyControl(task) {
    try {
      logger.log(`[${this.handlerName}] 开始执行任务: ${task.key}，当前并发数: ${this.processingCount}`);
      
      // 验证任务
      if (!this.validateTask(task)) {
        throw new Error(`Handler "${this.handlerName}" 任务验证失败`);
      }
      
      // 标记任务为执行中
      task.markAsExecuting();
      
      // 执行前的准备工作
      await this.beforeExecute(task);
      
      // 执行任务
      const result = await this.execute(task);
      
      // 执行后的清理工作
      await this.afterExecute(task, result);
      
      // 标记任务为完成
      task.markAsCompleted(result);
      
      logger.log(`[${this.handlerName}] 任务执行完成: ${task.key}`);
      
      // 任务成功完成，移动到完成队列
      this.moveTaskToQueue(task, task.status);
      
    } catch (error) {
      logger.error(`[${this.handlerName}] 任务执行失败: ${task.key}`, error);
      
      // 处理错误
      await this.handleSpecificError(error, task);
      
      // 标记任务为失败
      task.markAsFailed(error);
      
      // 从任务映射表中移除
      this.taskMap.delete(task.key);
      
    } finally {
      // 减少处理计数
      this.processingCount--;
      logger.log(`[${this.handlerName}] 任务处理完成，当前并发数: ${this.processingCount}`);
      
      // 任务完成后，触发下一次队列处理
      if (this.isRunning && !this.isPaused) {
        this.scheduleProcessing();
      }
    }
  }

  /**
   * 特定错误处理 - 默认实现
   * 子类可以重写此方法
   * @param {Error} error - 错误对象
   * @param {Task} task - 任务对象
   */
  async handleSpecificError(error, task) {
    // 默认实现，子类可以重写
    logger.error(`[${this.handlerName}] 处理器特定错误处理: ${task.key}`, error);
  }

  /**
   * 从等待队列移动任务到执行队列
   */
  async moveWaitingToExecution() {
    while (this.waitingQueue.length > 0 && 
           this.executionQueue.length < this.queueConfig.executionQueueSize) {
      
      const task = this.waitingQueue.shift();
      this.executionQueue.push(task);
      
      logger.log(`[${this.handlerName}] 任务从等待队列移动到执行队列: ${task.key}`);
    }
  }






  /**
   * 验证任务是否符合处理器要求
   * @param {Task} task - 任务对象
   * @returns {boolean} 是否有效
   */
  validateTask(task) {
    // 基础验证
    if (!task) {
      return false;
    }

    // 验证任务参数
    if (!task.validateParams()) {
      return false;
    }

    // 检查任务状态
    if (!task.isPending()) {
      return false;
    }

    // 子类可以重写此方法添加特定验证
    return this.validateSpecificTask(task);
  }

  /**
   * 特定任务验证
   * 子类可以重写此方法
   * @param {Task} task - 任务对象
   * @returns {boolean} 是否有效
   */
  validateSpecificTask(task) {
    return true;
  }

  /**
   * 执行前的准备工作
   * 子类可以重写此方法
   * @param {Task} task - 任务对象
   */
  async beforeExecute(task) {
    // 记录开始执行的日志
    logger.log(`[${this.handlerName}] 开始执行任务: ${task.key}`);
  }

  /**
   * 执行后的清理工作
   * 子类可以重写此方法
   * @param {Task} task - 任务对象
   * @param {*} result - 执行结果
   */
  async afterExecute(task, result) {
    // 记录完成执行的日志
    logger.log(`[${this.handlerName}] 完成执行任务: ${task.key}`);
  }



  /**
   * 检查是否可以处理指定类型的任务
   * @param {string} taskType - 任务类型
   * @returns {boolean} 是否可以处理
   */
  canHandle(taskType) {
    return this.getSupportedTaskTypes().includes(taskType);
  }

  /**
   * 获取支持的任务类型
   * 子类必须实现此方法
   * @returns {string[]} 支持的任务类型数组
   */
  getSupportedTaskTypes() {
    throw new Error(`Handler "${this.handlerName}" 必须实现 getSupportedTaskTypes 方法`);
  }

  /**
   * 获取任务
   * @param {string} taskKey - 任务键名
   * @returns {Task|null} 任务对象
   */
  getTask(taskKey) {
    return this.taskMap.get(taskKey) || null;
  }

  /**
   * 移动任务到对应队列
   * @param {Task} task - 任务对象
   * @param {string} status - 任务状态
   */
  moveTaskToQueue(task, status) {
    // 从所有队列中移除任务
    this.removeTaskFromAllQueues(task);

    // 添加到对应队列
    switch (status) {
      case TASK_STATUS.COMPLETED:
        this.completedQueue.push(task);
        break;
      // PENDING 和 EXECUTING 状态的任务保持在原队列
    }
  }

  /**
   * 从所有队列中移除任务
   * @param {Task} task - 任务对象
   */
  removeTaskFromAllQueues(task) {
    const queues = [this.executionQueue, this.waitingQueue, this.completedQueue];
    
    queues.forEach(queue => {
      const index = queue.findIndex(t => t.key === task.key);
      if (index !== -1) {
        queue.splice(index, 1);
      }
    });
  }

  /**
   * 移除任务
   * @param {string} taskKey - 任务键名
   * @returns {boolean} 是否成功移除
   */
  removeTask(taskKey) {
    const task = this.getTask(taskKey);
    if (!task) {
      return false;
    }

    //    
    this.taskMap.delete(taskKey);

    // 从所有队列中移除
    this.removeTaskFromAllQueues(task);

    logger.log(`[${this.handlerName}] 移除任务: ${taskKey}`);
    return true;
  }

  /**
   * 保存队列到存储
   */
  async saveQueues() {
    try {
      const handlerPrefix = this.handlerName;
      await Promise.all([
        runTimeDataService.saveTaskQueue(`${handlerPrefix}_${QUEUE_TYPE.EXECUTION}`, this.executionQueue),
        runTimeDataService.saveTaskQueue(`${handlerPrefix}_${QUEUE_TYPE.WAITING}`, this.waitingQueue)
      ]);
      
      logger.log(`[${this.handlerName}] 队列数据保存完成`);
    } catch (error) {
      logger.error(`[${this.handlerName}] 保存队列数据失败:`, error);
    }
  }

  /**
   * 从存储加载队列
   */
  async loadQueues() {
    try {
      const handlerPrefix = this.handlerName;
      const [executionData, waitingData] = await Promise.all([
        runTimeDataService.loadTaskQueue(`${handlerPrefix}_${QUEUE_TYPE.EXECUTION}`),
        runTimeDataService.loadTaskQueue(`${handlerPrefix}_${QUEUE_TYPE.WAITING}`)
      ]);

      // 恢复任务对象
      this.executionQueue = executionData.map(data => Task.fromJSON(data));
      this.waitingQueue = waitingData.map(data => Task.fromJSON(data));

      // 重建任务映射表
      this.taskMap.clear();
      const allTasks = [...this.executionQueue, ...this.waitingQueue];
      allTasks.forEach(task => {
        this.taskMap.set(task.key, task);
      });

      logger.log(`[${this.handlerName}] 队列数据加载完成`);
    } catch (error) {
      logger.error(`[${this.handlerName}] 加载队列数据失败:`, error);
    }
  }

  /**
   * 清理过期任务
   */
  async clearExpiredTasks() {
    try {
      const expiredTasks = [];
      
      // 检查各个队列中的过期任务
      [this.executionQueue, this.waitingQueue].forEach(queue => {
        for (let i = queue.length - 1; i >= 0; i--) {
          const task = queue[i];
          if (task.isExpired(this.persistenceConfig.fixedMinutes)) {
            expiredTasks.push(task);
            queue.splice(i, 1);
            this.taskMap.delete(task.key);
          }
        }
      });

      if (expiredTasks.length > 0) {
        logger.log(`[${this.handlerName}] 清理过期任务: ${expiredTasks.length} 个`);
      }
      
    } catch (error) {
      logger.error(`[${this.handlerName}] 清理过期任务失败:`, error);
    }
  }

  /**
   * 获取队列信息
   * @returns {Object} 队列信息
   */
  getQueueInfo() {
    return {
      execution: this.executionQueue.map(task => task.getSummary()),
      waiting: this.waitingQueue.map(task => task.getSummary()),
        completed: this.completedQueue.slice(-10).map(task => task.getSummary()) // 最近10个
    };
  }
}