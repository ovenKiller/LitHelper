/**
 * 示例：如何配置队列的持久化策略
 */

import { BaseHandler } from './src/background/service/baseHandler.js';
import { PERSISTENCE_STRATEGY, TASK_TYPE } from './src/constants.js';

// 示例 1: 不持久化的处理器（适用于临时任务，避免内存超出限额）
class NonPersistentHandler extends BaseHandler {
  constructor() {
    const config = {
      // 队列配置
      queueConfig: {
        executionQueueSize: 5,
        waitingQueueSize: 10
      },
      
      // 持久化配置 - 不持久化
      persistenceConfig: {
        strategy: PERSISTENCE_STRATEGY.NONE
      }
    };

    super('NonPersistentHandler', config);
  }

  getSupportedTaskTypes() {
    return [TASK_TYPE.SUMMARIZATION];
  }

  async execute(task) {
    // 实现具体的任务执行逻辑
    console.log(`执行临时任务: ${task.key}`);
    return { result: 'success' };
  }
}

// 示例 2: 持久化的处理器（适用于重要任务，需要在重启后恢复）
class PersistentHandler extends BaseHandler {
  constructor() {
    const config = {
      // 队列配置
      queueConfig: {
        executionQueueSize: 3,
        waitingQueueSize: 20
      },
      
      // 持久化配置 - 保存固定时长
      persistenceConfig: {
        strategy: PERSISTENCE_STRATEGY.FIXED_DURATION,
        fixedDuration: 1440 // 保存 24 小时（1440 分钟）
      }
    };

    super('PersistentHandler', config);
  }

  getSupportedTaskTypes() {
    return [TASK_TYPE.DOWNLOAD, TASK_TYPE.METADATA_EXTRACTION];
  }

  async execute(task) {
    // 实现具体的任务执行逻辑
    console.log(`执行重要任务: ${task.key}`);
    return { result: 'success' };
  }
}

// 示例 3: 使用默认配置的处理器（默认会持久化）
class DefaultHandler extends BaseHandler {
  constructor() {
    // 不传入 persistenceConfig，使用默认配置
    super('DefaultHandler');
  }

  getSupportedTaskTypes() {
    return Object.values(TASK_TYPE);
  }

  async execute(task) {
    console.log(`执行默认任务: ${task.key}`);
    return { result: 'success' };
  }
}

console.log('📝 持久化配置示例:');
console.log('');
console.log('1. 不持久化处理器 - 适用于临时任务，避免内存超出限额');
console.log('   persistenceConfig: { strategy: PERSISTENCE_STRATEGY.NONE }');
console.log('');
console.log('2. 持久化处理器 - 适用于重要任务，需要在重启后恢复');
console.log('   persistenceConfig: { strategy: PERSISTENCE_STRATEGY.FIXED_DURATION, fixedDuration: 1440 }');
console.log('');
console.log('3. 默认配置处理器 - 默认使用 FIXED_DURATION 策略');
console.log('   不传入 persistenceConfig 参数');

export { NonPersistentHandler, PersistentHandler, DefaultHandler };
