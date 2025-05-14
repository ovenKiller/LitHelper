import PlatformAdapter from './PlatformAdapter';

class RepositoryAdapter extends PlatformAdapter {
  constructor() {
    super();
  }

  /**
   * 提取论文元数据
   * @returns {Promise<Object>} 论文元数据
   */
  async extractMetadata() {
    return {};
  }

  /**
   * 获取PDF下载链接
   * @returns {Promise<string|null>} PDF下载链接
   */
  async getPdfUrl() {
    return null;
  }

  /**
   * 获取论文引用信息
   * @returns {Promise<Array>} 引用信息列表
   */
  async getCitations() {
    return [];
  }

  /**
   * 获取相关论文推荐
   * @returns {Promise<Array>} 相关论文列表
   */
  async getRelatedPapers() {
    return [];
  }

  /**
   * 获取论文版本信息
   * @returns {Promise<Array>} 版本信息列表
   */
  async getVersions() {
    return [];
  }

  /**
   * 获取论文摘要
   * @returns {Promise<string>} 论文摘要
   */
  async getAbstract() {
    return '';
  }

  /**
   * 获取论文关键词
   * @returns {Promise<Array>} 关键词列表
   */
  async getKeywords() {
    return [];
  }

  /**
   * 获取作者信息
   * @returns {Promise<Array>} 作者信息列表
   */
  async getAuthors() {
    return [];
  }

  /**
   * 获取机构信息
   * @returns {Promise<Array>} 机构信息列表
   */
  async getInstitutions() {
    return [];
  }

  /**
   * 获取发表信息（期刊/会议名称、日期等）
   * @returns {Promise<Object>} 发表信息
   */
  async getPublicationInfo() {
    return {};
  }
}

export default RepositoryAdapter; 