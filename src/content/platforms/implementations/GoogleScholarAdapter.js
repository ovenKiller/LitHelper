/**
 * GoogleScholarAdapter.js
 * 
 * 每个平台的适配组件，功能有:
 * - 检查当前页面是否支持
 * - 在页面中嵌入按钮
 *
 */

import PlatformAdapter from '../base/PlatformAdapter';

export default class GoogleScholarAdapter extends PlatformAdapter {
  constructor() {
    super();
    this.platformName = 'Google Scholar';
    this.allPapers = []; // Store all papers from current and next page
    this.onPaperAddedCallback = null; // Callback for when a paper is added
  }

  /**
   * Check if current page is supported
   * @returns {boolean} Whether the page is a Google Scholar search results page
   */
  isPageSupported() {
    const url = window.location.href;
    return url.includes('scholar.google.com/scholar?');
  }
  getPlatformName() {
    return this.platformName;
  }
  /**
   * Initialize the adapter
   * @param {Function} onPaperAdded - Callback when a paper is added to popup
   */
  async initialize(onPaperAdded) {
    console.log('Google Scholar adapter initializing...');
    this.onPaperAddedCallback = onPaperAdded;
    
    // 注入按钮到页面
    this.injectButtonsToSearchResults();
    
    // 监听DOM变化，处理动态加载的内容
    this.observePageChanges();
  }
  
  /**
   * 向Google Scholar搜索结果中注入按钮
   */
  injectButtonsToSearchResults() {
    // 获取所有论文条目
    const paperItems = document.querySelectorAll('.gs_r.gs_or.gs_scl');
    
    paperItems.forEach((item, index) => {
      // 提取论文信息
      const paperInfo = this.extractPaperInfo(item, index);
      
      // 如果成功提取到论文信息，添加按钮
      if (paperInfo) {
        this.addButtonToPaperItem(item, paperInfo);
      }
    });
  }

  /**
   * 监听页面变化，处理动态加载的内容
   */
  observePageChanges() {
    const observer = new MutationObserver((mutations) => {
      if (this.shouldReextractOnMutation(mutations)) {
        this.injectButtonsToSearchResults();
      }
    });
    
    // 开始观察
    const container = this.getResultsContainer();
    observer.observe(container, { childList: true, subtree: true });
  }

  /**
   * 从论文条目元素中提取论文信息
   * @param {Element} item - 论文条目元素
   * @param {number} index - 论文索引
   * @returns {Object|null} - 提取的论文信息对象或null
   */
  extractPaperInfo(item, index) {
    // 提取标题和链接
    const titleElement = item.querySelector('.gs_rt a');
    if (!titleElement) return null;
    
    const title = titleElement.textContent.trim();
    const url = titleElement.href;
    
    // 提取作者、出版物和年份
    const infoElement = item.querySelector('.gs_a');
    let authors = '';
    let publication = '';
    let year = '';
    
    if (infoElement) {
      const infoText = infoElement.textContent;
      
      // 尝试提取作者（在第一个-之前）
      const authorMatch = infoText.split('-');
      if (authorMatch.length > 0) {
        authors = authorMatch[0].trim();
      }
      
      // 尝试提取年份（通常在括号中的末尾）
      const yearMatch = infoText.match(/(\d{4})/);
      if (yearMatch) {
        year = yearMatch[1];
      }
      
      // 尝试提取出版物（在第二个-之后和年份之前）
      if (authorMatch.length > 1) {
        publication = authorMatch[1].trim();
        if (yearMatch) {
          publication = publication.replace(yearMatch[0], '').trim();
        }
      }
    }
    
    // 提取摘要
    const abstractElement = item.querySelector('.gs_rs');
    const abstract = abstractElement ? abstractElement.textContent.trim() : '';
    
    // 提取引用次数
    const citationElement = item.querySelector('.gs_fl a');
    let citations = 0;
    
    if (citationElement && citationElement.textContent.includes('Cited by')) {
      const citationMatch = citationElement.textContent.match(/Cited by (\d+)/);
      if (citationMatch && citationMatch[1]) {
        citations = parseInt(citationMatch[1], 10);
      }
    }
    
    // 尝试查找PDF链接
    let pdfUrl = null;
    const pdfLink = item.querySelector('a[href$=".pdf"]');
    if (pdfLink) {
      pdfUrl = pdfLink.href;
    }
    
    // 生成唯一ID
    const id = url;
    
    // 创建论文对象
    return {
      id,
      title,
      authors,
      year,
      publication,
      abstract,
      url,
      pdfUrl,
      citations,
      source: 'google_scholar'
    };
  }

  /**
   * 向论文条目添加按钮
   * @param {Element} item - 论文条目元素
   * @param {Object} paperInfo - 论文信息对象
   */
  addButtonToPaperItem(item, paperInfo) {
    // 检查是否已经添加了按钮
    if (item.querySelector('.rs-add-to-popup-btn')) {
      return;
    }
    
    // 查找论文右侧区域，通常是链接区域
    const rightSideArea = item.querySelector('.gs_or_ggsm') || item.querySelector('.gs_fl');
    
    if (rightSideArea) {
      // 创建按钮
      const button = document.createElement('button');
      button.className = 'rs-add-to-popup-btn';
      button.textContent = '添加到研究助手';
      button.style.cssText = `
        background-color: #4285f4;
        color: white;
        border: none;
        border-radius: 4px;
        padding: 6px 12px;
        margin-left: 8px;
        font-size: 12px;
        cursor: pointer;
        transition: background-color 0.3s ease;
        vertical-align: middle;
      `;
      
      // 添加悬停效果
      button.addEventListener('mouseover', () => {
        button.style.backgroundColor = '#3367d6';
      });
      button.addEventListener('mouseout', () => {
        button.style.backgroundColor = '#4285f4';
      });
      
      // 添加点击事件
      button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.addPaper(paperInfo);
      });
      
      // 插入按钮到右侧区域
      rightSideArea.appendChild(button);
    } else {
      // 如果找不到适合的位置，则创建新的容器并添加到论文条目末尾
      const buttonContainer = document.createElement('div');
      buttonContainer.className = 'rs-button-container';
      buttonContainer.style.cssText = `
        display: flex;
        justify-content: flex-end;
        margin-top: 8px;
      `;
      
      const button = document.createElement('button');
      button.className = 'rs-add-to-popup-btn';
      button.textContent = '添加到研究助手';
      button.style.cssText = `
        background-color: #4285f4;
        color: white;
        border: none;
        border-radius: 4px;
        padding: 6px 12px;
        font-size: 12px;
        cursor: pointer;
        transition: background-color 0.3s ease;
      `;
      
      button.addEventListener('mouseover', () => {
        button.style.backgroundColor = '#3367d6';
      });
      button.addEventListener('mouseout', () => {
        button.style.backgroundColor = '#4285f4';
      });
      
      button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.addPaper(paperInfo);
      });
      
      buttonContainer.appendChild(button);
      item.appendChild(buttonContainer);
    }
  }
  
  /**
   * 添加论文到存储和弹出窗口
   * @param {Object} paper - 论文对象
   */
  async addPaper(paper) {
    // 调用回调函数，将论文添加到弹出窗口
    if (this.onPaperAddedCallback) {
      this.onPaperAddedCallback(paper);
    }
  }
  
  /**
   * Get results container
   * @returns {HTMLElement} Results container element
   */
  getResultsContainer() {
    return document.getElementById('gs_res_ccl_mid') || document.body;
  }
  
  /**
   * Check if DOM mutations require re-extracting papers
   * @param {Array} mutations DOM mutation records
   * @returns {boolean} Whether papers should be re-extracted
   */
  shouldReextractOnMutation(mutations) {
    // Check if search results have changed
    for (const mutation of mutations) {
      if (mutation.type === 'childList' && 
          (mutation.target.id === 'gs_res_ccl_mid' || 
           mutation.target.closest('#gs_res_ccl_mid'))) {
        return true;
      }
    }
    return false;
  }
} 