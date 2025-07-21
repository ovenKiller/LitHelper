/**
 * messageService.js
 * 
 * 统一处理扩展内部消息的收发和分发
 */

import { logger } from '../../util/logger.js';
import { addRuntimeMessageListener, MessageActions, sendMessageToContentScript } from '../../util/message.js';
import { configService } from '../../option/configService.js';
import { paperBoxManager } from '../feature/paperBoxManager.js';
import { summarizationHandler } from '../feature/summarizationHandler.js';
import { TaskService } from './taskService.js';
import { AiCrawlerTaskHandler } from './taskHandler/aiCrawlerTaskHandler.js';
import { Task } from '../../model/task.js';

/**
 * 消息服务类
 * 负责管理所有消息的监听和分发
 */
export class MessageService {
  constructor() {
    this.isInitialized = false;
    this.taskService = null;
    this.aiCrawlerTaskHandler = null;
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
      
      // 注册处理器
      this.taskService.registerHandler('paper_element_crawler', this.aiCrawlerTaskHandler);
      
      // 启动任务服务
      await this.taskService.start();
      
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
    
    // Config Service Actions
    handlers.set(MessageActions.GET_CONFIG, this.handleGetConfig.bind(this));
    
    // PaperBox Manager Actions
    handlers.set(MessageActions.GET_PAPER_BOX_DATA, this.handleGetPaperBoxData.bind(this));
    handlers.set(MessageActions.ADD_PAPER_TO_BOX, this.handleAddPaperToBox.bind(this));
    handlers.set(MessageActions.REMOVE_PAPER_FROM_BOX, this.handleRemovePaperFromBox.bind(this));
    
    // Summarization Handler Actions
    handlers.set(MessageActions.SUMMARIZE_PAPER, this.handleSummarizePaper.bind(this));
    handlers.set(MessageActions.GET_ALL_SUMMARIES, this.handleGetAllSummaries.bind(this));
    
    // Task Service Actions
    handlers.set(MessageActions.ADD_TASK_TO_QUEUE, this.handleAddTaskToQueue.bind(this));
    
    // Setup the single listener with the handler map
    addRuntimeMessageListener(handlers);
    
    logger.log('[MessageService] Message listeners set up successfully');
  }

  /**
   * 处理获取配置消息
   */
  async handleGetConfig(data, sender, sendResponse) {
    try {
      const config = await configService.getConfig();
      sendResponse(config);
    } catch (error) {
      logger.error('[MessageService] Failed to get config:', error);
      sendResponse({ success: false, error: error.message });
    }
    return true;
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
      
      // 添加到任务队列
      await this.taskService.addTask(task);
      
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
   * 获取任务服务状态
   */
  getTaskServiceStatus() {
    if (!this.taskService) {
      return { initialized: false };
    }
    
    return {
      initialized: true,
      status: this.taskService.getStatus(),
      queueInfo: this.taskService.getQueueInfo()
    };
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
      // 获取所有标签页
      const tabs = await chrome.tabs.query({});
      
      // 查找匹配URL的标签页
      const matchingTabs = tabs.filter(tab => {
        if (!tab.url) return false;
        
        try {
          const tabUrl = new URL(tab.url);
          const targetUrl = new URL(url);
          
          // 比较域名和路径（忽略查询参数和锚点）
          return tabUrl.hostname === targetUrl.hostname && 
                 tabUrl.pathname === targetUrl.pathname;
        } catch (error) {
          logger.error('[MessageService] URL parsing error:', error);
          return false;
        }
      });

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
          await sendMessageToContentScript(tab.id, MessageActions.TASK_COMPLETION_NOTIFICATION, notificationData);
          logger.log(`[MessageService] Task completion notification sent to tab ${tab.id}`);
        } catch (error) {
          logger.error(`[MessageService] Failed to send notification to tab ${tab.id}:`, error);
        }
      }

      if (matchingTabs.length === 0) {
        logger.warn(`[MessageService] No matching tabs found for URL: ${url}`);
      }

    } catch (error) {
      logger.error('[MessageService] Failed to send task completion notification:', error);
    }
  }

  /**
   * 销毁消息服务
   */
  async destroy() {
    if (!this.isInitialized) {
      return;
    }

    try {
      // 停止任务服务
      if (this.taskService) {
        await this.taskService.stop();
      }
      
      this.isInitialized = false;
      logger.log('[MessageService] Message service destroyed');
    } catch (error) {
      logger.error('[MessageService] Failed to destroy message service:', error);
    }
  }
}

// 创建单例实例
export const messageService = new MessageService(); 