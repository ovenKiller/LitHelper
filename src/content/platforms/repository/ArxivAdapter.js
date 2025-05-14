import RepositoryAdapter from '../base/RepositoryAdapter';

class ArxivAdapter extends RepositoryAdapter {
  constructor() {
    super();
  }

  /**
   * 检查当前页面是否支持
   * @returns {boolean}
   */
  isPageSupported() {
    return window.location.hostname.includes('arxiv.org');
  }

  /**
   * 获取平台名称
   * @returns {string}
   */
  getPlatformName() {
    return 'arXiv';
  }

  /**
   * 提取论文元数据
   * @returns {Promise<Object>} 论文元数据
   */
  async extractMetadata() {
    try {
      const title = this.extractTitle();
      const authors = this.extractAuthors();
      const abstract = this.extractAbstract();
      const pdfUrl = this.extractPdfUrl();
      const categories = this.extractCategories();
      const submissionDate = this.extractSubmissionDate();
      const arxivId = this.extractArxivId();

      return {
        title,
        authors,
        abstract,
        pdfUrl,
        categories,
        submissionDate,
        arxivId,
        source: 'arxiv'
      };
    } catch (error) {
      console.error('Error extracting metadata:', error);
      return null;
    }
  }

  /**
   * 获取PDF下载链接
   * @returns {Promise<string|null>} PDF下载链接
   */
  async getPdfUrl() {
    return this.extractPdfUrl();
  }

  /**
   * 获取论文引用信息
   * @returns {Promise<Array>} 引用信息列表
   */
  async getCitations() {
    // arXiv不直接提供引用信息，需要通过其他API获取
    return [];
  }

  /**
   * 获取相关论文推荐
   * @returns {Promise<Array>} 相关论文列表
   */
  async getRelatedPapers() {
    const relatedPapers = [];
    const relatedElements = document.querySelectorAll('.related-papers a');
    
    for (const element of relatedElements) {
      const title = element.textContent.trim();
      const url = element.href;
      if (title && url) {
        relatedPapers.push({ title, url });
      }
    }
    
    return relatedPapers;
  }

  /**
   * 获取论文版本信息
   * @returns {Promise<Array>} 版本信息列表
   */
  async getVersions() {
    const versions = [];
    const versionElements = document.querySelectorAll('.version-history a');
    
    for (const element of versionElements) {
      const version = element.textContent.trim();
      const url = element.href;
      if (version && url) {
        versions.push({ version, url });
      }
    }
    
    return versions;
  }

  // 辅助方法
  extractTitle() {
    const titleElement = document.querySelector('h1.title');
    return titleElement ? titleElement.textContent.replace('Title:', '').trim() : '';
  }

  extractAuthors() {
    const authors = [];
    const authorElements = document.querySelectorAll('.authors a');
    
    for (const element of authorElements) {
      const name = element.textContent.trim();
      const url = element.href;
      if (name) {
        authors.push({ name, url });
      }
    }
    
    return authors;
  }

  extractAbstract() {
    const abstractElement = document.querySelector('.abstract');
    return abstractElement ? abstractElement.textContent.replace('Abstract:', '').trim() : '';
  }

  extractPdfUrl() {
    const pdfLink = document.querySelector('a[href$=".pdf"]');
    return pdfLink ? pdfLink.href : null;
  }

  extractCategories() {
    const categories = [];
    const categoryElements = document.querySelectorAll('.primary-subject');
    
    for (const element of categoryElements) {
      const category = element.textContent.trim();
      if (category) {
        categories.push(category);
      }
    }
    
    return categories;
  }

  extractSubmissionDate() {
    const dateElement = document.querySelector('.submission-date');
    return dateElement ? dateElement.textContent.replace('Submitted on', '').trim() : '';
  }

  extractArxivId() {
    const url = window.location.href;
    const match = url.match(/arxiv\.org\/abs\/(\d+\.\d+)/);
    return match ? match[1] : null;
  }
}

export default ArxivAdapter; 