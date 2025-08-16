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
import { fileManagementService } from '../../../service/fileManagementService.js';

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
   * 整理论文执行逻辑
   * 处理PDF下载、翻译和分类功能
   */
  async executeOrganizePaper(task) {
    logger.log("执行整理论文任务", task);
    const papers = task?.params?.papers || [];
    const options = task?.params?.options || {};

    logger.log("整理选项详情:", {
      downloadPdf: options.downloadPdf,
      translation: options.translation,
      classification: options.classification,
      storage: options.storage,
      selectedPapers: options.selectedPapers,
      totalPapers: options.totalPapers,
      timestamp: options.timestamp
    });

    const results = [];

    for (const paper of papers) {
      try {
        const result = await this._processSinglePaper(paper, options);
        results.push({ id: paper.id, success: true, result });
      } catch (error) {
        logger.error(`处理论文 ${paper.id} 失败:`, error);
        results.push({ id: paper.id, success: false, error: error.message });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failedCount = results.length - successCount;

    return {
      success: true,
      data: {
        processed: results.length,
        success: successCount,
        failed: failedCount,
        details: results
      }
    };
  }

  /**
   * 处理单篇论文
   * @param {Object} paper 论文对象
   * @param {Object} options 处理选项
   * @returns {Promise<Object>} 处理结果
   */
  async _processSinglePaper(paper, options) {
    const result = {
      paperId: paper.id,
      title: paper.title,
      actions: [],
      storage: options.storage || {}
    };

    // 0. 存储路径设置和目录创建
    if (options.storage?.taskDirectory) {
      try {
        logger.log(`[${paper.id}] 设置存储路径: ${options.storage.taskDirectory}`);

        // 使用文件管理服务创建子目录
        const dirResult = await fileManagementService.createSubDirectory(options.storage.taskDirectory);

        if (dirResult.success) {
          result.actions.push({
            type: 'storage',
            status: 'completed',
            workingDirectory: fileManagementService.getWorkingDirectoryName(),
            taskDirectory: dirResult.taskDirectory,
            fullPath: dirResult.fullPath,
            message: dirResult.message
          });

          // 更新result中的存储信息
          result.storage = {
            workingDirectory: fileManagementService.getWorkingDirectoryName(),
            taskDirectory: dirResult.taskDirectory,
            fullPath: dirResult.fullPath
          };
        } else {
          throw new Error(dirResult.error || '目录创建失败');
        }
      } catch (error) {
        logger.error(`[${paper.id}] 存储路径设置失败:`, error);
        result.actions.push({
          type: 'storage',
          status: 'failed',
          error: error.message,
          message: `存储路径设置失败: ${error.message}`
        });
      }
    }

    // 1. PDF下载
    if (options.downloadPdf && paper.pdfUrl && options.storage?.taskDirectory) {
      try {
        logger.log(`[${paper.id}] 执行PDF下载: ${paper.pdfUrl}`);

        // 使用文件管理服务下载PDF
        const downloadResult = await fileManagementService.downloadPdf(
          paper.pdfUrl,
          paper.title,
          options.storage.taskDirectory
        );

        if (downloadResult.success) {
          result.actions.push({
            type: 'download',
            status: 'completed',
            downloadId: downloadResult.downloadId,
            filename: downloadResult.filename,
            fullPath: downloadResult.fullPath,
            message: `PDF下载成功: ${downloadResult.filename}`,
            // 添加显示文件的功能
            showInFolder: {
              available: true,
              downloadId: downloadResult.downloadId
            }
          });
        } else {
          throw new Error(downloadResult.error || 'PDF下载失败');
        }
      } catch (error) {
        logger.error(`[${paper.id}] PDF下载失败:`, error);
        result.actions.push({
          type: 'download',
          status: 'failed',
          error: error.message,
          message: `PDF下载失败: ${error.message}`
        });
      }
    } else if (options.downloadPdf && !paper.pdfUrl) {
      logger.warn(`[${paper.id}] 无法下载PDF: 缺少PDF链接`);
      result.actions.push({
        type: 'download',
        status: 'failed',
        error: '缺少PDF链接',
        message: 'PDF下载失败: 论文没有可用的PDF链接'
      });
    } else if (options.downloadPdf && !options.storage?.taskDirectory) {
      logger.warn(`[${paper.id}] 无法下载PDF: 缺少任务目录`);
      result.actions.push({
        type: 'download',
        status: 'failed',
        error: '缺少任务目录',
        message: 'PDF下载失败: 未指定任务目录'
      });
    }

    // 2. 翻译功能
    if (options.translation?.enabled) {
      logger.log(`[${paper.id}] 执行翻译到 ${options.translation.targetLanguage}`);
      result.actions.push({
        type: 'translation',
        status: 'completed',
        targetLanguage: options.translation.targetLanguage,
        message: `翻译到${options.translation.targetLanguage}已完成`
      });
    }

    // 3. 分类功能
    if (options.classification?.enabled) {
      logger.log(`[${paper.id}] 执行分类，标准: ${options.classification.selectedStandard}`);
      result.actions.push({
        type: 'classification',
        status: 'completed',
        standard: options.classification.selectedStandard,
        message: '论文分类已完成'
      });
    }

    return result;
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
