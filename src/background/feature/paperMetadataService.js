/**
 * paperMetadataService.js
 *
 * 论文元数据服务
 * 负责处理和保存论文元数据信息
 *
 * Paper对象属性说明：
 * @typedef {Object} PaperObject
 * @property {string} id - 论文唯一标识符（必需）
 * @property {string} title - 论文标题（必需）
 * @property {string} authors - 作者信息，多个作者用逗号分隔
 * @property {string} abstract - 论文摘要
 * @property {string[]} urls - 论文相关URL数组
 * @property {string} pdfUrl - PDF下载链接
 * @property {string} publicationDate - 发表日期
 * @property {string} venue - 发表会议或期刊名称
 * @property {string[]} keywords - 关键词数组
 * @property {number} citationCount - 引用次数
 * @property {string} platform - 平台标识符（如：googleScholar, ieee等）
 * @property {string} allVersionsUrl - 所有版本链接（Google Scholar专用）
 * @property {HTMLElement|null} element - 对应的DOM元素（仅在前端使用，不会被序列化）
 * @property {string} sourceUrl - 来源页面URL
 * @property {string} updateTime - 最后更新时间（ISO字符串格式）
 * @property {boolean} processing - 是否正在处理中
 * @property {string} html - 论文元素的HTML内容（用于AI提取）
 * @property {Object} metadata - 平台特定的额外元数据
 */

import { logger } from '../../util/logger.js';
import { PLATFORM_KEYS, PAGE_TYPE, AI_EXTRACTOR_SUPPORTED_TASK_TYPES } from '../../constants.js';
import { Task } from '../../model/task.js';
import { Paper } from '../../model/Paper.js';

class PaperMetadataService {
  constructor() {
    this.paperCache = new Map(); // 以论文ID为key保存完整的论文对象数据
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
   * @param {Array<Paper|PaperObject>} papers - 论文对象数组，可以是Paper实例或符合PaperObject结构的普通对象
   * @returns {Promise<boolean>} 处理是否成功
   */
  async processPapers(sourceDomain, pageType, papers) {
    try {
      logger.log(`[PaperMetadataService] 开始处理论文对象列表`);
      logger.log(`[PaperMetadataService] 来源域名: ${sourceDomain}`);
      logger.log(`[PaperMetadataService] 页面类型: ${pageType}`);
      logger.log(`[PaperMetadataService] 论文数量: ${papers.length}`);
      logger.log(`[PaperMetadataService] 论文列表:`, papers.map(p => ({ id: p.id, title: p.title, platform: p.platform })));
      
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
   * @param {Paper|PaperObject} paper - 论文对象，可以是Paper实例或符合PaperObject结构的普通对象
   * @returns {Promise<boolean>} 处理是否成功
   */
  async processPaper(paper) {
    try {
      logger.log(`[PaperMetadataService] 开始处理论文: ${paper.title}`);
      // 验证论文对象
      if (!this.validatePaper(paper)) {
        return false;
      }

      // 为论文创建AI元数据提取任务
      const success = await this.createPaperMetadataExtractionTask(paper);
      
      if (success) {
        // 缓存完整的论文对象，并标记为处理中
        const paperCacheData = {
          ...paper,  // 保留所有原始字段
          processing: true,  // 标记为处理中
          updateTime: paper.updateTime || new Date().toISOString()
        };

        // 移除不需要序列化的字段
        if (paperCacheData.element) {
          delete paperCacheData.element;
        }
        this.paperCache.set(paper.id, paperCacheData);
        logger.log(`[PaperMetadataService] 论文 ${paper.title} 处理成功并已缓存，内容为:`, JSON.stringify(paperCacheData, null, 2));
      }
      
      return success;
      
    } catch (error) {
      logger.error(`[PaperMetadataService] 处理论文 ${paper.title} 时发生错误:`, error);
      return false;
    }
  }

  /**
   * 为单个论文创建AI元数据提取任务
   * @param {Paper|PaperObject} paper - 论文对象，可以是Paper实例或符合PaperObject结构的普通对象
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
   * @param {Paper|PaperObject} paper - 论文对象，可以是Paper实例或符合PaperObject结构的普通对象
   * @returns {boolean} 是否有效
   */
  validatePaper(paper) {
    if (!paper) {
      logger.error('[PaperMetadataService] 论文对象为null/undefined');
      return false;
    }

    // 验证必需字段
    if (!paper.id) {
      logger.error('[PaperMetadataService] 论文对象缺少id字段');
      return false;
    }

    if (!paper.title) {
      logger.error('[PaperMetadataService] 论文对象缺少title字段');
      return false;
    }

    // 验证字段类型
    const validationRules = [
      { field: 'id', type: 'string', required: true },
      { field: 'title', type: 'string', required: true },
      { field: 'authors', type: 'string', required: false },
      { field: 'abstract', type: 'string', required: false },
      { field: 'urls', type: 'array', required: false },
      { field: 'pdfUrl', type: 'string', required: false },
      { field: 'publicationDate', type: 'string', required: false },
      { field: 'venue', type: 'string', required: false },
      { field: 'keywords', type: 'array', required: false },
      { field: 'citationCount', type: 'number', required: false },
      { field: 'platform', type: 'string', required: false },
      { field: 'allVersionsUrl', type: 'string', required: false },
      { field: 'sourceUrl', type: 'string', required: false },
      { field: 'updateTime', type: 'string', required: false },
      { field: 'processing', type: 'boolean', required: false },
      { field: 'html', type: 'string', required: false },
      { field: 'metadata', type: 'object', required: false }
    ];

    for (const rule of validationRules) {
      const value = paper[rule.field];

      if (rule.required && (value === undefined || value === null)) {
        logger.error(`[PaperMetadataService] 论文对象缺少必需字段: ${rule.field}`);
        return false;
      }

      if (value !== undefined && value !== null) {
        if (!this._validateFieldType(value, rule.type, rule.field)) {
          return false;
        }
      }
    }

    // 检查HTML内容
    const hasHtml = paper.html || (paper.element?.outerHTML);
    if (!hasHtml) {
      logger.warn(`[PaperMetadataService] 论文 ${paper.title} 缺少HTML内容，可能影响提取效果`);
    }

    // 验证平台字段
    if (paper.platform && !Object.values(PLATFORM_KEYS).includes(paper.platform)) {
      logger.warn(`[PaperMetadataService] 论文 ${paper.title} 的平台字段值不在支持的平台列表中: ${paper.platform}`);
    }

    return true;
  }

  /**
   * 验证字段类型
   * @param {any} value - 要验证的值
   * @param {string} expectedType - 期望的类型
   * @param {string} fieldName - 字段名称
   * @returns {boolean} 类型是否正确
   * @private
   */
  _validateFieldType(value, expectedType, fieldName) {
    switch (expectedType) {
      case 'string':
        if (typeof value !== 'string') {
          logger.error(`[PaperMetadataService] 字段 ${fieldName} 应为字符串类型，实际为: ${typeof value}`);
          return false;
        }
        break;
      case 'number':
        if (typeof value !== 'number' || isNaN(value)) {
          logger.error(`[PaperMetadataService] 字段 ${fieldName} 应为数字类型，实际为: ${typeof value}`);
          return false;
        }
        break;
      case 'boolean':
        if (typeof value !== 'boolean') {
          logger.error(`[PaperMetadataService] 字段 ${fieldName} 应为布尔类型，实际为: ${typeof value}`);
          return false;
        }
        break;
      case 'array':
        if (!Array.isArray(value)) {
          logger.error(`[PaperMetadataService] 字段 ${fieldName} 应为数组类型，实际为: ${typeof value}`);
          return false;
        }
        break;
      case 'object':
        if (typeof value !== 'object' || Array.isArray(value)) {
          logger.error(`[PaperMetadataService] 字段 ${fieldName} 应为对象类型，实际为: ${typeof value}`);
          return false;
        }
        break;
      default:
        logger.warn(`[PaperMetadataService] 未知的类型验证规则: ${expectedType}`);
        break;
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
   * @returns {PaperObject|null} 论文数据，如果不存在则返回null
   */
  getCachedPaper(paperId) {
    return this.paperCache.get(paperId) || null;
  }

  /**
   * 缓存单个论文数据
   * @param {Paper|PaperObject} paper - 论文对象，可以是Paper实例或符合PaperObject结构的普通对象
   * @returns {boolean} 缓存是否成功
   */
  cachePaper(paper) {
    try {
      if (!paper || !paper.id) {
        logger.error('[PaperMetadataService] 无法缓存论文：论文对象为空或缺少ID');
        return false;
      }

      // 缓存完整的论文对象
      const paperCacheData = {
        ...paper,  // 保留所有字段
        updateTime: paper.updateTime || new Date().toISOString(),
        processing: paper.processing !== undefined ? paper.processing : false  // 默认为false（已完成处理）
      };

      // 移除不需要序列化的字段
      if (paperCacheData.element) {
        delete paperCacheData.element;
      }

      this.paperCache.set(paper.id, paperCacheData);
      logger.log(`[PaperMetadataService] 成功缓存完整论文对象: ${paper.title}`);
      return true;
    } catch (error) {
      logger.error(`[PaperMetadataService] 缓存论文失败: ${paper?.title || 'unknown'}`, error);
      return false;
    }
  }

  /**
   * 处理论文预处理完成事件
   * @param {Object} eventData - 事件数据
   * @param {Paper|PaperObject} eventData.paper - 预处理完成的论文对象
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
   * @returns {Map<string, PaperObject>} 所有论文数据，键为论文ID，值为论文对象
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

  /**
   * 创建标准的Paper对象
   * 确保从普通对象创建符合规范的Paper实例
   * @param {Object} data - 原始数据对象
   * @returns {Paper} 标准化的Paper实例
   */
  createStandardPaper(data) {
    return new Paper(data);
  }

  /**
   * 获取Paper对象的所有可用属性列表
   * @returns {Array<{name: string, type: string, required: boolean, description: string}>} 属性列表
   */
  getPaperAttributeSchema() {
    return [
      { name: 'id', type: 'string', required: true, description: '论文唯一标识符' },
      { name: 'title', type: 'string', required: true, description: '论文标题' },
      { name: 'authors', type: 'string', required: false, description: '作者信息，多个作者用逗号分隔' },
      { name: 'abstract', type: 'string', required: false, description: '论文摘要' },
      { name: 'urls', type: 'string[]', required: false, description: '论文相关URL数组' },
      { name: 'pdfUrl', type: 'string', required: false, description: 'PDF下载链接' },
      { name: 'publicationDate', type: 'string', required: false, description: '发表日期' },
      { name: 'venue', type: 'string', required: false, description: '发表会议或期刊名称' },
      { name: 'keywords', type: 'string[]', required: false, description: '关键词数组' },
      { name: 'citationCount', type: 'number', required: false, description: '引用次数' },
      { name: 'platform', type: 'string', required: false, description: '平台标识符（如：googleScholar, ieee等）' },
      { name: 'allVersionsUrl', type: 'string', required: false, description: '所有版本链接（Google Scholar专用）' },
      { name: 'element', type: 'HTMLElement', required: false, description: '对应的DOM元素（仅在前端使用，不会被序列化）' },
      { name: 'sourceUrl', type: 'string', required: false, description: '来源页面URL' },
      { name: 'updateTime', type: 'string', required: false, description: '最后更新时间（ISO字符串格式）' },
      { name: 'processing', type: 'boolean', required: false, description: '是否正在处理中' },
      { name: 'html', type: 'string', required: false, description: '论文元素的HTML内容（用于AI提取）' },
      { name: 'metadata', type: 'object', required: false, description: '平台特定的额外元数据' }
    ];
  }

  /**
   * 获取支持的平台列表
   * @returns {Array<{key: string, name: string}>} 支持的平台列表
   */
  getSupportedPlatforms() {
    return Object.entries(PLATFORM_KEYS).map(([name, key]) => ({
      key,
      name: name.toLowerCase().replace(/_/g, ' ')
    }));
  }

  /**
   * 检查Paper对象的完整性
   * 返回详细的检查报告，包括缺失的字段和建议
   * @param {Paper|PaperObject} paper - 要检查的论文对象
   * @returns {Object} 检查报告
   */
  checkPaperCompleteness(paper) {
    const report = {
      isValid: true,
      completeness: 0,
      missingFields: [],
      invalidFields: [],
      warnings: [],
      suggestions: []
    };

    if (!paper) {
      report.isValid = false;
      report.missingFields.push('整个论文对象');
      return report;
    }

    const schema = this.getPaperAttributeSchema();
    const totalFields = schema.length;
    let validFields = 0;

    for (const field of schema) {
      const value = paper[field.name];
      const hasValue = value !== undefined && value !== null && value !== '';

      if (field.required && !hasValue) {
        report.isValid = false;
        report.missingFields.push(field.name);
      } else if (hasValue) {
        // 验证字段类型
        if (this._validateFieldType(value, field.type.replace('[]', ''), field.name)) {
          validFields++;
        } else {
          report.invalidFields.push({
            field: field.name,
            expectedType: field.type,
            actualType: typeof value
          });
        }
      }
    }

    report.completeness = Math.round((validFields / totalFields) * 100);

    // 添加建议
    if (!paper.abstract) {
      report.suggestions.push('建议添加摘要信息以提高AI提取效果');
    }
    if (!paper.pdfUrl) {
      report.suggestions.push('建议添加PDF链接以便用户下载');
    }
    if (!paper.html && !paper.element) {
      report.warnings.push('缺少HTML内容，可能影响AI元数据提取效果');
    }

    return report;
  }
}

// 创建单例实例
export const paperMetadataService = new PaperMetadataService();
export default paperMetadataService;
