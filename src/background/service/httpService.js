/**
 * httpService.js
 *
 * 提供HTTP相关服务, 如获取指定url的html文本
 * 支持动态权限请求来处理跨域问题
 * 支持反爬虫保护、JavaScript渲染、tabs API等高级功能
 */
import { logger } from '../../util/logger.js';
import { offscreenManager } from './offscreenManager.js';

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
   * 为标签页添加插件标识
   * @param {number} tabId - 标签页ID
   * @param {string} url - 页面URL（用于日志）
   * @returns {Promise<void>}
   */
  async markTabAsPluginWork(tabId, url) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: () => {
          // 简单地在标题前加上[LitHelper]标识
          if (!document.title.startsWith('[LitHelper]')) {
            document.title = `[LitHelper] ${document.title}`;
          }
        }
      });

      logger.log(`[HttpService] 已为标签页 ${tabId} 添加插件标识: ${url}`);
    } catch (error) {
      logger.warn(`[HttpService] 添加标签页标识失败: ${tabId}`, error);
    }
  }


  /**
   * 延迟指定时间
   * @param {number} ms - 延迟时间（毫秒）
   * @returns {Promise<void>}
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 随机延迟，用于避免被检测为爬虫
   * @returns {Promise<void>}
   */
  async randomDelay() {
    const [min, max] = this.randomDelayRange;
    const randomMs = Math.floor(Math.random() * (max - min + 1)) + min;
    logger.log(`[HttpService] 随机延迟 ${randomMs}ms`);
    return this.delay(randomMs);
  }

  /**
   * 延迟指定时间
   * @param {number} ms - 延迟时间（毫秒）
   * @returns {Promise<void>}
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 随机延迟，用于避免被检测为爬虫
   * @returns {Promise<void>}
   */
  async randomDelay() {
    const [min, max] = this.randomDelayRange;
    const randomMs = Math.floor(Math.random() * (max - min + 1)) + min;
    logger.log(`[HttpService] 随机延迟 ${randomMs}ms`);
    return this.delay(randomMs);
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
   * 等待标签页加载完成
   * @param {number} tabId - 标签页ID
   * @returns {Promise<void>}
   */
  async waitForTabLoad(tabId) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('标签页加载超时'));
      }, 30000); // 30秒超时

      const checkStatus = async () => {
        try {
          const tab = await chrome.tabs.get(tabId);
          if (tab.status === 'complete') {
            clearTimeout(timeout);
            logger.log(`[HttpService] 标签页加载完成: ${tabId}`);
            resolve();
          } else {
            // 继续检查
            setTimeout(checkStatus, 500);
          }
        } catch (error) {
          clearTimeout(timeout);
          reject(error);
        }
      };

      checkStatus();
    });
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
   * 通过 tabs API 获取网页内容（支持JavaScript渲染，在后台标签页中加载）
   * @param {string} url - 目标网页的 URL
   * @param {number} retries - 当前重试次数
   * @param {boolean} skipPermissionRequest - 跳过权限请求
   * @returns {Promise<string>} - 返回网页的 HTML 文本
   */
  async getHtmlViaTabs(url, retries = 0, skipPermissionRequest = false) {
    logger.log(`[HttpService] 通过 tabs API 获取网页内容: ${url} (第${retries + 1}次尝试)`);

    let tabId = null;
    try {
      // 创建一个新的后台标签页
      logger.log(`[HttpService] 创建后台标签页加载: ${url}`);
      const tab = await chrome.tabs.create({
        url: url,
        active: false // 在后台打开，用户不可见
      });

      tabId = tab.id;
      logger.log(`[HttpService] 标签页已创建，ID: ${tabId}`);

      // 等待页面加载完成
      await this.waitForTabLoad(tabId);

      // 为标签页添加插件标识
      await this.markTabAsPluginWork(tabId, url);

      // 等待额外时间让 JavaScript 执行
      await this.delay(3000);

      // 注入脚本获取页面内容
      logger.log(`[HttpService] 注入脚本获取页面内容: ${url}`);
      const results = await chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: () => {
          // 移除脚本和样式标签以减少大小
          const scripts = document.querySelectorAll('script, style, noscript');
          scripts.forEach(el => el.remove());

          return document.documentElement.outerHTML;
        }
      });

      if (results && results[0] && results[0].result) {
        const html = results[0].result;
        logger.log(`[HttpService] 成功通过 tabs API 获取网页内容: ${url}, 长度: ${html.length}`);
        return html;
      } else {
        throw new Error('无法从标签页获取内容');
      }

    } catch (error) {
      logger.error(`[HttpService] tabs API 获取失败: ${url}`, error);

      // 如果还有重试次数，则进行重试
      if (retries < this.maxRetries) {
        logger.log(`[HttpService] ${this.retryDelay}ms 后进行第${retries + 2}次重试`);
        await this.delay(this.retryDelay);
        return this.getHtml(url, retries + 1, skipPermissionRequest);
      }

      // 重试次数用完，抛出最终错误
      logger.error(`[HttpService] 所有重试失败，最终获取网页内容失败: ${url}`);
      throw error;
    } finally {
      // 确保关闭标签页
      if (tabId) {
        try {
          await chrome.tabs.remove(tabId);
          logger.log(`[HttpService] 标签页已关闭: ${tabId}`);
        } catch (closeError) {
          logger.warn(`[HttpService] 关闭标签页失败: ${tabId}`, closeError);
        }
      }
    }
  }





}

export const httpService = new HttpService();
export default httpService; 