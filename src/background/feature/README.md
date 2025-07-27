# Feature层服务文档

## PaperMetadataService 论文元数据服务

功能定位：
负责处理和保存论文元数据信息，为论文对象创建AI提取任务，提供论文数据缓存管理。

核心功能：
1. **论文对象处理**：批量处理论文对象列表，为每个论文创建AI元数据提取任务
2. **任务创建**：为单个论文创建`PAPER_METADATA_EXTRACTION`类型的AI提取任务
3. **参数验证**：验证来源域名、页面类型和论文对象的有效性
4. **论文缓存管理**：提供论文数据的内存缓存功能，以论文标题为键值存储
5. **事件处理**：**新增** - 监听和处理论文预处理完成事件

关键方法：
- `processPapers()`: 处理论文对象列表，为每个论文创建AI提取任务
- `processPaper()`: 处理单个论文，验证并创建提取任务
- `createPaperMetadataExtractionTask()`: 为论文创建AI元数据提取任务
- `cachePaper()`: 缓存单个论文数据到内存
- `handlePaperPreprocessingCompleted()`: **新增** - 处理论文预处理完成事件

**最新更新**：
- **论文预处理完成事件处理**：新增`handlePaperPreprocessingCompleted()`方法，专门用于接收和处理来自AiExtractorTaskHandler的预处理完成事件
- **智能事件解析**：详细解析事件数据，包括论文对象、任务键名和时间戳
- **数据完整性验证**：验证事件数据的完整性，确保包含必要的paper字段
- **详细日志记录**：提供完整的事件处理日志，包括论文信息、任务键、时间戳等详细信息
- **自动缓存机制**：接收到预处理完成事件后，自动将论文数据缓存到内存中的paperCache
- **论文信息摘要**：智能显示摘要长度或标记无摘要状态，便于监控处理结果
- **错误容错**：完善的错误处理机制，确保事件处理失败不影响系统稳定性
- **缓存优化**：优化缓存存储机制，只保存必要字段（id、title、pdfUrl、abstract、updateTime），减少内存占用

支持的事件类型：
- `PAPER_PREPROCESSING_COMPLETED`: 论文预处理完成事件，由AiExtractorTaskHandler广播

事件数据结构：
```javascript
{
  paper: {
    id: 'paper123',
    title: '论文标题',
    pdfUrl: '下载链接',
    abstract: '论文摘要（可选）',
    updateTime: '2024-01-01T00:00:00.000Z'
  },
  taskKey: 'paper_metadata_extraction_googlescholar_paper123_1234567890',
  timestamp: '2024-01-01T00:00:00.000Z'
}
```

处理流程：
1. 接收来自content script的`PROCESS_PAPERS`消息
2. 验证输入参数（来源域名、页面类型、论文列表）
3. 遍历论文列表，为每个论文创建AI提取任务
4. 通过TaskService将任务添加到队列
5. **新增** - 监听`PAPER_PREPROCESSING_COMPLETED`事件
6. **新增** - 解析事件数据并缓存预处理完成的论文

缓存机制：
- 使用Map结构存储论文数据，键为论文标题
- 提供论文缓存的增删查改操作
- **新增** - 支持事件驱动的自动缓存更新
- **优化** - 缓存字段限制：只缓存必要字段（id、title、pdfUrl、abstract、updateTime），避免存储完整paper对象
- 缓存成功率监控和日志记录

依赖注入：
- 需要通过`setTaskService()`方法设置TaskService实例
- 支持任务队列的直接操作，避免消息传递的复杂性

## PaperBoxManager 论文盒子管理器

功能定位：
管理用户收藏的论文列表，提供论文的添加、删除、获取等操作。

核心功能：
1. **论文收藏管理**：添加和删除论文到个人收藏盒子
2. **数据持久化**：使用Chrome Storage API保存论文数据
3. **重复检测**：防止重复添加相同论文
4. **数据同步**：保证数据的实时同步和一致性

关键方法：
- `getPaperBox()`: 获取当前论文盒子中的所有论文
- `addPaperToBox()`: 添加论文到盒子，支持重复检测
- `removePaperFromBox()`: 从盒子中删除指定论文
- `isPaperInBox()`: 检查论文是否已在盒子中

数据结构：
```javascript
{
  papers: [
    {
      id: 'paper123',
      title: '论文标题',
      authors: ['作者1', '作者2'],
      abstract: '论文摘要',
      url: '论文链接',
      addedAt: '2024-01-01T00:00:00.000Z'
    }
  ],
  lastUpdated: '2024-01-01T00:00:00.000Z'
}
```

## SummarizationHandler 摘要处理器

功能定位：
处理论文摘要的生成、存储和管理，集成AI服务提供智能摘要功能。

核心功能：
1. **AI摘要生成**：调用AI服务为论文生成智能摘要
2. **摘要存储**：持久化保存生成的摘要数据
3. **批量处理**：支持对多篇论文进行批量摘要生成
4. **摘要检索**：提供摘要的查询和获取功能

关键方法：
- `summarizePaper()`: 为单篇论文生成摘要
- `summarizeAllPapers()`: 批量为多篇论文生成摘要
- `getAllSummaries()`: 获取所有已生成的摘要
- `getSummary()`: 获取指定论文的摘要

摘要生成流程：
1. 接收论文对象和摘要选项
2. 调用AI服务生成摘要内容
3. 保存摘要到本地存储
4. 返回生成结果和摘要内容