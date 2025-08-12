# PaperMetadataService 使用指南

## 概述

`PaperMetadataService` 是 LitHelper 的核心服务之一，负责处理和管理论文元数据信息。该服务提供了完整的 Paper 对象属性定义、验证机制和缓存管理功能。

## Paper 对象属性说明

### 必需属性

| 属性名 | 类型 | 描述 |
|--------|------|------|
| `id` | `string` | 论文唯一标识符，用于区分不同论文 |
| `title` | `string` | 论文标题 |

### 可选属性

| 属性名 | 类型 | 描述 |
|--------|------|------|
| `authors` | `string` | 作者信息，多个作者用逗号分隔 |
| `abstract` | `string` | 论文摘要 |
| `urls` | `string[]` | 论文相关URL数组 |
| `pdfUrl` | `string` | PDF下载链接 |
| `publicationDate` | `string` | 发表日期 |
| `venue` | `string` | 发表会议或期刊名称 |
| `keywords` | `string[]` | 关键词数组 |
| `citationCount` | `number` | 引用次数 |
| `platform` | `string` | 平台标识符（如：googleScholar, ieee等） |
| `allVersionsUrl` | `string` | 所有版本链接（Google Scholar专用） |
| `element` | `HTMLElement` | 对应的DOM元素（仅在前端使用，不会被序列化） |
| `sourceUrl` | `string` | 来源页面URL |
| `updateTime` | `string` | 最后更新时间（ISO字符串格式） |
| `processing` | `boolean` | 是否正在处理中 |
| `html` | `string` | 论文元素的HTML内容（用于AI提取） |
| `metadata` | `object` | 平台特定的额外元数据 |

## 支持的平台

- `googleScholar` - Google Scholar
- `semanticScholar` - Semantic Scholar  
- `arxiv` - arXiv
- `ieee` - IEEE Xplore
- `scienceDirect` - ScienceDirect
- `springer` - Springer
- `acm` - ACM Digital Library

## 主要方法

### 1. 创建和验证 Paper 对象

```javascript
import { paperMetadataService } from './paperMetadataService.js';
import { Paper } from '../../model/Paper.js';

// 创建标准Paper对象
const paper = paperMetadataService.createStandardPaper({
  id: 'paper-001',
  title: 'Deep Learning Research',
  authors: 'John Doe, Jane Smith',
  platform: 'googleScholar'
});

// 验证Paper对象
const isValid = paperMetadataService.validatePaper(paper);
console.log('Paper对象是否有效:', isValid);
```

### 2. 检查 Paper 对象完整性

```javascript
const completenessReport = paperMetadataService.checkPaperCompleteness(paper);
console.log('完整性报告:', completenessReport);

// 报告结构:
// {
//   isValid: boolean,           // 是否通过基本验证
//   completeness: number,       // 完整度百分比 (0-100)
//   missingFields: string[],    // 缺失的必需字段
//   invalidFields: object[],    // 类型错误的字段
//   warnings: string[],         // 警告信息
//   suggestions: string[]       // 改进建议
// }
```

### 3. 获取属性架构

```javascript
// 获取Paper对象的完整属性架构
const schema = paperMetadataService.getPaperAttributeSchema();
schema.forEach(attr => {
  console.log(`${attr.name}: ${attr.type} - ${attr.description}`);
});
```

### 4. 缓存管理

```javascript
// 缓存Paper对象
const cacheSuccess = paperMetadataService.cachePaper(paper);

// 获取缓存的Paper对象
const cachedPaper = paperMetadataService.getCachedPaper('paper-001');

// 获取所有缓存的Paper对象
const allCachedPapers = paperMetadataService.getAllCachedPapers();

// 清空缓存
paperMetadataService.clearCache();
```

### 5. 处理论文列表

```javascript
import { PLATFORM_KEYS, PAGE_TYPE } from '../../constants.js';

const papers = [
  { id: 'paper-1', title: 'Paper 1', authors: 'Author 1' },
  { id: 'paper-2', title: 'Paper 2', authors: 'Author 2' }
];

// 处理论文列表
const success = await paperMetadataService.processPapers(
  PLATFORM_KEYS.GOOGLE_SCHOLAR,
  PAGE_TYPE.SEARCH_RESULTS,
  papers
);
```

## 最佳实践

### 1. 创建 Paper 对象时的建议

```javascript
// ✅ 推荐：提供尽可能完整的信息
const goodPaper = {
  id: 'unique-paper-id',
  title: 'Complete Paper Title',
  authors: 'Author One, Author Two',
  abstract: 'Detailed abstract...',
  pdfUrl: 'https://example.com/paper.pdf',
  platform: PLATFORM_KEYS.GOOGLE_SCHOLAR,
  html: '<div>Paper HTML content</div>' // 用于AI提取
};

// ❌ 避免：只提供最少信息
const badPaper = {
  id: 'paper-id',
  title: 'Title'
  // 缺少其他有用信息
};
```

### 2. 错误处理

```javascript
try {
  const isValid = paperMetadataService.validatePaper(paper);
  if (!isValid) {
    // 检查详细的完整性报告
    const report = paperMetadataService.checkPaperCompleteness(paper);
    console.error('Paper验证失败:', report.missingFields);
  }
} catch (error) {
  console.error('处理Paper时发生错误:', error);
}
```

### 3. 类型安全

```javascript
// 使用TypeScript或JSDoc注释确保类型安全
/**
 * @param {Paper|PaperObject} paper
 * @returns {boolean}
 */
function processPaper(paper) {
  return paperMetadataService.validatePaper(paper);
}
```

## 示例代码

完整的使用示例请参考 `paperMetadataService.example.js` 文件，其中包含了各种使用场景的详细示例。

## 注意事项

1. **必需字段**: `id` 和 `title` 是必需的，缺少这些字段会导致验证失败
2. **类型验证**: 所有字段都有严格的类型要求，传入错误类型会导致验证失败
3. **HTML内容**: 为了获得最佳的AI提取效果，建议提供 `html` 或 `element` 属性
4. **平台标识**: `platform` 字段应使用 `PLATFORM_KEYS` 中定义的值
5. **缓存管理**: 缓存的Paper对象会自动移除 `element` 属性以避免序列化问题

## 故障排除

### 常见问题

1. **验证失败**: 检查必需字段是否存在，字段类型是否正确
2. **缓存失败**: 确保Paper对象有有效的 `id` 字段
3. **AI提取效果差**: 确保提供了 `html` 内容或 `element` 属性

### 调试技巧

```javascript
// 使用完整性检查获取详细信息
const report = paperMetadataService.checkPaperCompleteness(paper);
console.log('调试信息:', {
  isValid: report.isValid,
  completeness: report.completeness + '%',
  issues: [...report.missingFields, ...report.invalidFields],
  suggestions: report.suggestions
});
```
