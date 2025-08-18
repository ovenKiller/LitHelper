/**
 * aiService.js
 * 
 * 统一的AI服务模块：负责与AI大模型进行通信。
 * 它从configService获取必要的模型配置（如API密钥、URL），
 * 然后构造并发送API请求。
 */

import { configService } from './configService.js';
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
      // 直接使用默认AI模型配置
      let modelConfig;
      try {
        modelConfig = await this.configService.getDefaultAiModel();
      } catch (error) {
        return { 
          success: false, 
          message: error.message || "获取AI模型配置失败"
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
        data: typeof result === 'string' ? result.substring(0, 100) : String(result).substring(0, 100)
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
   * 从AI返回的字符串中提取并解析JSON数据
   * AI返回的数据可能包含多余的字符，需要先提取最外层{}包裹的JSON字符串
   * @param {string} responseText - AI返回的原始文本
   * @returns {Object} 解析后的JSON对象
   * @throws {Error} 如果无法提取或解析JSON
   * @private
   */
  _extractAndParseJSON(responseText) {
    if (!responseText || typeof responseText !== 'string') {
      throw new Error('AI返回数据为空或格式错误');
    }

    // 查找第一个 { 和最后一个 } 的位置
    const firstBraceIndex = responseText.indexOf('{');
    const lastBraceIndex = responseText.lastIndexOf('}');

    if (firstBraceIndex === -1 || lastBraceIndex === -1 || firstBraceIndex >= lastBraceIndex) {
      throw new Error('AI返回的数据中未找到有效的JSON格式');
    }

    // 提取JSON字符串
    const jsonString = responseText.substring(firstBraceIndex, lastBraceIndex + 1);

    try {
      // 解析JSON
      const parsedJSON = JSON.parse(jsonString);
      return parsedJSON;
    } catch (parseError) {
      logger.error('JSON解析失败，原始数据:', jsonString);
      throw new Error(`JSON解析失败: ${parseError.message}`);
    }
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
      throw new Error("模型配置不完整，缺少apiKey、url或selectedModel。");
    }
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
    
  }

  /**
   * 从论文内容页面提取论文项元素
   * @param {string} compressedHTML - 压缩后的HTML内容
   * @param {string} platform - 平台名称
   * @returns {Promise<Object>} 提取结果
   */
  async extractPaperElementsFromAllVersionContent(compressedHTML, title) {
    try {
      const prompt = this._createPaperElementExtractionFromAllVersionContentPrompt(compressedHTML, title);
    
      const aiResponse = await this.callLLM(prompt);
      if (!aiResponse.success) {
        throw new Error(aiResponse.message || '调用AI服务失败');
      }
      
      // 使用封装的方法解析AI返回的JSON
      let selectorConfig;
      try {
        selectorConfig = this._extractAndParseJSON(aiResponse.data);
      } catch (parseError) {
        logger.error('AI返回数据解析失败:', aiResponse.data);
        throw new Error(`AI返回的选择器配置格式无效: ${parseError.message}`);
      }
      
      // 验证返回格式
      if (!selectorConfig.mode || !selectorConfig.selector) {
        throw new Error('AI返回的选择器配置缺少必要字段');
      }
      
      return {
        success: true,
        data: selectorConfig
      };
      
    } catch (error) {
      logger.error('从内容页面提取论文项失败:', error);
      return {
        success: false,
        error: error.message || '从内容页面提取论文项失败',
        data: null
      };
    }
  }

  /**
   * 提取论文项列表
   * @param {string} compressedHTML - 压缩后的HTML内容
   * @param {string} platform - 平台名称
   * @returns {Promise<Object>} 提取结果
   */
  async extractPaperItems(compressedHTML, platform) {
    try {
      const prompt = this._createPaperItemExtractionPrompt(compressedHTML, platform);
      
      const aiResponse = await this.callLLM(prompt);
      if (!aiResponse.success) {
        throw new Error(aiResponse.message || '调用AI服务失败');
      }
      
      // 使用封装的方法解析AI返回的JSON
      let selectorConfig;
      try {
        selectorConfig = this._extractAndParseJSON(aiResponse.data);
      } catch (parseError) {
        logger.error('AI返回数据解析失败:', aiResponse.data);
        throw new Error(`AI返回的选择器配置格式无效: ${parseError.message}`);
      }
      
      // 验证返回格式
      if (!selectorConfig.mode || !selectorConfig.selector) {
        throw new Error('AI返回的选择器配置缺少必要字段');
      }
      
      return {
        success: true,
        data: selectorConfig
      };
      
    } catch (error) {
      logger.error('论文项提取失败:', error);
      return {
        success: false,
        error: error.message || '论文项提取失败',
        data: null
      };
    }
  }

  /**
   * 生成子选择器
   * @param {string} sampleHTMLs - 学习样本HTML内容
   * @param {string} platform - 平台名称
   * @returns {Promise<Object>} 生成结果
   */
  async generateSubSelectors(sampleHTMLs, platform) {
    try {
      const prompt = this._createSubSelectorGenerationPrompt(sampleHTMLs, platform);
      
      const aiResponse = await this.callLLM(prompt);
      if (!aiResponse.success) {
        throw new Error(aiResponse.message || '调用AI服务失败');
      }
      
      // 使用封装的方法解析AI返回的JSON
      let subSelectors;
      try {
        subSelectors = this._extractAndParseJSON(aiResponse.data);
      } catch (parseError) {
        logger.error('AI返回的子选择器数据解析失败:', aiResponse.data);
        throw new Error(`AI返回的子选择器配置格式无效: ${parseError.message}`);
      }
      
      return {
        success: true,
        data: subSelectors
      };
      
    } catch (error) {
      logger.error('子选择器生成失败:', error);
      return {
        success: false,
        error: error.message || '子选择器生成失败',
        data: null
      };
    }
  }

  /**
   * 验证选择器提取结果
   * @param {Array} validationSamples - 验证样本数组，每个样本包含论文项HTML
   * @param {Object} subSelectors - 子选择器配置对象
   * @param {Array} extractionResults - 各个选择器的提取结果
   * @param {string} platform - 平台名称
   * @returns {Promise<Object>} 验证结果
   */
  async validateSelectors(validationSamples, subSelectors, extractionResults, platform) {
    try {
      const prompt = this._createSelectorValidationPrompt(validationSamples, subSelectors, extractionResults, platform);
      
      const aiResponse = await this.callLLM(prompt);
      if (!aiResponse.success) {
        throw new Error(aiResponse.message || '调用AI服务失败');
      }
      
      // 使用封装的方法解析AI返回的JSON
      let validationResult;
      try {
        validationResult = this._extractAndParseJSON(aiResponse.data);
      } catch (parseError) {
        logger.error('AI返回的验证结果数据解析失败:', aiResponse.data);
        throw new Error(`AI返回的验证结果格式无效: ${parseError.message}`);
      }
      
      return {
        success: true,
        data: validationResult
      };
      
    } catch (error) {
      logger.error('选择器验证失败:', error);
      return {
        success: false,
        error: error.message || '选择器验证失败',
        data: null
      };
    }
  }

  /**
   * 创建论文项提取的AI提示
   * @param {string} compressedHTML - 压缩后的HTML内容
   * @param {string} platform - 平台名称
   * @returns {string} AI提示
   * @private
   */
  _createPaperItemExtractionPrompt(compressedHTML, platform) {
    return `你是一个专业的网页结构分析师，需要分析${platform}网站搜索结果页的HTML结构，找出能够提取所有论文列表的选择器。

请分析以下HTML结构：

\`\`\`html
${compressedHTML}
\`\`\`

任务要求：
1. 识别页面中的论文条目列表所在的结构
2. 论文项通常包含标题、作者、摘要、版本链接、pdf链接等

请以JSON格式返回结果：
{
  "mode": "css", 
  "selector": "你的选择器字符串"
}

响应示例：
{"mode": "css", "selector": ".gs_ri.gs_or.gs_scl"}`;
  }

  /**
   * 创建子选择器生成的AI提示
   * @param {string} sampleHTMLs - 学习样本HTML内容
   * @param {string} platform - 平台名称
   * @returns {string} AI提示
   * @private
   */
  _createSubSelectorGenerationPrompt(sampleHTMLs, platform) {
    return `你是一个专业的网页结构分析师，需要分析${platform}网站论文项的HTML结构，为每个子元素生成提取选择器。

请分析以下论文项样本的HTML结构，生成精确的选择器配置：

\`\`\`html
${sampleHTMLs}
\`\`\`

任务要求：
1. 为每个论文项的以下元素生成选择器:
   - 标题 (title)
   - 摘要 (abstract) 

2. 选择器规范：
   - 可使用CSS选择器或正则表达式
   - 避免直接使用<a>标签作为css选择器的一部分

3. 验证要求：
   - 每个选择器生成后必须进行自验证
   - 验证失败需要优化选择器直到成功
   - 即使某元素不存在也要提供合理的选择器

请以下列JSON格式返回结果：
{
  "title": {
    "mode": "css|regex",
    "selector": "选择器字符串"
  },
  "abstract": {
    "mode": "css|regex", 
    "selector": "选择器字符串"
  }
}
`;
  }

  /**
   * 创建选择器验证的AI提示
   * @param {Array} validationSamples - 验证样本数组
   * @param {Object} subSelectors - 子选择器配置对象
   * @param {Array} extractionResults - 各个选择器的提取结果
   * @param {string} platform - 平台名称
   * @returns {string} AI提示
   * @private
   */
  _createSelectorValidationPrompt(validationSamples, subSelectors, extractionResults, platform) {
    // 构建验证上下文信息
    let contextInfo = `你是一个专业的网页数据验证专家，需要验证从${platform}网站论文项中提取的数据是否正确。

以下是待验证的信息：

## 原始论文项HTML样本：
`;

    // 添加原始HTML样本
    validationSamples.forEach((sample, index) => {
      contextInfo += `\n### 论文项${index + 1}:\n\`\`\`html\n${sample.outerHTML}\n\`\`\`\n`;
    });

    contextInfo += `\n## 使用的选择器配置：\n`;
    for (const [extractorType, selectorConfig] of Object.entries(subSelectors)) {
      contextInfo += `- ${extractorType}: ${selectorConfig.mode}模式，选择器="${selectorConfig.selector}"\n`;
    }

    contextInfo += `\n## 提取结果：\n`;
    extractionResults.forEach((sampleResult, sampleIndex) => {
      contextInfo += `\n### 样本${sampleIndex + 1}的提取结果：\n`;
      for (const [extractorType, extractedData] of Object.entries(sampleResult)) {
        contextInfo += `- ${extractorType}: ${JSON.stringify(extractedData)}\n`;
      }
    });

    contextInfo += `\n## 验证任务：
请分析每个提取器的提取结果是否正确，并提供修改建议：

1. **paperElement（论文项）**: 是否正确提取到了论文项？论文项是否完整？
2. **title（标题）**: 是否正确提取到了论文标题？标题是否完整？
3. **abstract（摘要）**: 是否正确提取到了论文摘要？如果论文项本身不包含摘要，则视为正确
4. **all_versions_link（所有版本链接）**: 是否正确提取到了"所有版本"相关的链接或文本？如果论文项本身不包含"所有版本"，则视为正确
5. 以上若都正确，则overallSuccess为true。

请以JSON格式返回验证结果：
{
  "overallSuccess": true/false,
  "extractorResults": {
    "paperElement": {
      "isCorrect": true/false,
      "issues": "修改意见"
    },
    "title": {
      "isCorrect": true/false,
      "issues": "修改意见"
    },
    "abstract": {
      "isCorrect": true/false,
      "issues": "修改意见"
    },
    "all_versions_link": {
      "isCorrect": true/false,
      "issues": "修改意见"
    }
  }
}`;

    return contextInfo;
  }

     /**
    * 从论文内容页面提取论文子元素的AI提示
    * @param {string} compressedHTML - 压缩后的HTML内容
    * @param {string} platform - 平台名称
    * @returns {string} AI提示
    * @private
    */
   _createPaperElementExtractionFromAllVersionContentPrompt(compressedHTML, title) {
     return `你是一个专业的网页结构分析师，需要分析论文${title} 所有版本页面的列表页，并返回一个能把所有的论文项提取出来的css选择器。

请分析以下HTML结构：

\`\`\`html
${compressedHTML}
\`\`\`

任务要求：
1. 识别页面中的论文条目列表所在的结构
2. 论文项通常包含标题、作者、摘要、等

请以JSON格式返回结果：
{
  "mode": "css", 
  "selector": "你的选择器字符串"
}

响应示例：
{"mode": "css", "selector": ".gs_ri.gs_or.gs_scl"}`;
  }

  /**
   * 从文本列表中提取摘要
   * @param {Array} textList - 文本列表
   * @returns {Promise<Object>} 提取结果
   */
  async extractAbstractFromTextList(textList, title) {
    const prompt = this._createAbstractExtractionFromTextListPrompt(textList, title);
    const aiResponse = await this.callLLM(prompt);
    if (!aiResponse.success) {
      throw new Error(aiResponse.message || '调用AI服务失败');
    }
    let abstractList;
    try {
      abstractList = this._extractAndParseJSON(aiResponse.data);
    } catch (parseError) {
      logger.error('AI返回的摘要数据解析失败:', aiResponse.data);
      throw new Error(`AI返回的摘要数据格式无效: ${parseError.message}`);
    }
    return abstractList;
  }

  _createAbstractExtractionFromTextListPrompt(textList, title) {
    return `你是一个专业的论文摘要判断专家，需要从以下文本列表中提取摘要：

\`\`\`text
${textList.join('\n\n')}
\`\`\`

任务要求：
1. 判断文本列表是否是论文${title}的摘要
2. 文本列表前面有一个序号，如果你认为该项文本是论文${title}的摘要，则在答案中添加该序号，否则不添加

请以JSON格式返回结果：
{
  "abstract_list": [1, 2, 3]
}
`;
  }

  /**
   * 翻译论文摘要到指定语言
   * @param {string} abstract - 论文摘要文本
   * @param {string} targetLanguage - 目标语言（如：中文、英文、日文等）
   * @returns {Promise<string>} 翻译后的文本，失败时返回空字符串
   */
  async translateAbstract(abstract, targetLanguage) {
    try {
      const prompt = this._createTranslationPrompt(abstract, targetLanguage);

      const aiResponse = await this.callLLM(prompt);
      if (!aiResponse.success) {
        logger.error('调用AI服务失败:', aiResponse.message);
        return '';
      }

      // 使用封装的方法解析AI返回的JSON
      let translationResult;
      try {
        translationResult = this._extractAndParseJSON(aiResponse.data);
      } catch (parseError) {
        logger.error('AI返回的翻译数据解析失败:', aiResponse.data);
        return '';
      }

      // 验证返回格式并返回翻译文本
      if (!translationResult.translatedText) {
        logger.error('AI返回的翻译结果缺少必要字段');
        return '';
      }

      return translationResult.translatedText;

    } catch (error) {
      logger.error('论文摘要翻译失败:', error);
      return '';
    }
  }

  /**
   * 创建翻译的AI提示
   * @param {string} abstract - 论文摘要文本
   * @param {string} targetLanguage - 目标语言
   * @returns {string} AI提示
   * @private
   */
  _createTranslationPrompt(abstract, targetLanguage) {
    return `你是一个专业的学术翻译专家，需要将论文摘要翻译为指定语言。

请将以下论文摘要翻译为${targetLanguage}：

\`\`\`
${abstract}
\`\`\`

翻译要求：
1. 保持学术性和专业性
2. 准确传达原文的含义和技术细节
3. 使用该语言的学术写作规范
4. 保持原文的逻辑结构和层次
5. 专业术语要准确翻译

请以JSON格式返回翻译结果：
{
  "originalText": "原文摘要",
  "translatedText": "翻译后的摘要",
  "targetLanguage": "目标语言",
  "translationNotes": "翻译说明（可选）"
}`;
  }
}
// 创建并导出服务实例
const aiServiceInstance = new AIService();
export default aiServiceInstance; 