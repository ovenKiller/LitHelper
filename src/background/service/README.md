# Service层服务文档

## MessageService 消息服务

功能定位：
统一处理扩展内部消息的收发和分发，连接content script与background script之间的通信。

核心功能：
1. **消息路由**：根据消息action将请求分发到对应的处理器
2. **任务管理**：处理ADD_TASK_TO_QUEUE消息，将任务添加到任务队列
3. **任务通知**：向匹配的标签页发送任务完成通知
4. **配置管理**：处理配置相关的消息请求
5. **论文盒管理**：处理论文的添加、删除操作
6. **论文元数据处理**：处理PROCESS_PAPERS消息，调用paperMetadataService处理论文列表

核心方法：
- `initialize()`: 初始化消息服务和任务服务
- `handleAddTaskToQueue()`: 处理任务添加到队列的请求
- `handleProcessPapers()`: **新增** - 处理论文列表处理请求，调用paperMetadataService
- `handlePaperPreprocessingCompleted()`: **新增** - 处理论文预处理完成事件，调用paperMetadataService进行事件处理和缓存
- `sendTaskCompletionNotification()`: 发送任务完成通知给前台页面

支持的消息类型：
- `PROCESS_PAPERS`: 接收论文列表并通过paperMetadataService为每个论文创建AI提取任务
- `ADD_TASK_TO_QUEUE`: 将任务添加到任务队列
- `TASK_COMPLETION_NOTIFICATION`: 任务完成通知
- `PAPER_PREPROCESSING_COMPLETED`: **新增** - 论文预处理完成事件，由AiExtractorTaskHandler广播
- 其他配置和论文盒相关消息

最近修复：
- 修复了缺少常量导入导致的"Could not establish connection"错误
- 添加了AI_CRAWLER_SUPPORTED_TASK_TYPES和AI_EXTRACTOR_SUPPORTED_TASK_TYPES常量的导入
- **新增**：实现了PROCESS_PAPERS消息处理，支持GoogleScholarAdapter通过paperMetadataService创建论文提取任务
- **新增**：实现了PAPER_PREPROCESSING_COMPLETED消息处理，支持AiExtractorTaskHandler通过事件机制通知paperMetadataService论文预处理完成，实现自动缓存更新
- **关键修复**：修复了handleGetPaperBoxData方法永久阻塞问题 - 该方法之前被完全注释掉但仍在handlers中注册，导致GET_PAPER_BOX_DATA消息永远不会调用sendResponse，现已恢复正确实现使用paperBoxManager.getPaperBox()

## TaskService 任务服务

功能定位：
提供后台任务的综合执行、管理能力。

设计细节：
首先定义基础的任务执行能力。这些能力定义在基础任务类中，可以用于快速创建业务的任务执行器。
1、任务类的定义。任务类包含了一个任务执行所需的全部业务参数。包括任务的key、任务类型、任务状态、任务执行时的入参、任务的【执行状态】、任务的创建时间。承担的任务包括：根据任务类型找到合适的业务Handler（下面介绍Handler），将入参传入业务Handler来执行。创建时间主要是用于删除策略（下面介绍持久化策略时会介绍），任务的key用于唯一标志该任务。
2、任务的状态。包含等待执行、正在执行、已成功执行、已执行出错。四个状态。
3、任务队列。包含执行队列和等待队列，新任务直接进入执行队列，但是如果执行队列满，进入等待队列。两个队列的大小可以在创建执行器时配置
4、持久化机制。分业务持久化不同的队列，并可以在重启时恢复。恢复时保证完全还原任务的处理状态。为保证执行队列和等待队列的数据在持久化前后一致，需要及时更新它们的持久化信息。每种状态的任务有不同的策略可选，如不持久化、保存固定天数、保存固定条数。


然后，根据这个基础类，可以创建一系列handler。这些handler可以注册在taskService类中。当外界传入Task对象时，可以根据任务类型，调用不同的Handler。

## httpService
提供HTTP相关服务, 如获取指定url的html文本。
方法：
- `getHtml(url)`: 异步方法，根据传入的 URL，返回网页的 HTML 文本。

## htmlParserService
提供HTML解析服务，通过offscreen document安全地解析HTML并提取内容。

**最新优化**：
- 重构了offscreen.js，删除重复代码，改为导入util/htmlParser.js中的通用函数
- 优化了extractLargeTextBlocks方法，在判断长度前删除所有空白字符，但返回保留格式的文本块
- 遵循DRY原则，避免在多个文件中维护相同的HTML解析逻辑

详情见[htmlParserService.md](./htmlParserService.md)
