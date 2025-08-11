/**
 * OrganizeTaskHandler
 * 负责整理论文相关的任务处理（占位版带通知）
 * - 只接受“单论文”的 ORGANIZE_PAPERS 任务（papers.length 必须为 1）
 * - 暂不实现具体业务，仅构造一个成功的占位结果
 * - 执行完成后通过 PaperOrganizationService 进行结果通知
 */

import { BaseHandler } from '../baseHandler.js';
import { PERSISTENCE_STRATEGY, ORGANIZE_SUPPORTED_TASK_TYPES } from '../../../constants.js';
import { logger } from '../../../util/logger.js';
import { paperOrganizationService } from '../../feature/paperOrganizationService.js';

export class OrganizeTaskHandler extends BaseHandler {
  constructor() {
    const config = {
      maxConcurrency: 1,
      queueConfig: {
        executionQueueSize: 3,
        waitingQueueSize: 10
      },
      persistenceConfig: {
        strategy: PERSISTENCE_STRATEGY.NONE
      }
    };
    super('OrganizeTaskHandler', config);
  }

  /**
   * 返回支持的任务类型
   */
  getSupportedTaskTypes() {
    return Object.values(ORGANIZE_SUPPORTED_TASK_TYPES);
  }

  /**
   * 执行任务入口
   */
  async execute(task) {
    logger.log(`[${this.handlerName}] 收到整理任务: ${task.key}`);
    switch (task.type) {
      case ORGANIZE_SUPPORTED_TASK_TYPES.ORGANIZE_PAPER:
        return await this.executeOrganizePaper(task);
      default:
        return { success: false, error: `不支持的任务类型: ${task.type}` };
    }
  }

  /**
   * 占位的整理论文执行逻辑
   * 当前不做具体业务，只做参数校验并返回占位结果
   */
  async executeOrganizePaper(task) {
    logger.log("执行整理论文任务", task);
    const papers = task?.params?.papers || [];

    // 简单占位处理：逐个返回成功
    const details = papers.map(p => ({ id: p?.id, success: true }));
    return {
      success: true,
      data: {
        processed: papers.length,
        failed: 0,
        details
      }
    };
  }

  /**
   * 可选校验钩子（占位）
   */
  validateSpecificTask(task) {
    return true;
  }

  async beforeExecute(task) {
    await super.beforeExecute(task);
  }

  /**
   * 执行完成后通知 PaperOrganizationService（若其维护了该 taskKey 的索引则会更新）
   */
  async afterExecute(task, result) {
    try {
      await super.afterExecute(task, result);
    } finally {
      // 将占位结果回传给组织服务，用于更新对应批次/论文的状态
      try {
        const notifyOk = paperOrganizationService.notifyOrganizeTaskCompleted(task.key, {
          success: !!result?.success,
          error: result?.error
        });
        if (!notifyOk) {
          logger.debug(`[${this.handlerName}] 未找到对应批次映射（可能来自旧入口或多论文任务）: ${task.key}`);
        }
      } catch (e) {
        logger.warn(`[${this.handlerName}] 通知组织服务失败: ${e?.message}`);
      }
    }
  }
}

export default OrganizeTaskHandler;
