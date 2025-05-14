/**
 * storage.js
 * 
 * 提供数据持久化存储服务
 */

export class StorageService {
  /**
   * 保存数据到存储
   * @param {string} key 存储键
   * @param {any} data 要存储的数据
   */
  async saveData(key, data) {
    try {
      const saveObj = {};
      saveObj[key] = data;
      await chrome.storage.local.set(saveObj);
      return true;
    } catch (error) {
      console.error(`保存数据失败[${key}]:`, error);
      return false;
    }
  }

  /**
   * 获取存储的数据
   * @param {string} key 存储键
   * @returns {Promise<any>} 存储的数据
   */
  async get(key) {
    try {
      const result = await chrome.storage.local.get(key);
      return result[key];
    } catch (error) {
      console.error(`获取数据失败[${key}]:`, error);
      return null;
    }
  }

  /**
   * 删除存储的数据
   * @param {string} key 存储键
   */
  async remove(key) {
    try {
      await chrome.storage.local.remove(key);
      return true;
    } catch (error) {
      console.error(`删除数据失败[${key}]:`, error);
      return false;
    }
  }

  /**
   * 保存论文数据
   * @param {Object} paper 论文对象
   */
  async savePaper(paper) {
    if (!paper || !paper.id) {
      console.error('无效的论文数据');
      return false;
    }
    return await this.save(`papers.${paper.id}`, paper);
  }

  /**
   * 获取论文数据
   * @param {string} paperId 论文ID
   */
  async getPaper(paperId) {
    return await this.get(`papers.${paperId}`);
  }

  /**
   * 保存论文摘要
   * @param {Object} summary 摘要对象
   */
  async saveSummary(summary) {
    if (!summary || !summary.paperId) {
      console.error('无效的摘要数据');
      return false;
    }
    return await this.save(`summaries.${summary.paperId}`, summary);
  }

  /**
   * 获取论文摘要
   * @param {string} paperId 论文ID
   */
  async getSummary(paperId) {
    return await this.get(`summaries.${paperId}`);
  }

  /**
   * 获取所有摘要
   */
  async getAllSummaries() {
    try {
      const allData = await chrome.storage.local.get(null);
      const summaries = [];
      
      for (const key in allData) {
        if (key.startsWith('summaries.')) {
          summaries.push(allData[key]);
        }
      }
      
      return summaries;
    } catch (error) {
      console.error('获取所有摘要失败:', error);
      return [];
    }
  }

  /**
   * 记录论文下载
   * @param {Object} downloadInfo 下载信息
   */
  async recordDownload(downloadInfo) {
    if (!downloadInfo || !downloadInfo.paperId) {
      console.error('无效的下载信息');
      return false;
    }
    return await this.save(`downloads.${downloadInfo.paperId}`, downloadInfo);
  }

}

// 创建并导出单例实例，兼容旧代码
export const storage = new StorageService(); 