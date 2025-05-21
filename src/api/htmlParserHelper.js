function simpleDOMtoXML(element, level = 0) {
    // 创建缩进
    const indent = '  '.repeat(level);
    
    // 获取类名
    const classAttr = element.className ? ` class="${element.className}"` : '';
    
    // 开始标签
    let result = `${indent}<${element.tagName.toLowerCase()}${classAttr}>\n`;
    
    // 递归处理子元素
    for (let i = 0; i < element.children.length; i++) {
      result += simpleDOMtoXML(element.children[i], level + 1);
    }
    
    // 闭合标签
    result += `${indent}</${element.tagName.toLowerCase()}>\n`;
    
    return result;
  }

function parseDocumentToXML(doc) {
    return simpleDOMtoXML(doc.body);
}

// 导出函数
export {
    simpleDOMtoXML,
    parseDocumentToXML
};

