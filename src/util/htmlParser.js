function simpleDOMtoXMLStructure(element, level = 0) {  // 将DOM结构转换为XML结构
    // 创建缩进
    const indent = '  '.repeat(level);
    
    // 获取类名
    const classAttr = element.className ? ` class="${element.className}"` : '';
    
    // 开始标签
    let result = `${indent}<${element.tagName.toLowerCase()}${classAttr}>\n`;
    
    // 递归处理子元素
    for (let i = 0; i < element.children.length; i++) {
      result += simpleDOMtoXMLStructure(element.children[i], level + 1);
    }
    
    // 闭合标签
    result += `${indent}</${element.tagName.toLowerCase()}>\n`;
    
    return result;
  }

function parseDocumentToXMLStructure(doc) {
    return simpleDOMtoXMLStructure(doc.body);
}

// 文字区域提取功能

// 需要删除的格式标签
const FORMAT_TAGS = [
    'b', 'strong', 'i', 'em', 'u', 'small', 'mark', 
    'del', 'ins', 'sub', 'sup', 'span', 'font', 'code'
];

// 需要忽略的元素
const IGNORE_ELEMENTS = [
    'script', 'style', 'noscript', 'nav', 'header', 
    'footer', 'aside', 'form', 'button'
];

/**
 * 判断文字内容是否有效
 * @param {string} text - 文字内容
 * @param {number} minLength - 最小字符长度
 * @returns {boolean} 是否为有效文字
 */
function isValidTextContent(text, minLength = 5) {
    const cleanText = text.trim();
    
    // 基础长度检查
    if (cleanText.length < minLength) return false;
    
    // 文字质量检查：必须包含字母或汉字
    const hasValidChars = /[a-zA-Z\u4e00-\u9fa5]/.test(cleanText);
    if (!hasValidChars) return false;
    return true;
}

/**
 * 删除格式标签，保留文字内容
 * @param {Element} element - DOM元素
 * @returns {Element} 处理后的元素
 */
function removeFormatTags(element) {
    if (!element) return element;
    
    const clonedElement = element.cloneNode(true);
    
    // 找到所有格式标签（使用更安全的选择器）
    try {
        const formatElements = clonedElement.querySelectorAll(FORMAT_TAGS.join(','));
        
        // 从后往前删除（避免NodeList变化影响）
        Array.from(formatElements).reverse().forEach(formatEl => {
            if (formatEl && formatEl.parentNode) {
                const textContent = formatEl.textContent;
                const textNode = document.createTextNode(textContent);
                formatEl.parentNode.replaceChild(textNode, formatEl);
            }
        });
    } catch (e) {
        console.warn('格式标签删除时出错:', e);
    }
    
    return clonedElement;
}

/**
 * 截断文字并添加说明
 * @param {string} text - 原始文字
 * @param {number} maxLength - 最大长度，默认10
 * @returns {string} 处理后的文字
 */
function truncateText(text, maxLength = 10) {
    if (text.length <= maxLength) {
        return text;
    }
    
    const truncated = text.substring(0, maxLength);
    const suffix = `(已截断，共${text.length}字)`;
    return truncated + suffix;
}

/**
 * 检查元素是否包含有效文字内容
 * @param {Element} element - DOM元素
 * @param {number} minLength - 最小字符长度
 * @returns {boolean} 是否包含有效文字
 */
function hasValidText(element, minLength) {
    // 检查是否为有效的元素
    if (!element) {
        return false;
    }
    
    // 获取标签名，如果没有则使用默认值
    const tagName = (element.tagName || 'div').toLowerCase();
    
    // 跳过忽略的元素
    if (IGNORE_ELEMENTS.includes(tagName)) {
        return false;
    }
    
    // 跳过隐藏元素
    try {
        const style = window.getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden') {
            return false;
        }
    } catch (e) {
        // 如果无法获取样式，继续处理（可能在特殊环境中）
        console.warn('无法获取元素样式:', e);
    }
    
    // 获取纯文字内容
    const textContent = element.textContent.trim();
    
    // 判断文字有效性
    return isValidTextContent(textContent, minLength);
}

/**
 * 提取DOM元素中的文字结构
 * @param {Element} domElement - DOM元素
 * @param {number} minLength - 字符下限
 * @returns {string} 文字元素的XML结构
 */
function extractTextStructure(domElement, minLength = 20) {
    // 检查入参是否存在
    if (!domElement) {
        console.warn('传入的element为空，请检查是否为document.body且页面已加载完成');
        return '';
    }
    
    // 如果传入的是document而不是document.body，自动转换
    if (domElement === document) {
        console.warn('传入的是document对象，已自动转换为document.body');
        if (!document.body) {
            console.error('document.body为null，页面可能未完全加载');
            return '';
        }
        domElement = document.body;
    }
    
    // 检查document.body是否为null
    if (domElement === document.body && domElement === null) {
        console.error('document.body为null，页面可能未完全加载');
        return '';
    }
    
    /**
     * 递归构建文字结构
     * @param {Element} element - 当前元素
     * @param {number} level - 层级深度
     * @returns {string} XML结构字符串
     */
    function buildTextStructure(element, level = 0) {
        // 检查是否为有效的元素
        if (!element) {
            return '';
        }
        
        const indent = '  '.repeat(level);
        let result = '';
        
        // 获取标签名，如果没有则使用默认值
        const tagName = (element.tagName || 'div').toLowerCase();
        
        // 检查当前元素是否包含有效文字
        const hasText = hasValidText(element, minLength);
        
        if (hasText) {
            // 删除格式标签
            const cleanElement = removeFormatTags(element);
            const textContent = cleanElement.textContent.trim();
            
            // 如果当前元素直接包含文字（没有子元素或子元素都是格式标签）
            const hasStructuralChildren = Array.from(element.children).some(child => {
                if (!child) return false;
                const childTagName = (child.tagName || 'div').toLowerCase();
                return !FORMAT_TAGS.includes(childTagName);
            });
            
            if (!hasStructuralChildren && textContent) {
                // 叶子文字节点：输出文字内容
                const truncatedText = truncateText(textContent,20);
                const classAttr = element.className ? ` class="${element.className}"` : '';
                result = `${indent}<${tagName}${classAttr}>${truncatedText}</${tagName}>\n`;
            } else {
                // 结构节点：递归处理子元素
                const classAttr = element.className ? ` class="${element.className}"` : '';
                result = `${indent}<${tagName}${classAttr}>\n`;
                
                // 处理子元素
                for (let child of element.children) {
                    // 确保子元素是有效的元素
                    if (child) {
                        const childResult = buildTextStructure(child, level + 1);
                        if (childResult) {
                            result += childResult;
                        }
                    }
                }
                
                result += `${indent}</${tagName}>\n`;
            }
        } else {
            // 当前元素无有效文字，但检查子元素
            let hasValidChildren = false;
            let childResults = '';
            
            for (let child of element.children) {
                // 确保子元素是有效的元素
                if (child) {
                    const childResult = buildTextStructure(child, level + 1);
                    if (childResult) {
                        childResults += childResult;
                        hasValidChildren = true;
                    }
                }
            }
            
            if (hasValidChildren) {
                const classAttr = element.className ? ` class="${element.className}"` : '';
                result = `${indent}<${tagName}${classAttr}>\n`;
                result += childResults;
                result += `${indent}</${tagName}>\n`;
            }
        }
        
        return result;
    }
    
    return buildTextStructure(domElement);
}

// 导出函数
export {
    simpleDOMtoXMLStructure,
    parseDocumentToXMLStructure,
    extractTextStructure,
    isValidTextContent,
    removeFormatTags,
    truncateText
};

