/**
 * AI爬虫任务处理器
 * 继承自BaseHandler，专门处理AI驱动的网页爬虫任务
 */

import { BaseHandler } from '../baseHandler.js';
import { TASK_STATUS, PERSISTENCE_STRATEGY, SUPPORTED_TASK_TYPES, PAGE_TYPE } from '../../../constants.js';
import { Task } from '../../../model/task.js';
import { Result } from '../../../model/Result.js';
import { Paper } from '../../../model/Paper.js';
import { logger } from '../../../util/logger.js';
import aiService from '../../../service/aiService.js';
import { htmlParserService } from '../htmlParserService.js';
import { CssSelector } from '../../../model/CssSelector.js';
import { runTimeDataService } from '../../../service/runTimeDataService.js';
import { messageService } from '../messageService.js';

export class AiCrawlerTaskHandler extends BaseHandler {
  /**
   * 构造函数
   */
  constructor() {
    const config = {
      // 并发配置
      maxConcurrency: 3,
      
      // 队列配置
      queueConfig: {
        executionQueueSize: 5,
        waitingQueueSize: 10
      },
      
      // 持久化配置 - 不需要持久化
      persistenceConfig: {
        strategy: PERSISTENCE_STRATEGY.NONE,
        fixedDays: 0,
        fixedCount: 0
      }
    };

    super('AiCrawlerTaskHandler', config);
  }

  /**
   * 获取支持的任务类型
   * @returns {string[]} 支持的任务类型数组
   */
  getSupportedTaskTypes() {
    return Object.values(SUPPORTED_TASK_TYPES);
  }

  /**
   * 特定任务验证
   * @param {Task} task - 任务对象
   * @returns {boolean} 是否有效
   */
  validateSpecificTask(task) {
    // 验证任务类型
    if (!this.getSupportedTaskTypes().includes(task.type)) {
      logger.error(`[${this.handlerName}] 不支持的任务类型: ${task.type}`);
      return false;
    }

    // 根据任务类型验证参数
    switch (task.type) {
      case SUPPORTED_TASK_TYPES.PAPER_ELEMENT_CRAWLER:
        return this.validatePaperElementCrawlerTask(task);
      default:
        return false;
    }
  }

  /**
   * 验证网页爬取任务
   * @param {Task} task - 任务对象
   * @returns {boolean} 是否有效
   */
  validatePaperElementCrawlerTask(task) {
    const { url, platform, pageHTML } = task.params;
    
    // 验证必要参数
    if (!url || typeof url !== 'string') {
      logger.error(`[${this.handlerName}] 缺少或无效的URL参数`);
      return false;
    }

    if (!pageHTML || typeof pageHTML !== 'string') {
      return false;
    }

    if (!platform || typeof platform !== 'string') {
      logger.error(`[${this.handlerName}] 缺少或无效的平台参数`);
      return false;
    }

    return true;
  }

  /** 
   * 执行前的准备工作
   * @param {Task} task - 任务对象
   */
  async beforeExecute(task) {
    logger.log("执行前的准备工作${}",task)
    await super.beforeExecute(task);
  }

  /**
   * 执行任务的核心逻辑
   * @param {Task} task - 要执行的任务
   * @returns {Promise<*>} 执行结果
   */
  async execute(task) {
    try {
      switch (task.type) {
        case SUPPORTED_TASK_TYPES.PAPER_ELEMENT_CRAWLER:
          return await this.executePaperElementCrawler(task);
        default:
          throw new Error(`不支持的任务类型: ${task.type}`);
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * 执行网页爬取任务
   * @param {Task} task - 任务对象
   * @returns {Promise<Object>} 爬取结果
   */
  async executePaperElementCrawler(task) {
    const { url, platform, pageHTML, timestamp } = task.params;
    logger.log("执行元素提取任务", task);
    
    try {
      // 创建提取论文元素选择器的 prompt
      const prompt = this.createSelectorExtractionPrompt(pageHTML, platform);
      
      // 调用 AI 服务生成选择器
      const aiResponse = await aiService.callLLM(prompt);
      
      if (!aiResponse.success) {
        throw new Error(aiResponse.message || '调用AI服务失败');
      }

      const selector = aiResponse.data;

      // 步骤1: 使用htmlParserService提取元素
      logger.log(`[${this.handlerName}] 使用选择器提取元素: ${selector}`);
      let extractedElements;
      try {
        extractedElements = await htmlParserService.extractTextContent(pageHTML, selector);
        logger.log(`[${this.handlerName}] 成功提取到 ${extractedElements.length} 个元素`);
      } catch (extractError) {
        logger.error(`[${this.handlerName}] 元素提取失败:`, extractError);
        return {
          success: false,
          error: `元素提取失败: ${extractError.message}`,
          data: {
            selector: selector,
            extractionError: extractError.message
          }
        };
      }

      // 步骤2: 使用CssSelector验证提取结果
      logger.log(`[${this.handlerName}] 验证提取结果`);
      const isValid = CssSelector.validateWithPredefined(extractedElements, 'VALIDATE_PAPER_LIST');
      
      if (isValid) {
        logger.log(`[${this.handlerName}] 提取结果验证通过`);
        
        // 保存成功的CSS选择器
        const selectorSaved = await this.saveCssSelector(task.params, selector, extractedElements);
        
        // 发送任务完成通知给前台
        try {
          await messageService.sendTaskCompletionNotification(
            task.type,
            url,
            platform,
            true,
            {
              selector: selector,
              elementCount: extractedElements.length,
              selectorSaved: selectorSaved
            }
          );
          logger.log(`[${this.handlerName}] 任务完成通知已发送`);
        } catch (notificationError) {
          logger.error(`[${this.handlerName}] 发送任务完成通知失败:`, notificationError);
        }
        
        return {
          success: true,
          data: {
            selector: selector,
            extractedElements: extractedElements,
            elementCount: extractedElements.length,
            validationPassed: true,
            selectorSaved: selectorSaved
          },
          message: `成功提取并验证了 ${extractedElements.length} 个论文元素${selectorSaved ? '，选择器已保存' : ''}`
        };
      } else {
        logger.warn(`[${this.handlerName}] 提取结果验证失败`);
        return {
          success: false,
          error: '提取的结果未通过验证标准',
          data: {
            selector: selector,
            extractedElements: extractedElements,
            elementCount: extractedElements.length,
            validationPassed: false
          }
        };
      }
      
    } catch (error) {
      logger.error(`[${this.handlerName}] 选择器生成失败:`, error);
      return {
        success: false,
        error: error.message || '选择器生成失败',
        data: null
      };
    }
  }

  /**
   * 创建用于提取论文元素选择器的 AI prompt
   * @param {string} pageHTML - 网页HTML内容
   * @param {string} platform - 平台名称
   * @returns {string} 生成的prompt
   */
  createSelectorExtractionPrompt(pageHTML, platform) {
    
    const prompt = `你是一个专业的网页结构分析师，需要分析${platform}网站搜索结果页的HTML结构，找出能够提取所有论文列表的CSS选择器。

请分析以下HTML结构：

\`\`\`html
${pageHTML}
\`\`\`

任务要求：
1. 识别页面中的论文条目列表所在的结构
2、论文项通常包含标题、作者、摘要、版本链接、pdf链接等，因此该搜索结果应当一共包含若干个论文项。按照这个selector提取出的应当是一个论文项列表。

请只返回CSS选择器字符串，不要包含任何额外的解释、代码块标记或文字。
响应实例:
h3.gs_rt > a
`;

    return prompt;
  }

  /**
   * 保存成功验证的CSS选择器
   * @param {Object} taskParams - 任务参数 
   * @param {string} selector - CSS选择器字符串
   * @param {Array} extractedElements - 提取到的元素
   * @returns {boolean} 是否保存成功
   */
  async saveCssSelector(taskParams, selector, extractedElements) {
    try {
      const { url, platform } = taskParams;
      
      // 创建新的CssSelector实例
      const cssSelector = new CssSelector({
        domain: CssSelector.extractDomain(url),
        pageType: PAGE_TYPE.SEARCH_RESULTS,
        selector: selector,
        description: `AI自动生成的${platform}论文列表提取选择器`,
        validation: CssSelector.PREDEFINED_VALIDATIONS.VALIDATE_PAPER_LIST,
        enabled: true,
        metadata: {
          platform: platform,
          generatedByAI: true,
          elementCount: extractedElements.length,
          lastUsed: new Date().toISOString(),
          generationSource: 'ai_crawler_task'
        }
      });
      
      // 验证配置完整性
      const validation = cssSelector.validate();
      if (!validation.valid) {
        logger.warn(`[${this.handlerName}] CSS选择器配置无效:`, validation.errors);
        return false;
      }
      
      // 使用runTimeDataService保存
      const saveResult = await runTimeDataService.saveCssSelector(cssSelector);
      if (saveResult) {
        logger.log(`[${this.handlerName}] CSS选择器已保存: ${cssSelector.getKey()}`);
        return true;
      } else {
        logger.error(`[${this.handlerName}] CSS选择器保存失败`);
        return false;
      }
      
    } catch (error) {
      logger.error(`[${this.handlerName}] 保存CSS选择器时发生错误:`, error);
      return false;
    }
  }

  /**
   * 执行后的清理工作
   * @param {Task} task - 任务对象
   * @param {*} result - 执行结果
   */
  async afterExecute(task, result) {
    await super.afterExecute(task, result);
    
    // 记录执行统计
    this.recordTaskStatistics(task, result);
    
    logger.log(`[${this.handlerName}] 任务${task.key}执行完成，结果: ${result.success ? '成功' : '失败'}`);
  }

  /**
   * 特定错误处理
   * @param {Error} error - 错误对象
   * @param {Task} task - 任务对象
   */
  async handleSpecificError(error, task) {
    logger.error(`[${this.handlerName}] AI爬虫任务失败: ${task.key}`, error);
    
    // 根据错误类型进行特定处理
    if (error.name === 'TimeoutError') {
      logger.log(`[${this.handlerName}] 任务超时，考虑重试或调整参数`);
    } else if (error.name === 'NetworkError') {
      logger.log(`[${this.handlerName}] 网络错误，建议稍后重试`);
    } else if (error.name === 'RateLimitError') {
      logger.log(`[${this.handlerName}] 速率限制错误，延迟后重试`);
    }
    
    // 记录错误统计
    this.recordErrorStatistics(error, task);
  }

  /**
   * 记录任务统计
   * @param {Task} task - 任务对象
   * @param {*} result - 执行结果
   */
  recordTaskStatistics(task, result) {
    // TODO: 实现统计记录逻辑
    // 可以记录到数据库或其他存储系统
    logger.log(`[${this.handlerName}] 记录任务统计: ${task.type} - ${result.success ? '成功' : '失败'}`);
  }

  /**
   * 记录错误统计
   * @param {Error} error - 错误对象
   * @param {Task} task - 任务对象
   */
  recordErrorStatistics(error, task) {
    // TODO: 实现错误统计记录逻辑
    console.log(`[${this.handlerName}] 记录错误统计: ${error.name} - ${task.type}`);
  }
}

export default AiCrawlerTaskHandler; 