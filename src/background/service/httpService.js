/**
 * httpService.js
 *
 * 提供HTTP相关服务, 如获取指定url的html文本
 * 支持动态权限请求来处理跨域问题
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
   * @param {string} url - 目标URL
   * @returns {Promise<boolean>} - 是否有权限
   */
  async hasPermission(url) {
    try {
      const origin = new URL(url).origin + '/*';
      return new Promise((resolve) => {
        chrome.permissions.contains({ origins: [origin] }, resolve);
      });
    } catch (error) {
      logger.error(`[HttpService] 权限检查失败: ${url}`, error);
      return false;
    }
  }

  /**
   * 请求访问指定URL的权限
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

      // 不使用缓存，总是尝试权限请求以确保用户能看到对话框
      const origin = new URL(url).origin + '/*';
      logger.log(`[HttpService] 准备请求权限: ${origin}`);
      
      // 检查当前是否已有权限
      const currentPermission = await this.hasPermission(url);
      logger.log(`[HttpService] 权限请求前状态检查: ${currentPermission} for ${origin}`);

      // 即使已有权限，也尝试请求以触发可能的对话框
      logger.log(`[HttpService] 正在调用chrome.permissions.request...`);
      
      const granted = await new Promise((resolve, reject) => {
        try {
          chrome.permissions.request({ origins: [origin] }, (result) => {
            if (chrome.runtime.lastError) {
              const error = chrome.runtime.lastError;
              logger.error(`[HttpService] Chrome权限API错误: ${error.message || JSON.stringify(error)}`);
              reject(new Error(`Chrome权限API错误: ${error.message || JSON.stringify(error)}`));
            } else {
              logger.log(`[HttpService] Chrome权限API返回结果: ${result}`);
              resolve(result);
            }
          });
        } catch (apiError) {
          const errorMsg = apiError.message || apiError.toString() || JSON.stringify(apiError);
          logger.error(`[HttpService] 调用Chrome权限API时发生异常: ${errorMsg}`);
          reject(new Error(`调用Chrome权限API时发生异常: ${errorMsg}`));
        }
      });

      // 更新缓存
      this.permissionCache.set(domain, granted);
      
      if (granted) {
        logger.log(`[HttpService] 权限授权成功: ${origin}`);
      } else {
        logger.warn(`[HttpService] 权限被用户拒绝: ${origin}`);
      }

      return granted;
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
    
    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`[HttpService] 网络响应不 OK: ${response.statusText}`);
      }

      const html = await response.text();
      logger.log(`[HttpService] 成功获取网页内容, URL: ${url}`);
      return html;
    } catch (error) {
      const errorMessage = error.message || error.toString();
      logger.error(`[HttpService] 获取网页内容失败: ${url} (第${retries + 1}次尝试)`, error);
      
      // 检查是否是跨域权限错误且还没有尝试过权限请求
      const isCorsError = errorMessage.includes('CORS') || 
                         errorMessage.includes('Access-Control-Allow-Origin') ||
                         errorMessage.includes('Cross-Origin') ||
                         errorMessage.includes('Failed to fetch') ||
                         errorMessage.includes('NetworkError') ||
                         error.name === 'TypeError';
      
      logger.log(`[HttpService] 错误分析 - errorMessage: "${errorMessage}", error.name: "${error.name}", isCorsError: ${isCorsError}`);
      
      if (isCorsError && !skipPermissionRequest) {
        logger.log(`[HttpService] 检测到跨域权限错误，开始权限检查流程: ${url}`);
        
        const hasPermission = await this.hasPermission(url);
        logger.log(`[HttpService] 当前权限状态: ${hasPermission} for ${url}`);
        
        if (!hasPermission) {
          logger.warn(`[HttpService] 权限不足，但无法在后台自动请求权限（需要用户手势）: ${url}`);
          logger.warn(`[HttpService] 建议用户在popup中手动授权全局权限`);
          
          // 不再尝试自动权限请求，而是提供更友好的错误信息
          const domain = new URL(url).hostname;
          throw new Error(`[HttpService] 访问 ${domain} 需要额外权限。请在扩展设置中点击"请求所有权限"按钮进行授权。`);
        } else {
          logger.log(`[HttpService] 已有权限但仍然失败，可能是其他网络问题: ${url}`);
          // 即使有权限但仍然失败，可能是网络问题或服务器阻止，继续重试机制
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
  }

  /**
   * 测试权限请求功能
   * @param {string} url - 测试URL
   * @returns {Promise<Object>} - 测试结果
   */
  async testPermissionRequest(url) {
    logger.log(`[HttpService] 开始权限请求测试: ${url}`);
    
    try {
      const hasPermissionBefore = await this.hasPermission(url);
      logger.log(`[HttpService] 测试前权限状态: ${hasPermissionBefore}`);
      
      const granted = await this.requestPermission(url);
      logger.log(`[HttpService] 权限请求结果: ${granted}`);
      
      const hasPermissionAfter = await this.hasPermission(url);
      logger.log(`[HttpService] 测试后权限状态: ${hasPermissionAfter}`);
      
      return {
        success: true,
        url: url,
        hasPermissionBefore,
        granted,
        hasPermissionAfter,
        testTime: new Date().toISOString()
      };
    } catch (error) {
      logger.error(`[HttpService] 权限请求测试失败:`, error);
      return {
        success: false,
        url: url,
        error: error.message,
        testTime: new Date().toISOString()
      };
    }
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
        manifestPermissions: [],
        optionalPermissions: [],
        recommendations: []
      };

      // 检查每个域名的权限状态
      for (const domain of testDomains) {
        try {
          const hasPermission = await chrome.permissions.contains({
            origins: [domain + '/*']
          });
          results.permissions[domain] = {
            hasPermission,
            status: hasPermission ? 'granted' : 'not-granted'
          };
        } catch (error) {
          results.permissions[domain] = {
            hasPermission: false,
            status: 'error',
            error: error.message
          };
        }
      }

      // 检查通用权限
      try {
        const hasUniversalPermission = await chrome.permissions.contains({
          origins: ['*://*/*']
        });
        results.universalPermission = {
          hasPermission: hasUniversalPermission,
          status: hasUniversalPermission ? 'granted' : 'not-granted'
        };

        if (hasUniversalPermission) {
          results.recommendations.push('✅ 已获得通用权限，可以访问所有网站');
        } else {
          results.recommendations.push('⚠️ 建议在popup中点击"请求所有权限"按钮获得通用访问权限');
        }
      } catch (error) {
        results.universalPermission = {
          hasPermission: false,
          status: 'error',
          error: error.message
        };
      }

      // 生成建议
      const deniedCount = Object.values(results.permissions).filter(p => !p.hasPermission).length;
      if (deniedCount > 0) {
        results.recommendations.push(`❌ ${deniedCount} 个域名缺少权限，可能影响论文内容提取`);
      } else {
        results.recommendations.push('✅ 所有预定义域名都有访问权限');
      }

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