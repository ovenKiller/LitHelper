chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.target !== 'offscreen') {
    return;
  }

  if (request.action === 'parseHTML') {
    const { html, platform } = request.data;
    const doc = new DOMParser().parseFromString(html, 'text/html');

    const selectors = generateSelectors(doc, platform);
    const validation = validateSelectors(doc, selectors);

    sendResponse({
      success: true,
      data: {
        selectors,
        validation,
      },
    });
  } else if (request.action === 'extractElements') {
    const { html, selector } = request.data;
    
    try {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const elements = doc.querySelectorAll(selector);
      
      const results = [];
      elements.forEach((element, index) => {
        results.push({
          index: index,
          textContent: element.textContent?.trim() || '',
          innerHTML: element.innerHTML || '',
          outerHTML: element.outerHTML || '',
          tagName: element.tagName?.toLowerCase() || '',
          attributes: getElementAttributes(element)
        });
      });

      sendResponse({
        success: true,
        data: {
          selector: selector,
          matchCount: results.length,
          elements: results
        }
      });
    } catch (error) {
      sendResponse({
        success: false,
        error: `Invalid selector or parsing error: ${error.message}`
      });
    }
  } else if (request.action === 'compressHtml') {
    const { html, minLength = 20 } = request.data;
    
    try {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const compressedHtml = extractTextStructure(doc.documentElement, minLength);
      
      sendResponse({
        success: true,
        data: {
          compressedHtml: compressedHtml
        }
      });
    } catch (error) {
      sendResponse({
        success: false,
        error: `HTML compression error: ${error.message}`
      });
    }
  }

  return true; 
});

function generateSelectors(doc, platform) {
  const selectors = {};
  
  if (platform === 'googleScholar') {
    const paperItemCandidates = ['.gs_ri', '.gs_or', '.gs_scl', '.gs_ri.gs_or.gs_scl'];
    selectors.paperItems = findBestSelector(doc, paperItemCandidates);
    
    const titleCandidates = ['.gs_rt a', '.gs_rt h3 a', 'h3 a'];
    selectors.paperTitle = findBestSelector(doc, titleCandidates);
    
    const authorCandidates = ['.gs_a'];
    selectors.paperAuthors = findBestSelector(doc, authorCandidates);
    
    const abstractCandidates = ['.gs_rs'];
    selectors.paperAbstract = findBestSelector(doc, abstractCandidates);
  }
  
  return selectors;
}

function findBestSelector(doc, candidates) {
  let bestSelector = null;
  let maxCount = 0;
  
  for (const candidate of candidates) {
    try {
      const elements = doc.querySelectorAll(candidate);
      if (elements.length > maxCount) {
        maxCount = elements.length;
        bestSelector = {
          selector: candidate,
          matchCount: elements.length
        };
      }
    } catch (error) {
      console.warn(`[Offscreen] Invalid selector: ${candidate}`);
    }
  }
  
  return bestSelector;
}

function validateSelectors(doc, selectors) {
  const validation = {};
  
  for (const [key, selectorInfo] of Object.entries(selectors)) {
    if (selectorInfo && selectorInfo.selector) {
      try {
        const elements = doc.querySelectorAll(selectorInfo.selector);
        validation[key] = {
          isValid: elements.length > 0,
          elementCount: elements.length,
          selector: selectorInfo.selector
        };
      } catch (error) {
        validation[key] = {
          isValid: false,
          error: error.message
        };
      }
    } else {
      validation[key] = {
        isValid: false,
        error: 'No valid selector found'
      };
    }
  }
  
  return validation;
}

/**
 * 获取元素的所有属性
 * @param {Element} element - DOM元素
 * @returns {Object} 属性对象
 */
function getElementAttributes(element) {
  const attributes = {};
  if (element.attributes) {
    for (let i = 0; i < element.attributes.length; i++) {
      const attr = element.attributes[i];
      attributes[attr.name] = attr.value;
    }
  }
  return attributes;
} 

// ====== HTML压缩相关函数 ======

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
                const textNode = clonedElement.ownerDocument.createTextNode(textContent);
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
                const truncatedText = truncateText(textContent, 20);
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