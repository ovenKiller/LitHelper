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
  let iframe = null; // 在函数作用域声明 iframe

  try {
    console.log(`[Offscreen] 开始获取网页内容: ${url}`);


    // 创建一个隐藏的 iframe 来加载页面
    iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.style.width = '1024px';
    iframe.style.height = '768px';

    // 设置 iframe 的沙箱属性，允许脚本执行和更多权限
    // 注意：某些网站可能仍然会阻止跨域访问
    iframe.sandbox = 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation allow-top-navigation-by-user-activation allow-downloads';

    // 尝试设置更宽松的权限策略
    iframe.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
    iframe.setAttribute('loading', 'eager');

    document.body.appendChild(iframe);

    // 等待 iframe 加载完成
    const loadPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('页面加载超时'));
      }, 30000); // 30秒超时

      iframe.onload = () => {
        clearTimeout(timeout);
        console.log(`[Offscreen] iframe 加载完成: ${url}`);
        resolve();
      };

      iframe.onerror = (event) => {
        clearTimeout(timeout);
        console.error(`[Offscreen] iframe 加载错误: ${url}`, event);
        reject(new Error('页面加载失败'));
      };

      // 添加额外的错误监听
      iframe.addEventListener('error', (event) => {
        clearTimeout(timeout);
        console.error(`[Offscreen] iframe 错误事件: ${url}`, event);
        reject(new Error('页面加载失败'));
      });
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
      console.warn(`[Offscreen] 跨域限制，使用 fetch 获取: ${url}`, crossOriginError);

      try {
        // 如果因为跨域无法访问 iframe 内容，回退到 fetch
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            ...headers
          },
          credentials: 'omit',
          cache: 'no-cache'
        });

        if (!response.ok) {
          let errorDetail = `HTTP ${response.status}: ${response.statusText}`;

          // 针对常见错误码提供更详细的说明
          if (response.status === 403) {
            errorDetail += ' - 可能原因：需要登录访问、反爬虫保护、或IP被限制';
          } else if (response.status === 404) {
            errorDetail += ' - 页面不存在';
          } else if (response.status === 429) {
            errorDetail += ' - 请求过于频繁，被限流';
          } else if (response.status >= 500) {
            errorDetail += ' - 服务器内部错误';
          }

          throw new Error(errorDetail);
        }

        html = await response.text();
        console.log(`[Offscreen] fetch 回退成功: ${url}, 长度: ${html.length}`);
      } catch (fetchError) {
        console.error(`[Offscreen] fetch 回退也失败: ${url}`, fetchError);

        // 提供更友好的错误信息
        let friendlyError = `无法获取页面内容: `;
        friendlyError += `iframe 失败 (${crossOriginError.message}), `;
        friendlyError += `fetch 失败 (${fetchError.message})`;

        // 针对 ACM 等学术网站的特殊提示
        if (url.includes('acm.org') || url.includes('ieee.org') || url.includes('springer.com')) {
          friendlyError += ' - 提示：该学术网站可能需要机构访问权限或订阅';
        }

        throw new Error(friendlyError);
      }
    }

    // 清理 iframe
    try {
      if (iframe && iframe.parentNode) {
        document.body.removeChild(iframe);
        console.log(`[Offscreen] iframe 已清理: ${url}`);
      }
    } catch (cleanupError) {
      console.warn(`[Offscreen] iframe 清理失败: ${url}`, cleanupError);
    }

    sendResponse({
      success: true,
      html: html,
      url: url
    });

  } catch (error) {
    console.error(`[Offscreen] 获取网页内容失败: ${url}`, error);

    // 清理可能存在的 iframe
    try {
      if (iframe && iframe.parentNode) {
        document.body.removeChild(iframe);
      }
      // 额外清理：查找所有可能的 iframe
      const iframes = document.querySelectorAll('iframe');
      iframes.forEach(frame => {
        if (frame.src === url && frame.parentNode) {
          frame.parentNode.removeChild(frame);
        }
      });
    } catch (cleanupError) {
      console.warn(`[Offscreen] 错误清理失败: ${url}`, cleanupError);
    }

    sendResponse({
      success: false,
      error: error.message,
      url: url
    });
  }
}

/**
 * 专门处理学术网站的 fetch 请求
 * @param {string} url - 目标URL
 * @param {Object} headers - 请求头
 * @param {Function} sendResponse - 响应函数
 */
async function handleAcademicSiteFetch(url, headers, sendResponse) {
  try {
    console.log(`[Offscreen] 使用学术网站专用 fetch: ${url}`);

    // 为学术网站使用更真实的浏览器请求头
    const academicHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Cache-Control': 'max-age=0',
      ...headers
    };

    const response = await fetch(url, {
      method: 'GET',
      headers: academicHeaders,
      credentials: 'omit',
      cache: 'no-cache',
      redirect: 'follow'
    });

    if (!response.ok) {
      let errorDetail = `HTTP ${response.status}: ${response.statusText}`;

      if (response.status === 403) {
        errorDetail += ' - 学术网站访问被拒绝，可能需要机构订阅或登录';
      } else if (response.status === 429) {
        errorDetail += ' - 请求过于频繁，建议稍后重试';
      }

      throw new Error(errorDetail);
    }

    const html = await response.text();
    console.log(`[Offscreen] 学术网站 fetch 成功: ${url}, 长度: ${html.length}`);

    sendResponse({
      success: true,
      html: html,
      url: url,
      method: 'academic-fetch'
    });

  } catch (error) {
    console.error(`[Offscreen] 学术网站 fetch 失败: ${url}`, error);

    sendResponse({
      success: false,
      error: `学术网站访问失败: ${error.message}`,
      url: url,
      method: 'academic-fetch'
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