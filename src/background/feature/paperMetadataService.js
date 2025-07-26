/**
 * paperMetadataService.js
 * 
 * 论文元数据服务
 * 负责处理和保存论文元数据信息
 */

import { logger } from '../../util/logger.js';
import { PLATFORM_KEYS, PAGE_TYPE } from '../../constants.js';

class PaperMetadataService {
  constructor() {
    this.paperCache = new Map(); // 以论文题目为key保存论文数据
  }

  /**
   * 处理论文HTML元素列表
   * @param {string} sourceDomain - 来源域名(PLATFORM_KEYS中的值)
   * @param {string} pageType - 页面类型(PAGE_TYPE中的值) 
   * @param {Array<string>} htmlElementList - HTML字符串列表
   * @returns {Promise<boolean>} 处理是否成功
   */
  async processPaperElementList(sourceDomain, pageType, htmlElementList) {
    try {
      logger.log(`[PaperMetadataService] 开始处理论文元素列表`);
      logger.log(`[PaperMetadataService] 来源域名: ${sourceDomain}`);
      logger.log(`[PaperMetadataService] 页面类型: ${pageType}`);
      logger.log(`[PaperMetadataService] HTML元素数量: ${htmlElementList.length}`);
      
      // 验证输入参数
      if (!this.validateInputParams(sourceDomain, pageType, htmlElementList)) {
        return false;
      }

      // 遍历处理每个HTML元素
      for (let i = 0; i < htmlElementList.length; i++) {
        const htmlString = htmlElementList[i];
        logger.log(`[PaperMetadataService] 处理第 ${i + 1} 个HTML元素，长度: ${htmlString.length} 字符`);
        
        // TODO: 这里将来要实现提取论文信息的逻辑
        // 1. 解析HTML字符串
        // 2. 提取论文标题、作者、摘要等信息
        // 3. 以论文题目为key保存到缓存中
        logger.log(`[PaperMetadataService] 第 ${i + 1} 个元素处理完成（当前仅为占位符）`);
      }

      logger.log(`[PaperMetadataService] 论文元素列表处理完成，共处理 ${htmlElementList.length} 个元素`);
      return true;
      
    } catch (error) {
      logger.error('[PaperMetadataService] 处理论文元素列表时发生错误:', error);
      return false;
    }
  }

  /**
   * 验证输入参数
   * @param {string} sourceDomain - 来源域名
   * @param {string} pageType - 页面类型
   * @param {Array<string>} htmlElementList - HTML字符串列表
   * @returns {boolean} 参数是否有效
   */
  validateInputParams(sourceDomain, pageType, htmlElementList) {
    // 验证来源域名
    const validPlatforms = Object.values(PLATFORM_KEYS);
    if (!validPlatforms.includes(sourceDomain)) {
      logger.error(`[PaperMetadataService] 无效的来源域名: ${sourceDomain}`);
      logger.log(`[PaperMetadataService] 支持的域名: ${validPlatforms.join(', ')}`);
      return false;
    }

    // 验证页面类型
    const validPageTypes = Object.values(PAGE_TYPE);
    if (!validPageTypes.includes(pageType)) {
      logger.error(`[PaperMetadataService] 无效的页面类型: ${pageType}`);
      logger.log(`[PaperMetadataService] 支持的页面类型: ${validPageTypes.join(', ')}`);
      return false;
    }

    // 验证HTML元素列表
    if (!Array.isArray(htmlElementList)) {
      logger.error('[PaperMetadataService] HTML元素列表必须是数组');
      return false;
    }

    if (htmlElementList.length === 0) {
      logger.warn('[PaperMetadataService] HTML元素列表为空');
      return false;
    }

    // 验证数组中的每个元素都是字符串
    for (let i = 0; i < htmlElementList.length; i++) {
      if (typeof htmlElementList[i] !== 'string') {
        logger.error(`[PaperMetadataService] HTML元素列表第 ${i} 项不是字符串类型`);
        return false;
      }
    }

    return true;
  }

  /**
   * 获取缓存的论文数据
   * @param {string} paperTitle - 论文标题
   * @returns {Object|null} 论文数据
   */
  getCachedPaper(paperTitle) {
    return this.paperCache.get(paperTitle) || null;
  }

  /**
   * 获取所有缓存的论文数据
   * @returns {Map} 所有论文数据
   */
  getAllCachedPapers() {
    return new Map(this.paperCache);
  }

  /**
   * 清空论文缓存
   */
  clearCache() {
    this.paperCache.clear();
    logger.log('[PaperMetadataService] 论文缓存已清空');
  }
}

// 创建单例实例
export const paperMetadataService = new PaperMetadataService();
export default paperMetadataService;
