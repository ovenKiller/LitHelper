# 扩展研究论文摘要生成器

本文档提供了关于如何扩展研究论文摘要生成器架构以添加新功能、平台或集成的指导。

## 目录

1. [添加新的LLM提供商](#添加新的llm提供商)
2. [支持新平台](#支持新平台)
3. [实现PDF处理器](#实现pdf处理器)
4. [添加新的摘要分类](#添加新的摘要分类)
5. [增强UI界面](#增强ui界面)
6. [添加分析功能](#添加分析功能)

## 添加新的LLM提供商

该架构设计通过抽象的`LLMProvider`接口轻松支持多个LLM提供商。

### 添加新LLM提供商的步骤：

1. 在`src/api/llmProviders/`目录下创建一个新文件，遵循`[提供商名称]Provider.js`的命名约定
2. 实现`LLMProvider`接口中要求的方法：
   - `initialize()`：设置API凭证和任何提供商特定的配置
   - `summarize()`：为论文生成摘要
   - `categorize()`：根据定义的类别对论文进行分类
   - `batchSummarize()`：一次处理多篇论文
   - `comparePapers()`：比较多篇论文
   - `isConfigured()`：检查提供商是否正确配置
   - `getProviderName()`：返回提供商名称
   - `getAvailableModels()`：返回该提供商可用的模型

### 示例：

```javascript
// src/api/llmProviders/AnthropicProvider.js
import LLMProvider from './LLMProvider';

class AnthropicProvider extends LLMProvider {
  constructor(config) {
    super(config);
    this.apiKey = config?.apiKey || '';
    this.model = config?.model || 'claude-3-opus';
    // ... 更多初始化代码
  }
  
  async initialize() {
    if (!this.apiKey) {
      throw new Error('需要Anthropic API密钥');
    }
    
    this.initialized = true;
  }
  
  // 实现所有必需的方法
  // ...
}

export default AnthropicProvider;
```

3. 在`public/popup.html`中将提供商添加到UI选项中
4. 在`src/config/config.js`中的配置工厂中注册提供商

## 支持新平台

要支持新的学术平台，需实现一个新的平台适配器。

### 添加新平台适配器的步骤：

1. 在`src/content/platforms/`目录下创建一个新文件，遵循`[平台名称]Adapter.js`的命名约定
2. 实现`PlatformAdapter`接口中要求的方法：
   - `initialize()`：初始化平台特定资源
   - `isPageSupported()`：检查当前页面是否属于此平台
   - `extractCurrentPapers()`：从页面提取论文信息
   - `injectUI()`：向页面添加UI元素
   - `getPDFUrl()`：获取论文的PDF下载URL
   - 以及用于UI操作的其他必需方法

### 示例：

```javascript
// src/content/platforms/ScienceDirectAdapter.js
import PlatformAdapter from './PlatformAdapter';
import { createEmptyPaper } from '../../models/Paper';

class ScienceDirectAdapter extends PlatformAdapter {
  constructor(config) {
    super(config);
    this.hostPattern = /sciencedirect\.com/i;
    this.resultsSelector = '.ResultList';
    // ... 更多初始化代码
  }
  
  isPageSupported() {
    return this.hostPattern.test(window.location.hostname) && 
           document.querySelector(this.resultsSelector) !== null;
  }
  
  // 实现所有必需的方法
  // ...
}

export default ScienceDirectAdapter;
```

3. 在`src/content/content.js`中添加平台适配器导入
4. 在`public/popup.html`中将平台添加到UI选项
5. 在配置文件的`platforms`部分注册平台

## 实现PDF处理器

该架构使用PDF处理器来处理PDF下载和提取。

### 添加新PDF处理器的步骤：

1. 在`src/api/pdfProcessors/`目录下创建一个新文件，遵循`[名称]Processor.js`的命名约定
2. 实现`PDFProcessor`接口中要求的方法
3. 在后台脚本的初始化中注册处理器

### 示例：

```javascript
// src/api/pdfProcessors/PDFLibProcessor.js
import PDFProcessor from './PDFProcessor';

class PDFLibProcessor extends PDFProcessor {
  constructor(config) {
    super(config);
    // ... 初始化代码
  }
  
  async initialize() {
    // 导入PDF库
    this.pdfLib = await import('pdf-lib');
  }
  
  // 实现所有必需的方法
  // ...
}

export default PDFLibProcessor;
```

## 添加新的摘要分类

要添加新的摘要分类：

1. 在`src/config/config.js`中更新默认配置：

```javascript
const DEFAULT_CONFIG = {
  // ...
  summarization: {
    categories: [
      // 现有分类
      { id: 'methodology', name: '方法论', enabled: true },
      // 添加新分类
      { id: 'novelty', name: '创新性', enabled: true },
    ],
    // ...
  },
  // ...
};
```

2. 在`public/popup.html`中更新UI以包含新分类
3. 更新LLM提供商中的提示，包括新分类

## 增强UI界面

### 内容脚本UI增强：

1. 修改平台适配器实现以注入新的UI元素
2. 在适当的组件样式表中添加新的CSS样式 `src/content/ui/styles/`：
   - 对于通用样式：`base.css`
   - 对于特定平台的样式：`platforms.css`
   - 对于特定组件的样式：创建或修改相应的组件CSS文件
3. 确保在 `src/content/ui/styles/index.css` 中导入任何新的CSS文件
4. 更新平台适配器中的事件处理程序

### 弹出UI增强：

1. 使用新UI元素更新`public/popup.html`
2. 在`src/popup/popup.js`中添加事件处理程序

## 添加分析功能

要添加分析或跟踪功能：

1. 在`src/utils/analytics.js`中创建一个新模块
2. 实现跟踪事件、用户交互等的方法
3. 在后台、内容和弹出脚本中导入并使用分析模块

### 示例：

```javascript
// src/utils/analytics.js
export class Analytics {
  constructor(config) {
    this.enabled = config?.enabled || false;
    this.userId = config?.userId || null;
  }
  
  trackEvent(category, action, label, value) {
    if (!this.enabled) return;
    
    // 实现跟踪逻辑
    logger.log(`分析: ${category} - ${action} - ${label} - ${value}`);
  }
  
  // 更多分析方法
}
```

## 扩展最佳实践

1. **保持接口兼容**：始终实现基类中的所有必需方法
2. **配置驱动**：使所有新功能可配置
3. **错误处理**：实现适当的错误处理和回退机制
4. **性能考虑**：注意性能，特别是在网页上运行的内容脚本
5. **测试**：在多个浏览器和版本上测试扩展
6. **文档**：记录您的更改和新功能的使用方法

## 高级扩展

### 跨平台比较

要添加跨平台比较论文的功能：

1. 增强`Paper`模型以包含平台特定标识符
2. 实现论文匹配算法以识别重复项
3. 添加比较视图的UI元素

### 自定义摘要模板

要添加用户定义的摘要模板：

1. 扩展配置以包含可自定义模板
2. 更新LLM提供商以使用这些模板
3. 添加模板编辑的UI元素 