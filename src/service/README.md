# Service 模块

## aiService.js

统一的AI服务模块，负责与AI大模型进行通信。

### 主要功能

1. **模型连接测试**
   - `testModelConnection(index)` - 测试指定模型的连接状态
   - `testModelConnectivity(modelConfig)` - 测试模型配置的连接性

2. **AI模型调用**
   - `callLLM(prompt, options)` - 调用AI大模型生成回复
   - 支持多种AI模型配置（OpenAI兼容接口）
   - 统一的错误处理和响应格式

3. **论文数据提取**
   - `extractPaperItems(compressedHTML, platform)` - 提取论文项列表
   - `generateSubSelectors(sampleHTMLs, platform)` - 生成子选择器
   - `validateSelectors(validationSamples, subSelectors, extractionResults, platform)` - 验证选择器提取结果

### 最近更新

**优化AI提示词技术准确性**：
- 改进了`all_versions_link`字段的描述说明
- 明确了CSS选择器和正则表达式两种模式的技术差异：
  - CSS选择器：只能选择到DOM元素（如a标签），需要后续代码提取href属性值
  - 正则表达式：可以直接从HTML文本中匹配并提取URL字符串
- 澄清了CSS选择器本身无法直接获取URL，避免技术误解

### 配置要求

- 需要配置AI模型的API密钥、URL和选择的模型名称
- 通过configService获取模型配置信息
- 支持OpenAI兼容的API接口格式

### 错误处理

- 统一的错误封装和处理机制
- 详细的错误信息包含HTTP状态码和原始错误详情
- 支持网络错误和API错误的区分处理 