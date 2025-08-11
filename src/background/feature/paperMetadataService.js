/**
 * paperMetadataService.js
 * 
 * 论文元数据服务
 * 负责处理和保存论文元数据信息
 */

import { logger } from '../../util/logger.js';
import { PLATFORM_KEYS, PAGE_TYPE, AI_EXTRACTOR_SUPPORTED_TASK_TYPES } from '../../constants.js';
import { Task } from '../../model/task.js';

class PaperMetadataService {
  constructor() {
    this.paperCache = new Map(); // 以论文ID为key保存论文数据
    this.taskService = null; // 将通过依赖注入的方式设置
  }

  /**
   * 设置任务服务（依赖注入）
   * @param {TaskService} taskService - 任务服务实例
   */
  setTaskService(taskService) {
    this.taskService = taskService;
  }

  /**
   * 处理论文对象列表，并完善论文信息
   * @param {string} sourceDomain - 来源域名(PLATFORM_KEYS中的值)
   * @param {string} pageType - 页面类型(PAGE_TYPE中的值) 
   * @param {Array<Object>} papers - 论文对象数组
   * @returns {Promise<boolean>} 处理是否成功
   */
  async processPapers(sourceDomain, pageType, papers) {
    try {
      logger.log(`[PaperMetadataService] 开始处理论文对象列表`);
      logger.log(`[PaperMetadataService] 来源域名: ${sourceDomain}`);
      logger.log(`[PaperMetadataService] 页面类型: ${pageType}`);
      logger.log(`[PaperMetadataService] 论文数量: ${papers.length}`);
      
      // 验证输入参数
      if (!this.validateInputParams(sourceDomain, pageType, papers)) {
        return false;
      }

      let successCount = 0;
      let failureCount = 0;

      // 遍历处理每个paper对象
      for (let i = 0; i < papers.length; i++) {
        const paper = papers[i];
        logger.log(`[PaperMetadataService] 处理第 ${i + 1} 个论文: ${paper.title}`);
        
        try {
          const success = await this.processPaper(paper);
          if (success) {
            successCount++;
            logger.log(`[PaperMetadataService] 第 ${i + 1} 个论文处理成功`);
          } else {
            failureCount++;
            logger.warn(`[PaperMetadataService] 第 ${i + 1} 个论文处理失败`);
          }
        } catch (error) {
          failureCount++;
          logger.error(`[PaperMetadataService] 第 ${i + 1} 个论文处理时发生异常:`, error);
        }
      }

      logger.log(`[PaperMetadataService] 论文对象列表处理完成`, {
        总数: papers.length,
        成功: successCount,
        失败: failureCount
      });
      
      return successCount > 0; // 只要有一个成功就返回true
      
    } catch (error) {
      logger.error('[PaperMetadataService] 处理论文对象列表时发生错误:', error);
      return false;
    }
  }

  /**
   * 处理单个论文，创建AI提取任务
   * @param {Object} paper - 论文对象
   * @returns {Promise<boolean>} 处理是否成功
   */
  async processPaper(paper) {
    try {
      
      // 验证论文对象
      if (!this.validatePaper(paper)) {
        return false;
      }

      // 为论文创建AI元数据提取任务
      const success = await this.createPaperMetadataExtractionTask(paper);
      
      if (success) {
        // 缓存论文信息（只缓存必要字段）
        const paperCacheData = {
          id: paper.id,
          title: paper.title,
          pdfUrl: paper.pdfUrl || '',
          abstract: paper.abstract || '',
          updateTime: paper.updateTime || new Date().toISOString(),
          processing: true
        };
        logger.log('[PaperMetadataService] 论文缓存数据:', paperCacheData);
        this.paperCache.set(paper.id, paperCacheData);
        logger.log(`[PaperMetadataService] 论文 ${paper.title} 处理成功并已缓存`);
      }
      
      return success;
      
    } catch (error) {
      logger.error(`[PaperMetadataService] 处理论文 ${paper.title} 时发生错误:`, error);
      return false;
    }
  }

  /**
   * 为单个论文创建AI元数据提取任务
   * @param {Object} paper - 论文对象
   * @returns {Promise<boolean>} 创建是否成功
   */
  async createPaperMetadataExtractionTask(paper) {
    try {
      // 构建任务参数
      const taskParams = {
        paper: {
          ...paper,
          // 如果paper.html存在，使用它；否则尝试从element获取
          html: paper.html || (paper.element?.outerHTML) || ''
        },
        platform: paper.platform || 'unknown',
        timestamp: Date.now()
      };

      // 移除element引用以避免序列化问题
      delete taskParams.paper.element;

      // 生成任务键名
      const taskKey = `${AI_EXTRACTOR_SUPPORTED_TASK_TYPES.PAPER_METADATA_EXTRACTION}_${paper.platform || 'unknown'}_${paper.id}_${Date.now()}`;

      logger.log(`[PaperMetadataService] 准备创建AI提取任务`, {
        taskKey,
        paperTitle: paper.title,
        htmlLength: taskParams.paper.html?.length || 0
      });
      // 通过消息系统将任务添加到队列
      // 注意：这里我们无法直接访问messageService，需要通过Chrome运行时API
      const result = await this.sendTaskToQueue(taskKey, AI_EXTRACTOR_SUPPORTED_TASK_TYPES.PAPER_METADATA_EXTRACTION, taskParams);

      if (result?.success) {
        logger.log(`[PaperMetadataService] 成功为论文 ${paper.title} 创建AI提取任务: ${taskKey}`);
        return true;
      } else {
        logger.error(`[PaperMetadataService] 为论文 ${paper.title} 创建AI提取任务失败:`, result?.error);
        return false;
      }

    } catch (error) {
      logger.error(`[PaperMetadataService] 为论文 ${paper.title} 创建AI提取任务时发生异常:`, error);
      return false;
    }
  }

  /**
   * 发送任务到队列
   * @param {string} taskKey - 任务键名
   * @param {string} taskType - 任务类型
   * @param {Object} taskParams - 任务参数
   * @returns {Promise<Object>} 操作结果
   */
  async sendTaskToQueue(taskKey, taskType, taskParams) {
    try {
      if (!this.taskService) {
        throw new Error('TaskService not initialized. Please call setTaskService() first.');
      }

      // 创建任务对象
      const task = new Task(taskKey, taskType, taskParams);
      
      // 直接添加到任务队列
      await this.taskService.addTask(task);
      
      logger.log(`[PaperMetadataService] 任务已添加到队列: ${taskKey}`);
      
      return {
        success: true,
        taskKey: taskKey
      };
      
    } catch (error) {
      logger.error('[PaperMetadataService] 发送任务到队列失败:', error);
      return {
        success: false,
        error: error.message || '发送任务失败'
      };
    }
  }

  /**
   * 验证论文对象
   * @param {Object} paper - 论文对象
   * @returns {boolean} 是否有效
   */
  validatePaper(paper) {
    if (!paper) {
      logger.error('[PaperMetadataService] 论文对象为null/undefined');
      return false;
    }

    if (!paper.id) {
      logger.error('[PaperMetadataService] 论文对象缺少id字段');
      return false;
    }

    if (!paper.title) {
      logger.error('[PaperMetadataService] 论文对象缺少title字段');
      return false;
    }

    // 检查HTML内容
    const hasHtml = paper.html || (paper.element?.outerHTML);
    if (!hasHtml) {
      logger.warn(`[PaperMetadataService] 论文 ${paper.title} 缺少HTML内容，可能影响提取效果`);
    }

    return true;
  }

  /**
   * 验证输入参数
   * @param {string} sourceDomain - 来源域名
   * @param {string} pageType - 页面类型
   * @param {Array<Object>} papers - 论文对象数组
   * @returns {boolean} 参数是否有效
   */
  validateInputParams(sourceDomain, pageType, papers) {
    // 验证来源域名
    const validPlatforms = Object.values(PLATFORM_KEYS);
    if (!validPlatforms.includes(sourceDomain)) {
      logger.error(`[PaperMetadataService] 无效的来源域名: ${sourceDomain}`);
      logger.log(`[PaperMetadataService] 支持的域名: ${validPlatforms.join(', ')}`);
      return false;
    }

    // 验证页面类型
    const validPageTypes = Object.values(PAGE_TYPE);
    if (!validPageTypes.includes(pageType)) {
      logger.error(`[PaperMetadataService] 无效的页面类型: ${pageType}`);
      logger.log(`[PaperMetadataService] 支持的页面类型: ${validPageTypes.join(', ')}`);
      return false;
    }

    // 验证论文对象列表
    if (!Array.isArray(papers)) {
      logger.error('[PaperMetadataService] 论文对象列表必须是数组');
      return false;
    }

    if (papers.length === 0) {
      logger.warn('[PaperMetadataService] 论文对象列表为空');
      return false;
    }

    // 验证数组中的每个元素都是对象
    for (let i = 0; i < papers.length; i++) {
      if (typeof papers[i] !== 'object' || papers[i] === null) {
        logger.error(`[PaperMetadataService] 论文对象列表第 ${i} 项不是有效对象`);
        return false;
      }
    }

    return true;
  }

  /**
   * 获取缓存的论文数据
   * @param {string} paperId - 论文ID
   * @returns {Object|null} 论文数据
   */
  getCachedPaper(paperId) {
    return this.paperCache.get(paperId) || null;
  }

  /**
   * 缓存单个论文数据
   * @param {Object} paper - 论文对象
   * @returns {boolean} 缓存是否成功
   */
  cachePaper(paper) {
    try {
      if (!paper || !paper.id) {
        logger.error('[PaperMetadataService] 无法缓存论文：论文对象为空或缺少ID');
        return false;
      }

      // 只缓存必要字段
      const paperCacheData = {
        id: paper.id,
        title: paper.title,
        pdfUrl: paper.pdfUrl || '',
        abstract: paper.abstract || '',
        updateTime: paper.updateTime || new Date().toISOString()
      };
      this.paperCache.set(paper.id, paperCacheData);
      logger.log(`[PaperMetadataService] 成功缓存论文: ${paper.title}`);
      return true;
    } catch (error) {
      logger.error(`[PaperMetadataService] 缓存论文失败: ${paper?.title || 'unknown'}`, error);
      return false;
    }
  }

  /**
   * 处理论文预处理完成事件
   * @param {Object} eventData - 事件数据
   * @returns {boolean} 处理是否成功
   */
  handlePaperPreprocessingCompleted(eventData) {
    try {
      logger.log('[PaperMetadataService] 收到论文预处理完成事件:', eventData);
      
      if (!eventData || !eventData.paper) {
        logger.error('[PaperMetadataService] 论文预处理完成事件数据无效：缺少paper字段');
        return false;
      }

      const paper = eventData.paper;
      logger.log(paper)

      // 缓存论文数据
      const cacheSuccess = this.cachePaper(paper);

      
      if (cacheSuccess) {
        logger.log(`[PaperMetadataService] 论文 ${paper.title} 预处理完成事件处理成功并已缓存`);
      } else {
        logger.error(`[PaperMetadataService] 论文 ${paper.title} 缓存失败`);
      }

      return cacheSuccess;

    } catch (error) {
      logger.error('[PaperMetadataService] 处理论文预处理完成事件时发生错误:', error);
      return false;
    }
  }

  /**
   * 获取所有缓存的论文数据
   * @returns {Map} 所有论文数据
   */
  getAllCachedPapers() {
    return new Map(this.paperCache);
  }

  /**
   * 清空论文缓存
   */
  clearCache() {
    this.paperCache.clear();
    logger.log('[PaperMetadataService] 论文缓存已清空');
  }
}

// 创建单例实例
export const paperMetadataService = new PaperMetadataService();
export default paperMetadataService;
