/**
 * 基础任务处理器类 - 事件驱动版本
 * 使用事件驱动架构 + Chrome Alarms API 替代定时任务
 * 可以用于快速创建一个任务的处理器，独享队列。
 */

import { TASK_STATUS, QUEUE_CONFIG, QUEUE_TYPE, PERSISTENCE_STRATEGY } from '../../constants.js';
import { runTimeDataService } from '../../service/runTimeDataService.js';
import { Task } from '../../model/task.js';
import { logger } from '../../util/logger.js';

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
      strategy: config.persistenceConfig?.strategy || PERSISTENCE_STRATEGY.FIXED_DURATION,
      fixedDuration: config.persistenceConfig?.fixedDuration || 100
    };

    // 任务队列
    this.executionQueue = [];
    this.waitingQueue = [];

    // 任务映射表
    this.taskMap = new Map();

    // 事件驱动标识
    this.isProcessing = false;

    // 事件监听器引用，用于清理
    this.messageListener = null;

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
  }

  /**
   * 清理事件监听器
   */
  cleanupEventListeners() {
    // 清理 Chrome 消息监听器
    if (this.messageListener) {
      chrome.runtime.onMessage.removeListener(this.messageListener);
      this.messageListener = null;
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

    return task;
  }

  /**
   * 启动处理器 - 启动持续处理循环
   */
  async start() {
    // 确保处理器已初始化
    await this.initialize();

    // 启动持续处理循环
    this.startProcessingLoop();
    
    logger.log(`[${this.handlerName}] 处理器已启动`);
  }

  /**
   * 启动持续处理循环 - 替代递归式调用
   */
  startProcessingLoop() {
    const processLoop = async () => {
      while (true) {
        try {
          // 如果没有任务，等待一段时间后再检查
          if (!this.hasQueuedTasks()) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            continue;
          }

          // 处理队列
          await this.processQueue();
          
          // 处理完成后短暂休息，避免CPU占用过高
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error) {
          logger.error(`[${this.handlerName}] 处理循环异常:`, error);
          // 发生错误时等待更长时间再重试
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    };

    // 启动异步处理循环
    processLoop().catch(error => {
      logger.error(`[${this.handlerName}] 处理循环启动失败:`, error);
    });
  }

  /**
   * 处理队列 - 纯粹的队列处理逻辑，不包含循环调用
   */
  async processQueue() {
    // 防止并发处理
    if (this.isProcessing) {
      return;
    }
    
    this.isProcessing = true;
    
    try {
      // 处理执行队列
      await this.processExecutionQueue();
      // 从等待队列移动任务到执行队列
      await this.moveWaitingToExecution();
      // 定期保存队列状态
      await this.saveQueues();
      
    } catch (error) {
      logger.error(`[${this.handlerName}] 队列处理失败:`, error);
      throw error;
    } finally {
      this.isProcessing = false;
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
    
      
      // 标记任务为失败
      task.markAsFailed(error);
      
      // 从任务映射表中移除
      this.taskMap.delete(task.key);
      
    } finally {
      // 减少处理计数
      this.processingCount--;
      logger.log(`[${this.handlerName}] 任务处理完成，当前并发数: ${this.processingCount}`);
      
      // 任务完成后，不再需要手动触发下一次处理，由主循环负责
    }
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
          if (task.isExpired(this.persistenceConfig.fixedDuration)) {
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
}