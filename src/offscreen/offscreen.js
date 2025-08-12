import {
  extractTextStructure,
  extractLargeTextBlocks
} from '../util/htmlParser.js';
import { MessageActions } from '../util/message.js';

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.target !== 'offscreen') {
    return;
  }

  // 处理获取网页内容的请求（支持JavaScript渲染）
  if (request.type === 'FETCH_HTML_WITH_JS') {
    handleFetchHtmlWithJS(request, sendResponse);
    return true; // 保持消息通道开放
  }

  if (request.action === MessageActions.PARSE_HTML) {
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
  } else if (request.action === MessageActions.EXTRACT_ELEMENTS) {
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
  } else if (request.action === MessageActions.COMPRESS_HTML) {
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
  } else if (request.action === MessageActions.EXTRACT_LARGE_TEXT_BLOCKS) {
    const { html, minLength = 100 } = request.data;
    
    try {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const textBlocks = extractLargeTextBlocks(doc.documentElement, minLength);
      
      sendResponse({
        success: true,
        data: {
          textBlocks: textBlocks
        }
      });
    } catch (error) {
      sendResponse({
        success: false,
        error: `Extracting large text blocks error: ${error.message}`
      });
    }
  }

  return true;
});

/**
 * 处理获取网页内容的请求（支持JavaScript渲染）
 * @param {Object} request - 请求对象
 * @param {Function} sendResponse - 响应函数
 */
async function handleFetchHtmlWithJS(request, sendResponse) {
  const { url, headers = {} } = request;

  try {
    console.log(`[Offscreen] 开始获取网页内容: ${url}`);

    // 创建一个隐藏的 iframe 来加载页面
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.style.width = '1024px';
    iframe.style.height = '768px';

    // 设置 iframe 的沙箱属性，允许脚本执行
    iframe.sandbox = 'allow-scripts allow-same-origin allow-forms allow-popups';

    document.body.appendChild(iframe);

    // 等待 iframe 加载完成
    const loadPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('页面加载超时'));
      }, 30000); // 30秒超时

      iframe.onload = () => {
        clearTimeout(timeout);
        resolve();
      };

      iframe.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('页面加载失败'));
      };
    });

    // 设置 iframe 的 src
    iframe.src = url;

    // 等待页面加载
    await loadPromise;

    // 等待额外时间让 JavaScript 执行
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 获取 iframe 中的文档内容
    let html;
    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;

      // 移除脚本和样式标签以减少大小
      const scripts = iframeDoc.querySelectorAll('script, style, noscript');
      scripts.forEach(el => el.remove());

      html = iframeDoc.documentElement.outerHTML;

      console.log(`[Offscreen] 成功获取网页内容: ${url}, 长度: ${html.length}`);
    } catch (crossOriginError) {
      console.warn(`[Offscreen] 跨域限制，使用 fetch 获取: ${url}`);

      // 如果因为跨域无法访问 iframe 内容，回退到 fetch
      const response = await fetch(url, {
        method: 'GET',
        headers: headers,
        credentials: 'omit',
        cache: 'no-cache'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      html = await response.text();
    }

    // 清理 iframe
    document.body.removeChild(iframe);

    sendResponse({
      success: true,
      html: html,
      url: url
    });

  } catch (error) {
    console.error(`[Offscreen] 获取网页内容失败: ${url}`, error);

    // 清理可能存在的 iframe
    const iframes = document.querySelectorAll('iframe[src="' + url + '"]');
    iframes.forEach(iframe => {
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
    });

    sendResponse({
      success: false,
      error: error.message,
      url: url
    });
  }
}

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