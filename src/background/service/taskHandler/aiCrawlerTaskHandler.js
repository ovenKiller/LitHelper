/**
 * AI爬虫任务处理器
 * 继承自BaseHandler，专门处理AI驱动的网页爬虫任务
 */

import { BaseHandler } from '../baseHandler.js';
import { TASK_STATUS, PERSISTENCE_STRATEGY, AI_CRAWLER_SUPPORTED_TASK_TYPES, AI_EXTRACTOR_SUPPORTED_TASK_TYPES, PAGE_TYPE } from '../../../constants.js';
import { Task } from '../../../model/task.js';
import { logger } from '../../../util/logger.js';
import aiService from '../../../service/aiService.js';
import { htmlParserService } from '../htmlParserService.js';
import { PlatformSelector } from '../../../model/PlatformSelector.js';
import { runTimeDataService } from '../../../service/runTimeDataService.js';
import { messageService } from '../messageService.js';
import { EXTRACTOR_TYPE, SELECTOR_MODE } from '../../../constants.js';

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
    return Object.values(AI_CRAWLER_SUPPORTED_TASK_TYPES);
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
      case AI_CRAWLER_SUPPORTED_TASK_TYPES.PAPER_ELEMENT_CRAWLER:
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
        case AI_CRAWLER_SUPPORTED_TASK_TYPES.PAPER_ELEMENT_CRAWLER:
          return await this.executePaperElementCrawler(task);
        default:
          throw new Error(`不支持的任务类型: ${task.type}`);
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * 执行网页爬取任务 - 多阶段生成验证流程
   * @param {Task} task - 任务对象
   * @returns {Promise<Object>} 爬取结果
   */
  async executePaperElementCrawler(task) {
    const { url, platform, pageHTML, timestamp } = task.params;
    logger.log("执行多阶段元素提取任务", task);
    
    try {
      // 阶段一：提取论文项列表
      logger.log(`[${this.handlerName}] 阶段一：开始提取论文项列表`);
      const paperItemResult = await this.extractPaperItems(pageHTML, platform);
      
      if (!paperItemResult.success) {
        return paperItemResult;
      }
      
      const { paperItemElements, paperItemSelector } = paperItemResult.data;
      logger.log(`[${this.handlerName}] 阶段一完成：提取到 ${paperItemElements.length} 个论文项`);
      
      // 灵活处理论文项数量 - 有多少用多少
      if (paperItemElements.length === 0) {
        return {
          success: false,
          error: `没有提取到任何论文项`,
          data: { elementCount: 0 }
        };
      }
      
      logger.log(`[${this.handlerName}] 继续处理 ${paperItemElements.length} 个论文项`);
      
      // 阶段二：生成子元素选择器
      logger.log(`[${this.handlerName}] 阶段二：开始生成子元素选择器`);
      const subSelectorResult = await this.generateSubSelectors(paperItemElements, platform);
      
      if (!subSelectorResult.success) {
        return subSelectorResult;
      }
      
      const { subSelectors, learningSamples, validationSamples } = subSelectorResult.data;
      logger.log(`[${this.handlerName}] 阶段二完成：生成了 ${Object.keys(subSelectors).length} 个子选择器`);
      
      // 阶段三：灵活验证（不强制要求交叉验证）
      let validationPassed = false;
      if (validationSamples && validationSamples.length > 0) {
        logger.log(`[${this.handlerName}] 阶段三：开始灵活验证子选择器（使用 ${validationSamples.length} 个验证样本）`);
        const validationResult = await this.validateSubSelectors(validationSamples, subSelectors);
        
        if (validationResult.success) {
          validationPassed = true;
          logger.log(`[${this.handlerName}] 阶段三完成：验证通过`);
        } else {
          logger.warn(`[${this.handlerName}] 阶段三：验证未完全通过，但继续执行任务`);
        }
      } else {
        logger.log(`[${this.handlerName}] 阶段三：跳过验证（没有验证样本）`);
      }
      
      // 阶段四：保存与通知
      logger.log(`[${this.handlerName}] 阶段四：开始保存PlatformSelector`);
      const saveResult = await this.savePlatformSelector(task.params, paperItemSelector, subSelectors);
      
      if (!saveResult.success) {
        return saveResult;
      }
      
      // 发送任务完成通知给前台
      try {
        await messageService.sendTaskCompletionNotification(
          task.type,
          url,
          platform,
          true,
          {
            platformSelector: saveResult.data.platformSelector,
            elementCount: paperItemElements.length,
            hasValidation: validationSamples && validationSamples.length > 0,
            validationPassed: validationPassed
          }
        );
        logger.log(`[${this.handlerName}] 任务完成通知已发送`);
      } catch (notificationError) {
        logger.error(`[${this.handlerName}] 发送任务完成通知失败:`, notificationError);
      }
      
      return {
        success: true,
        data: {
          platformSelector: saveResult.data.platformSelector,
          elementCount: paperItemElements.length,
          learningSampleCount: learningSamples.length,
          validationSampleCount: validationSamples ? validationSamples.length : 0,
          extractorCount: Object.keys(subSelectors).length,
          validationPassed: validationPassed
        },
        message: `成功生成并保存了完整的PlatformSelector，包含 ${Object.keys(subSelectors).length} 个提取器`
      };
      
    } catch (error) {
      logger.error(`[${this.handlerName}] 多阶段任务执行失败:`, error);
      return {
        success: false,
        error: error.message || '多阶段任务执行失败',
        data: null
      };
    }
  }

  /**
   * 阶段一：提取论文项列表
   * @param {string} pageHTML - 完整页面HTML
   * @param {string} platform - 平台名称
   * @returns {Promise<Object>} 提取结果
   */
  async extractPaperItems(pageHTML, platform) {
    try {
      // 压缩HTML
      logger.log(`[${this.handlerName}] 压缩HTML页面内容`);
      const compressedHTML = await htmlParserService.compressHtmlToTextStructure(pageHTML, 20);
      logger.log(`[${this.handlerName}] HTML压缩完成，压缩后长度: ${compressedHTML.length}`);
      
      // 调用AI服务提取论文项选择器
      const aiResult = await aiService.extractPaperItems(compressedHTML, platform);
      if (!aiResult.success) {
        throw new Error(aiResult.error || '调用AI服务失败');
      }
      
      const selectorConfig = aiResult.data;
      
      // 使用选择器提取元素
      let paperItemElements;
      
      const extractResult = await htmlParserService.extractElements(pageHTML, selectorConfig.selector);
      
      if (!extractResult.success) {
        throw new Error(extractResult.error || '提取元素失败');
      }
      
      paperItemElements = extractResult.data.elements;
      
      logger.log(`[${this.handlerName}] 成功提取到 ${paperItemElements.length} 个论文项`);
      
      return {
        success: true,
        data: {
          paperItemElements: paperItemElements,
          paperItemSelector: selectorConfig
        }
      };
      
    } catch (error) {
      logger.error(`[${this.handlerName}] 论文项提取失败:`, error);
      return {
        success: false,
        error: error.message || '论文项提取失败',
        data: null
      };
    }
  }

  /**
   * 阶段二：生成子元素选择器
   * @param {Array} paperItemElements - 论文项元素数组
   * @param {string} platform - 平台名称
   * @returns {Promise<Object>} 生成结果
   */
  async generateSubSelectors(paperItemElements, platform) {
    try {
      // 分配学习样本和验证样本
      const { learningSamples, validationSamples } = this.allocateSamples(paperItemElements);
      
      logger.log(`[${this.handlerName}] 样本分配：学习样本 ${learningSamples.length} 个，验证样本 ${validationSamples ? validationSamples.length : 0} 个`);
      
      // 构建学习样本的HTML内容
      const sampleHTMLs = learningSamples.map((element, index) => {
        return `样本${index + 1}:\n${element.outerHTML}\n`;
      }).join('\n');
      
      // 调用AI服务生成子选择器
      const aiResult = await aiService.generateSubSelectors(sampleHTMLs, platform);
      if (!aiResult.success) {
        throw new Error(aiResult.error || '调用AI服务失败');
      }
      
      const subSelectors = aiResult.data;
      
      // 验证返回格式
      const requiredExtractors = [EXTRACTOR_TYPE.TITLE, EXTRACTOR_TYPE.ABSTRACT];
      for (const extractorType of requiredExtractors) {
        if (!subSelectors[extractorType] || !subSelectors[extractorType].mode || !subSelectors[extractorType].selector) {
          logger.warn(`[${this.handlerName}] 缺少或无效的子选择器: ${extractorType}`);
        }
      }
      
      logger.log(`[${this.handlerName}] 成功生成 ${Object.keys(subSelectors).length} 个子选择器`);
      
      return {
        success: true,
        data: {
          subSelectors: subSelectors,
          learningSamples: learningSamples,
          validationSamples: validationSamples
        }
      };
      
    } catch (error) {
      logger.error(`[${this.handlerName}] 子选择器生成失败:`, error);
      return {
        success: false,
        error: error.message || '子选择器生成失败',
        data: null
      };
    }
  }

  /**
   * 阶段三：验证子选择器 - 使用AI验证
   * @param {Array} validationSamples - 验证样本
   * @param {Object} subSelectors - 子选择器配置
   * @returns {Promise<Object>} 验证结果
   */
  async validateSubSelectors(validationSamples, subSelectors) {
    try {
      logger.log(`[${this.handlerName}] 开始AI验证 ${validationSamples.length} 个样本`);
      
      // 步骤1：提取所有结果
      const extractionResults = [];
      
      for (let i = 0; i < validationSamples.length; i++) {
        const sample = validationSamples[i];
        const sampleResults = {};
        
        logger.log(`[${this.handlerName}] 处理样本 ${i + 1}/${validationSamples.length}`);
        
        for (const [extractorType, selectorConfig] of Object.entries(subSelectors)) {
          try {
            let extractedResults;
            
            if (selectorConfig.mode === 'css') {
              // 对于CSS选择器，使用htmlParserService在样本HTML内查找
              try {
                const extractResult = await htmlParserService.extractElements(sample.outerHTML, selectorConfig.selector);
                if (extractResult.success) {
                  extractedResults = extractResult.data.elements.map(el => el.textContent.trim());
                } else {
                  extractedResults = [];
                }
              } catch (parseError) {
                logger.warn(`[${this.handlerName}] CSS选择器提取失败: ${parseError.message}`);
                extractedResults = [];
              }
            } else if (selectorConfig.mode === 'regex') {
              // 对于正则选择器，在样本文本内匹配
              const regex = new RegExp(selectorConfig.selector, 'gi');
              const matches = sample.textContent.match(regex) || [];
              extractedResults = matches;
            } else {
              // 默认使用CSS模式
              try {
                const extractResult = await htmlParserService.extractElements(sample.outerHTML, selectorConfig.selector);
                if (extractResult.success) {
                  extractedResults = extractResult.data.elements.map(el => el.textContent.trim());
                } else {
                  extractedResults = [];
                }
              } catch (parseError) {
                logger.warn(`[${this.handlerName}] 选择器提取失败: ${parseError.message}`);
                extractedResults = [];
              }
            }
            
            sampleResults[extractorType] = extractedResults;
            
          } catch (extractError) {
            logger.warn(`[${this.handlerName}] 样本${i + 1}的${extractorType}提取器执行失败: ${extractError.message}`);
            sampleResults[extractorType] = [];
          }
        }
        
        extractionResults.push(sampleResults);
      }
      
      logger.log(`[${this.handlerName}] 完成所有样本提取，开始AI验证`);
      
      // 步骤2：调用AI进行验证
      const platform = 'google_scholar'; // 可以根据实际情况传入
      const aiValidationResult = await aiService.validateSelectors(
        validationSamples, 
        subSelectors, 
        extractionResults, 
        platform
      );
      
      if (!aiValidationResult.success) {
        logger.warn(`[${this.handlerName}] AI验证调用失败: ${aiValidationResult.error}`);
        // 如果AI验证失败，返回基本的成功结果，不阻止任务继续
        return {
          success: true,
          data: { 
            validationPassed: false,
            aiValidationFailed: true,
            error: aiValidationResult.error,
            extractionResults: extractionResults
          }
        };
      }
      
      const validationData = aiValidationResult.data;
      logger.log(`[${this.handlerName}] AI验证完成，整体结果: ${validationData.overallSuccess}`);
      if (validationData.overallSuccess) {
        logger.log(`[${this.handlerName}] AI验证通过`);
        return {
          success: true,
          data: { 
            validationPassed: true,
            aiValidationResult: validationData,
            extractionResults: extractionResults
          }
        };
      } else {
        logger.warn(`[${this.handlerName}] AI验证未完全通过，但不阻止任务继续`);
        return {
          success: false,
          error: `AI验证未完全通过: ${validationData.extractorResults}`,
          data: { 
            validationPassed: false,
            aiValidationResult: validationData,
            extractionResults: extractionResults
          }
        };
      }
      
    } catch (error) {
      logger.error(`[${this.handlerName}] AI验证过程失败:`, error);
      return {
        success: false,
        error: error.message || 'AI验证过程失败',
        data: null
      };
    }
  }

  /**
   * 阶段四：保存PlatformSelector
   * @param {Object} taskParams - 任务参数
   * @param {Object} paperItemSelector - 论文项选择器配置
   * @param {Object} subSelectors - 子选择器配置
   * @returns {Promise<Object>} 保存结果
   */
  async savePlatformSelector(taskParams, paperItemSelector, subSelectors) {
    try {
      const { url, platform } = taskParams;
      
      logger.log(`[${this.handlerName}] 🏗️  开始创建PlatformSelector:`);
      logger.log(`  - URL: ${url}`);
      logger.log(`  - Platform: ${platform}`);
      
      // 创建PlatformSelector实例
      const platformSelector = new PlatformSelector({
        domain: PlatformSelector.extractDomain(url),
        pageType: PAGE_TYPE.SEARCH_RESULTS
      });
      
      logger.log(`[${this.handlerName}] 📝 PlatformSelector基础信息:`);
      logger.log(`  - Domain: ${platformSelector.domain}`);
      logger.log(`  - Page Type: ${platformSelector.pageType}`);
      logger.log(`  - Key: ${platformSelector.getKey()}`);
      
      // 根据平台设置platformKey
      if (platform === 'google_scholar') {
        platformSelector.platformKey = 'googleScholar';
        logger.log(`[${this.handlerName}] 设置Platform Key: googleScholar`);
      }
      
      logger.log(`[${this.handlerName}] 📋 论文项选择器配置:`, paperItemSelector);
      
      // 设置论文项提取器
      platformSelector.setExtractorMode(
        EXTRACTOR_TYPE.PAPER_ITEM, 
        paperItemSelector.mode, 
        {
          selector: paperItemSelector.selector,
          description: `AI自动生成的${platform}论文项提取器`,
          validation: PlatformSelector.PREDEFINED_VALIDATIONS.VALIDATE_PAPER_LIST
        }
      );
      
      logger.log(`[${this.handlerName}] ✅ 论文项提取器已设置`);
      
      // 设置子提取器
      logger.log(`[${this.handlerName}] 🔧 子选择器配置详情:`);
      for (const [extractorType, selectorConfig] of Object.entries(subSelectors)) {
        logger.log(`  - ${extractorType}:`, selectorConfig);
        
        const validationName = this.getValidationNameForExtractor(extractorType);
        const validation = validationName ? PlatformSelector.PREDEFINED_VALIDATIONS[validationName] : null;
        
        platformSelector.setExtractorMode(
          extractorType,
          selectorConfig.mode,
          {
            selector: selectorConfig.selector,
            description: `AI自动生成的${platform}${extractorType}提取器`,
            validation: validation
          }
        );
        
        logger.log(`  - ${extractorType} 提取器已设置，验证规则: ${validationName || 'none'}`);
      }
      
      // 打印完整的PlatformSelector数据
      logger.log(`[${this.handlerName}] 🎯 完整的PlatformSelector数据:`);
      logger.log(`  - toJSON():`, platformSelector.toJSON());
      logger.log(`  - 提取器数量: ${Object.keys(platformSelector.extractors || {}).length}`);
      
      // 保存到存储
      logger.log(`[${this.handlerName}] 💾 开始保存到runTimeDataService...`);
      const saveSuccess = await runTimeDataService.savePlatformSelector(platformSelector);
      if (!saveSuccess) {
        throw new Error('保存PlatformSelector到存储失败');
      }
      
      logger.log(`[${this.handlerName}] ✅ PlatformSelector保存成功: ${platformSelector.getKey()}`);
      
      return {
        success: true,
        data: {
          platformSelector: platformSelector,
          key: platformSelector.getKey()
        }
      };
      
    } catch (error) {
      logger.error(`[${this.handlerName}] 保存PlatformSelector失败:`, error);
      return {
        success: false,
        error: error.message || '保存PlatformSelector失败',
        data: null
      };
    }
  }

  /**
   * 分配学习样本和验证样本
   * @param {Array} paperItemElements - 论文项元素数组
   * @returns {Object} 分配结果
   */
  allocateSamples(paperItemElements) {
    // 调试日志：确认参数类型和内容
    logger.log(`[${this.handlerName}] allocateSamples 参数类型: ${typeof paperItemElements}`);
    logger.log(`[${this.handlerName}] allocateSamples 是否为数组: ${Array.isArray(paperItemElements)}`);
    logger.log(`[${this.handlerName}] allocateSamples 参数内容:`, paperItemElements);
    
    const totalCount = paperItemElements.length;
    
    // 灵活分配策略：有多少用多少
    if (totalCount === 1) {
      // 只有1个样本，全部用于学习，无验证样本
      return { learningSamples: paperItemElements, validationSamples: null };
    } else if (totalCount === 2) {
      // 2个样本，使用第一个学习，第二个验证
      return { 
        learningSamples: [paperItemElements[0]], 
        validationSamples: [paperItemElements[1]] 
      };
    } else if (totalCount === 3) {
      // 3个样本，前2个学习，最后1个验证
      return { 
        learningSamples: paperItemElements.slice(0, 2), 
        validationSamples: [paperItemElements[2]] 
      };
    } else {
      // 4个或更多样本，随机分配
      const shuffled = [...paperItemElements].sort(() => Math.random() - 0.5);
      
      // 使用约一半样本进行学习，其余验证（至少保证1个学习样本）
      const learningCount = Math.max(1, Math.floor(totalCount / 2));
      const learningSamples = shuffled.slice(0, learningCount);
      const validationSamples = shuffled.slice(learningCount);
      
      return { learningSamples, validationSamples };
    }
  }

  /**
   * 根据提取器类型获取对应的验证规则名称
   * @param {string} extractorType - 提取器类型
   * @returns {string|null} 验证规则名称
   */
  getValidationNameForExtractor(extractorType) {
    const mapping = {
      [EXTRACTOR_TYPE.TITLE]: 'VALIDATE_TITLE',
      [EXTRACTOR_TYPE.ABSTRACT]: 'VALIDATE_ABSTRACT',
      [EXTRACTOR_TYPE.ALL_VERSIONS_LINK]: 'VALIDATE_ALL_VERSIONS_LINK',
      [EXTRACTOR_TYPE.PDF]: 'VALIDATE_PDF_URL'
    };
    return mapping[extractorType] || null;
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