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
import aiServiceInstance from '../../../service/aiService.js';

export class OrganizeTaskHandler extends BaseHandler {
  constructor() {
    const config = {
      maxConcurrency: 10,
      queueConfig: {
        executionQueueSize: 20,
        waitingQueueSize: 50
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

    // 1. 设置存储路径
    await this._handleStorage(paper, options, result);

    // 2. 执行翻译
    const translationResult = await this._handleTranslation(paper, options, result);
    logger.log(`[${paper.id}] 翻译处理完成，结果:`, translationResult);

    // 3. 执行分类（如果启用）
    const classificationResult = await this._handleClassification(paper, options, result);
    logger.log(`[${paper.id}] 分类处理完成，结果:`, classificationResult);

    // 4. 保存处理结果供批次CSV生成使用
    result.processedData = {
      originalAbstract: translationResult.originalText || paper.abstract,
      translatedAbstract: translationResult.translatedText,
      targetLanguage: options.translation?.targetLanguage,
      classification: classificationResult,
      classificationStandard: options.classification?.selectedStandard
    };

    logger.log(`[${paper.id}] processedData 已保存:`, result.processedData);

    // 调试：打印处理结果
    logger.log(`[${paper.id}] 处理完成，数据:`, {
      title: paper.title,
      allVersionsUrl: paper.allVersionsUrl,
      pdfUrl: paper.pdfUrl,
      translatedAbstract: result.processedData.translatedAbstract,
      classification: result.processedData.classification
    });

    return result;
  }

  /**
   * 处理存储路径设置
   * @param {Object} paper - 论文对象
   * @param {Object} options - 选项
   * @param {Object} result - 结果对象
   * @private
   */
  async _handleStorage(paper, options, result) {
    if (!options.storage?.taskDirectory) return;

    await this._executeAction('storage', paper.id, async () => {
      logger.log(`[${paper.id}] 设置存储路径: ${options.storage.taskDirectory}`);

      const dirResult = await fileManagementService.createSubDirectory(options.storage.taskDirectory);

      if (!dirResult.success) {
        throw new Error(dirResult.error || '目录创建失败');
      }

      // 更新result中的存储信息
      result.storage = {
        workingDirectory: fileManagementService.getWorkingDirectoryName(),
        taskDirectory: dirResult.taskDirectory,
        fullPath: dirResult.fullPath
      };

      return {
        workingDirectory: fileManagementService.getWorkingDirectoryName(),
        taskDirectory: dirResult.taskDirectory,
        fullPath: dirResult.fullPath,
        message: dirResult.message
      };
    }, result);
  }

  /**
   * 处理翻译功能
   * @param {Object} paper - 论文对象
   * @param {Object} options - 选项
   * @param {Object} result - 结果对象
   * @returns {Promise<Object>} 翻译结果对象
   * @private
   */
  async _handleTranslation(paper, options, result) {
    if (!options.translation?.enabled) {
      return { translatedText: null, originalText: paper.abstract };
    }

    const translationResult = await this._executeAction('translation', paper.id, async () => {
      logger.log(`[${paper.id}] 执行翻译到 ${options.translation.targetLanguage}`);

      const translatedText = await aiServiceInstance.translateAbstract(
        paper.abstract,
        options.translation.targetLanguage
      );

      logger.log(`[${paper.id}] AI翻译服务返回:`, {
        type: typeof translatedText,
        content: translatedText,
        length: translatedText ? translatedText.length : 0
      });

      if (!translatedText) {
        throw new Error('翻译失败，返回空结果');
      }

      return {
        originalText: paper.abstract,
        translatedText: translatedText,
        targetLanguage: options.translation.targetLanguage,
        message: `翻译到${options.translation.targetLanguage}已完成`
      };
    }, result, { translatedText: null, originalText: paper.abstract }); // 失败时返回原文

    // 调试：打印翻译结果
    logger.log(`[${paper.id}] 翻译结果类型:`, typeof translationResult);
    logger.log(`[${paper.id}] 翻译结果内容:`, translationResult);

    // 确保返回正确的格式
    if (typeof translationResult === 'string') {
      const result = { translatedText: translationResult, originalText: paper.abstract };
      logger.log(`[${paper.id}] 返回字符串格式翻译结果:`, result);
      return result;
    }

    const finalResult = translationResult || { translatedText: null, originalText: paper.abstract };
    logger.log(`[${paper.id}] 返回最终翻译结果:`, finalResult);
    return finalResult;
  }

  /**
   * 处理分类功能
   * @param {Object} paper - 论文对象
   * @param {Object} options - 选项
   * @param {Object} result - 结果对象
   * @returns {Promise<string|null>} 分类结果
   * @private
   */
  async _handleClassification(paper, options, result) {
    if (!options.classification?.enabled) return null;

    // 目前是占位实现
    return await this._executeAction('classification', paper.id, async () => {
      logger.log(`[${paper.id}] 执行分类，标准: ${options.classification.selectedStandard}`);

      // TODO: 实际的分类逻辑，这里返回一个示例分类
      const mockCategory = this._getMockCategory(paper.title, options.classification.selectedStandard);

      return {
        category: mockCategory,
        standard: options.classification.selectedStandard,
        message: '论文分类已完成'
      };
    }, result, null);
  }

  /**
   * 获取模拟分类结果（临时实现）
   * @param {string} title - 论文标题
   * @param {string} standard - 分类标准
   * @returns {string} 分类结果
   * @private
   */
  _getMockCategory(title, standard) {
    // 简单的关键词匹配分类逻辑
    const titleLower = (title || '').toLowerCase();

    if (standard === 'ACM') {
      if (titleLower.includes('machine learning') || titleLower.includes('ai')) return 'Computing methodologies → Machine learning';
      if (titleLower.includes('network') || titleLower.includes('internet')) return 'Networks → Network protocols';
      if (titleLower.includes('database') || titleLower.includes('data')) return 'Information systems → Database management';
      if (titleLower.includes('security') || titleLower.includes('crypto')) return 'Security and privacy → Cryptography';
      return 'General and reference → General literature';
    } else if (standard === 'IEEE') {
      if (titleLower.includes('machine learning') || titleLower.includes('ai')) return 'Artificial Intelligence';
      if (titleLower.includes('network') || titleLower.includes('internet')) return 'Computer Networks';
      if (titleLower.includes('database') || titleLower.includes('data')) return 'Database Systems';
      if (titleLower.includes('security') || titleLower.includes('crypto')) return 'Computer Security';
      return 'Computer Science';
    }

    return 'Uncategorized';
  }



  /**
   * 通用的动作执行器，统一处理错误和结果记录
   * @param {string} actionType - 动作类型
   * @param {string} paperId - 论文ID
   * @param {Function} actionFn - 执行的异步函数
   * @param {Object} result - 结果对象
   * @param {any} fallbackValue - 失败时的回退值
   * @returns {Promise<any>} 执行结果或回退值
   * @private
   */
  async _executeAction(actionType, paperId, actionFn, result, fallbackValue = null) {
    try {
      const actionResult = await actionFn();
      logger.log(`[${paperId}] _executeAction ${actionType} 成功，结果:`, actionResult);

      result.actions.push({
        type: actionType,
        status: 'completed',
        ...actionResult
      });

      // 根据动作类型返回相应的结果
      if (actionType === 'translation') {
        // 对于翻译，返回完整的结果对象
        logger.log(`[${paperId}] _executeAction 返回翻译结果:`, actionResult);
        return actionResult;
      } else if (actionType === 'classification') {
        return actionResult.category || actionResult;
      }
      return actionResult;
    } catch (error) {
      logger.error(`[${paperId}] ${actionType}失败:`, error);

      result.actions.push({
        type: actionType,
        status: 'failed',
        error: error.message,
        message: `${actionType}失败: ${error.message}`
      });

      return fallbackValue;
    }
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
      // 将详细结果回传给组织服务，用于更新对应批次/论文的状态和CSV生成
      try {
        // 调试：打印完整的result结构
        logger.log(`[${this.handlerName}] afterExecute 收到的result:`, result);

        // 从result中提取单篇论文的处理结果
        // result.data.details 是一个数组，包含每篇论文的处理结果
        const paperResult = result?.data?.details?.[0];
        logger.log(`[${this.handlerName}] 提取的论文结果:`, paperResult);

        if (paperResult) {
          const notifyOk = paperOrganizationService.notifyOrganizeTaskCompleted(task.key, {
            success: !!paperResult.success,
            error: paperResult.error,
            // 传递处理后的数据供CSV生成使用
            processedData: paperResult.result?.processedData,
            actions: paperResult.result?.actions,
            storage: paperResult.result?.storage
          });

          if (!notifyOk) {
            logger.debug(`[${this.handlerName}] 未找到对应批次映射（可能来自旧入口或多论文任务）: ${task.key}`);
          }
        } else {
          logger.warn(`[${this.handlerName}] 无法从result中提取论文处理结果`);
        }
      } catch (e) {
        logger.warn(`[${this.handlerName}] 通知组织服务失败: ${e?.message}`);
      }
    }
  }
}

export default OrganizeTaskHandler;
