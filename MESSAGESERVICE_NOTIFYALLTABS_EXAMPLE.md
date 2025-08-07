# MessageService.notifyAllTabs 使用示例

## 概述

`MessageService` 现在提供了一个通用的 `notifyAllTabs` 方法，用于向所有标签页发送通知。这个方法被设计为可重用的通知机制，可以被系统中的任何组件使用。

## 方法签名

```javascript
async notifyAllTabs(action, data, source = 'MessageService')
```

### 参数说明

- `action` (string): 消息动作类型，通常使用 `MessageActions` 中定义的常量
- `data` (Object): 要发送的数据对象
- `source` (string, 可选): 发送源标识，用于日志记录，默认为 'MessageService'

## 使用示例

### 1. 在 PaperBoxManager 中的使用

```javascript
import { messageService } from '../service/messageService.js';

// 论文盒子更新通知
await messageService.notifyAllTabs(
  'paperBoxUpdated', 
  { papers: { ...paperBox } }, 
  'PaperBoxManager'
);
```

### 2. 在其他服务中的使用

```javascript
import { messageService } from '../service/messageService.js';
import { MessageActions } from '../../util/message.js';

// 任务完成通知
await messageService.notifyAllTabs(
  MessageActions.TASK_COMPLETION_NOTIFICATION,
  {
    taskType: 'PAPER_EXTRACTION',
    success: true,
    timestamp: Date.now()
  },
  'TaskService'
);

// 配置更新通知
await messageService.notifyAllTabs(
  MessageActions.CONFIG_UPDATED,
  {
    configType: 'AI_MODELS',
    updatedAt: Date.now()
  },
  'ConfigService'
);
```

### 3. 自定义通知示例

```javascript
// 用户操作通知
await messageService.notifyAllTabs(
  'userActionCompleted',
  {
    action: 'BULK_DOWNLOAD',
    itemCount: 25,
    status: 'completed'
  },
  'DownloadService'
);

// 系统状态通知
await messageService.notifyAllTabs(
  'systemStatusUpdate',
  {
    status: 'ready',
    services: ['TaskService', 'StorageService', 'AIService'],
    timestamp: Date.now()
  },
  'SystemManager'
);
```

## 特性

### 1. 错误处理
- 自动处理无法发送消息的标签页（如没有 content script 的标签页）
- 不会因为单个标签页发送失败而中断整个通知流程

### 2. 日志记录
- 详细的日志记录，包括发送开始、成功、失败等状态
- 使用 `source` 参数标识发送源，便于调试和监控

### 3. 异步处理
- 完全异步的实现，不会阻塞调用者
- 支持并发发送到多个标签页

## 与原有通知机制的对比

### 之前的实现（在 paperBoxManager 中）
```javascript
// 每个组件都需要实现自己的通知逻辑
async function notifyAllTabs(action, data) {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    try {
      await sendMessageToContentScript(tab.id, MessageActions.PAPER_BOX_UPDATED, data);
    } catch (error) {
      // 错误处理
    }
  }
}
```

### 现在的实现（在 MessageService 中）
```javascript
// 统一的通知服务，所有组件共享
await messageService.notifyAllTabs('paperBoxUpdated', data, 'PaperBoxManager');
```

## 优势

1. **代码复用**: 避免在多个组件中重复实现相同的通知逻辑
2. **统一管理**: 所有通知都通过 MessageService 处理，便于维护和监控
3. **标准化**: 统一的错误处理和日志记录机制
4. **可扩展**: 易于添加新的通知功能，如过滤、批量发送等
5. **调试友好**: 通过 `source` 参数可以轻松追踪通知来源

## 注意事项

1. **消息动作**: 建议使用 `MessageActions` 中定义的常量，保持一致性
2. **数据格式**: 确保发送的数据对象可以被 JSON 序列化
3. **性能考虑**: 对于频繁的通知，考虑添加防抖或节流机制
4. **错误处理**: 虽然方法内部处理了错误，但调用者仍应考虑通知失败的情况

## 扩展建议

未来可以考虑添加以下功能：

1. **选择性通知**: 只向特定 URL 模式的标签页发送通知
2. **通知队列**: 对于高频通知，实现队列机制避免性能问题
3. **通知确认**: 要求接收方确认收到通知
4. **通知过滤**: 基于标签页状态或用户设置过滤通知
