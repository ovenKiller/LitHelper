# AI爬虫任务处理器

这是一个继承自BaseHandler的AI爬虫任务处理器，专门用于处理AI驱动的网页爬虫任务。

## 特性

- 继承自BaseHandler，具备完整的任务队列管理功能
- 执行队列长度：5个任务
- 等待队列长度：10个任务
- 不需要持久化存储
- 支持多种爬虫任务类型
- 内置速率限制和错误处理

## 支持的任务类型

1. **网页爬取** (`crawl_webpage`)
   - 爬取指定网页内容
   - 支持自定义CSS选择器
   - 返回结构化数据

2. **数据提取** (`extract_data`)
   - 从现有内容中提取结构化数据
   - 支持自定义提取规则
   - AI智能提取

3. **内容分析** (`analyze_content`)
   - 对内容进行语义分析
   - 情感分析
   - 关键词提取

4. **批量爬取** (`batch_crawl`)
   - 批量处理多个URL
   - 并发控制
   - 统计结果

## 使用方法

### 1. 启动处理器

```javascript
import { aiCrawlerTaskHandler } from './aiCrawlerTaskHandler.js';

// 启动处理器
await aiCrawlerTaskHandler.start();
```

### 2. 添加任务

#### 网页爬取任务

```javascript
const crawlTask = {
  key: 'crawl_example_com',
  type: 'crawl_webpage',
  params: {
    url: 'https://example.com',
    selectors: {
      title: 'h1',
      content: '.content',
      links: 'a'
    },
    options: {
      timeout: 30000,
      waitFor: 'domcontentloaded'
    }
  }
};

await aiCrawlerTaskHandler.addTask(crawlTask);
```

#### 数据提取任务

```javascript
const extractTask = {
  key: 'extract_entities',
  type: 'extract_data',
  params: {
    content: 'HTML或文本内容',
    extractionRules: [
      {
        field: 'email',
        pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
      },
      {
        field: 'phone',
        pattern: /\d{3}-\d{3}-\d{4}/g
      }
    ]
  }
};

await aiCrawlerTaskHandler.addTask(extractTask);
```

#### 内容分析任务

```javascript
const analyzeTask = {
  key: 'analyze_sentiment',
  type: 'analyze_content',
  params: {
    content: '要分析的文本内容',
    analysisType: 'sentiment',
    options: {
      language: 'zh-CN',
      detailed: true
    }
  }
};

await aiCrawlerTaskHandler.addTask(analyzeTask);
```

#### 批量爬取任务

```javascript
const batchTask = {
  key: 'batch_crawl_sites',
  type: 'batch_crawl',
  params: {
    urls: [
      'https://example1.com',
      'https://example2.com',
      'https://example3.com'
    ],
    options: {
      concurrency: 2,
      delay: 1000
    }
  }
};

await aiCrawlerTaskHandler.addTask(batchTask);
```

### 3. 监控任务状态

```javascript
// 获取处理器状态
const status = aiCrawlerTaskHandler.getStatus();
console.log('处理器状态:', status);

// 获取队列信息
const queueInfo = aiCrawlerTaskHandler.getQueueInfo();
console.log('队列信息:', queueInfo);

// 获取特定任务
const task = aiCrawlerTaskHandler.getTask('crawl_example_com');
console.log('任务状态:', task.status);
```

### 4. 停止处理器

```javascript
// 停止处理器
await aiCrawlerTaskHandler.stop();
```

## 配置说明

### 队列配置

- `executionQueueSize`: 5 - 执行队列大小
- `waitingQueueSize`: 10 - 等待队列大小
- `maxConcurrency`: 3 - 最大并发数

### 爬虫配置

- `userAgent`: 自定义User-Agent
- `timeout`: 30000毫秒 - 请求超时时间
- `maxRetries`: 3 - 最大重试次数
- `retryDelay`: 1000毫秒 - 重试延迟
- `rateLimit`: 每分钟10个请求 - 速率限制

## 错误处理

处理器会自动处理以下错误类型：

- **TimeoutError**: 请求超时
- **NetworkError**: 网络错误
- **RateLimitError**: 速率限制错误

每种错误类型都有相应的处理逻辑和重试机制。

## 扩展开发

目前具体的爬虫逻辑部分标记为TODO，需要根据实际需求实现：

1. HTTP请求处理
2. HTML解析
3. 数据提取算法
4. AI模型集成
5. 错误重试机制

## 注意事项

1. 请遵守目标网站的robots.txt规则
2. 合理设置请求间隔，避免对目标服务器造成压力
3. 处理个人信息时要遵守相关法律法规
4. 建议在生产环境中添加更完善的错误处理和日志记录 