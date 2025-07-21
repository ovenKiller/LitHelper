import { getPlatformType, getPlatformName } from './config';
import GoogleScholarAdapter from './search/GoogleScholarAdapter';
import { logger } from '../../util/logger.js';
import { PLATFORM_KEYS } from '../../constants.js';

class AdapterFactory {
  /**
   * 获取适配器实例
   * @param {string} url - 要处理的URL
   * @returns {Promise<PlatformAdapter|null>} 适配器实例或null
   */
  static async getAdapter(url) {
    const type = getPlatformType(url);
    if (!type) return null;

    const platform = getPlatformName(url);
    if (!platform) return null;

    try {
      let adapter;
      
      // 根据平台类型和名称创建对应的适配器
      switch (type) {
        case 'search':
          adapter = await this.getSearchAdapter(platform);
          break;
        case 'repository':
          adapter = await this.getRepositoryAdapter(platform);
          break;
        default:
          return null;
      }

      if (adapter) {
        await adapter.initialize();
      }
      
      return adapter;
    } catch (error) {
      logger.error('Failed to create adapter:', error);
      return null;
    }
  }

  /**
   * 获取搜索平台适配器
   * @param {string} platform - 平台名称
   * @returns {Promise<SearchPlatformAdapter|null>}
   */
  static async getSearchAdapter(platform) {
    switch (platform) {
      case PLATFORM_KEYS.GOOGLE_SCHOLAR:
        return new GoogleScholarAdapter();
      // 添加其他搜索平台适配器
      default:
        return null;
    }
  }

  /**
   * 获取论文库适配器
   * @param {string} platform - 平台名称
   * @returns {Promise<RepositoryAdapter|null>}
   */
  static async getRepositoryAdapter(platform) {
    switch (platform) {
      case PLATFORM_KEYS.ARXIV:
        return new ArxivAdapter();
      // 添加其他论文库适配器
      default:
        return null;
    }
  }
}

export default AdapterFactory; 