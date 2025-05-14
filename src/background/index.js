/**
 * index.js
 * 
 * 扩展后台服务的入口文件，初始化各个服务
 */

import { ConfigManager } from './config/config-manager.js';
import { PaperService } from './services/paper-service.js';
import { SummaryService } from './services/summary-service.js';
import { DownloadService } from './services/download-service.js';
import { MessageRouter } from './messaging/message-router.js';
import { setupMessageHandlers } from './messaging/handlers/index.js';
import { StorageService } from '../utils/storage.js';
import { LLMService } from '../api/llm/llm-service.js';

// 初始化服务
const init = async () => {
  console.log('Research Summarizer 后台服务初始化中...');
  
  // 初始化配置管理器
  const configManager = new ConfigManager();
  await configManager.loadConfig();
  
  // 初始化存储服务
  const storageService = new StorageService();
  
  // 初始化API服务
  const llmService = new LLMService(configManager);
  
  // 初始化核心服务
  const paperService = new PaperService(storageService);
  const summaryService = new SummaryService(storageService, llmService, configManager);
  const downloadService = new DownloadService(storageService);
  
  // 初始化消息路由
  const messageRouter = new MessageRouter();
  setupMessageHandlers(
    messageRouter, 
    configManager, 
    paperService, 
    summaryService, 
    downloadService
  );
  
  // 监听扩展安装或更新事件
  chrome.runtime.onInstalled.addListener(async (details) => {
    console.log('扩展已安装/更新:', details.reason);
    
    // 第一次安装时显示欢迎页面或设置
    if (details.reason === 'install') {
      // chrome.tabs.create({ url: 'public/welcome.html' });
      console.log('扩展首次安装，可以在这里显示欢迎页面');
    }
  });
  
  console.log('Research Summarizer 后台服务已启动');
};

// 启动后台服务
init(); 