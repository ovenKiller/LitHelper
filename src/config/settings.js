/**
 * settings.js
 * 
 * 设置页面的交互逻辑
 */

import Config from './config';
import llmServiceInstance from '../services/llmService';
import ModelView from './ModelView';

class SettingsController {
  constructor() {
    // 配置实例
    this.config = Config;
    this.currentConfig = null;
    
    // 视图实例
    this.modelView = new ModelView();
    
    // 模型相关元素
    this.modelCardsContainer = document.getElementById('model-cards-container');
    this.defaultModelSelect = document.getElementById('default-ai-model');
    this.addCustomModelBtn = document.getElementById('add-custom-model');
    
    // 摘要相关元素
    this.summaryCategories = document.getElementById('summary-categories');
    this.maxPapersInput = document.getElementById('max-papers');
    this.includeAbstractCheck = document.getElementById('include-abstract');
    this.includeCitationsCheck = document.getElementById('include-citations');
    
    // 操作按钮
    this.saveSettingsBtn = document.getElementById('save-settings');
    this.resetDefaultsBtn = document.getElementById('reset-defaults');
    
    // 导航元素
    this.navItems = document.querySelectorAll('.nav-item');
    
    // 状态信息元素
    this.statusMessage = document.getElementById('status-message');
    
    // 自定义模型模态框
    this.customModelModal = document.getElementById('custom-model-modal');
    this.modelNameInput = document.getElementById('model-name');
    this.modelApiKeyInput = document.getElementById('model-api-key');
    this.modelApiUrlInput = document.getElementById('model-api-url');
    this.modelAvailableModelsInput = document.getElementById('model-available-models');
    this.modelDefaultModelSelect = document.getElementById('model-default-model');
    this.modelMaxTokensInput = document.getElementById('model-max-tokens');
    this.modelTemperatureInput = document.getElementById('model-temperature');
    this.temperatureValueSpan = document.getElementById('temperature-value');
    this.modelActiveCheck = document.getElementById('model-active');
    this.modalCloseBtn = document.getElementById('modal-close');
    this.modalCancelBtn = document.getElementById('modal-cancel');
    this.modalAddBtn = document.getElementById('modal-add');
    
    // 确认删除模态框
    this.confirmDeleteModal = document.getElementById('confirm-delete-modal');
    this.deleteModelNameSpan = document.getElementById('delete-model-name');
    this.deleteModalCloseBtn = document.getElementById('delete-modal-close');
    this.deleteModalCancelBtn = document.getElementById('delete-modal-cancel');
    this.deleteModalConfirmBtn = document.getElementById('delete-modal-confirm');
    
    // 模型删除的临时数据
    this.modelToDelete = null;
  }
  
  /**
   * 初始化
   */
  async init() {
    try {
      // 初始化配置
      await this.config.init();
      this.currentConfig = this.config.getConfig();
      
      // 设置事件监听器
      this.setupEventListeners();
      
      // 加载配置到UI
      this.loadConfigToUI();
    } catch (error) {
      console.error('初始化设置页面失败:', error);
      this.showStatus(false, '加载设置失败：' + error.message);
    }
  }
  
  /**
   * 设置所有事件监听器
   */
  setupEventListeners() {
    // 导航切换
    this.navItems.forEach(item => {
      item.addEventListener('click', () => {
        const section = item.getAttribute('data-section');
        this.switchSection(section);
      });
    });
    
    // 保存设置
    this.saveSettingsBtn.addEventListener('click', () => this.saveSettings());
    
    // 重置设置
    this.resetDefaultsBtn.addEventListener('click', () => this.confirmResetSettings());
    
    // 添加自定义模型按钮
    this.addCustomModelBtn.addEventListener('click', () => this.openAddModelModal());
    
    // 模态框关闭按钮
    this.modalCloseBtn.addEventListener('click', () => this.closeAddModelModal());
    this.modalCancelBtn.addEventListener('click', () => this.closeAddModelModal());
    
    // 温度滑块实时更新显示值
    this.modelTemperatureInput.addEventListener('input', () => {
      this.temperatureValueSpan.textContent = this.modelTemperatureInput.value;
    });
    
    // 可用模型输入框变化时更新默认模型下拉列表
    this.modelAvailableModelsInput.addEventListener('input', () => {
      this.updateDefaultModelOptions();
    });
    
    // 添加模型按钮
    this.modalAddBtn.addEventListener('click', () => this.addCustomModel());
    
    // 删除模态框按钮
    this.deleteModalCloseBtn.addEventListener('click', () => this.closeDeleteModal());
    this.deleteModalCancelBtn.addEventListener('click', () => this.closeDeleteModal());
    this.deleteModalConfirmBtn.addEventListener('click', () => this.deleteModel());
  }
  
  /**
   * 切换设置区域
   * @param {string} section - 区域ID
   */
  switchSection(section) {
    // 移除所有导航项的active类
    this.navItems.forEach(item => item.classList.remove('active'));
    
    // 给当前选中的导航项添加active类
    document.querySelector(`.nav-item[data-section="${section}"]`).classList.add('active');
    
    // 移除所有内容区域的active类
    document.querySelectorAll('.section').forEach(el => el.classList.remove('active'));
    
    // 给当前内容区域添加active类
    document.getElementById(section).classList.add('active');
  }
  
  /**
   * 将配置加载到UI
   */
  loadConfigToUI() {
    // 加载AI模型
    this.loadAiModels();
    
    // 加载选中的默认模型
    if (this.currentConfig.selectedAiModel) {
      this.defaultModelSelect.value = this.currentConfig.selectedAiModel;
    }
    
    // 加载摘要设置
    this.loadSummarizationSettings();
  }
  
  /**
   * 加载AI模型到UI
   */
  loadAiModels() {
    // 清空模型容器
    this.modelCardsContainer.innerHTML = '';
    
    // 遍历所有模型
    if (this.currentConfig.aiModels && Array.isArray(this.currentConfig.aiModels)) {
      this.currentConfig.aiModels.forEach((model, index) => {
        // 创建模型卡片，使用ModelView类
        const modelCard = this.modelView.createModelCard(model, index, {
          onDeleteClick: (model, index) => this.confirmDeleteModel(model, index),
          onToggleChange: (index, checked) => {
            // 更新模型的激活状态
            this.currentConfig.aiModels[index].active = checked;
            // 立即更新默认模型选择器
            this.updateDefaultModelSelector();
          },
          onFieldChange: (index, fieldName, value) => {
            // 更新模型字段
            this.currentConfig.aiModels[index][fieldName] = value;
          },
          onTestConnection: async (index) => {
            return await this.testModelConnection(index);
          }
        });
        
        this.modelCardsContainer.appendChild(modelCard);
      });
    }
    
    // 更新默认模型选择器
    this.updateDefaultModelSelector();
  }
  
  /**
   * 加载摘要设置到UI
   */
  loadSummarizationSettings() {
    const summarization = this.currentConfig.summarization;
    
    if (!summarization) return;
    
    // 加载摘要类别
    this.summaryCategories.innerHTML = '';
    if (summarization.categories && Array.isArray(summarization.categories)) {
      summarization.categories.forEach(category => {
        const categoryItem = document.createElement('div');
        categoryItem.className = 'checkbox-item';
        
        const categoryCheck = document.createElement('input');
        categoryCheck.type = 'checkbox';
        categoryCheck.id = `category-${category.id}`;
        categoryCheck.checked = category.enabled;
        categoryCheck.addEventListener('change', () => {
          // 更新类别的启用状态
          const index = this.currentConfig.summarization.categories.findIndex(c => c.id === category.id);
          if (index !== -1) {
            this.currentConfig.summarization.categories[index].enabled = categoryCheck.checked;
          }
        });
        
        const categoryLabel = document.createElement('label');
        categoryLabel.textContent = category.name;
        categoryLabel.setAttribute('for', `category-${category.id}`);
        
        categoryItem.appendChild(categoryCheck);
        categoryItem.appendChild(categoryLabel);
        
        this.summaryCategories.appendChild(categoryItem);
      });
    }
    
    // 加载最大处理文献数
    this.maxPapersInput.value = summarization.maxPapersPerBatch || 10;
    
    // 加载内容包含选项
    this.includeAbstractCheck.checked = !!summarization.includeAbstract;
    this.includeCitationsCheck.checked = !!summarization.includeCitations;
  }
  
  /**
   * 保存所有设置
   */
  async saveSettings() {
    try {
      // 收集摘要设置的更改
      this.collectSummarizationSettings();
      
      // 收集全局默认模型设置
      if (this.defaultModelSelect.value) {
        this.currentConfig.selectedAiModel = this.defaultModelSelect.value;
      } else {
        this.currentConfig.selectedAiModel = null;
      }
      
      // 保存配置
      await this.config.updateConfig(this.currentConfig);
      
      // 显示成功消息
      this.showStatus(true, '设置已成功保存！');
      
      // 重新加载UI以确保一致性
      this.loadConfigToUI();
    } catch (error) {
      console.error('保存设置失败:', error);
      this.showStatus(false, '保存设置失败：' + error.message);
    }
  }
  
  /**
   * 收集摘要设置的更改
   */
  collectSummarizationSettings() {
    // 收集最大处理文献数
    if (this.maxPapersInput.value) {
      this.currentConfig.summarization.maxPapersPerBatch = parseInt(this.maxPapersInput.value, 10);
    }
    
    // 收集内容包含选项
    this.currentConfig.summarization.includeAbstract = this.includeAbstractCheck.checked;
    this.currentConfig.summarization.includeCitations = this.includeCitationsCheck.checked;
  }
  
  /**
   * 确认是否重置设置
   */
  confirmResetSettings() {
    if (confirm('确定要将所有设置恢复为默认值吗？此操作不可撤销。')) {
      this.resetSettings();
    }
  }
  
  /**
   * 重置所有设置为默认值
   */
  async resetSettings() {
    try {
      // 调用配置类的重置方法
      this.currentConfig = await this.config.resetConfig();
      
      // 重新加载UI
      this.loadConfigToUI();
      
      // 显示成功消息
      this.showStatus(true, '所有设置已恢复为默认值！');
    } catch (error) {
      console.error('重置设置失败:', error);
      this.showStatus(false, '重置设置失败：' + error.message);
    }
  }
  
  /**
   * 显示状态消息
   * @param {boolean} success - 是否成功
   * @param {string} message - 消息内容
   */
  showStatus(success, message) {
    this.modelView.showStatus(
      this.statusMessage, 
      success ? 'success' : 'error', 
      message
    );
  }
  
  /**
   * 打开添加自定义模型的模态框
   */
  openAddModelModal() {
    // 重置表单
    this.resetModelForm();
    
    // 显示模态框
    this.customModelModal.classList.add('active');
  }
  
  /**
   * 关闭添加自定义模型的模态框
   */
  closeAddModelModal() {
    this.customModelModal.classList.remove('active');
  }
  
  /**
   * 重置模型表单
   */
  resetModelForm() {
    this.modelNameInput.value = '';
    this.modelApiKeyInput.value = '';
    this.modelApiUrlInput.value = '';
    this.modelAvailableModelsInput.value = '';
    this.modelDefaultModelSelect.innerHTML = '<option value="">-- 请先输入可用模型 --</option>';
    this.modelMaxTokensInput.value = '2000';
    this.modelTemperatureInput.value = '0.7';
    this.temperatureValueSpan.textContent = '0.7';
    this.modelActiveCheck.checked = true;
  }
  
  /**
   * 更新默认模型选项
   */
  updateDefaultModelOptions() {
    // 获取可用模型列表
    const modelsText = this.modelAvailableModelsInput.value;
    const models = modelsText.split(/[,\n]/).map(m => m.trim()).filter(m => m);
    
    // 重置选择器
    this.modelDefaultModelSelect.innerHTML = '';
    
    if (models.length === 0) {
      // 如果没有可用模型，显示提示
      const option = document.createElement('option');
      option.value = '';
      option.textContent = '-- 请先输入可用模型 --';
      this.modelDefaultModelSelect.appendChild(option);
    } else {
      // 添加所有可用模型作为选项
      models.forEach(model => {
        const option = document.createElement('option');
        option.value = model;
        option.textContent = model;
        this.modelDefaultModelSelect.appendChild(option);
      });
      
      // 默认选择第一个模型
      this.modelDefaultModelSelect.value = models[0];
    }
  }
  
  /**
   * 更新默认模型选择器
   */
  updateDefaultModelSelector() {
    // 获取所有启用且有API密钥的模型
    const enabledModels = this.currentConfig.aiModels
      ? this.currentConfig.aiModels.filter(model => model.active && model.apiKey)
      : [];
    
    // 创建并替换当前的选择器
    const selector = this.modelView.createModelSelector(
      enabledModels,
      this.currentConfig.selectedAiModel,
      (value) => {
        // 更新默认模型
        this.currentConfig.selectedAiModel = value;
      }
    );
    
    // 替换现有选择器
    if (this.defaultModelSelect.parentNode) {
      this.defaultModelSelect.parentNode.replaceChild(selector, this.defaultModelSelect);
      this.defaultModelSelect = selector;
    }
  }
  
  /**
   * 添加自定义模型
   */
  addCustomModel() {
    // 验证必填字段
    if (!this.validateModelForm()) {
      return;
    }
    
    // 获取表单数据
    const modelName = this.modelNameInput.value.trim();
    const apiKey = this.modelApiKeyInput.value.trim();
    const apiUrl = this.modelApiUrlInput.value.trim();
    const modelsText = this.modelAvailableModelsInput.value;
    const models = modelsText.split(/[,\n]/).map(m => m.trim()).filter(m => m);
    const selectedModel = this.modelDefaultModelSelect.value;
    const maxTokens = parseInt(this.modelMaxTokensInput.value, 10);
    const temperature = parseFloat(this.modelTemperatureInput.value);
    const active = this.modelActiveCheck.checked;
    
    // 创建新模型配置
    const newModel = {
      name: modelName,
      apiKey: apiKey,
      url: apiUrl,
      models: models.length > 1 ? models : models[0],
      selectedModel: selectedModel,
      maxTokens: maxTokens,
      temperature: temperature,
      active: active,
      isCustom: true
    };
    
    // 添加到当前配置
    if (!this.currentConfig.aiModels) {
      this.currentConfig.aiModels = [];
    }
    
    this.currentConfig.aiModels.push(newModel);
    
    // 关闭模态框
    this.closeAddModelModal();
    
    // 重新加载模型
    this.loadAiModels();
    
    // 如果新模型是激活状态且有API密钥，自动选择它作为默认模型
    if (newModel.active && newModel.apiKey) {
      this.defaultModelSelect.value = newModel.name;
    }
    
    // 显示成功消息
    this.showStatus(true, `已成功添加自定义模型 "${modelName}"！`);
  }
  
  /**
   * 验证模型表单
   * @returns {boolean} 是否验证通过
   */
  validateModelForm() {
    // 验证模型名称
    if (!this.modelNameInput.value.trim()) {
      alert('请输入服务商/模型名称');
      this.modelNameInput.focus();
      return false;
    }
    
    // 验证API密钥
    if (!this.modelApiKeyInput.value.trim()) {
      alert('请输入API密钥');
      this.modelApiKeyInput.focus();
      return false;
    }
    
    // 验证API地址
    if (!this.modelApiUrlInput.value.trim()) {
      alert('请输入API地址');
      this.modelApiUrlInput.focus();
      return false;
    }
    
    // 验证可用模型
    const modelsText = this.modelAvailableModelsInput.value;
    const models = modelsText.split(/[,\n]/).map(m => m.trim()).filter(m => m);
    if (models.length === 0) {
      alert('请输入至少一个可用模型');
      this.modelAvailableModelsInput.focus();
      return false;
    }
    
    // 验证默认选用模型
    if (!this.modelDefaultModelSelect.value) {
      alert('请选择默认选用模型');
      this.modelDefaultModelSelect.focus();
      return false;
    }
    
    return true;
  }
  
  /**
   * 确认删除模型
   * @param {Object} model - 要删除的模型
   * @param {number} index - 模型的索引
   */
  confirmDeleteModel(model, index) {
    // 保存要删除的模型信息
    this.modelToDelete = { model, index };
    
    // 设置确认对话框内容
    this.deleteModelNameSpan.textContent = model.name;
    
    // 显示确认对话框
    this.confirmDeleteModal.classList.add('active');
  }
  
  /**
   * 关闭删除确认模态框
   */
  closeDeleteModal() {
    this.confirmDeleteModal.classList.remove('active');
    this.modelToDelete = null;
  }
  
  /**
   * 删除模型
   */
  deleteModel() {
    if (!this.modelToDelete) return;
    
    const { index } = this.modelToDelete;
    
    // 从配置中删除模型
    this.currentConfig.aiModels.splice(index, 1);
    
    // 关闭模态框
    this.closeDeleteModal();
    
    // 重新加载模型
    this.loadAiModels();
    
    // 显示成功消息
    this.showStatus(true, '已成功删除模型！');
  }
  
  /**
   * 测试模型连接
   * @param {number} index - 模型索引
   * @returns {Promise<Object>} - 测试结果
   */
  async testModelConnection(index) {
    if (!this.currentConfig.aiModels || index >= this.currentConfig.aiModels.length) {
      return { success: false, message: '找不到指定的模型' };
    }
    
    const model = this.currentConfig.aiModels[index];
    
    try {
      // 显示测试状态
      const card = this.modelCardsContainer.querySelector(`[data-index="${index}"]`);
      
      // 测试连接
      const result = await llmServiceInstance.testModelConnectivity({...model});
      
      // 更新测试结果UI
      if (card) {
        this.modelView.updateTestResult(card, result);
      }
      
      return result;
    } catch (error) {
      console.error('测试连接出错:', error);
      return {
        success: false,
        message: `测试失败: ${error.message}`
      };
    }
  }
}

// 当DOM加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  const settingsController = new SettingsController();
  settingsController.init();
});

export default SettingsController; 