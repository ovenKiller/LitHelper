
import { BaseHandler } from '../baseHandler.js';
import { TASK_STATUS, PERSISTENCE_STRATEGY, AI_EXTRACTOR_SUPPORTED_TASK_TYPES } from '../../../constants.js';
import { Task } from '../../../model/task.js';
import { Result } from '../../../model/Result.js';
import { Paper } from '../../../model/Paper.js';
import { logger } from '../../../util/logger.js';
import aiService from '../../../service/aiService.js';
import { htmlParserService } from '../htmlParserService.js';
import { messageService } from '../messageService.js';
import { httpService } from '../httpService.js';
import { runTimeDataService } from '../../../service/runTimeDataService.js';
import { paperMetadataService } from '../../feature/paperMetadataService.js';
import { MessageActions } from '../../../util/message.js';

export class AiExtractorTaskHandler extends BaseHandler {
  /**
   * 构造函数
   */
  constructor() {
    const config = {
      maxConcurrency: 5,
      queueConfig: {
        executionQueueSize: 10,
        waitingQueueSize: 20
      },
      persistenceConfig: {
        strategy: PERSISTENCE_STRATEGY.NONE
      }
    };

    super('AiExtractorTaskHandler', config);
  }

  /**
   * 获取支持的任务类型
   * @returns {string[]} 支持的任务类型数组
   */
  getSupportedTaskTypes() {
    return Object.values(AI_EXTRACTOR_SUPPORTED_TASK_TYPES);
  }

  /**
   * 特定任务验证
   * @param {Task} task - 任务对象
   * @returns {boolean} 是否有效
   */
  validateSpecificTask(task) {
    // 验证任务参数
    if (!task.params) {
      logger.error(`[${this.handlerName}] 任务 ${task.key} 缺少参数`);
      return false;
    }

    if (task.type === AI_EXTRACTOR_SUPPORTED_TASK_TYPES.PAPER_METADATA_EXTRACTION) {
      if (!task.params.paper) {
        logger.error(`[${this.handlerName}] 论文元数据提取任务 ${task.key} 缺少paper参数`);
        return false;
      }

      if (!task.params.paper.id) {
        logger.error(`[${this.handlerName}] 论文元数据提取任务 ${task.key} 的paper缺少id字段`);
        return false;
      }

      if (!task.params.paper.title) {
        logger.error(`[${this.handlerName}] 论文元数据提取任务 ${task.key} 的paper缺少title字段`);
        return false;
      }
    }

    return true;
  }

  /**
   * 执行任务的核心逻辑
   * @param {Task} task - 要执行的任务
   * @returns {Promise<*>} 执行结果
   */
  async execute(task) {
    logger.log(`[${this.handlerName}] 收到提取任务:`, task);
    switch (task.type) {
      case AI_EXTRACTOR_SUPPORTED_TASK_TYPES.PAPER_METADATA_EXTRACTION:
        return await this.executePaperMetadataExtraction(task);
      default:
        return { success: false, error: `不支持的任务类型: ${task.type}` };
    }
  }

  /**
   * 执行后的清理工作
   * @param {Task} task - 任务对象
   * @param {*} result - 执行结果
   */
  async afterExecute(task, result) {
    await super.afterExecute(task, result);
    logger.log(`[${this.handlerName}] 任务${task.key}执行完成，结果: ${result.success ? '成功' : '失败'}`);
  }

  /**
   * 特定错误处理
   * @param {Error} error - 错误对象
   * @param {Task} task - 任务对象
   */
  async handleSpecificError(error, task) {
    logger.error(`[${this.handlerName}] AI提取任务失败: ${task.key}`, error);
  }

  /**
   * 执行论文元数据提取任务
   * @param {Task} task - 任务对象
   * @returns {Promise<Object>} 执行结果
   */
  async executePaperMetadataExtraction(task) {
    try {
      logger.log(`[${this.handlerName}] 执行论文元数据提取任务:`, task.key);
      
      const { paper } = task.params;
      
      logger.log(`[${this.handlerName}] 开始处理论文: ${paper.title}`);
      
      let abstract = null;
      
      if (paper.allVersionsUrl) {
        logger.log(`[${this.handlerName}] 开始获取论文所有版本: ${paper.allVersionsUrl}`);
        try {
          const allVersionsHtml = await httpService.getHtml(paper.allVersionsUrl);
          abstract = await this.processPaperHtml(allVersionsHtml, paper);
          logger.log(`[${this.handlerName}] 成功处理所有版本数据`);
        } catch (error) {
          logger.warn(`[${this.handlerName}] 获取所有版本失败，将跳过: ${error.message}`);
        }
      } else {
        logger.log(`[${this.handlerName}] 论文 ${paper.title} 没有所有版本链接，跳过该步骤`);
      }

      // 创建新的Paper对象并保存预处理数据
      try {
        logger.log(`[${this.handlerName}] 开始创建预处理论文数据`);
        
        // 构建新Paper对象的数据
        const paperData = {
          id: paper.id,
          title: paper.title,
          pdfUrl: paper.pdfUrl || '',
          updateTime: new Date().toISOString()
        };

        // 只有在abstract不为null且不为空字符串时才赋值
        if (abstract && typeof abstract === 'string' && abstract.trim()) {
          paperData.abstract = abstract.trim();
          logger.log(`[${this.handlerName}] 论文 ${paper.title} 提取到摘要，长度: ${abstract.length}`);
        } else {
          logger.log(`[${this.handlerName}] 论文 ${paper.title} 未提取到有效摘要`);
        }

        // 创建新的Paper对象
        const preprocessedPaper = new Paper(paperData);
        logger.log(`[${this.handlerName}] 预处理论文数据: ${preprocessedPaper}`);
    
        // 广播论文预处理完成事件
        try {
          logger.log(`[${this.handlerName}] 广播论文预处理完成事件: ${preprocessedPaper.title}`);
          
          // 通过Chrome runtime消息API广播事件
          chrome.runtime.sendMessage({
            action: MessageActions.PAPER_PREPROCESSING_COMPLETED,
            data: {
              paper: preprocessedPaper,
              taskKey: task.key,
              timestamp: new Date().toISOString()
            }
          }).catch(error => {
            // 忽略没有监听器的错误，这是正常的
            logger.log(`[${this.handlerName}] 消息发送完成 (可能没有监听器): ${error.message}`);
          });
          
          logger.log(`[${this.handlerName}] 论文预处理完成事件已广播`);
        } catch (broadcastError) {
          logger.warn(`[${this.handlerName}] 广播论文预处理完成事件失败:`, broadcastError);
        }
        
      } catch (saveError) {
        logger.error(`[${this.handlerName}] 创建和保存预处理论文数据时发生错误:`, saveError);
        return {
          success: false,
          error: saveError.message,
          paperId: paper.id,
          processedAt: new Date().toISOString()
        };
      }
    } catch (error) {
      logger.error(`[${this.handlerName}] 论文元数据提取任务执行失败:`, error);
      return {  
        success: false,
        error: error.message,
        processedAt: new Date().toISOString()
      };
    }
  }

  /**
   * 处理论文所有版本页面
   * @param {string} allVersionsHtml - 所有版本页面的HTML
   * @param {Object} paper - 原始论文对象
   * @returns {Promise<Object>} 处理结果
   */
  async processAllVersions(allVersionsHtml, paper) {
    try {
      logger.log(`[${this.handlerName}] 开始处理论文所有版本HTML，长度: ${allVersionsHtml?.length || 0}`);
      
      if (!allVersionsHtml) {
        return { error: '所有版本HTML为空' };
      }
      logger.log(`[${this.handlerName}] HTML解析完成`);

      // 这里可以添加更多的处理逻辑，比如：
      // 1. 提取不同版本的发布时间
      // 2. 提取引用信息
      // 3. 提取作者信息等

      return {
        rawHtml: allVersionsHtml.substring(0, 1000), // 只保存前1000字符作为样本
        parsedData: abstract,
        processedAt: new Date().toISOString()
      };

    } catch (error) {
      logger.error(`[${this.handlerName}] 处理所有版本时发生错误:`, error);
      return { 
        error: error.message,
        processedAt: new Date().toISOString()
      };
    }
  }

  /**
   * 处理论文HTML内容
   * @param {string} paperHtml - 论文HTML内容
   * @param {Object} paper - 原始论文对象
   * @returns {Promise<Object>} 处理结果
   */
  async processPaperHtml(paperHtml, paper) {
    try {
      logger.log(`[${this.handlerName}] 开始处理论文HTML内容，长度: ${paperHtml?.length || 0}`);
      
      // 第一步：压缩HTML
      const parsedData = await htmlParserService.compressHtmlToTextStructure(paperHtml, 20);
      logger.log(`[${this.handlerName}] HTML压缩完成，压缩后长度: ${parsedData.length}`);

      // 第二步：提取论文项（参考aiCrawlerTaskHandler的extractPaperItems实现）
      let paperItems = null;
      let paperItemSelector = null;

        try {
          logger.log(`[${this.handlerName}] 开始提取论文项，平台: ${paper.platform}`);
          
          // 调用AI服务提取论文项选择器
          const aiResult = await aiService.extractPaperElementsFromAllVersionContent(parsedData,paper.title);
          if (aiResult.success) {
            const selectorConfig = aiResult.data;
            paperItemSelector = selectorConfig;
            
            // 使用选择器提取元素
            const extractResult = await htmlParserService.extractElements(paperHtml, selectorConfig.selector);
            
            if (extractResult.success) {
              paperItems = extractResult.data.elements;
              logger.log(`[${this.handlerName}] 成功提取到 ${paperItems.length} 个论文项`);
            } else {
              logger.warn(`[${this.handlerName}] 论文项元素提取失败: ${extractResult.error}`);
            }
          } else {
            logger.warn(`[${this.handlerName}] AI服务提取论文项选择器失败: ${aiResult.error}`);
          }
        } catch (paperItemError) {
          logger.warn(`[${this.handlerName}] 论文项提取过程出错: ${paperItemError.message}`);
        }

      // 第三步：对提取到的论文项进行进一步解析
      let parsedPaperItems = null;
      if (paperItems && paperItems.length >= 2) {
        try {
          logger.log(`[${this.handlerName}] 开始对论文项进行进一步解析，总数: ${paperItems.length}`);
          
          // 随机选择两项
          const shuffled = [...paperItems].sort(() => 0.5 - Math.random());
          const selectedItems = shuffled.slice(0, 2);
          
          logger.log(`[${this.handlerName}] 随机选择了 2 个论文项进行并行解析`);
          
          // 创建两个并行的异步任务
          const parseTask1 = this.parsePaperItem(selectedItems[0], paper, 0);
          const parseTask2 = this.parsePaperItem(selectedItems[1], paper, 1);
          
          // 并行执行解析任务
          const [abstract1, abstract2] = await Promise.all([
            parseTask1,
            parseTask2
          ]);
          const abstract = abstract1 && abstract2 ? 
            (abstract1.length > abstract2.length ? abstract1 : abstract2) :
            abstract1 || abstract2 || null;
          
          logger.log(`[${this.handlerName}] 论文项并行解析完成，成功: ${parseResult1.success && parseResult2.success}`);
          
        } catch (parseError) {
          logger.warn(`[${this.handlerName}] 论文项并行解析过程出错: ${parseError.message}`);

          parsedPaperItems = {
            error: parseError.message,
            selectedCount: 0,
            totalCount: paperItems ? paperItems.length : 0
          };
        }
      } else {
        logger.log(`[${this.handlerName}] 论文项数量不足（${paperItems ? paperItems.length : 0}），跳过进一步解析`);
      }

      logger.log(`[${this.handlerName}] 论文HTML解析完成`);

      return abstract;

    } catch (error) {
      logger.error(`[${this.handlerName}] 处理论文HTML时发生错误:`, error);
      return null;
    }
  }

  /**
   * 解析单个论文项
   * @param {Object} paperItem - 论文项数据
   * @param {Object} paper - 原始论文对象
   * @param {number} index - 项目索引
   * @returns {Promise<Object>} 解析结果
   */
  async parsePaperItem(paperItem, paper, index) {
    try {
      logger.log(`[${this.handlerName}] 开始解析论文项 ${index}，长度: ${paperItem?.innerHTML?.length || 0}`);
      
      if (!paperItem || !paperItem.innerHTML) {
        return {
          success: false,
          error: '论文项数据为空',
          index: index,
          parsedAt: new Date().toISOString()
        };
      }
      
      // 第一步：从论文项中提取第一个非pdf的链接, 实际上就是论文的链接
      let firstNonPdfLink = null;
      try {
        // 使用正则表达式提取所有链接
        const linkRegex = /<a[^>]+href\s*=\s*["']([^"']+)["'][^>]*>/gi;
        const links = [];
        let match;
        
        while ((match = linkRegex.exec(paperItem.innerHTML)) !== null) {
          const href = match[1];
          // 过滤掉相对链接、锚点链接和javascript链接
          if (href && !href.startsWith('#') && !href.startsWith('javascript:') && href.length > 1) {
            links.push(href);
          }
        }
        
        // 过滤掉pdf链接，找到第一个非pdf链接
        const nonPdfLinks = links.filter(link => {
          const lowerLink = link.toLowerCase();
          return !lowerLink.includes('.pdf') && 
                 !lowerLink.includes('pdf') &&
                 !lowerLink.includes('filetype:pdf');
        });
        
        firstNonPdfLink = nonPdfLinks.length > 0 ? nonPdfLinks[0] : null;
        
        logger.log(`[${this.handlerName}] 论文项 ${index} 提取到 ${links.length} 个链接，其中 ${nonPdfLinks.length} 个非pdf链接`);
        if (firstNonPdfLink) {
          logger.log(`[${this.handlerName}] 论文项 ${index} 第一个非pdf链接: ${firstNonPdfLink}`);
        }
        
      } catch (linkError) {
        logger.warn(`[${this.handlerName}] 论文项 ${index} 链接提取失败: ${linkError.message}`);
      }
      
      let paperHtml = null;
      let compressedContent = null;
      let parsedMetadata = null;
      let aiParseResult = { success: false };
      let permissionError = false;

      // 第二步：获取论文HTML内容，包含权限失败的回退处理
      if (firstNonPdfLink) {
        try {
          paperHtml = await httpService.getHtml(firstNonPdfLink);
          logger.log(`[${this.handlerName}] 论文项 ${index} 成功获取论文HTML，长度: ${paperHtml.length}`);
        } catch (htmlError) {
          // 检查是否是权限相关的错误
          const isPermissionError = htmlError.message.includes('无法获取访问权限') || 
                                  htmlError.message.includes('用户拒绝了授权请求') ||
                                  htmlError.message.includes('权限请求过程中发生错误');
          
          if (isPermissionError) {
            permissionError = true;
            logger.warn(`[${this.handlerName}] 论文项 ${index} 权限获取失败，将跳过该论文的详细内容提取: ${htmlError.message}`);
          } else {
            logger.warn(`[${this.handlerName}] 论文项 ${index} HTML获取失败: ${htmlError.message}`);
          }
        }
      } else {
        logger.warn(`[${this.handlerName}] 论文项 ${index} 未找到有效的非PDF链接`);
      }

      // 第三步：处理HTML内容（仅在成功获取时）
      if (paperHtml) {
        try {
          // 压缩论文项的HTML内容
          const textList = await htmlParserService.extractLargeTextBlocks(paperHtml, 150);
          logger.log(`[${this.handlerName}] 论文项 ${index} 提取到 ${textList.length} 个文本块`);
          
          // 对文本列表进行处理：添加序号和截断处理
          const processedTextList = textList.map((text, textIndex) => {
            // 添加序号
            const sequenceNumber = textIndex + 1;
            
            // 文本截断处理：前后50个字，中间加省略号
            let processedText = text;
            if (text.length > 400) {
              const firstPart = text.substring(0, 200);
              const lastPart = text.substring(text.length - 200,text.length);
              processedText = `${firstPart}...（中间信息已截断）...${lastPart}`;
            }
            
            return `${sequenceNumber}. ${processedText}`;
          });
        
        // 正确的方式：先await获取结果，再访问属性
        const extractResult = await aiService.extractAbstractFromTextList(processedTextList, paper.title);
        const abstract_list = extractResult.abstract_list;
        let abstract = "";
        if (abstract_list.length > 0) {
            for (const abstract_index of abstract_list) {
              abstract += textList[abstract_index - 1];
            }
        }else{
            logger.warn(`[${this.handlerName}] 论文项 ${paper.title} 未提取到摘要`);
        }
        logger.log(`[${this.handlerName}] 论文项 ${paper.title} 提取到摘要: ${abstract}`);
        return abstract;
        } catch (processError) {
          logger.warn(`[${this.handlerName}] 论文项 ${index} 内容处理失败: ${processError.message}`);
        }
      }

      return {
        success: !permissionError && (paperHtml !== null),
        index: index,
        firstNonPdfLink: firstNonPdfLink, // 第一个非pdf链接
        originalHtml: paperItem.innerHTML.substring(0, 500), // 保存前500字符
        compressedContent: compressedContent,
        aiParsedMetadata: parsedMetadata,
        aiParseSuccess: aiParseResult.success,
        permissionError: permissionError, // 标记是否为权限错误
        hasHtmlContent: paperHtml !== null,
        parsedAt: new Date().toISOString()
      };

    } catch (error) {
      logger.error(`[${this.handlerName}] 解析论文项 ${index} 时发生错误:`, error);
      return {
        success: false,
        error: error.message,
        index: index,
        firstNonPdfLink: firstNonPdfLink, // 第一个非pdf链接（如果在错误前提取到了）
        parsedAt: new Date().toISOString()
      };
    }
  }
}

export default AiExtractorTaskHandler; 