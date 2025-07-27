# TaskHandler层文档

## AiExtractorTaskHandler AI提取任务处理器

功能定位：
专门处理AI内容提取相关的任务，包括论文元数据提取、内容分析等。

支持的任务类型：
- `PAPER_METADATA_EXTRACTION`: 论文元数据提取任务

核心功能：
1. **论文元数据提取**：从论文对象中提取标题、摘要、作者等元数据信息
2. **HTML内容解析**：对论文的HTML内容进行压缩和结构化处理
3. **AI服务集成**：调用AI服务进行智能内容提取和分析
4. **并发处理**：支持多个论文项的并行解析处理
5. **事件广播**：**新增** - 在论文预处理完成后广播`PAPER_PREPROCESSING_COMPLETED`事件

关键方法：
- `executePaperMetadataExtraction()`: 执行论文元数据提取任务
- `processPaperHtml()`: 处理论文HTML内容，包括压缩、元素提取和AI解析
- `parsePaperItem()`: 解析单个论文项，支持并行处理

**最新更新**：
- **论文预处理完成事件广播**：在创建预处理论文对象后，通过Chrome runtime消息API广播`PAPER_PREPROCESSING_COMPLETED`事件，包含以下数据：
  - `paper`: 预处理完成的论文对象
  - `taskKey`: 任务键名
  - `timestamp`: 完成时间戳
- **消息集成**：导入并使用MessageActions常量，确保消息类型的一致性
- **错误处理优化**：对事件广播失败进行容错处理，不影响主要处理流程

处理流程：
1. 接收论文元数据提取任务
2. 获取论文所有版本页面HTML（如果存在）
3. 解析HTML内容并提取论文项
4. 并行处理选中的论文项，提取摘要等信息
5. 创建预处理论文对象
6. **新增** - 广播论文预处理完成事件
7. 返回处理结果

## AiCrawlerTaskHandler AI爬虫任务处理器

功能定位：
专门处理AI驱动的网页内容抓取任务，智能识别和提取网页中的结构化信息。

支持的任务类型：
- `PAPER_ELEMENT_CRAWLER`: 论文元素抓取任务
- `PAPER_ELEMENT_INFO_EXTRACTOR`: 论文元素信息提取任务
