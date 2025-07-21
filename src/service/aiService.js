/**
 * aiService.js
 * 
 * 统一的AI服务模块：负责与AI大模型进行通信。
 * 它从configService获取必要的模型配置（如API密钥、URL），
 * 然后构造并发送API请求。
 */

import { configService } from '../option/configService.js';
import { logger } from '../util/logger.js';

class AIService {
  constructor() {
    this.configService = configService;
  }

  /**
   * 测试模型连接
   * @param {number} index - 模型索引
   * @returns {Promise<Object>} 测试结果
   */
  async testModelConnection(index) {
    const models = await this.configService.getAiModels();
    if (!models || !models[index]) {
      return { 
        success: false, 
        message: "找不到指定的模型配置" 
      };
    }

    const modelConfig = models[index];
    
    // 调用内部方法测试连接
    return await this.testModelConnectivity(modelConfig);
  }
  
  /**
   * 调用AI大模型生成回复
   * @param {string} prompt - 用户提示词
   * @param {Object} options - 可选参数，可以覆盖默认配置
   * @param {number} options.temperature - 温度参数
   * @param {boolean} options.stream - 是否使用流式输出
   * @param {function} options.onStream - 流式输出的回调函数
   * @returns {Promise<Object>} - 统一格式的响应 {success, message?, data?}
   * @throws {Error} - 如果调用失败或配置错误
   */
  async callLLM(prompt, options = {}) {
    try {
      // 选择要使用的模型配置
      let modelName = options.modelName || await this.configService.getSelectedAiModelName();
      if (!modelName) {
        // 如果没有设置默认模型，则使用第一个激活的模型
        const enabledModels = await this.configService.getEnabledModels();
        if (enabledModels.length === 0) {
          return { 
            success: false, 
            message: "没有可用的AI模型。请在设置中配置API密钥。" 
          };
        }
        modelName = enabledModels[0].name;
      }

      // 查找模型配置
      const allModels = await this.configService.getAiModels();
      const modelConfig = allModels.find(m => m.name === modelName);

      if (!modelConfig || !modelConfig.active || !modelConfig.apiKey) {
        return { 
          success: false, 
          message: `模型"${modelName}"不可用或缺少API密钥` 
        };
      }

      // 调用核心方法
      return await this._callWithConfig(prompt, modelConfig, options);
    } catch (error) {
      logger.error("调用AI模型失败:", error);
      return {
        success: false,
        message: `AI调用失败: ${error.message}`
      };
    }
  }

  /**
   * 测试模型配置的连接性
   * @param {Object} modelConfig - 模型配置对象
   * @returns {Promise<Object>} - 包含测试结果的对象 {success, message, data?, error?}
   */
  async testModelConnectivity(modelConfig) {
    try {
      // 使用 callLLM 的核心逻辑，但传入特定配置
      const result = await this._callWithConfig(
        "Say 'Hello, World!'", 
        modelConfig, 
        { isTest: true }
      );
      
      return {
        success: true,
        message: "连接成功！",
        data: result.substring(0, 100)
      };
    } catch (error) {
      return {
        success: false,
        message: `连接测试失败：${error.message}`,
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
    // 检查响应是否有效
    if (!responseData || !responseData.choices || !responseData.choices.length) {
      logger.warn("无法从响应中提取有效内容:", responseData);
      return "";
    }

    // 提取生成的文本内容
    const choice = responseData.choices[0];
    
    // 根据不同模型返回格式提取内容
    if (choice.message && choice.message.content) {
      return choice.message.content.trim();
    } else if (choice.text) {
      return choice.text.trim();
    } else if (choice.content) {
      return choice.content.trim();
    }
    
    return "";
  }

  /**
   * 使用指定的模型配置调用AI
   * @param {string} prompt - 用户提示词
   * @param {Object} modelConfig - 模型配置对象
   * @param {Object} options - 选项
   * @param {boolean} options.isTest - 是否为测试请求
   * @param {boolean} options.stream - 是否使用流式输出
   * @returns {Promise<Object>} - 统一格式的响应 {success, message?, data?}
   * @private
   */
  async _callWithConfig(prompt, modelConfig, options = {}) {
    // 验证必要的配置字段
    if (!modelConfig || !modelConfig.apiKey || !modelConfig.url || !modelConfig.selectedModel) {
      return { 
        success: false, 
        message: "模型配置不完整，缺少apiKey、url或selectedModel。" 
      };
    }

    try {
      // 根据模型提供商构建请求
      const requestDetails = this._constructOpenAICompatibleRequest(
        prompt, 
        modelConfig,
        options.stream || false,
        options.isTest || false
      );

      // 发送请求
      const responseData = await this._sendRequest(requestDetails);
      
      // 解析响应
      const parsedResponse = this._parseOpenAICompatibleResponse(responseData);
      
      // 返回成功结果
      return {
        success: true,
        message: "AI调用成功",
        data: parsedResponse
      };
    } catch (error) {
      // 构造详细的错误信息
      let errorMessage = "AI调用失败";
      
      if (error.details && error.details.message) {
        errorMessage += `：${error.details.message}`;
      } else if (error.message) {
        errorMessage += `：${error.message}`;
      }
      
      if (error.details && error.details.status) {
        errorMessage += ` (HTTP ${error.details.status})`;
      }
      
      return {
        success: false,
        message: errorMessage
      };
    }
  }
}

// 创建并导出服务实例
const aiServiceInstance = new AIService();
export default aiServiceInstance; 