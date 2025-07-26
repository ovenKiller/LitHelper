/**
 * controller.js
 * 
 * 设置页面的控制器。
 * 负责协调View和ConfigService，处理所有业务逻辑。
 */
import { View } from './view.js';
import { configService } from './configService.js';
import aiService from '../service/aiService.js';
import { logger } from '../util/logger.js';

export class Controller {
  constructor() {
    this.view = new View();
    this.configService = configService;
    this.aiService = aiService;
  }

  async init() {
    await this.configService.getConfig(); // Ensure config is loaded
    this.setupEventListeners();
    await this.renderPage();
  }

  async renderPage() {
    const config = await this.configService.getConfig();
    this.view.render(config);
  }

  setupEventListeners() {
    this.view.bindModelSettingsChange(this.handleModelSettingsChange.bind(this));
    this.view.bindModelAction(this.handleModelAction.bind(this));
    this.view.bindAddModel(this.handleAddModel.bind(this));
    this.view.bindDefaultModelChange(this.handleDefaultModelChange.bind(this));
    this.view.bindResetSettings(this.handleResetSettings.bind(this));
    this.view.bindSaveSettings(this.handleSaveSettings.bind(this));
  }
  
  // --- Event Handlers ---

  async handleModelSettingsChange(index, updates) {
    try {
        // Special handling for the 'active' checkbox
        if (updates.active !== undefined) {
            await this.configService.toggleModelActive(index, updates.active);
        } else {
            await this.configService.updateModel(index, updates);
        }
        await this.configService.saveConfig();
        await this.renderPage(); // Re-render to update dependent parts like the default model selector
        this.view.showSaveStatus('Settings saved successfully!');
    } catch (error) {
        logger.error('Failed to update model settings:', error);
        this.view.showSaveStatus('Failed to save settings.', false);
    }
  }

  async handleModelAction(action, index) {
    switch (action) {
      case 'delete':
        if (confirm('Are you sure you want to delete this model?')) {
          await this.configService.deleteModel(index);
          await this.renderPage();
          this.view.showSaveStatus('Model deleted successfully!');
        }
        break;
      case 'test':
        await this.handleModelTest(index);
        break;
      default:
        logger.warn('Unknown model action:', action);
    }
  }

  /**
   * 处理模型测试
   * @param {number} index - 模型在配置中的索引
   */
  async handleModelTest(index) {
    try {
      // 显示测试开始状态
      this.view.showTestStatus(index, 'testing', '正在测试连接...');
      
      // 调用AI服务进行测试
      const testResult = await this.aiService.testModelConnection(index);
      
      // 根据测试结果更新UI
      if (testResult.success) {
        this.view.showTestStatus(index, 'success', testResult.message, testResult.data);
        logger.log(`Model ${index} test successful:`, testResult.message);
      } else {
        this.view.showTestStatus(index, 'error', testResult.message);
        logger.warn(`Model ${index} test failed:`, testResult.message);
      }
    } catch (error) {
      // 处理意外错误
      const errorMessage = `测试过程中发生错误: ${error.message}`;
      this.view.showTestStatus(index, 'error', errorMessage);
      logger.error('Model test error:', error);
    }
  }

  async handleAddModel(modelData) {
    try {
      await this.configService.addCustomModel(modelData);
      await this.renderPage();
      this.view.showSaveStatus('Custom model added successfully!');
    } catch (error) {
      logger.error('Failed to add custom model:', error);
      this.view.showSaveStatus('Failed to add model.', false);
    }
  }

  async handleDefaultModelChange(modelName) {
    try {
      await this.configService.setSelectedAiModelName(modelName);
      this.view.showSaveStatus('Default model updated!');
    } catch (error) {
      logger.error('Failed to set default model:', error);
      this.view.showSaveStatus('Failed to update default model.', false);
    }
  }

  async handleResetSettings() {
    try {
      await this.configService.resetConfig();
      await this.renderPage();
      this.view.showSaveStatus('Settings have been reset to default.');
    } catch (error) {
      logger.error('Failed to reset settings:', error);
      this.view.showSaveStatus('Failed to reset settings.', false);
    }
  }

  async handleSaveSettings() {
    try {
      await this.configService.saveConfig();
      this.view.showSaveStatus('所有设置已成功保存！');
      logger.log('Settings saved successfully');
    } catch (error) {
      logger.error('Failed to save settings:', error);
      this.view.showSaveStatus('保存设置失败，请重试。', false);
    }
  }
} 