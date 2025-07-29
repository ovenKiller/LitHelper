/**
 * messageService.js
 * 
 * 统一处理扩展内部消息的收发和分发
 */

import { logger } from '../../util/logger.js';
import { addRuntimeMessageListener, MessageActions, sendMessageToContentScript } from '../../util/message.js';
import { configService } from '../../service/configService.js';
import { paperBoxManager } from '../feature/paperBoxManager.js';
import { summarizationHandler } from '../feature/summarizationHandler.js';
import { TaskService } from './taskService.js';
import { AiCrawlerTaskHandler } from './taskHandler/aiCrawlerTaskHandler.js';
import { AiExtractorTaskHandler } from './taskHandler/aiExtractorTaskHandler.js';
import { Task } from '../../model/task.js';
import { paperMetadataService } from '../feature/paperMetadataService.js';
import { AI_CRAWLER_SUPPORTED_TASK_TYPES, AI_EXTRACTOR_SUPPORTED_TASK_TYPES } from '../../constants.js';
import { runTimeDataService } from '../../service/runTimeDataService.js';
import { httpService } from './httpService.js';

/**
 * 消息服务类
 * 负责管理所有消息的监听和分发
 */
export class MessageService {
  constructor() {
    this.isInitialized = false;
    this.taskService = null;
    this.aiCrawlerTaskHandler = null;
    this.aiExtractorTaskHandler = null;
  }

  /**
   * 初始化消息服务
   */
  async initialize() {
    if (this.isInitialized) {
      logger.warn('[MessageService] Already initialized');
      return;
    }

    try {
      logger.log('[MessageService] Initializing message service...');
      
      // 初始化任务服务
      await this.initializeTaskService();
      
      // 设置消息监听器
      this.setupMessageListeners();
      
      this.isInitialized = true;
      logger.log('[MessageService] Message service initialized successfully');
    } catch (error) {
      logger.error('[MessageService] Failed to initialize message service:', error);
      throw error;
    }
  }

  /**
   * 初始化任务服务
   */
  async initializeTaskService() {
    try {
      // 创建任务服务实例
      this.taskService = new TaskService();
      
      // 创建AI爬虫任务处理器
      this.aiCrawlerTaskHandler = new AiCrawlerTaskHandler();
      this.aiExtractorTaskHandler = new AiExtractorTaskHandler();
      
      // 注册处理器
      this.taskService.registerHandler(AI_CRAWLER_SUPPORTED_TASK_TYPES.PAPER_ELEMENT_CRAWLER, this.aiCrawlerTaskHandler);
      this.taskService.registerHandler(AI_EXTRACTOR_SUPPORTED_TASK_TYPES.PAPER_METADATA_EXTRACTION, this.aiExtractorTaskHandler);
      
      // 启动任务服务
      await this.taskService.start();
      
      // 注入taskService到paperMetadataService中
      paperMetadataService.setTaskService(this.taskService);
      
      logger.log('[MessageService] Task service initialized successfully');
    } catch (error) {
      logger.error('[MessageService] Failed to initialize task service:', error);
      throw error;
    }
  }

  /**
   * 设置消息监听器
   */
  setupMessageListeners() {
    const handlers = new Map();
    
    
    // PaperBox Manager Actions
    handlers.set(MessageActions.GET_PAPER_BOX_DATA, this.handleGetPaperBoxData.bind(this));
    handlers.set(MessageActions.ADD_PAPER_TO_BOX, this.handleAddPaperToBox.bind(this));
    handlers.set(MessageActions.REMOVE_PAPER_FROM_BOX, this.handleRemovePaperFromBox.bind(this));
    
    // Summarization Handler Actions
    handlers.set(MessageActions.SUMMARIZE_PAPER, this.handleSummarizePaper.bind(this));
    handlers.set(MessageActions.GET_ALL_SUMMARIES, this.handleGetAllSummaries.bind(this));
    
    // Task Service Actions
    handlers.set(MessageActions.ADD_TASK_TO_QUEUE, this.handleAddTaskToQueue.bind(this));
    handlers.set(MessageActions.CLEAR_ALL_TASK_DATA, this.handleClearAllTaskData.bind(this));
    

    
    // Paper Metadata Service Actions
    handlers.set(MessageActions.PROCESS_PAPER_ELEMENT_LIST, this.handleProcessPaperElementList.bind(this));
    handlers.set(MessageActions.PROCESS_PAPERS, this.handleProcessPapers.bind(this));
    handlers.set(MessageActions.PAPER_PREPROCESSING_COMPLETED, this.handlePaperPreprocessingCompleted.bind(this));
    
    // Setup the single listener with the handler map
    addRuntimeMessageListener(handlers);
    
    logger.log('[MessageService] Message listeners set up successfully');
  }


  /**
   * 处理获取论文盒数据消息
   */
  async handleGetPaperBoxData(data, sender, sendResponse) {
    // try {
    //   const papers = await paperBoxManager.getAllPapers();
    //   sendResponse({ success: true, papers });
    // } catch (error) {
    //   logger.error('[MessageService] Failed to get paper box data:', error);
    //   sendResponse({ success: false, error: error.message });
    // }
    // return true;
    return true;
  }

  /**
   * 处理添加论文到盒子消息
   */
  async handleAddPaperToBox(data, sender, sendResponse) {
    try {
      const result = await paperBoxManager.addPaper(data);
      sendResponse(result);
    } catch (error) {
      logger.error('[MessageService] Failed to add paper to box:', error);
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }

  /**
   * 处理从盒子移除论文消息
   */
  async handleRemovePaperFromBox(data, sender, sendResponse) {
    try {
      const result = await paperBoxManager.removePaper(data.paperId);
      sendResponse(result);
    } catch (error) {
      logger.error('[MessageService] Failed to remove paper from box:', error);
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }

  /**
   * 处理总结论文消息
   */
  async handleSummarizePaper(data, sender, sendResponse) {
    try {
      const result = await summarizationHandler.summarizePaper(data.paper, data.options);
      sendResponse(result);
    } catch (error) {
      logger.error('[MessageService] Failed to summarize paper:', error);
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }

  /**
   * 处理获取所有摘要消息
   */
  async handleGetAllSummaries(data, sender, sendResponse) {
    try {
      const summaries = await summarizationHandler.getAllSummaries();
      sendResponse({ success: true, summaries });
    } catch (error) {
      logger.error('[MessageService] Failed to get all summaries:', error);
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }

  /**
   * 处理添加任务到队列消息
   */
  async handleAddTaskToQueue(data, sender, sendResponse) {
    try {
      if (!this.taskService) {
        throw new Error('TaskService not initialized');
      }

      const { taskKey, taskType, taskParams } = data;
      
      // 创建任务对象
      const task = new Task(taskKey, taskType, taskParams);
      
      // 添加到任务队列 - 移除不必要的await，因为TaskService.addTask是同步的
      // 但handler.addTask可能是异步的，所以需要等待返回的Promise
      const addedTask = this.taskService.addTask(task);
      
      // 如果返回的是Promise，等待它完成
      if (addedTask && typeof addedTask.then === 'function') {
        await addedTask;
      }
      
      logger.log(`[MessageService] Task added to queue: ${taskKey}`);
      
      sendResponse({
        success: true,
        message: '任务已添加到队列',
        taskKey: taskKey
      });
    } catch (error) {
      logger.error('[MessageService] Failed to add task to queue:', error);
      sendResponse({
        success: false,
        error: error.message || '添加任务失败'
      });
    }
    return true;
  }

  /**
   * 处理清除所有任务数据消息
   */
  async handleClearAllTaskData(data, sender, sendResponse) {
    try {
      logger.log('[MessageService] 收到清除所有任务数据请求');
      
      // 调用runTimeDataService清除所有任务数据
      const result = await runTimeDataService.clearAllTaskData();
      
      if (result.success) {
        logger.log('[MessageService] 成功清除所有任务数据:', result.statistics);
        sendResponse({
          success: true,
          statistics: result.statistics,
          message: result.message
        });
      } else {
        logger.error('[MessageService] 清除任务数据失败:', result.error);
        sendResponse({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      logger.error('[MessageService] 处理清除任务数据消息时发生错误:', error);
      sendResponse({
        success: false,
        error: error.message || '清除任务数据失败'
      });
    }
    return true;
  }


  /**
   * 发送任务完成通知给前台
   * @param {string} taskType - 任务类型
   * @param {string} url - 任务相关的URL
   * @param {string} platform - 平台标识
   * @param {boolean} success - 任务是否成功
   * @param {Object} additionalData - 附加数据
   */
  async sendTaskCompletionNotification(taskType, url, platform, success, additionalData = {}) {
    try {
      logger.log(`[MessageService] 准备发送任务完成通知: taskType=${taskType}, url=${url}, platform=${platform}, success=${success}`);
      
      // 获取所有标签页
      const tabs = await chrome.tabs.query({});
      logger.log(`[MessageService] 找到 ${tabs.length} 个标签页`);
      
      // 查找匹配URL的标签页
      const matchingTabs = tabs.filter(tab => {
        if (!tab.url) {
          logger.log(`[MessageService] 标签页 ${tab.id} 没有URL，跳过`);
          return false;
        }
        
        try {
          const tabUrl = new URL(tab.url);
          const targetUrl = new URL(url);
          
          logger.log(`[MessageService] 标签页 ${tab.id}: ${tabUrl.hostname}${tabUrl.pathname} vs 目标: ${targetUrl.hostname}${targetUrl.pathname}`);
          
          // 比较域名和路径（忽略查询参数和锚点）
          const matches = tabUrl.hostname === targetUrl.hostname && 
                         tabUrl.pathname === targetUrl.pathname;
          
          if (matches) {
            logger.log(`[MessageService] 标签页 ${tab.id} URL匹配成功`);
          }
          
          return matches;
        } catch (error) {
          logger.error(`[MessageService] 标签页 ${tab.id} URL解析错误:`, error);
          return false;
        }
      });

      logger.log(`[MessageService] 找到 ${matchingTabs.length} 个匹配的标签页`);

      const notificationData = {
        taskType,
        url,
        platform,
        success,
        timestamp: Date.now(),
        ...additionalData
      };

      // 向匹配的标签页发送通知
      for (const tab of matchingTabs) {
        try {
          logger.log(`[MessageService] 正在向标签页 ${tab.id} 发送通知...`);
          await sendMessageToContentScript(tab.id, MessageActions.TASK_COMPLETION_NOTIFICATION, notificationData);
          logger.log(`[MessageService] 标签页 ${tab.id} 通知发送成功`);
        } catch (error) {
          logger.error(`[MessageService] 向标签页 ${tab.id} 发送通知失败:`, error);
        }
      }

      if (matchingTabs.length === 0) {
        logger.warn(`[MessageService] 没有找到匹配URL的标签页: ${url}`);
        logger.log(`[MessageService] 所有标签页URL列表:`);
        tabs.forEach(tab => {
          if (tab.url) {
            logger.log(`  - 标签页 ${tab.id}: ${tab.url}`);
          }
        });
      }

    } catch (error) {
      logger.error('[MessageService] 发送任务完成通知失败:', error);
    }
  }

  /**
   * 处理论文元素列表处理消息
   */
  async handleProcessPaperElementList(data, sender, sendResponse) {
    try {
      logger.log('[MessageService] Received paper data processing request:', data);
      
      const { sourceDomain, pageType, papers } = data;
      
      // 调用论文元数据服务处理论文对象列表
      const result = await paperMetadataService.processPapers(
        sourceDomain, 
        pageType, 
        papers
      );
      
      sendResponse({
        success: result,
        message: result ? '论文数据处理成功' : '论文数据处理失败'
      });
      
    } catch (error) {
      logger.error('[MessageService] Failed to process paper data:', error);
      sendResponse({ 
        success: false, 
        error: error.message || '处理论文数据时发生未知错误'
      });
    }
    return true;
  }

  /**
   * 处理论文列表处理消息
   */
  async handleProcessPapers(data, sender, sendResponse) {
    try {
      logger.log('[MessageService] 收到处理论文列表请求:', data);
      
      const { sourceDomain, pageType, papers } = data;
      
      // 添加详细的调试信息
      logger.log('[MessageService] 请求详情:', {
        sourceDomain,
        pageType,
        papersCount: papers?.length || 0,
        paperMetadataServiceAvailable: !!paperMetadataService,
        taskServiceInjected: !!paperMetadataService?.taskService
      });
      
      // 调用论文元数据服务处理论文对象列表
      const result = await paperMetadataService.processPapers(
        sourceDomain, 
        pageType, 
        papers
      );
      
      logger.log('[MessageService] 论文处理结果:', { result });
      
      sendResponse({
        success: result,
        message: result ? '论文列表处理成功' : '论文列表处理失败'
      });
      
    } catch (error) {
      logger.error('[MessageService] 处理论文列表失败:', error);
      sendResponse({ 
        success: false, 
        error: error.message || '处理论文列表时发生未知错误'
      });
    }
    return true;
  }

  /**
   * 处理论文预处理完成消息
   */
  async handlePaperPreprocessingCompleted(data, sender, sendResponse) {
    try {
      logger.log('[MessageService] 收到论文预处理完成通知:', data);
      
      // 调用paperMetadataService处理预处理完成事件
      const result = await paperMetadataService.handlePaperPreprocessingCompleted(data);
      
      if (result) {
        logger.log('[MessageService] 论文预处理完成事件处理成功');
        sendResponse({ success: true, message: '论文预处理完成事件处理成功' });
      } else {
        logger.error('[MessageService] 论文预处理完成事件处理失败');
        sendResponse({ success: false, error: '论文预处理完成事件处理失败' });
      }
      
    } catch (error) {
      logger.error('[MessageService] 处理论文预处理完成消息失败:', error);
      sendResponse({ success: false, error: error.message || '处理论文预处理完成失败' });
    }
    return true;
  }
}

// 创建单例实例
export const messageService = new MessageService(); 