/**
 * aiService.js
 * 
 * 统一的AI服务模块：管理模型配置与API通信
 * 合并了原来的modelService.js和llmService.js的功能
 */

import configInstance from '../option/SettingsModel';

class AIService {
  constructor() {
    this.config = configInstance;
  }

  /********************************************************************************
   * 模型配置管理功能 (原modelService.js)
   ********************************************************************************/
  
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
    
    // 调用内部方法测试连接
    return await this.testModelConnectivity(modelConfig);
  }

  /********************************************************************************
   * LLM API通信功能 (原llmService.js)
   ********************************************************************************/
  
  /**
   * 调用AI大模型生成回复
   * @param {string} prompt - 用户提示词
   * @param {Object} options - 可选参数，可以覆盖默认配置
   * @param {number} options.maxTokens - 最大生成token数
   * @param {number} options.temperature - 温度参数
   * @param {boolean} options.stream - 是否使用流式输出
   * @param {function} options.onStream - 流式输出的回调函数
   * @returns {Promise<string>} - 模型生成的回复文本
   * @throws {Error} - 如果调用失败或配置错误
   */
  async callLLM(prompt, options = {}) {
    // 确保配置已加载
    if (!this.config.currentConfig) {
      await this.config.init();
    }
    
    // 获取激活的模型配置
    const modelConfig = this.config.getEnabledAiModel();
    
    if (!modelConfig) {
      throw new Error("没有启用或配置有效的AI模型。请在设置中配置并启用AI模型。");
    }
    
    // 使用options中的参数覆盖模型配置，如果有的话
    const effectiveConfig = {
      ...modelConfig,
      maxTokens: options.maxTokens || modelConfig.maxTokens,
      temperature: options.temperature || modelConfig.temperature
    };
    
    // 构造API请求
    const requestDetails = this._constructOpenAICompatibleRequest(prompt, effectiveConfig, options.stream);
    
    try {
      // 发送请求并获取响应
      const responseData = await this._sendRequest(requestDetails);
      
      // 解析并返回响应中的文本内容
      return this._parseOpenAICompatibleResponse(responseData);
    } catch (error) {
      console.error("调用AI模型失败:", error);
      
      // 重新抛出更友好的错误消息
      throw new Error(`调用AI模型失败：${error.message || '未知错误'}`);
    }
  }

  /**
   * 测试模型配置的连接性
   * @param {Object} modelConfig - 模型配置对象
   * @returns {Promise<Object>} - 包含测试结果的对象 {success, message, data?, error?}
   */
  async testModelConnectivity(modelConfig) {
    // 验证必要的配置字段
    if (!modelConfig || !modelConfig.apiKey || !modelConfig.url || !modelConfig.selectedModel) {
      return { 
        success: false, 
        message: "模型配置不完整，缺少apiKey、url或selectedModel。" 
      };
    }

    // 简短的测试提示词
    const testPrompt = "Say 'Hello, World!'";
    
    // 构造测试请求，强制使用小maxTokens
    const requestDetails = this._constructOpenAICompatibleRequest(testPrompt, modelConfig, false, true);

    try {
      // 发送测试请求
      const responseData = await this._sendRequest(requestDetails);
      
      // 尝试解析响应
      try {
        const parsedResponse = this._parseOpenAICompatibleResponse(responseData);
        
        // 如果成功解析到响应文本
        if (parsedResponse && typeof parsedResponse === 'string') {
          return { 
            success: true, 
            message: "连接成功！模型返回了有效响应。", 
            data: parsedResponse.substring(0, 100) // 只返回前100个字符，避免过长
          };
        } else {
          // 解析成功但格式不符合预期
          return { 
            success: false, 
            message: "连接成功，但模型响应内容解析失败或为空。", 
            data: responseData 
          };
        }
      } catch (parseError) {
        // 解析响应时出错
        return { 
          success: false, 
          message: `连接成功，但响应解析失败：${parseError.message}`, 
          data: responseData 
        };
      }
    } catch (error) {
      // 请求发送失败或API返回错误
      let errorMessage = "连接测试失败";
      
      // 尝试提取详细错误信息
      if (error.details && error.details.message) {
        errorMessage += `：${error.details.message}`;
      } else if (error.message) {
        errorMessage += `：${error.message}`;
      }
      
      // 如果是API错误，可能会有更详细的状态信息
      if (error.details && error.details.status) {
        errorMessage += ` (HTTP ${error.details.status})`;
      }
      
      return { 
        success: false, 
        message: errorMessage, 
        error: error.details || error 
      };
    }
  }

  /**
   * 构造兼容OpenAI API的请求
   * @param {string} prompt - 用户提示词
   * @param {Object} modelConfig - 模型配置
   * @param {boolean} stream - 是否使用流式输出
   * @param {boolean} isTest - 是否为测试请求，如果是则使用最小token数
   * @returns {Object} 包含URL、方法、headers和body的请求对象
   * @private
   */
  _constructOpenAICompatibleRequest(prompt, modelConfig, stream = false, isTest = false) {
    // 构造完整的API URL
    const baseUrl = modelConfig.url.endsWith('/') ? modelConfig.url : modelConfig.url + '/';
    const endpoint = baseUrl + 'v1/chat/completions';
    
    // 构造请求体
    const body = {
      model: modelConfig.selectedModel,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: isTest ? 10 : (modelConfig.maxTokens || 150), // 测试时使用最小token数
      temperature: modelConfig.temperature || 0.7,
    };
    
    // 如果需要流式输出
    if (stream) {
      body.stream = true;
    }

    // 返回完整的请求配置
    return {
      url: endpoint,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${modelConfig.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    };
  }

  /**
   * 发送HTTP请求到模型API
   * @param {Object} requestDetails - 请求配置
   * @returns {Promise<Object>} API响应的JSON对象
   * @throws {Error} 如果请求失败
   * @private
   */
  async _sendRequest(requestDetails) {
    try {
      // 使用fetch API发送请求
      const response = await fetch(requestDetails.url, {
        method: requestDetails.method,
        headers: requestDetails.headers,
        body: requestDetails.body,
      });

      // 检查HTTP状态码
      if (!response.ok) {
        // 如果状态码不是2xx，尝试读取错误信息
        let errorData;
        
        try {
          errorData = await response.json();
        } catch (e) {
          // 如果响应体不是JSON，使用状态文本
          errorData = { message: `HTTP错误 ${response.status}: ${response.statusText}` };
        }
        
        // 构造并抛出自定义错误
        const error = new Error(errorData.error?.message || errorData.message || `API请求失败，状态码: ${response.status}`);
        error.details = {
          status: response.status,
          statusText: response.statusText,
          responseBody: errorData,
          requestUrl: requestDetails.url,
        };
        throw error;
      }

      // 解析并返回JSON响应
      return await response.json();
    } catch (error) {
      // 捕获网络错误或上面抛出的错误
      if (!error.details) {
        // 封装原始网络错误
        const wrappedError = new Error(`网络请求失败: ${error.message}`);
        wrappedError.details = { 
          originalError: error, 
          requestUrl: requestDetails.url 
        };
        throw wrappedError;
      }
      
      // 重新抛出已经封装好的错误
      throw error;
    }
  }
  
  /**
   * 解析OpenAI兼容API的响应
   * @param {Object} responseData - API响应的JSON对象
   * @returns {string} 模型生成的文本
   * @throws {Error} 如果响应格式不符合预期
   * @private
   */
  _parseOpenAICompatibleResponse(responseData) {
    // 检查响应中是否包含有效的回复内容
    if (responseData && 
        responseData.choices && 
        responseData.choices[0] && 
        responseData.choices[0].message && 
        responseData.choices[0].message.content) {
      return responseData.choices[0].message.content.trim();
    } 
    // 检查响应中是否包含API错误
    else if (responseData && responseData.error && responseData.error.message) {
      throw new Error(`API错误: ${responseData.error.message}`);
    }
    
    // 如果响应格式不符合预期
    console.warn("无法从响应中提取有效内容:", responseData);
    throw new Error("模型响应格式不符合OpenAI兼容规范或内容为空。");
  }
}

// 创建并导出服务实例
const aiServiceInstance = new AIService();
export default aiServiceInstance; 