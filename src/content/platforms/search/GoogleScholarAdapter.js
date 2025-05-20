/**
 * GoogleScholarAdapter.js
 * 
 * 每个平台的适配组件，功能有:
 * - 检查当前页面是否支持
 * - 在页面中嵌入按钮
 *
 */

import SearchPlatformAdapter from '../base/SearchPlatformAdapter';
import AdapterFactory from '../AdapterFactory';
import PaperControls from '../../ui/components/PaperControls';
import SummaryContainer from '../../ui/components/SummaryContainer';
import { Paper } from '../../../models/Paper';
import { logger } from '../../../background/utils/logger';
class GoogleScholarAdapter extends SearchPlatformAdapter {
  constructor() {
    super();
    this.extractorFactory = AdapterFactory;
    this.uiManager = null; // 将在setPlatformManager中设置
  }

  // 设置UI管理器
  setPlatformManager(uiManager) {
    this.uiManager = uiManager;
  }

  /**
   * 检查当前页面是否支持
   * @returns {boolean}
   */
  isPageSupported() {
    return window.location.hostname.includes('scholar.google.com');
  }

  /**
   * 获取平台名称
   * @returns {string}
   */
  getPlatformName() {
    return 'Google Scholar';
  }

  /**
   * 获取搜索结果容器
   * @returns {HTMLElement|null}
   */
  getResultsContainer() {
    return document.querySelector('#gs_res_ccl_mid') || document.querySelector('#gs_res_ccl');
  }

  /**
   * 获取搜索结果中的论文数量
   * @returns {number}
   */
  getPaperCount() {
    const countText = document.querySelector('#gs_ab_md .gs_ab_mdw')?.textContent;
    if (!countText) return 0;
    
    const match = countText.match(/About\s+([\d,]+)\s+results/);
    return match ? parseInt(match[1].replace(/,/g, '')) : 0;
  }

  /**
   * 获取当前论文在搜索结果中的位置
   * @returns {number}
   */
  getCurrentPaperNumber() {
    const currentItem = document.querySelector('.gs_ri.gs_or.gs_scl');
    if (!currentItem) return 0;
    
    const items = Array.from(document.querySelectorAll('.gs_ri.gs_or.gs_scl'));
    return items.indexOf(currentItem) + 1;
  }

  /**
   * 从搜索结果中提取论文信息
   * @param {NodeList|Element[]} resultItems - 论文结果元素
   * @param {string} sourceTag - 论文来源标签
   * @param {string} idPrefix - 论文ID前缀
   * @returns {Array} 提取的论文信息
   */
  extractPapersFromElements(resultItems, sourceTag, idPrefix) {
    const papers = [];
    
    resultItems.forEach((item, index) => {
      const authorString = this.extractAuthors(item);
      const authorsArray = authorString.split(',').map(author => author.trim()).filter(author => author.length > 0);

      // 提取论文链接
      const titleElement = item.querySelector('.gs_rt a');
      const paperUrl = titleElement?.href || '';
      
      // 获取all versions URL
      const versionsUrl = this.extractAllVersionsUrl(item);
      
      const paperData = {
        id: `${idPrefix}_${index}`,
        // element: item, // Will be attached later
        source: sourceTag,
        title: this.extractTitle(item),
        authors: authorsArray,
        abstract: this.extractAbstract(item),
        urls: paperUrl ? [paperUrl] : [],
        pdfUrl: this.extractPdfUrl(item),
        citationCount: this.extractCitations(item), // Mapped from citations to citationCount
        allVersionsUrl: versionsUrl,
        googleScholarVersionsUrl: versionsUrl, // 添加googleScholarVersionsUrl字段
        publicationDate: this.extractYear(item) // Mapped from year to publicationDate
      };
      
      const paperInstance = new Paper(paperData);
      // Attach the DOM element to the Paper instance for UI purposes
      // This property is not part of the formal Paper model but is used by the adapter
      paperInstance.element = item; 
      
      papers.push(paperInstance);
    });
    
    return papers;
  }

  /**
   * 从当前页面提取论文信息
   * @returns {Promise<Array>} 提取的论文信息
   */
  async extractPapers() {
    const container = this.getResultsContainer();
    if (!container) return [];
    
    const resultItems = container.querySelectorAll('.gs_r.gs_or.gs_scl') || 
                        container.querySelectorAll('.gs_ri');
    return this.extractPapersFromElements(resultItems, 'google_scholar', 'gs');
  }

  /**
   * 从HTML内容中提取论文信息
   * @param {string} html - HTML内容
   * @returns {Array} 提取的论文信息
   */
  extractPapersFromHTML(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const resultItems = doc.querySelectorAll('.gs_ri.gs_or.gs_scl');
    return this.extractPapersFromElements(resultItems, 'google_scholar', 'gs');
  }

  /**
   * 通过URL获取论文信息
   * @param {string} url - 要获取论文的URL
   * @returns {Promise<Array>} 获取的论文信息
   */
  async getPapersByUrl(url) {
    try {
      const response = await fetch(url);
      const html = await response.text();
      return this.extractPapersFromHTML(html);
    } catch (error) {
      logger.error('Failed to fetch papers:', error);
      return [];
    }
  }

  /**
   * 检查页面变更时是否需要重新提取论文
   * @param {MutationRecord[]} mutations - DOM变更记录
   * @returns {boolean}
   */
  shouldReextractOnMutation(mutations) {
    return mutations.some(mutation => {
      const target = mutation.target;
      return target.classList?.contains('gs_ri') || 
             target.classList?.contains('gs_or') || 
             target.classList?.contains('gs_scl');
    });
  }

  // 辅助方法
  extractTitle(item) {
    return item.querySelector('.gs_rt a')?.textContent || '';
  }

  extractAuthors(item) {
    const authorText = item.querySelector('.gs_a')?.textContent || '';
    return authorText.split('-')[0].trim();
  }

  extractAbstract(item) {
    return item.querySelector('.gs_rs')?.textContent || '';
  }

  extractPdfUrl(item) {
    const pdfLink = Array.from(item.querySelectorAll('.gs_fl a'))
      .find(a => a.textContent.includes('PDF'));
    return pdfLink?.href || null;
  }

  extractCitations(item) {
    const citationsLink = Array.from(item.querySelectorAll('.gs_fl a'))
      .find(a => a.textContent.includes('Cited by'));
    if (!citationsLink) return 0;
    
    const match = citationsLink.textContent.match(/Cited by (\d+)/);
    return match ? parseInt(match[1]) : 0;
  }

  extractAllVersionsUrl(item) {
    // 首先检查是否已有可见的"All versions"链接
    const allLinks = Array.from(item.querySelectorAll('.gs_fl a'));
    let versionLink = allLinks.find(a => {
      return (a.textContent.toLowerCase().includes('version') || 
              (a.href && a.href.includes('cluster='))) && 
             !a.classList.contains('gs_or_mor');
    });
    
    // 如果直接找到了链接，返回它
    if (versionLink && versionLink.href) {
      return versionLink.href;
    }
    
    // 尝试直接从DOM中找到"All Versions"链接，即使它是隐藏的
    // 查找包含cluster参数的链接，这通常是all versions链接的特征
    const hiddenVersionsLink = Array.from(item.querySelectorAll('a[href*="cluster"]')).find(a => 
      a.textContent.toLowerCase().includes('version')
    );
    
    if (hiddenVersionsLink && hiddenVersionsLink.href) {
      logger.log('找到隐藏的All versions链接:', hiddenVersionsLink.href);
      return hiddenVersionsLink.href;
    }
    
    // 如果还找不到，尝试获取html源码中的链接
    // 注意：这种方法绕过了CSP限制，因为我们没有执行JavaScript URL
    
    // 检查是否有包含"scholar?cluster="的链接
    const clusterRegex = /href="([^"]*scholar\?cluster=[^"]*)"/;
    const itemHtml = item.outerHTML;
    const clusterMatch = itemHtml.match(clusterRegex);
    
    if (clusterMatch && clusterMatch[1]) {
      const decodedUrl = decodeURIComponent(clusterMatch[1]);
      logger.log('从HTML源代码中提取All versions URL:', decodedUrl);
      
      // 构建完整URL（如果是相对URL）
      if (decodedUrl.startsWith('/')) {
        const baseUrl = new URL(window.location.href).origin;
        return baseUrl + decodedUrl;
      }
      return decodedUrl;
    }
    
    logger.log('无法找到All versions链接');
    return null;
  }

  extractYear(item) {
    const yearMatch = item.querySelector('.gs_a')?.textContent.match(/\b(19|20)\d{2}\b/);
    return yearMatch ? yearMatch[0] : null;
  }

  /**
   * 在页面中嵌入UI元素
   * @returns {Promise<boolean>} 操作是否成功
   */
  async injectUI() {
    logger.log("页面UI元素嵌入");
    try {
      // 检查UI管理器是否已设置
      if (!this.uiManager) {
        logger.error('UI Manager not initialized');
        return false;
      }

      // 异步获取当前页面的论文
      const papers = await this.extractPapers();
      
      // 为每个论文创建并注入UI组件
      for (const paper of papers) {
        if (!paper.element) continue;
        
        // 创建论文控制组件
        const controls = new PaperControls(paper.id, paper.element);
        controls.initialize({
          hasPdf: !!paper.pdfUrl,
          onSummarize: (paperId) => this.uiManager.handleSummarizeClick(paperId, this),
          onDownload: (paperId) => this.uiManager.handleDownloadClick(paperId, this),
          onAddToPaperBox: (paperId) => this.handleAddToPaperBox(paperId, paper)
        });
        
        // 注册控件组件到UI管理器
        this.uiManager.registerControlsComponent(paper.id, controls);
        
        // 创建摘要容器
        const summaryContainer = new SummaryContainer(paper.id, paper.element);
        summaryContainer.initialize();
        
        // 注册组件到UI管理器
        this.uiManager.registerComponent(paper.id, summaryContainer);
      }
      
      return true;
    } catch (error) {
      logger.error('Failed to inject UI:', error);
      return false;
    }
  }

  /**
   * 处理添加到论文盒的点击事件
   * @param {string} paperId - 论文ID
   * @param {Object} paper - 论文对象
   */
  async handleAddToPaperBox(paperId, paper) {
    if (!this.uiManager) {
      logger.error('UI Manager not initialized');
      return;
    }
    
    // 调用UI管理器的handleAddPaper方法添加论文
    await this.uiManager.handleAddPaper(paper);
    
    // 获取PaperControls实例并显示成功状态
    const controlsInstance = this.uiManager.getControlsComponent(paperId);
    if (controlsInstance && controlsInstance.showAddSuccess) {
      controlsInstance.showAddSuccess();
    } else {
      logger.warn(`未找到论文 ${paperId} 的控件实例`);
    }
  }

  /**
   * 从所有版本中提取论文信息
   * @param {HTMLElement} paperItem - 论文元素
   * @returns {Promise<Object|null>} 提取的论文信息
   */
  async extractPaperFromAllVersions(paperItem) {
    try {
      const allVersionsLink = Array.from(paperItem.querySelectorAll('.gs_fl a'))
        .find(a => {
          const text = a.textContent.toLowerCase();
          const versionPatterns = [
            /all\s+\d+\s+versions?/i,
            /all\s+versions?/i,
            /versions?/i
          ];
          const hasVersionCount = /\d+\s+versions?/i.test(text);
          return versionPatterns.some(pattern => pattern.test(text)) || hasVersionCount;
        });
      
      if (!allVersionsLink) {
        logger.log('No "All versions" link found');
        return null;
      }
      
      logger.log("Found all versions link:", allVersionsLink.href);
      
      // 保存所有版本的URL
      const allVersionsUrl = allVersionsLink.href;

      const response = await fetch(allVersionsUrl);
      const text = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'text/html');

      const paperItems = doc.querySelectorAll('.gs_r.gs_or.gs_scl');
      for (const item of paperItems) {
        const links = item.querySelectorAll('a');
        for (const link of links) {
          if (link.href.includes('arxiv.org')) {
            const extractor = this.extractorFactory.getAdapter(link.href);
            if (extractor) {
              const metadata = await extractor.extractMetadata();
              // 添加allVersionsUrl属性
              if (metadata) {
                metadata.allVersionsUrl = allVersionsUrl;
              }
              return metadata;
            }
          }
        }
      }
      
      return null;
    } catch (error) {
      logger.error('Error extracting paper from all versions:', error);
      return null;
    }
  }
}

export default GoogleScholarAdapter; 