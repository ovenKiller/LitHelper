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
import { Paper } from '../../../model/Paper';
import { logger } from '../../../util/logger.js';
import GoogleScholarElementExtractor from '../../extractors/elementExtractors/googleScholarElementExactor';
import { PLATFORM_KEYS, getPlatformDisplayName, SUPPORTED_TASK_TYPES, PAGE_TYPE } from '../../../constants';
import { parseDocumentToXMLStructure, extractTextStructure } from '../../../util/htmlParser.js';
import { runTimeDataService } from '../../../service/runTimeDataService.js';
import { addContentScriptMessageListener, MessageActions } from '../../../util/message.js';


class GoogleScholarAdapter extends SearchPlatformAdapter {
  constructor() {
    super();
    this.extractorFactory = AdapterFactory;
    this.uiManager = null; // 将在setPlatformManager中设置
    this.elementExtractor = new GoogleScholarElementExtractor(); // 添加元素提取器
    this.setupMessageListeners(); // 设置消息监听器
  }

  // 设置UI管理器
  setPlatformManager(uiManager) {
    this.uiManager = uiManager;
  }

  /**
   * 设置消息监听器
   */
  setupMessageListeners() {
    const handlers = new Map();
    handlers.set(MessageActions.TASK_COMPLETION_NOTIFICATION, this.handleTaskCompletionNotification.bind(this));
    
    addContentScriptMessageListener(handlers);
    logger.log('[GoogleScholarAdapter] Message listeners setup completed');
  }

  /**
   * 处理任务完成通知
   * @param {Object} data - 通知数据
   * @param {Object} sender - 发送者信息
   * @param {Function} sendResponse - 响应函数
   */
  async handleTaskCompletionNotification(data, sender, sendResponse) {
    try {
      logger.log('[GoogleScholarAdapter] Received task completion notification:', data);
      
      const { taskType, url, platform, success, elementCount } = data;
      
      // 验证条件1：检查当前页面是否已成功嵌入UI
      const hasUIComponents = this.checkUIComponentsInjected();
      
      // 验证条件2：检查消息URL是否与当前页面一致
      const urlMatches = this.checkUrlMatch(url);
      
      logger.log(`[GoogleScholarAdapter] UI components injected: ${hasUIComponents}, URL matches: ${urlMatches}`);
      
      // 如果两个条件都满足，弹出刷新提示
      if (!hasUIComponents && urlMatches && success) {
        this.showRefreshPrompt(elementCount);
      }
      
      sendResponse({ received: true });
    } catch (error) {
      logger.error('[GoogleScholarAdapter] Error handling task completion notification:', error);
      sendResponse({ received: false, error: error.message });
    }
    
    return true; // 异步响应
  }

  /**
   * 检查UI组件是否已注入
   * @returns {boolean} 是否已注入UI组件
   */
  checkUIComponentsInjected() {
    // 方法1：通过UIManager检查注册的组件数量
    if (this.uiManager && this.uiManager.getRegisteredComponentsCount) {
      const componentCount = this.uiManager.getRegisteredComponentsCount();
      if (componentCount > 0) {
        logger.log(`[GoogleScholarAdapter] Found ${componentCount} registered UI components`);
        return true;
      }
    }
    
    // 方法2：通过DOM检查特定的UI组件类名
    const paperControls = document.querySelectorAll('.lit-helper-paper-controls');
    const summaryContainers = document.querySelectorAll('.lit-helper-summary-container');
    
    if (paperControls.length > 0 || summaryContainers.length > 0) {
      logger.log(`[GoogleScholarAdapter] Found ${paperControls.length} paper controls and ${summaryContainers.length} summary containers`);
      return true;
    }
    
    logger.log('[GoogleScholarAdapter] No UI components found');
    return false;
  }

  /**
   * 检查URL是否匹配当前页面
   * @param {string} messageUrl - 消息中的URL
   * @returns {boolean} URL是否匹配
   */
  checkUrlMatch(messageUrl) {
    try {
      const currentUrl = new URL(window.location.href);
      const taskUrl = new URL(messageUrl);
      
      // 比较域名和路径
      const matches = currentUrl.hostname === taskUrl.hostname && 
                     currentUrl.pathname === taskUrl.pathname;
      
      logger.log(`[GoogleScholarAdapter] URL match check: current=${currentUrl.href}, task=${taskUrl.href}, matches=${matches}`);
      return matches;
    } catch (error) {
      logger.error('[GoogleScholarAdapter] Error checking URL match:', error);
      return false;
    }
  }

  /**
   * 显示刷新页面提示
   * @param {number} elementCount - 提取到的元素数量
   */
  showRefreshPrompt(elementCount) {
    const message = `论文元素提取任务已完成！检测到 ${elementCount} 个论文项。\n\n是否刷新页面以应用新的UI组件？`;
    
    if (confirm(message)) {
      logger.log('[GoogleScholarAdapter] User confirmed refresh, reloading page');
      window.location.reload();
    } else {
      logger.log('[GoogleScholarAdapter] User declined refresh');
    }
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
    return getPlatformDisplayName(PLATFORM_KEYS.GOOGLE_SCHOLAR);
  }

  /**
   * 获取平台键名（标识符）
   * @returns {string}
   */
  getPlatformKey() {
    return PLATFORM_KEYS.GOOGLE_SCHOLAR;
  }

  /**
   * 获取搜索结果容器
   * @returns {HTMLElement|null}
   */
  getResultsContainer() {
    return this.elementExtractor.getResultsContainer();
  }


  /**
   * 从当前页面提取论文信息
   * @returns {Promise<Array>} 提取的论文信息
   */
  async extractPapers() {
    parseDocument(document, "");
    
    // 使用元素提取器获取论文元素
    const resultItems = this.elementExtractor.extractAllPaperElements();
    
    return this.extractPapersFromElements(resultItems, 'google_scholar', 'gs');
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
   * 准备页面数据（并行执行）
   * @returns {Promise<void>}
   */
  async preparePageData() {
    logger.log(`[GoogleScholarAdapter] 开始准备页面数据...`);
    
    // 预查询CSS选择器，这个操作可以与UIManager初始化并行进行
    this.cachedSelector = await runTimeDataService.getCssSelectorForPage(
      window.location.href, 
      PAGE_TYPE.SEARCH_RESULTS
    );
    
    if (this.cachedSelector) {
      logger.log(`[GoogleScholarAdapter] 找到已保存的CSS选择器: ${this.cachedSelector.selector}`);
    } else {
      logger.log(`[GoogleScholarAdapter] 未找到已保存的CSS选择器，稍后将创建AI学习任务`);
    }
    
    logger.log(`[GoogleScholarAdapter] 页面数据准备完成`);
  }

  /**
   * 在页面中嵌入UI元素（优化版本）
   * @returns {Promise<boolean>} 操作是否成功
   */
  async injectUI() {
    logger.log("页面UI元素嵌入");
    try {
      let papers = [];
      
      // 使用已经预准备的CSS选择器数据
      if (this.cachedSelector) {
        logger.log(`[GoogleScholarAdapter] 使用预准备的CSS选择器: ${this.cachedSelector.selector}`);
        
        try {
          // 使用已保存的选择器提取论文元素
          papers = await this.extractPapersWithSelector(this.cachedSelector.selector);
          
          if (papers.length <= 1) {
            logger.warn(`[GoogleScholarAdapter] 已保存的选择器未能提取到足够论文，可能页面结构已变化`);
            // 如果选择器失效，禁用它并创建新任务
            await this.createPaperElementCrawlerTask();
            logger.log(`[GoogleScholarAdapter] 已创建新的AI爬取任务，等待学习新选择器`);
            return false;
          }
        } catch (error) {
          logger.error(`[GoogleScholarAdapter] 使用已保存选择器提取论文时发生错误:`, error);
          // 创建新的AI任务来学习选择器，但不阻塞当前流程
          this.createPaperElementCrawlerTask().catch(err => 
            logger.error('创建AI任务失败:', err)
          );
          return false;
        }
        
      } else {
        logger.log(`[GoogleScholarAdapter] 没有可用的CSS选择器，创建AI学习任务`);
        
        // 创建任务让AI学习，但不等待完成，让用户能看到基本UI
        this.createPaperElementCrawlerTask().catch(err => 
          logger.error('创建AI任务失败:', err)
        );
        logger.log(`[GoogleScholarAdapter] AI学习任务已创建，当前页面不执行UI注入`);
        return false;
      }

      // 为提取到的论文注入UI组件
      logger.log(`[GoogleScholarAdapter] 开始为 ${papers.length} 篇论文注入UI组件`);
      
      for (const paper of papers) {
        if (!paper.element) {
          logger.warn(`[GoogleScholarAdapter] 论文 ${paper.id} 缺少DOM元素，跳过UI注入`);
          continue;
        }
        
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
      
      logger.log(`[GoogleScholarAdapter] UI注入完成，成功为 ${papers.length} 篇论文注入组件`);
      return true;
      
    } catch (error) {
      logger.error('[GoogleScholarAdapter] UI注入失败:', error);
      return false;
    }
  }

  /**
   * 使用指定的CSS选择器提取论文
   * @param {string} selector - CSS选择器字符串
   * @returns {Promise<Array>} 提取的论文数组
   */
  async extractPapersWithSelector(selector) {
    try {
      // 使用CSS选择器直接从页面提取元素
      const elements = document.querySelectorAll(selector);
      
      if (elements.length === 0) {
        logger.warn(`[GoogleScholarAdapter] 选择器 "${selector}" 未匹配到任何元素`);
        return [];
      }
      
      logger.log(`[GoogleScholarAdapter] 选择器 "${selector}" 匹配到 ${elements.length} 个元素`);
      
      // 将NodeList转换为数组并提取论文信息
      const resultItems = Array.from(elements);
      return this.extractPapersFromElements(resultItems, 'google_scholar', 'gs');
      
    } catch (error) {
      logger.error(`[GoogleScholarAdapter] 使用选择器提取论文时发生错误:`, error);
      throw error;
    }
  }

  /**
   * 创建论文元素爬虫任务
   * @returns {Promise<boolean>} 操作是否成功
   */
  async createPaperElementCrawlerTask() {
    try {
      // 简单的任务参数 - 只传递HTML
      const taskParams = {
        url: window.location.href,
        platform: this.getPlatformKey(),
        pageHTML: extractTextStructure(document.documentElement),
        timestamp: Date.now()
      };

      // 生成任务键名
      const taskKey = `paper_element_crawler_${this.getPlatformKey()}_${Date.now()}`;

      // 通过消息发送到后台
      const result = await this.sendTaskToBackground(taskKey, SUPPORTED_TASK_TYPES.PAPER_ELEMENT_CRAWLER, taskParams);
      logger.log('Paper element crawler task created successfully:', result);
      if (result.success) {
        logger.log('Paper element crawler task created successfully:', taskKey);
        return true;
      } else {
        logger.error('Failed to create paper element crawler task:', result.error);
        return false;
      }
    } catch (error) {
      logger.error('Error creating paper element crawler task:', error);
      return false;
    }
  }

  /**
   * 发送任务到后台
   * @param {string} taskKey - 任务键名
   * @param {string} taskType - 任务类型
   * @param {Object} taskParams - 任务参数
   * @returns {Promise<Object>} 操作结果
   */
  async sendTaskToBackground(taskKey, taskType, taskParams) {
    try {
      // 导入消息模块
      const { sendMessageToBackend, MessageActions } = await import('../../../util/message.js');
      
      // 发送消息到后台
      const result = await sendMessageToBackend(MessageActions.ADD_TASK_TO_QUEUE, {
        taskKey,
        taskType,
        taskParams
      });
      
      return result;
    } catch (error) {
      logger.error('Failed to send task to background:', error);
      return {
        success: false,
        error: error.message || '发送任务失败'
      };
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