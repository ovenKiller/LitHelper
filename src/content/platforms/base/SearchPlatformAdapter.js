import PlatformAdapter from './PlatformAdapter';

import { logger } from '../../../background/utils/logger';
class SearchPlatformAdapter extends PlatformAdapter {
  constructor() {
    super();
  }

  /**
   * 获取搜索结果容器
   * @returns {HTMLElement|null}
   */
  getResultsContainer() {
    return null;
  }

  /**
   * 获取搜索结果中的论文数量
   * @returns {number}
   */
  getPaperCount() {
    return 0;
  }

  /**
   * 获取当前论文在搜索结果中的位置
   * @returns {number}
   */
  getCurrentPaperNumber() {
    return 0;
  }

  /**
   * 从搜索结果中提取论文信息
   * @param {NodeList|Element[]} resultItems - 论文结果元素
   * @param {string} sourceTag - 论文来源标签
   * @param {string} idPrefix - 论文ID前缀
   * @returns {Array} 提取的论文信息
   */
  extractPapersFromElements(resultItems, sourceTag, idPrefix) {
    return [];
  }

  /**
   * 从当前页面提取论文信息
   * @returns {Promise<Array>} 提取的论文信息
   */
  async extractPapers() {
    return [];
  }

  /**
   * 从HTML内容中提取论文信息
   * @param {string} html - HTML内容
   * @returns {Array} 提取的论文信息
   */
  extractPapersFromHTML(html) {
    return [];
  }

  /**
   * 通过URL获取论文信息
   * @param {string} url - 要获取论文的URL
   * @returns {Promise<Array>} 获取的论文信息
   */
  async getPapersByUrl(url) {
    return [];
  }

  /**
   * 检查页面变更时是否需要重新提取论文
   * @param {MutationRecord[]} mutations - DOM变更记录
   * @returns {boolean}
   */
  shouldReextractOnMutation(mutations) {
    return false;
  }
}

export default SearchPlatformAdapter; 