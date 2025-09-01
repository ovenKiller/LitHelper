/**
 * messageService.js
 *
 * 统一处理扩展内部消息的收发和分发
 */

import { logger } from '../../util/logger.js';
import { addRuntimeMessageListener, MessageActions, broadcastToAllTabs, sendToMatchingTabs } from '../../util/message.js';
import { paperBoxManager } from '../feature/paperBoxManager.js';
import { TaskService } from './taskService.js';
import { AiCrawlerTaskHandler } from './taskHandler/aiCrawlerTaskHandler.js';
import { AiExtractorTaskHandler } from './taskHandler/aiExtractorTaskHandler.js';
import { OrganizeTaskHandler } from './taskHandler/organizeTaskHandler.js';
import { Task } from '../../model/task.js';
import { paperMetadataService } from '../feature/paperMetadataService.js';
import { paperOrganizationService } from '../feature/paperOrganizationService.js';
import { AI_CRAWLER_SUPPORTED_TASK_TYPES, AI_EXTRACTOR_SUPPORTED_TASK_TYPES, ORGANIZE_SUPPORTED_TASK_TYPES } from '../../constants.js';
import { runTimeDataService } from '../../service/runTimeDataService.js';

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
    this.paperOrganizationService = paperOrganizationService;
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

      // 创建任务处理器
      this.aiCrawlerTaskHandler = new AiCrawlerTaskHandler();
      this.aiExtractorTaskHandler = new AiExtractorTaskHandler();
      this.organizeTaskHandler = new OrganizeTaskHandler();

      // 注册处理器
      this.taskService.registerHandler(AI_CRAWLER_SUPPORTED_TASK_TYPES.PAPER_ELEMENT_CRAWLER, this.aiCrawlerTaskHandler);
      this.taskService.registerHandler(AI_EXTRACTOR_SUPPORTED_TASK_TYPES.PAPER_METADATA_EXTRACTION, this.aiExtractorTaskHandler);
      this.taskService.registerHandler(ORGANIZE_SUPPORTED_TASK_TYPES.ORGANIZE_PAPER, this.organizeTaskHandler);

      // 启动任务服务
      await this.taskService.start();

      // 注入taskService到各服务中
      paperMetadataService.setTaskService(this.taskService);
      paperOrganizationService.setTaskService(this.taskService);

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
    handlers.set(MessageActions.CLEAR_PAPER_BOX, this.handleClearPaperBox.bind(this));

    // Task Service Actions
    handlers.set(MessageActions.ADD_TASK_TO_QUEUE, this.handleAddTaskToQueue.bind(this));
    handlers.set(MessageActions.CLEAR_ALL_TASK_DATA, this.handleClearAllTaskData.bind(this));
    handlers.set(MessageActions.GET_ACTIVE_TASKS_STATUS, this.handleGetActiveTasksStatus.bind(this));

    // Storage Service Actions
    handlers.set(MessageActions.CLEAR_ALL_CSS_SELECTORS, this.handleClearAllCssSelectors.bind(this));



    // Paper Metadata Service Actions
    handlers.set(MessageActions.PROCESS_PAPER_ELEMENT_LIST, this.handleProcessPaperElementList.bind(this));
    handlers.set(MessageActions.PROCESS_PAPERS, this.handleProcessPapers.bind(this));
    handlers.set(MessageActions.PAPER_PREPROCESSING_COMPLETED, this.handlePaperPreprocessingCompleted.bind(this));

    // Organize Service Actions
    handlers.set(MessageActions.ORGANIZE_PAPERS, this.handleOrganizePapers.bind(this));

    // System Actions
    handlers.set(MessageActions.OPEN_SETTINGS_SECTION, this.handleOpenSettingsSection.bind(this));
    handlers.set(MessageActions.OPEN_WORKING_DIRECTORY, this.handleOpenWorkingDirectory.bind(this));
    handlers.set(MessageActions.OPEN_FILE_DIRECTORY, this.handleOpenFileDirectory.bind(this));
    handlers.set(MessageActions.HEALTH_CHECK, this.handleHealthCheck.bind(this));
    handlers.set(MessageActions.PING, this.handlePing.bind(this));
    handlers.set(MessageActions.SHOW_DOWNLOAD_IN_FOLDER, this.handleShowDownloadInFolder.bind(this));

    // Setup the single listener with the handler map
    addRuntimeMessageListener(handlers);

    logger.log('[MessageService] Message listeners set up successfully');
  }


  /**
   * 处理获取论文盒数据消息
   */
  async handleGetPaperBoxData(data, sender, sendResponse) {
    try {
      // 确保服务已初始化
      if (!this.isInitialized) {
        logger.warn('[MessageService] Service not initialized yet, waiting...');
        // 等待初始化完成，最多等待5秒
        let waitTime = 0;
        const maxWait = 5000;
        const checkInterval = 100;

        while (!this.isInitialized && waitTime < maxWait) {
          await new Promise(resolve => setTimeout(resolve, checkInterval));
          waitTime += checkInterval;
        }

        if (!this.isInitialized) {
          logger.error('[MessageService] Service initialization timeout');
          sendResponse({ success: false, error: 'Service not ready' });
          return true;
        }
      }

      const papers = paperBoxManager.getPaperBox();
      logger.log(`[MessageService] Returning paper box data with ${Object.keys(papers).length} papers`);
      sendResponse({ success: true, papers });
    } catch (error) {
      logger.error('[MessageService] Failed to get paper box data:', error);
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }

  /**
   * 处理添加论文到盒子消息
   */
  async handleAddPaperToBox(data, sender, sendResponse) {
    try {
      // 从消息数据中提取 paper 对象
      const paper = data.paper || data;
      const result = await paperBoxManager.addPaper(paper);
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
   * 处理清空论文盒消息
   */
  async handleClearPaperBox(data, sender, sendResponse) {
    try {
      logger.log('[MessageService] 收到清空论文盒请求');
      const result = await paperBoxManager.clearAllPapers();
      logger.log('[MessageService] 论文盒清空结果:', result);
      sendResponse(result);
    } catch (error) {
      logger.error('[MessageService] Failed to clear paper box:', error);
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
   * 处理清除所有CSS选择器消息
   */
  async handleClearAllCssSelectors(data, sender, sendResponse) {
    try {
      logger.log('[MessageService] 收到清除所有CSS选择器请求');

      // 调用runTimeDataService的clearAllCssSelectors方法
      const result = await runTimeDataService.clearAllCssSelectors();

      if (result.success) {
        logger.log(`[MessageService] 成功清除所有CSS选择器: ${result.deletedCount} 个`);
        sendResponse({
          success: true,
          deletedCount: result.deletedCount,
          message: `成功清除 ${result.deletedCount} 个CSS选择器`
        });
      } else {
        logger.error('[MessageService] 清除CSS选择器失败:', result.error);
        sendResponse({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      logger.error('[MessageService] 处理清除CSS选择器消息时发生错误:', error);
      sendResponse({
        success: false,
        error: error.message || '清除CSS选择器失败'
      });
    }
    return true;
  }

  /**
   * 向所有标签页发送通知
   * @param {string} action - 消息动作
   * @param {Object} data - 要发送的数据
   * @param {string} source - 发送源标识（用于日志）
   */
  async notifyAllTabs(action, data, source = 'MessageService') {
    // 使用 message.js 中的抽象方法
    const result = await broadcastToAllTabs(action, data, source);

    if (result.success) {
      logger.log(`[${source}] 通知发送完成: ${result.successCount}/${result.totalTabs} 成功`);
    } else {
      logger.error(`[${source}] 发送通知失败:`, result.error);
    }

    return result;
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
    logger.log(`[MessageService] 准备发送任务完成通知: taskType=${taskType}, url=${url}, platform=${platform}, success=${success}`);

    // 构建通知数据
    const notificationData = {
      taskType,
      url,
      platform,
      success,
      timestamp: Date.now(),
      ...additionalData
    };

    // 使用 message.js 中的抽象方法发送到匹配的标签页
    const result = await sendToMatchingTabs(url, MessageActions.TASK_COMPLETION_NOTIFICATION, notificationData, 'MessageService');

    if (result.success) {
      if (result.matchingTabs.length > 0) {
        logger.log(`[MessageService] 任务完成通知发送完成: ${result.successCount}/${result.totalMatching} 成功`);
      } else {
        logger.warn(`[MessageService] 没有找到匹配URL的标签页: ${url}`);
      }
    } else {
      logger.error('[MessageService] 发送任务完成通知失败:', result.error);
    }

    return result;
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

  /**
   * 处理整理论文消息
   */
  async handleOrganizePapers(data, sender, sendResponse) {
    try {
      logger.log('[MessageService] 收到整理论文请求:', data);
      const { papers, options } = data || {};

      // 详细记录接收到的选项数据
      logger.log('[MessageService] 接收到的选项详情:', {
        downloadPdf: options?.downloadPdf,
        translation: options?.translation,
        classification: options?.classification,
        selectedPapers: options?.selectedPapers,
        totalPapers: options?.totalPapers
      });

      const result = await paperOrganizationService.organizePapers(papers, options);
      sendResponse({ success: result, message: result ? '整理论文任务已提交' : '整理论文任务提交失败' });
    } catch (error) {
      logger.error('[MessageService] 处理整理论文消息失败:', error);
      sendResponse({ success: false, error: error.message || '整理论文失败' });
    }
    return true;
  }





  /**
   * 处理打开设置页面特定部分消息
   */
  async handleOpenSettingsSection(data, sender, sendResponse) {
    try {
      const { section } = data || {};
      // 打开设置页面并跳转到指定部分
      const url = chrome.runtime.getURL('settings.html') + (section ? `#${section}` : '');
      await chrome.tabs.create({ url });
      sendResponse({ success: true });
    } catch (error) {
      logger.error('[MessageService] 打开设置页面失败:', error);
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }

  /**
   * 处理打开工作目录消息
   * 使用 chrome.downloads.search() + show() 方案直接定位到目录
   */
  async handleOpenWorkingDirectory(data, sender, sendResponse) {
    try {
      const { workingDirectory, taskDirectory } = data || {};
      logger.log('[MessageService] 请求打开工作目录:', { workingDirectory, taskDirectory });

      // 导入文件管理服务
      const { fileManagementService } = await import('../../service/fileManagementService.js');

      let result;
      // 优先尝试显示工作目录（LitHelperData），而不是具体任务目录
      // 这样用户可以看到整个工作目录的结构
      result = await fileManagementService.showWorkingDirectory();

      // 如果工作目录显示失败，且有任务目录，尝试显示任务目录
      if (!result.success && taskDirectory) {
        logger.log('[MessageService] 工作目录显示失败，尝试显示任务目录');
        result = await fileManagementService.showTaskDirectory(taskDirectory);
      }

      if (result.success) {
        sendResponse({
          success: true,
          message: result.message,
          filename: result.filename,
          downloadId: result.downloadId
        });
      } else {
        // 如果失败，提供降级方案
        sendResponse({
          success: false,
          error: result.error,
          message: `无法定位到目录，建议手动在下载文件夹中查找 ${workingDirectory || 'LitHelperData'} 目录`
        });
      }
    } catch (error) {
      logger.error('[MessageService] 打开工作目录失败:', error);
      sendResponse({
        success: false,
        error: error.message,
        message: '无法打开工作目录，请手动在下载文件夹中查找相关文件'
      });
    }
    return true;
  }

  /**
   * 处理打开指定文件所在目录消息
   */
  async handleOpenFileDirectory(data, sender, sendResponse) {
    try {
      const { filePath } = data || {};
      logger.log('[MessageService] 请求打开文件所在目录:', filePath);

      if (!filePath) {
        throw new Error('缺少文件路径');
      }

      // 导入文件管理服务
      const { fileManagementService } = await import('../../service/fileManagementService.js');

      // 从文件路径中提取目录路径
      const directoryPath = filePath.substring(0, filePath.lastIndexOf('/'));

      let result;
      if (directoryPath.includes('/')) {
        // 如果是子目录，尝试显示具体目录
        const taskDirectory = directoryPath.split('/').pop();
        result = await fileManagementService.showTaskDirectory(taskDirectory);
      } else {
        // 如果是根目录，显示工作目录
        result = await fileManagementService.showWorkingDirectory();
      }

      if (result.success) {
        sendResponse({
          success: true,
          message: result.message,
          filename: result.filename,
          downloadId: result.downloadId
        });
      } else {
        // 如果失败，提供降级方案
        sendResponse({
          success: false,
          error: result.error,
          message: `无法定位到目录，建议手动在下载文件夹中查找相关文件`
        });
      }
    } catch (error) {
      logger.error('[MessageService] 打开文件目录失败:', error);
      sendResponse({
        success: false,
        error: error.message,
        message: '无法打开文件目录，请手动在下载文件夹中查找相关文件'
      });
    }
    return true;
  }

  /**
   * 处理在文件管理器中显示下载文件消息
   */
  async handleShowDownloadInFolder(data, sender, sendResponse) {
    try {
      const { downloadId } = data || {};
      logger.log('[MessageService] 请求显示下载文件:', downloadId);

      if (!downloadId) {
        throw new Error('缺少下载ID');
      }

      // 导入downloadService
      const { downloadService } = await import('../util/downloadService.js');

      // 在文件管理器中显示文件
      const result = await downloadService.showDownloadInFolder(downloadId);

      sendResponse(result);
    } catch (error) {
      logger.error('[MessageService] 显示下载文件失败:', error);
      sendResponse({
        success: false,
        error: error.message
      });
    }
    return true;
  }

  /**
   * 处理健康检查消息
   */
  async handleHealthCheck(data, sender, sendResponse) {
    try {
      const isReady = this.isInitialized &&
                      this.taskService &&
                      this.taskService.isStarted;

      logger.log('[MessageService] 健康检查请求，服务状态:', {
        isInitialized: this.isInitialized,
        hasTaskService: !!this.taskService,
        taskServiceStarted: this.taskService?.isStarted || false
      });

      sendResponse({
        success: isReady,
        timestamp: Date.now(),
        services: {
          messageService: this.isInitialized,
          taskService: !!this.taskService,
          taskServiceStarted: this.taskService?.isStarted || false
        }
      });
    } catch (error) {
      logger.error('[MessageService] 健康检查失败:', error);
      sendResponse({
        success: false,
        error: error.message,
        timestamp: Date.now()
      });
    }
    return true;
  }

  /**
   * 处理PING消息（用于激活Service Worker）
   */
  async handlePing(data, sender, sendResponse) {
    logger.log('[MessageService] 收到PING消息，Service Worker已激活');
    sendResponse({
      success: true,
      timestamp: Date.now(),
      message: 'Service Worker active'
    });
    return true;
  }

  /**
   * 处理获取活跃任务状态消息
   */
  async handleGetActiveTasksStatus(data, sender, sendResponse) {
    try {
      // 确保服务已初始化
      if (!this.isInitialized) {
        await this.initialize();
      }

      // 调试信息
      logger.log(`[MessageService] 检查 paperOrganizationService:`, {
        exists: !!this.paperOrganizationService,
        hasMethod: !!this.paperOrganizationService?.getActiveTasksStatus
      });

      // 从 paperOrganizationService 获取状态
      const statusInfo = this.paperOrganizationService.getActiveTasksStatus();

      logger.log(`[MessageService] 返回任务状态:`, statusInfo);

      sendResponse({
        success: true,
        data: statusInfo
      });
    } catch (error) {
      logger.error('[MessageService] 获取任务状态失败:', error);
      sendResponse({
        success: false,
        error: error.message
      });
    }
    return true;
  }
}

// 创建单例实例
export const messageService = new MessageService();