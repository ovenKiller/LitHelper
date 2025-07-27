# HTML Parser Utility

这个模块提供了一系列用于处理和解析HTML DOM元素的函数。

## 功能

### `simpleDOMtoXMLStructure(element, level)`

将DOM结构转换为一个简化的、带缩进的XML结构字符串，主要用于调试和可视化DOM层级。

### `parseDocumentToXMLStructure(doc)`

接收一个`document`对象，并将其`body`部分转换为XML结构字符串。

### `extractTextStructure(domElement, minLength)`

提取DOM元素中包含有意义文本的结构，并以XML格式返回。它会过滤掉不重要的标签和没有足够长文本内容的节点。

### `extractLargeTextBlocks(domElement, minLength)`

从指定的DOM元素中，递归地提取出所有长度超过`minLength`的大段纯文本。这个函数会智能地识别并返回最精细粒度的文本块，避免重复提取父子节点的文本。

**更新功能**：现在包含完整的文本清理功能，会自动过滤不可见字符（如\n、多余空格等），将连续的空白字符标准化为单个空格，并在判断文本长度和有效性时先进行清理再判断。

### `cleanText(text)`

**新增功能**：清理文本中的不可见字符和多余空白。
- 移除控制字符（保留基本空白字符进行后续处理）
- 将制表符和换行符转换为空格
- 将多个连续的空白字符替换为单个空格
- 移除首尾空白
- 返回清理后的规范化文本

### `isValidTextContent(text, minLength)`

检查一段文本是否为有效的、有意义的内容。现在使用`cleanText`函数先清理文本再进行有效性判断。

### `removeFormatTags(element)`

从一个DOM元素的克隆中移除所有纯格式化标签（如 `<b>`, `<i>`, `<span>` 等），并保留其文本内容。

### `truncateText(text, maxLength)`

将过长的文本截断，并附加上下文说明。 