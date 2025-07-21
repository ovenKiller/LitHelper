# HTML解析服务 (HtmlParserService)

## 功能概述

`HtmlParserService` 是一个利用 Chrome 扩展的 Offscreen API 来解析 HTML 并提取 CSS 选择器结果的服务类。它提供了一系列方法来处理 HTML 字符串并根据 CSS 选择器提取相应的内容。

## 主要特性

- ✅ 基于 Offscreen API 的安全 HTML 解析
- ✅ 支持任意 CSS 选择器
- ✅ 多种提取模式：文本内容、innerHTML、outerHTML
- ✅ 完整的元素信息提取（包括属性、标签名等）
- ✅ 错误处理和日志记录
- ✅ 自动初始化和资源管理

## 使用方法

### 基本使用

```javascript
import { htmlParserService } from './htmlParserService.js';

// 提取文本内容
const textList = await htmlParserService.extractTextContent(htmlString, '.title');
console.log('提取到的文本:', textList);

// 提取HTML内容
const htmlList = await htmlParserService.extractInnerHTML(htmlString, '.content');
console.log('提取到的HTML:', htmlList);

// 获取元素数量
const count = await htmlParserService.getElementCount(htmlString, 'p');
console.log('段落数量:', count);
```

### 完整的元素信息提取

```javascript
const result = await htmlParserService.extractElements(htmlString, '.item');
if (result.success) {
  console.log(`找到 ${result.data.matchCount} 个元素`);
  result.data.elements.forEach((element, index) => {
    console.log(`元素 ${index}:`);
    console.log('- 文本内容:', element.textContent);
    console.log('- HTML内容:', element.innerHTML);
    console.log('- 标签名:', element.tagName);
    console.log('- 属性:', element.attributes);
  });
}
```

## API 参考

### 核心方法

#### `extractTextContent(html, selector)`
提取指定选择器匹配元素的文本内容。

**参数:**
- `html` (string): HTML字符串
- `selector` (string): CSS选择器

**返回:** `Promise<Array<string>>` - 文本内容数组

#### `extractInnerHTML(html, selector)`
提取指定选择器匹配元素的innerHTML内容。

**参数:**
- `html` (string): HTML字符串
- `selector` (string): CSS选择器

**返回:** `Promise<Array<string>>` - innerHTML内容数组

#### `extractOuterHTML(html, selector)`
提取指定选择器匹配元素的outerHTML内容。

**参数:**
- `html` (string): HTML字符串
- `selector` (string): CSS选择器

**返回:** `Promise<Array<string>>` - outerHTML内容数组

#### `extractElements(html, selector)`
提取指定选择器匹配元素的完整信息。

**参数:**
- `html` (string): HTML字符串
- `selector` (string): CSS选择器

**返回:** `Promise<Object>` - 包含以下结构的对象：
```javascript
{
  success: boolean,
  data: {
    selector: string,
    matchCount: number,
    elements: Array<{
      index: number,
      textContent: string,
      innerHTML: string,
      outerHTML: string,
      tagName: string,
      attributes: Object
    }>
  }
}
```

#### `getElementCount(html, selector)`
获取指定选择器匹配的元素数量。

**参数:**
- `html` (string): HTML字符串
- `selector` (string): CSS选择器

**返回:** `Promise<number>` - 匹配的元素数量

### 管理方法

#### `initialize()`
手动初始化服务（通常不需要手动调用，首次使用时会自动初始化）。

#### `destroy()`
销毁服务，清理资源。

## 使用示例

### 示例 1: 提取新闻标题

```javascript
const newsHtml = `
  <div class="news">
    <h2 class="title">新闻标题1</h2>
    <p class="content">新闻内容1...</p>
  </div>
  <div class="news">
    <h2 class="title">新闻标题2</h2>
    <p class="content">新闻内容2...</p>
  </div>
`;

const titles = await htmlParserService.extractTextContent(newsHtml, '.title');
console.log(titles); // ['新闻标题1', '新闻标题2']
```

### 示例 2: 提取商品信息

```javascript
const productHtml = `
  <div class="product" data-id="123">
    <h3 class="name">产品A</h3>
    <span class="price">¥99.99</span>
  </div>
`;

const products = await htmlParserService.extractElements(productHtml, '.product');
if (products.success) {
  products.data.elements.forEach(product => {
    console.log('产品ID:', product.attributes['data-id']);
    console.log('产品名称:', product.textContent);
  });
}
```

### 示例 3: 批量处理链接

```javascript
const pageHtml = await fetch(url).then(res => res.text());
const links = await htmlParserService.extractElements(pageHtml, 'a[href]');

const linkData = links.data.elements.map(link => ({
  url: link.attributes.href,
  text: link.textContent.trim(),
  title: link.attributes.title || ''
}));

console.log('提取到的链接:', linkData);
```

## 错误处理

服务内置了完善的错误处理机制：

```javascript
try {
  const result = await htmlParserService.extractTextContent(html, selector);
  // 处理成功结果
} catch (error) {
  console.error('提取失败:', error.message);
  // 处理错误情况
}
```

## 注意事项

1. **CSS选择器语法**: 支持标准的CSS选择器语法，包括类选择器、ID选择器、属性选择器、伪类选择器等
2. **HTML格式**: 输入的HTML字符串应该是格式良好的HTML，否则可能导致解析异常
3. **性能考虑**: 对于大量的HTML内容或复杂的选择器，解析可能需要一定时间
4. **内存使用**: 大量的HTML内容会占用较多内存，建议及时处理结果并清理引用

## 技术实现

- 使用 Chrome Offscreen API 创建独立的文档上下文
- 利用浏览器原生的 DOMParser 进行HTML解析
- 基于标准的 querySelector/querySelectorAll API 进行元素选择
- 异步消息传递机制确保主线程不被阻塞 