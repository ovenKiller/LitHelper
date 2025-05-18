/**
 * SettingsController.js (原 settings.js)
 * 
 * 控制器(Controller)层：设置页面的交互逻辑
 */

import Config from './SettingsModel';
import aiServiceInstance from '../api/aiService';
import ModelView from './SettingsView';

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
      // 收集摘要设置
      this.collectSummarizationSettings();
      
      // 保存配置
      await this.config.updateConfig(this.currentConfig);
      
      this.showStatus(true, '设置已保存');
    } catch (error) {
      console.error('保存设置失败:', error);
      this.showStatus(false, '保存设置失败：' + error.message);
    }
  }
  
  /**
   * 收集摘要设置
   */
  collectSummarizationSettings() {
    this.currentConfig.summarization = this.currentConfig.summarization || {};
    
    // 收集最大处理文献数
    this.currentConfig.summarization.maxPapersPerBatch = parseInt(this.maxPapersInput.value, 10);
    
    // 收集内容包含选项
    this.currentConfig.summarization.includeAbstract = this.includeAbstractCheck.checked;
    this.currentConfig.summarization.includeCitations = this.includeCitationsCheck.checked;
  }
  
  /**
   * 确认重置设置
   */
  confirmResetSettings() {
    if (confirm('确认要将所有设置重置为默认值吗？此操作不可撤销。')) {
      this.resetSettings();
    }
  }
  
  /**
   * 重置所有设置
   */
  async resetSettings() {
    try {
      // 重置配置
      this.currentConfig = await this.config.resetConfig();
      
      // 重新加载UI
      this.loadConfigToUI();
      
      this.showStatus(true, '设置已重置为默认值');
    } catch (error) {
      console.error('重置设置失败:', error);
      this.showStatus(false, '重置设置失败：' + error.message);
    }
  }
  
  /**
   * 显示状态信息
   * @param {boolean} success - 是否成功
   * @param {string} message - 消息内容
   */
  showStatus(success, message) {
    this.statusMessage.textContent = message;
    this.statusMessage.className = success ? 'status success' : 'status error';
    this.statusMessage.style.display = 'block';
    
    // 自动隐藏
    setTimeout(() => {
      this.statusMessage.style.display = 'none';
    }, 3000);
  }
  
  /**
   * 打开添加模型模态框
   */
  openAddModelModal() {
    // 重置表单
    this.resetModelForm();
    
    // 显示模态框
    this.customModelModal.style.display = 'flex';
    setTimeout(() => {
      this.customModelModal.classList.add('active');
    }, 10);
  }
  
  /**
   * 关闭添加模型模态框
   */
  closeAddModelModal() {
    this.customModelModal.classList.remove('active');
    setTimeout(() => {
      this.customModelModal.style.display = 'none';
    }, 300);
  }
  
  /**
   * 重置模型表单
   */
  resetModelForm() {
    this.modelNameInput.value = '';
    this.modelApiKeyInput.value = '';
    this.modelApiUrlInput.value = '';
    this.modelAvailableModelsInput.value = '';
    this.modelDefaultModelSelect.innerHTML = '';
    this.modelMaxTokensInput.value = '2000';
    this.modelTemperatureInput.value = '0.7';
    this.temperatureValueSpan.textContent = '0.7';
    this.modelActiveCheck.checked = false;
  }
  
  /**
   * 更新默认模型选项
   */
  updateDefaultModelOptions() {
    // 获取可用模型列表
    const modelsInput = this.modelAvailableModelsInput.value;
    const models = modelsInput.split(',').map(m => m.trim()).filter(m => m);
    
    // 清空选择器
    this.modelDefaultModelSelect.innerHTML = '';
    
    // 如果没有模型，添加提示选项
    if (models.length === 0) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = '-- 请先添加可用模型 --';
      option.disabled = true;
      option.selected = true;
      this.modelDefaultModelSelect.appendChild(option);
      return;
    }
    
    // 添加每个模型的选项
    models.forEach(modelName => {
      const option = document.createElement('option');
      option.value = modelName;
      option.textContent = modelName;
      this.modelDefaultModelSelect.appendChild(option);
    });
    
    // 默认选择第一个
    this.modelDefaultModelSelect.value = models[0];
  }
  
  /**
   * 更新默认模型选择器
   */
  updateDefaultModelSelector() {
    // 清空选择器
    this.defaultModelSelect.innerHTML = '';
    
    // 获取所有激活的模型
    const activeModels = this.currentConfig.aiModels.filter(model => model.active);
    
    // 如果没有激活模型，添加提示选项
    if (activeModels.length === 0) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = '-- 请先启用至少一个AI模型 --';
      option.disabled = true;
      option.selected = true;
      this.defaultModelSelect.appendChild(option);
      return;
    }
    
    // 添加每个激活模型的选项
    activeModels.forEach(model => {
      const option = document.createElement('option');
      option.value = model.name;
      option.textContent = model.name;
      
      // 如果当前选中的模型存在于激活模型中，则选中该选项
      if (this.currentConfig.selectedAiModel === model.name) {
        option.selected = true;
      }
      
      this.defaultModelSelect.appendChild(option);
    });
    
    // 如果当前选中的模型不存在于激活模型中，选择第一个激活模型
    if (!activeModels.some(m => m.name === this.currentConfig.selectedAiModel)) {
      this.defaultModelSelect.value = activeModels[0].name;
      this.currentConfig.selectedAiModel = activeModels[0].name;
    }
  }
  
  /**
   * 添加自定义模型
   */
  addCustomModel() {
    // 验证表单
    const validationResult = this.validateModelForm();
    if (!validationResult.valid) {
      alert(validationResult.message);
      return;
    }
    
    // 获取表单数据
    const name = this.modelNameInput.value.trim();
    const apiKey = this.modelApiKeyInput.value.trim();
    const url = this.modelApiUrlInput.value.trim();
    let models = this.modelAvailableModelsInput.value.trim().split(',').map(m => m.trim()).filter(m => m);
    const selectedModel = this.modelDefaultModelSelect.value;
    const maxTokens = parseInt(this.modelMaxTokensInput.value, 10);
    const temperature = parseFloat(this.modelTemperatureInput.value);
    const active = this.modelActiveCheck.checked;
    
    // 创建模型配置
    const newModel = {
      name,
      apiKey,
      url,
      models: models.length === 1 ? models[0] : models,
      selectedModel,
      maxTokens,
      temperature,
      active,
      isCustom: true
    };
    
    // 添加到模型列表
    this.currentConfig.aiModels = this.currentConfig.aiModels || [];
    this.currentConfig.aiModels.push(newModel);
    
    // 如果这是唯一的激活模型，则设为默认
    if (active && (!this.currentConfig.selectedAiModel || !this.currentConfig.aiModels.some(m => m.name !== name && m.active))) {
      this.currentConfig.selectedAiModel = name;
    }
    
    // 重新加载模型列表
    this.loadAiModels();
    
    // 关闭模态框
    this.closeAddModelModal();
    
    // 显示成功消息
    this.showStatus(true, `已添加模型 "${name}"`);
  }
  
  /**
   * 验证模型表单
   * @returns {{valid: boolean, message: string}} - 验证结果
   */
  validateModelForm() {
    const name = this.modelNameInput.value.trim();
    const apiKey = this.modelApiKeyInput.value.trim();
    const url = this.modelApiUrlInput.value.trim();
    const models = this.modelAvailableModelsInput.value.trim();
    const selectedModel = this.modelDefaultModelSelect.value;
    
    if (!name) {
      return { valid: false, message: '请输入模型名称' };
    }
    
    // 检查名称是否重复
    if (this.currentConfig.aiModels.some(model => model.name === name)) {
      return { valid: false, message: `模型名称 "${name}" 已存在，请使用不同的名称` };
    }
    
    if (!apiKey) {
      return { valid: false, message: '请输入API密钥' };
    }
    
    if (!url) {
      return { valid: false, message: '请输入API地址' };
    }
    
    if (!models) {
      return { valid: false, message: '请输入至少一个可用模型名称' };
    }
    
    if (!selectedModel) {
      return { valid: false, message: '请选择默认模型' };
    }
    
    return { valid: true, message: '' };
  }
  
  /**
   * 确认删除模型
   * @param {Object} model - 要删除的模型
   * @param {number} index - 模型索引
   */
  confirmDeleteModel(model, index) {
    this.modelToDelete = { model, index };
    this.deleteModelNameSpan.textContent = model.name;
    
    // 显示确认对话框
    this.confirmDeleteModal.style.display = 'flex';
    setTimeout(() => {
      this.confirmDeleteModal.classList.add('active');
    }, 10);
  }
  
  /**
   * 关闭删除确认对话框
   */
  closeDeleteModal() {
    this.confirmDeleteModal.classList.remove('active');
    setTimeout(() => {
      this.confirmDeleteModal.style.display = 'none';
      this.modelToDelete = null;
    }, 300);
  }
  
  /**
   * 删除模型
   */
  deleteModel() {
    if (!this.modelToDelete) return;
    
    const { model, index } = this.modelToDelete;
    
    // 从数组中删除
    this.currentConfig.aiModels.splice(index, 1);
    
    // 如果删除的是当前选中的默认模型，重置选择
    if (this.currentConfig.selectedAiModel === model.name) {
      const active = this.currentConfig.aiModels.find(m => m.active);
      this.currentConfig.selectedAiModel = active ? active.name : null;
    }
    
    // 重新加载模型列表
    this.loadAiModels();
    
    // 关闭模态框
    this.closeDeleteModal();
    
    // 显示成功消息
    this.showStatus(true, `已删除模型 "${model.name}"`);
  }
  
  /**
   * 测试模型连接
   * @param {number} index - 模型索引
   * @returns {Promise<{success: boolean, error: string|null}>} - 测试结果
   */
  async testModelConnection(index) {
    try {
      const model = this.currentConfig.aiModels[index];
      
      // 检查必需字段
      if (!model.apiKey) {
        return { success: false, error: '请先设置API密钥' };
      }
      
      if (!model.url) {
        return { success: false, error: '请先设置API地址' };
      }
      
      // 简单的连接测试
      const testResult = await aiServiceInstance.testModelConnectivity({
        provider: model.name,
        apiKey: model.apiKey,
        url: model.url,
        selectedModel: model.selectedModel
      });
      
      // 使用返回的结果
      return { 
        success: testResult.success, 
        error: testResult.success ? null : testResult.message 
      };
    } catch (error) {
      console.error('测试连接错误:', error);
      return { 
        success: false, 
        error: error.message || '连接失败，请检查API密钥和地址' 
      };
    }
  }
}

// 初始化实例
const controller = new SettingsController();
export default controller;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  controller.init();
}); 