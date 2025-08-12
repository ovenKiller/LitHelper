/**
 * httpService.js
 *
 * 提供HTTP相关服务, 如获取指定url的html文本
 * 支持动态权限请求来处理跨域问题
 * 支持反爬虫保护、JavaScript渲染、tabs API等高级功能
 */
import { logger } from '../../util/logger.js';

class HttpService {
  constructor() {
    // 默认重试次数
    this.maxRetries = 2;
    // 重试延迟时间（毫秒）
    this.retryDelay = 1000;
    // 权限请求缓存，避免重复请求
    this.permissionCache = new Map();
    // 随机延迟范围（毫秒）
    this.randomDelayRange = [500, 2000];
    // 用户代理字符串池
    this.userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
    ];
  }

  /**
   * 设置重试配置
   * @param {number} maxRetries - 最大重试次数
   * @param {number} retryDelay - 重试延迟时间（毫秒）
   */
  setRetryConfig(maxRetries, retryDelay = 1000) {
    this.maxRetries = maxRetries;
    this.retryDelay = retryDelay;
  }

  /**
   * 延迟函数
   * @param {number} ms - 延迟时间（毫秒）
   * @returns {Promise} - 延迟Promise
   */
  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 随机延迟函数，用于反爬虫
   * @param {number} min - 最小延迟时间（毫秒）
   * @param {number} max - 最大延迟时间（毫秒）
   * @returns {Promise} - 延迟Promise
   */
  async randomDelay(min = this.randomDelayRange[0], max = this.randomDelayRange[1]) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    logger.log(`[HttpService] 随机延迟 ${delay}ms`);
    return this.delay(delay);
  }

  /**
   * 从URL提取域名
   * @param {string} url - 完整URL
   * @returns {string} - 域名
   */
  extractDomain(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch (error) {
      logger.error(`[HttpService] URL解析失败: ${url}`, error);
      return null;
    }
  }

  /**
   * 检查是否有访问指定URL的权限
   * 由于插件已申请所有网站权限，直接返回true
   * @param {string} url - 目标URL
   * @returns {Promise<boolean>} - 是否有权限
   */
  async hasPermission(url) {
    try {
      // 插件已拥有所有网站权限，直接返回true
      return true;
    } catch (error) {
      logger.error(`[HttpService] 权限检查失败: ${url}`, error);
      return false;
    }
  }

  /**
   * 请求访问指定URL的权限
   * 由于插件已申请所有网站权限，直接返回true
   * @param {string} url - 目标URL
   * @returns {Promise<boolean>} - 是否成功获得权限
   */
  async requestPermission(url) {
    try {
      const domain = this.extractDomain(url);
      if (!domain) {
        logger.error(`[HttpService] 无法提取域名: ${url}`);
        return false;
      }

      // 插件已拥有所有网站权限，直接返回true
      logger.log(`[HttpService] 插件已拥有所有网站权限，跳过权限请求: ${url}`);
      
      // 更新缓存
      this.permissionCache.set(domain, true);
      
      return true;
    } catch (error) {
      logger.error(`[HttpService] 权限请求过程中发生错误: ${url}`, error);
      return false;
    }
  }

  /**
   * 根据 URL 获取网页 HTML 内容，支持重试机制和动态权限请求
   * @param {string} url - 目标网页的 URL
   * @param {number} retries - 当前重试次数（内部使用）
   * @param {boolean} skipPermissionRequest - 跳过权限请求（内部使用）
   * @returns {Promise<string>} - 返回网页的 HTML 文本
   * @throws {Error} - 当网络请求失败或响应不 OK 时抛出错误
   */
  async getHtml(url, retries = 0, skipPermissionRequest = false) {
    logger.log(`[HttpService] 开始获取网页内容: ${url} (第${retries + 1}次尝试)`);

    // 验证URL是否为绝对路径
    if (!url || typeof url !== 'string') {
      throw new Error(`[HttpService] 无效的URL: ${url}`);
    }

    // 检查URL是否是绝对路径（包含协议）
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      throw new Error(`[HttpService] URL必须是绝对路径（包含http://或https://）: ${url}`);
    }

    // 添加随机延迟以避免被检测为爬虫
    if (retries > 0) {
      await this.randomDelay();
    }

    return this.getHtmlViaTabs(url, retries, skipPermissionRequest);
  }



  /**
   * 通过 Chrome tabs API 获取网页内容（支持JavaScript渲染）
   * @param {string} url - 目标网页的 URL
   * @param {number} retries - 当前重试次数
   * @param {boolean} skipPermissionRequest - 跳过权限请求
   * @returns {Promise<string>} - 返回网页的 HTML 文本
   */
  async getHtmlViaTabs(url, retries = 0, skipPermissionRequest = false) {
    logger.log(`[HttpService] 通过 tabs API 获取网页内容: ${url}`);

    try {
      // 创建新标签页（在后台打开）
      const tab = await chrome.tabs.create({
        url: url,
        active: false // 在后台打开，减少对用户的干扰
      });

      // 等待页面加载完成
      await this.waitForTabLoad(tab.id);

      // 等待额外时间让JavaScript执行
      await this.delay(3000);

      // 注入脚本获取页面内容
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          // 移除脚本标签和样式标签，只保留主要内容
          const scripts = document.querySelectorAll('script, style, noscript');
          scripts.forEach(el => el.remove());

          // 获取页面HTML
          return {
            html: document.documentElement.outerHTML,
            title: document.title,
            url: window.location.href,
            readyState: document.readyState
          };
        }
      });

      // 立即关闭标签页
      await chrome.tabs.remove(tab.id);

      if (results && results[0] && results[0].result) {
        const { html, title, url: finalUrl, readyState } = results[0].result;
        logger.log(`[HttpService] 成功通过 tabs API 获取网页内容: ${finalUrl}, 标题: ${title}, 状态: ${readyState}, 长度: ${html.length}`);
        return html;
      } else {
        throw new Error('无法从标签页获取内容');
      }

    } catch (error) {
      logger.error(`[HttpService] tabs API 获取失败: ${url}`, error);

      // 处理错误和重试逻辑
      return this.handleTabsError(error, url, retries, skipPermissionRequest);
    }
  }

  /**
   * 处理 tabs API 错误
   * @param {Error} error - 错误对象
   * @param {string} url - 目标URL
   * @param {number} retries - 当前重试次数
   * @param {boolean} skipPermissionRequest - 跳过权限请求
   * @returns {Promise<string>} - 重试或抛出错误
   */
  async handleTabsError(error, url, retries, skipPermissionRequest) {
    const errorMessage = error.message || error.toString();

    logger.error(`[HttpService] tabs API 获取失败: ${url} (第${retries + 1}次尝试)`, error);

    // 检查是否是权限错误
    const isPermissionError = errorMessage.includes('permissions') ||
                             errorMessage.includes('Cannot access') ||
                             errorMessage.includes('Extension does not have permission');

    if (isPermissionError && !skipPermissionRequest) {
      logger.log(`[HttpService] 检测到权限错误，开始权限检查流程: ${url}`);

      const hasPermission = await this.hasPermission(url);
      logger.log(`[HttpService] 当前权限状态: ${hasPermission} for ${url}`);

      if (!hasPermission) {
        const domain = new URL(url).hostname;
        throw new Error(`[HttpService] 访问 ${domain} 需要额外权限。请在扩展设置中点击"请求所有权限"按钮进行授权。`);
      }
    }

    // 如果还有重试次数，则进行重试
    if (retries < this.maxRetries) {
      logger.log(`[HttpService] ${this.retryDelay}ms 后进行第${retries + 2}次重试`);
      await this.delay(this.retryDelay);
      return this.getHtml(url, retries + 1, skipPermissionRequest);
    }

    // 重试次数用完，抛出最终错误
    logger.error(`[HttpService] 所有重试失败，最终获取网页内容失败: ${url}`);
    throw error;
  }

  /**
   * 等待标签页加载完成
   * @param {number} tabId - 标签页ID
   * @param {number} timeout - 超时时间（毫秒）
   * @returns {Promise} - 加载完成Promise
   */
  async waitForTabLoad(tabId, timeout = 30000) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(listener);
        reject(new Error('标签页加载超时'));
      }, timeout);

      const listener = (updatedTabId, changeInfo, tab) => {
        if (updatedTabId === tabId && changeInfo.status === 'complete') {
          clearTimeout(timeoutId);
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      };

      chrome.tabs.onUpdated.addListener(listener);
    });
  }



  /**
   * 清除权限缓存
   */
  clearPermissionCache() {
    this.permissionCache.clear();
    logger.log(`[HttpService] 权限缓存已清除`);
  }

  /**
   * 获取权限缓存信息
   * @returns {Object} - 权限缓存信息
   */
  getPermissionCacheInfo() {
    const info = {};
    for (const [domain, granted] of this.permissionCache.entries()) {
      info[domain] = granted;
    }
    return info;
  }

  /**
   * 权限诊断方法
   * 由于插件已申请所有网站权限，简化诊断逻辑
   * @returns {Promise<Object>} - 诊断结果
   */
  async diagnosePermissions() {
    try {
      logger.log(`[HttpService] 开始权限诊断`);
      
      const testDomains = [
        'https://books.google.com',
        'https://scholar.google.com',
        'https://ieeexplore.ieee.org',
        'https://dl.acm.org',
        'https://arxiv.org',
        'https://cir.nii.ac.jp'
      ];

      const results = {
        timestamp: new Date().toISOString(),
        permissions: {},
        cache: this.getPermissionCacheInfo(),
        manifestPermissions: ['*://*/*'],
        optionalPermissions: [],
        recommendations: []
      };

      // 由于插件已拥有所有网站权限，所有域名都标记为已授权
      for (const domain of testDomains) {
        results.permissions[domain] = {
          hasPermission: true,
          status: 'granted'
        };
      }

      // 插件已拥有通用权限
      results.universalPermission = {
        hasPermission: true,
        status: 'granted'
      };
      
      results.recommendations.push('✅ 插件已拥有所有网站访问权限');
      results.recommendations.push('✅ 所有预定义域名都有访问权限');

      logger.log(`[HttpService] 权限诊断完成:`, results);
      return {
        success: true,
        data: results
      };

    } catch (error) {
      logger.error(`[HttpService] 权限诊断失败:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export const httpService = new HttpService();
export default httpService; 