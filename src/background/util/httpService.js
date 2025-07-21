/**
 * httpService.js
 * 
 * 底层HTTP服务，专门封装 fetch API，处理跨域请求
 * 不包含任何业务逻辑，只提供纯粹的HTTP请求操作
 */

import { logger } from '../../util/logger.js';

/**
 * 发送GET请求
 * @param {string} url 请求URL
 * @param {Object} options 请求选项
 * @returns {Promise<Object>} 请求结果
 */
async function get(url, options = {}) {
  try {
    logger.debug(`[HttpService] 发送GET请求: ${url}`);
    
    const response = await fetch(url, {
      method: 'GET',
      ...options
    });
    
    return await processResponse(response, url);
  } catch (error) {
    logger.error(`[HttpService] GET请求失败 [${url}]:`, error);
    return {
      success: false,
      error: error.message || 'GET请求失败',
      url: url
    };
  }
}

/**
 * 发送POST请求
 * @param {string} url 请求URL
 * @param {any} data 请求数据
 * @param {Object} options 请求选项
 * @returns {Promise<Object>} 请求结果
 */
async function post(url, data, options = {}) {
  try {
    logger.debug(`[HttpService] 发送POST请求: ${url}`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      body: typeof data === 'string' ? data : JSON.stringify(data),
      ...options
    });
    
    return await processResponse(response, url);
  } catch (error) {
    logger.error(`[HttpService] POST请求失败 [${url}]:`, error);
    return {
      success: false,
      error: error.message || 'POST请求失败',
      url: url
    };
  }
}

/**
 * 获取页面内容（专门用于抓取网页）
 * @param {string} url 页面URL
 * @param {Object} options 请求选项
 * @returns {Promise<Object>} 页面内容结果
 */
async function fetchPageContent(url, options = {}) {
  try {
    logger.debug(`[HttpService] 获取页面内容: ${url}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LitHelper/1.0)',
        ...options.headers
      },
      ...options
    });
    
    if (!response.ok) {
      throw new Error(`HTTP错误: ${response.status} ${response.statusText}`);
    }
    
    const contentType = response.headers.get('content-type') || '';
    let content;
    
    // 根据内容类型处理响应
    if (contentType.includes('application/json')) {
      content = await response.json();
    } else {
      content = await response.text();
    }
    
    logger.debug(`[HttpService] 页面内容获取成功: ${url}, 内容长度: ${typeof content === 'string' ? content.length : 'N/A'}`);
    
    return {
      success: true,
      content: content,
      contentType: contentType,
      status: response.status,
      url: url
    };
  } catch (error) {
    logger.error(`[HttpService] 获取页面内容失败 [${url}]:`, error);
    return {
      success: false,
      error: error.message || '获取页面内容失败',
      url: url
    };
  }
}

/**
 * 处理HTTP响应
 * @param {Response} response Fetch响应对象
 * @param {string} url 请求URL
 * @returns {Promise<Object>} 处理后的结果
 * @private
 */
async function processResponse(response, url) {
  if (!response.ok) {
    throw new Error(`HTTP错误: ${response.status} ${response.statusText}`);
  }
  
  const contentType = response.headers.get('content-type') || '';
  let data;
  
  try {
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }
  } catch (parseError) {
    logger.warn(`[HttpService] 响应解析失败 [${url}]:`, parseError);
    data = null;
  }
  
  logger.debug(`[HttpService] 请求成功: ${url}, 状态: ${response.status}`);
  
  return {
    success: true,
    data: data,
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    url: url
  };
}

/**
 * 发送带有超时的请求
 * @param {string} url 请求URL
 * @param {Object} options 请求选项
 * @param {number} timeout 超时时间（毫秒）
 * @returns {Promise<Object>} 请求结果
 */
async function fetchWithTimeout(url, options = {}, timeout = 10000) {
  try {
    logger.debug(`[HttpService] 发送带超时请求: ${url}, 超时: ${timeout}ms`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    return await processResponse(response, url);
  } catch (error) {
    logger.error(`[HttpService] 带超时请求失败 [${url}]:`, error);
    
    if (error.name === 'AbortError') {
      return {
        success: false,
        error: `请求超时 (${timeout}ms)`,
        url: url
      };
    }
    
    return {
      success: false,
      error: error.message || '请求失败',
      url: url
    };
  }
}

export const httpService = {
  get,
  post,
  fetchPageContent,
  fetchWithTimeout
}; 