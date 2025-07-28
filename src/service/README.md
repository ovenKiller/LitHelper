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

## runTimeDataService.js

运行时数据服务模块，负责管理平台配置、选择器缓存和预处理数据的持久化存储。

### 主要功能

1. **平台配置管理**
   - `getPlatformConfig(platformKey)` - 获取平台配置

2. **CSS选择器管理**
   - `saveCssSelector(cssSelector)` - 保存CSS选择器配置
   - `getCssSelector(domain, pageType)` - 获取CSS选择器配置
   - `getAllCssSelectors()` - 获取所有CSS选择器配置
   - `removeCssSelector(domain, pageType)` - 删除CSS选择器配置

3. **平台选择器管理**
   - `savePlatformSelector(platformSelector)` - 保存PlatformSelector配置
   - `getPlatformSelector(domain, pageType)` - 获取PlatformSelector配置
   - `getPlatformSelectorForPage(url, pageType)` - 根据URL获取PlatformSelector

4. **任务管理**
   - `saveTaskQueue(queueType, tasks)` - 保存任务队列
   - `loadTaskQueue(queueType)` - 加载任务队列
   - `getTaskHistory(days)` - 获取任务历史记录
   - `getTaskStatistics(days)` - 获取任务统计信息

5. **预处理论文数据管理** *(新增功能)*
   - `savePreprocessedPaper(paperData)` - 保存预处理的论文数据（自动触发清理）
   - `getPreprocessedPaper(paperId)` - 获取预处理的论文数据
   - `getAllPreprocessedPapers()` - 获取所有预处理论文数据
   - `removePreprocessedPaper(paperId)` - 删除预处理论文数据
   - `clearAllPreprocessedPapers()` - 清空所有预处理论文数据
   - `getPreprocessedPaperStatistics()` - 获取预处理论文统计信息
   - `cleanupOldPreprocessedPapers(maxCount, cleanupCount)` - 清理过期的预处理论文数据

### 预处理论文数据功能特性

- **数据结构标准化**：基于Paper.js模型存储包含id、title、abstract、pdfUrl、updateTime等标准字段的论文数据
- **智能摘要管理**：只有当abstract不为null且不为空字符串时才保存摘要内容
- **自动时间戳**：为每条预处理数据添加saveAt时间戳，便于追踪数据处理时间
- **统计分析支持**：提供论文数量、摘要完整性、来源分布等多维度统计信息
- **存储键格式**：使用`preprocessedPapers.{paperId}`格式存储，便于管理和查询
- **批量操作支持**：支持获取所有论文数据和批量清理功能
- **自动清理机制** *(最新新增)*：
  - **数量限制**：最多保留200条预处理论文数据
  - **自动触发**：每次保存新数据后自动检查并清理超限数据
  - **智能删除**：按`updateTime`时间排序，删除最久远的20条数据
  - **容错设计**：清理失败不影响数据保存操作
  - **详细日志**：记录清理过程和删除的数据信息
  - **可配置参数**：支持自定义最大保留数量和单次清理数量

### 缓存机制

- **内存缓存**：CSS选择器和PlatformSelector配置的内存缓存
- **缓存管理**：支持缓存状态查询和清理操作
- **性能优化**：减少Chrome存储API的重复调用，提升访问性能

### 数据持久化

- 使用Chrome存储API进行数据持久化
- 支持大容量数据存储和批量操作
- 完善的错误处理和日志记录机制 