# AI爬虫任务处理器

这是一个继承自BaseHandler的AI爬虫任务处理器，专门用于处理AI驱动的网页爬虫任务，特别是针对学术论文平台的智能元素提取。

## 最新功能更新 (2024)

### 论文元素爬取任务 (`PAPER_ELEMENT_CRAWLER`)

**核心特性：**
- **灵活的样本处理策略**：不再要求最少样本数量，有多少论文项就处理多少
- **智能样本分配**：
  - 1个样本：全部用于学习，无验证
  - 2个样本：1个学习，1个验证  
  - 3个样本：2个学习，1个验证
  - 4个以上：约一半学习，其余验证
- **宽松验证策略**：采用30%成功率阈值，即使验证失败也不中止任务
- **多阶段处理流程**：提取论文项 → 生成子选择器 → 灵活验证 → 保存配置

**任务参数：**
```javascript
const paperCrawlerTask = {
  key: 'crawl_papers_googlescholar',
  type: 'PAPER_ELEMENT_CRAWLER',
  params: {
    url: 'https://scholar.google.com/scholar?q=machine+learning',
    platform: 'google_scholar',
    pageHTML: '完整的页面HTML内容',
    timestamp: Date.now()
  }
};
```

**执行流程：**
1. **阶段一**：从页面HTML提取论文项列表
2. **阶段二**：基于样本生成子元素选择器（标题、摘要、链接等）
3. **阶段三**：灵活验证生成的选择器（可选，不强制）
4. **阶段四**：保存PlatformSelector配置并发送通知

**AI智能验证策略：**
- **AI驱动验证**：使用大语言模型进行选择器提取结果的智能验证
- **上下文分析**：结合原始论文项HTML、选择器配置和提取结果进行综合判断
- **精准反馈**：AI可识别提取错误的具体原因并提供选择器优化建议
- **智能置信度**：为每个提取器提供0.0-1.0的置信度评分
- **容错机制**：即使AI验证失败也不中止任务，保证系统健壮性
- **多维度评估**：针对标题、摘要、链接等不同内容类型提供专项验证

## 特性

- 继承自BaseHandler，具备完整的任务队列管理功能
- 执行队列长度：5个任务
- 等待队列长度：10个任务
- 最大并发数：3个任务
- 不需要持久化存储
- 支持多种爬虫任务类型
- 内置速率限制和错误处理

## 支持的任务类型

1. **论文元素爬取** (`PAPER_ELEMENT_CRAWLER`) - **主要功能**
   - 智能提取学术论文页面的结构化数据
   - 自动生成和验证CSS/Regex选择器
   - 支持Google Scholar等主流学术平台
   - 灵活的样本处理和验证策略

## 使用方法

### 1. 启动处理器

```javascript
import { AiCrawlerTaskHandler } from './aiCrawlerTaskHandler.js';

const handler = new AiCrawlerTaskHandler();
await handler.start();
```

### 2. 添加论文爬取任务

```javascript
const paperTask = {
  key: 'extract_papers_' + Date.now(),
  type: 'PAPER_ELEMENT_CRAWLER',
  params: {
    url: 'https://scholar.google.com/scholar?q=deep+learning',
    platform: 'google_scholar',
    pageHTML: document.documentElement.outerHTML,
    timestamp: Date.now()
  }
};

await handler.addTask(paperTask);
```

### 3. 监控任务执行

```javascript
// 获取处理器状态
const status = handler.getStatus();
console.log('处理器状态:', status);

// 监听任务完成通知
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'TASK_COMPLETION_NOTIFICATION') {
    console.log('任务完成:', message.data);
  }
});
```

### 4. 任务结果示例

```javascript
{
  success: true,
  data: {
    platformSelector: PlatformSelector实例,
    elementCount: 15,           // 提取的论文项数量
    learningSampleCount: 8,     // 学习样本数量
    validationSampleCount: 7,   // 验证样本数量
    extractorCount: 4,          // 生成的提取器数量
    validationPassed: true      // 验证是否通过
  },
  message: "成功生成并保存了完整的PlatformSelector，包含 4 个提取器"
}
```

### 5. 停止处理器

```javascript
await handler.stop();
```

## 技术细节

### 验证策略
- **成功率阈值**：30%的验证成功率即认为通过
- **错误容忍**：记录但不阻止任务继续执行
- **统计报告**：提供详细的验证成功/失败统计

### 样本分配算法
- 动态调整学习和验证样本比例
- 保证至少有1个学习样本
- 充分利用所有可用样本

### 最新修复 (2024)
- **修复了htmlParserService返回值处理问题**：正确解析extractElements方法返回的对象结构
- **改进了验证方法**：使用htmlParserService替代直接DOM操作，确保在background script环境中正常工作
- **增强了错误处理**：对CSS和正则选择器验证失败提供更好的错误处理和日志记录
- **修复了PlatformSelector key生成不匹配问题**：统一删除platformKey部分，使保存和查询时的key格式保持一致(`${domain}_${pageType}`)，解决了"没有可用的PlatformSelector，创建AI学习任务"的问题
