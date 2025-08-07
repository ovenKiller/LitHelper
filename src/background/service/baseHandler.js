/**
 * 基础任务处理器类 - 事件驱动版本
 * 可以用于快速创建一个任务的处理器，独享队列。
 * 
 * 
 * TODO： 这个版本功能上来说是没问题的，但是等间隔的定时任务无法消除延时问题。日后再修改。
 */

import { QUEUE_CONFIG, QUEUE_TYPE, PERSISTENCE_STRATEGY } from '../../constants.js';
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

    // 队列变更跟踪
    this.queueChanged = false;

    // 使用Promise链确保串行执行，避免竞态条件
    this.processingChain = Promise.resolve();

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

      logger.log(`[${this.handlerName}] 处理器初始化完成`);
    } catch (error) {
      logger.error(`[${this.handlerName}] 初始化处理器失败:`, error);
      throw error;
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

    // 添加到执行队列或等待队列
    if (this.executionQueue.length < this.queueConfig.executionQueueSize) {
      this.executionQueue.push(task);
      this.markQueueChanged();
      logger.log(`[${this.handlerName}] 任务添加到执行队列: ${task.key}`);
    } else if (this.waitingQueue.length < this.queueConfig.waitingQueueSize) {
      this.waitingQueue.push(task);
      this.markQueueChanged();
      logger.log(`[${this.handlerName}] 任务添加到等待队列: ${task.key}`);
    } else {
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
   * 使用Promise链确保串行执行，避免竞态条件
   */
  async processQueue() {
    // 将新的处理任务添加到Promise链的末尾
    this.processingChain = this.processingChain
      .then(() => this._doProcessQueue())
      .catch(error => {
        logger.error(`[${this.handlerName}] 队列处理失败:`, error);
        // 即使出错也要继续处理后续任务，不要中断整个链
      });

    // 返回当前的处理Promise，调用者可以选择等待或不等待
    return this.processingChain;
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
      // 只有在队列发生变更时才保存
      await this.saveQueuesIfChanged();

    } catch (error) {
      logger.error(`[${this.handlerName}] 队列处理失败:`, error);
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
   * 标记队列已变更
   */
  markQueueChanged() {
    this.queueChanged = true;
  }

  /**
   * 重置队列变更标记
   */
  resetQueueChanged() {
    this.queueChanged = false;
  }
  /**
   * 处理执行队列
   */
  async processExecutionQueue() {
    // 首先清理已完成或失败的任务
    const originalLength = this.executionQueue.length;
    this.executionQueue = this.executionQueue.filter(task => task.isPending());

    // 如果清理了任务，标记队列已变更
    if (this.executionQueue.length !== originalLength) {
      this.markQueueChanged();
    }

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
      
    } catch (error) {
      logger.error(`[${this.handlerName}] 任务执行失败: ${task.key}`, error);
    
      
      // 标记任务为失败
      task.markAsFailed(error);
      
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
    let moved = false;

    while (this.waitingQueue.length > 0 &&
           this.executionQueue.length < this.queueConfig.executionQueueSize) {

      const task = this.waitingQueue.shift();
      this.executionQueue.push(task);
      moved = true;

      logger.log(`[${this.handlerName}] 任务从等待队列移动到执行队列: ${task.key}`);
    }

    // 如果移动了任务，标记队列已变更
    if (moved) {
      this.markQueueChanged();
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
    // 子类可以重写此方法添加特定的准备工作
  }

  /**
   * 执行后的清理工作
   * 子类可以重写此方法
   * @param {Task} task - 任务对象
   * @param {*} result - 执行结果
   */
  async afterExecute(task, result) {
    // 子类可以重写此方法添加特定的清理工作
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
   * 只有在队列发生变更时才保存队列到存储
   */
  async saveQueuesIfChanged() {
    if (!this.queueChanged) {
      return;
    }

    try {
      await this.saveQueues();
      this.resetQueueChanged();
      logger.log(`[${this.handlerName}] 队列变更已保存`);
    } catch (error) {
      logger.error(`[${this.handlerName}] 保存队列变更失败:`, error);
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

      // 加载完成后重置变更标记
      this.resetQueueChanged();

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
          }
        }
      });

      if (expiredTasks.length > 0) {
        this.markQueueChanged();
        logger.log(`[${this.handlerName}] 清理过期任务: ${expiredTasks.length} 个`);
      }

    } catch (error) {
      logger.error(`[${this.handlerName}] 清理过期任务失败:`, error);
    }
  }
}