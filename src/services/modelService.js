/**
 * modelService.js
 * 
 * 负责模型相关的业务逻辑，如测试连接、管理模型列表等
 */

import configInstance from '../config/config';
import llmServiceInstance from './llmService';

class ModelService {
  constructor() {
    this.config = configInstance;
  }

  /**
   * 获取所有模型配置
   * @returns {Array} 模型配置数组
   */
  async getAllModels() {
    if (!this.config.currentConfig) {
      await this.config.init();
    }
    return this.config.currentConfig.aiModels || [];
  }

  /**
   * 获取当前默认的模型
   * @returns {string|null} 默认模型名称或null
   */
  async getDefaultModelName() {
    if (!this.config.currentConfig) {
      await this.config.init();
    }
    return this.config.currentConfig.selectedAiModel;
  }

  /**
   * 设置默认模型
   * @param {string} modelName - 模型名称
   */
  async setDefaultModel(modelName) {
    if (!this.config.currentConfig) {
      await this.config.init();
    }
    this.config.currentConfig.selectedAiModel = modelName;
    await this.config.updateConfig(this.config.currentConfig);
  }

  /**
   * 启用或禁用模型
   * @param {number} index - 模型索引
   * @param {boolean} active - 是否启用
   * @returns {boolean} 成功与否
   */
  async toggleModelStatus(index, active) {
    if (!this.config.currentConfig) {
      await this.config.init();
    }

    if (!this.config.currentConfig.aiModels || 
        !this.config.currentConfig.aiModels[index]) {
      return false;
    }

    this.config.currentConfig.aiModels[index].active = active;
    return true;
  }

  /**
   * 更新模型配置
   * @param {number} index - 模型索引
   * @param {Object} updates - 更新字段
   * @returns {boolean} 成功与否
   */
  async updateModelConfig(index, updates) {
    if (!this.config.currentConfig) {
      await this.config.init();
    }

    if (!this.config.currentConfig.aiModels || 
        !this.config.currentConfig.aiModels[index]) {
      return false;
    }

    // 更新模型配置
    Object.assign(this.config.currentConfig.aiModels[index], updates);
    return true;
  }

  /**
   * 添加自定义模型
   * @param {Object} modelConfig - 模型配置
   * @returns {boolean} 成功与否
   */
  async addCustomModel(modelConfig) {
    if (!this.config.currentConfig) {
      await this.config.init();
    }

    if (!this.config.currentConfig.aiModels) {
      this.config.currentConfig.aiModels = [];
    }

    // 添加自定义标记
    modelConfig.isCustom = true;
    
    // 添加到模型列表
    this.config.currentConfig.aiModels.push(modelConfig);
    return true;
  }

  /**
   * 删除模型
   * @param {number} index - 模型索引
   * @returns {boolean} 成功与否
   */
  async deleteModel(index) {
    if (!this.config.currentConfig) {
      await this.config.init();
    }

    if (!this.config.currentConfig.aiModels || 
        !this.config.currentConfig.aiModels[index]) {
      return false;
    }

    // 删除模型
    this.config.currentConfig.aiModels.splice(index, 1);
    return true;
  }

  /**
   * 保存所有配置更改
   * @returns {Promise<boolean>} 成功与否
   */
  async saveAllChanges() {
    try {
      await this.config.updateConfig(this.config.currentConfig);
      return true;
    } catch (error) {
      console.error('保存配置失败:', error);
      return false;
    }
  }

  /**
   * 重置所有配置
   * @returns {Promise<boolean>} 成功与否
   */
  async resetAllConfig() {
    try {
      await this.config.resetConfig();
      return true;
    } catch (error) {
      console.error('重置配置失败:', error);
      return false;
    }
  }

  /**
   * 测试模型连接
   * @param {number} index - 模型索引
   * @returns {Promise<Object>} 测试结果
   */
  async testModelConnection(index) {
    if (!this.config.currentConfig) {
      await this.config.init();
    }

    if (!this.config.currentConfig.aiModels || 
        !this.config.currentConfig.aiModels[index]) {
      return { 
        success: false, 
        message: "找不到指定的模型配置" 
      };
    }

    // 获取模型配置副本进行测试
    const modelConfig = { ...this.config.currentConfig.aiModels[index] };
    
    // 调用LLM服务测试连接
    return await llmServiceInstance.testModelConnectivity(modelConfig);
  }

  /**
   * 获取启用且有API密钥的模型列表
   * @returns {Array<Object>} 可用模型数组
   */
  async getEnabledModels() {
    if (!this.config.currentConfig) {
      await this.config.init();
    }

    if (!this.config.currentConfig.aiModels) {
      return [];
    }

    // 筛选启用且有API密钥的模型
    return this.config.currentConfig.aiModels.filter(
      model => model.active && model.apiKey
    );
  }
}

// 创建并导出服务实例
const modelServiceInstance = new ModelService();
export default modelServiceInstance; 