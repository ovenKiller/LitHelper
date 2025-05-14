/**
 * summary.js
 * 
 * 论文摘要数据模型
 */

export class Summary {
  /**
   * @param {Object} data 摘要数据
   * @param {string} data.paperId 论文ID
   * @param {string} data.summary 摘要内容
   * @param {Object} [data.categories] 分类评分
   */
  constructor(data) {
    this.paperId = data.paperId;
    this.summary = data.summary || '';
    this.categories = data.categories || {};
    this.createdAt = data.createdAt || new Date().toISOString();
  }

  /**
   * 获取分类得分
   * @param {string} categoryId 分类ID
   * @returns {number} 分类得分
   */
  getCategoryScore(categoryId) {
    return this.categories?.[categoryId]?.score || 0;
  }

  /**
   * 获取分类解释
   * @param {string} categoryId 分类ID
   * @returns {string} 分类解释
   */
  getCategoryExplanation(categoryId) {
    return this.categories?.[categoryId]?.explanation || '';
  }

  /**
   * 添加分类评分
   * @param {string} categoryId 分类ID
   * @param {number} score 分数
   * @param {string} explanation 解释
   */
  addCategory(categoryId, score, explanation) {
    if (!this.categories) {
      this.categories = {};
    }
    
    this.categories[categoryId] = {
      score,
      explanation
    };
  }
} 