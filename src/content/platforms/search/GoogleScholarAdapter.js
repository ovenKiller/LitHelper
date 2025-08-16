/**
 * GoogleScholarAdapter.js
 * 
 * 每个平台的适配组件，功能有:
 * - 检查当前页面是否支持
 * - 在页面中嵌入按钮
 *
 */

import SearchPlatformAdapter from '../base/SearchPlatformAdapter';
import PaperControls from '../../ui/components/PaperControls';
import SummaryContainer from '../../ui/components/SummaryContainer';
import { Paper } from '../../../model/Paper';
import { logger } from '../../../util/logger.js';
import GoogleScholarElementExtractor from '../../extractors/elementExtractors/googleScholarElementExactor';
import { PLATFORM_KEYS, getPlatformDisplayName, AI_CRAWLER_SUPPORTED_TASK_TYPES, AI_EXTRACTOR_SUPPORTED_TASK_TYPES, PAGE_TYPE, EXTRACTOR_TYPE } from '../../../constants';
import { runTimeDataService } from '../../../service/runTimeDataService.js';
import { addContentScriptMessageListener,sendMessageToBackend, MessageActions } from '../../../util/message.js';
// 移除错误的导入
// import { paperMetadataService } from '../../../background/feature/paperMetadataService.js';

class GoogleScholarAdapter extends SearchPlatformAdapter {
  constructor() {
    super();
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
      logger.log('[GoogleScholarAdapter] 📨 收到任务完成通知:', data);
      
      const { taskType, url, platform, success, elementCount } = data;
      
      logger.log(`[GoogleScholarAdapter] 🔍 通知详情: taskType=${taskType}, url=${url}, platform=${platform}, success=${success}, elementCount=${elementCount}`);
      
      // 验证条件1：检查当前页面是否已成功嵌入UI
      const hasUIComponents = this.checkUIComponentsInjected();
      
      // 验证条件2：检查消息URL是否与当前页面一致
      const urlMatches = this.checkUrlMatch(url);
      
      logger.log(`[GoogleScholarAdapter] 🎯 条件检查: hasUIComponents=${hasUIComponents}, urlMatches=${urlMatches}, success=${success}`);
      logger.log(`[GoogleScholarAdapter] 🤔 判断条件: !hasUIComponents=${!hasUIComponents} && urlMatches=${urlMatches} && success=${success}`);
      
      // 如果两个条件都满足，弹出刷新提示
      if (!hasUIComponents && urlMatches && success) {
        logger.log(`[GoogleScholarAdapter] ✅ 所有条件满足，显示刷新提示`);
        this.showRefreshPrompt(elementCount);
      } else {
        logger.log(`[GoogleScholarAdapter] ❌ 条件不满足，不显示刷新提示`);
        logger.log(`[GoogleScholarAdapter] 详细原因:`);
        logger.log(`  - 页面已有UI组件: ${hasUIComponents} (需要: false)`);
        logger.log(`  - URL匹配: ${urlMatches} (需要: true)`);
        logger.log(`  - 任务成功: ${success} (需要: true)`);
        
        // 即使不显示刷新提示，也给用户一个通知
        if (success && urlMatches) {
          const message = hasUIComponents 
            ? `任务完成！检测到 ${elementCount} 个论文项，页面已有UI组件。` 
            : `任务完成！检测到 ${elementCount} 个论文项。`;
          
          // 使用浏览器通知API显示通知
          if (window.Notification && Notification.permission === 'granted') {
            new Notification('LitHelper 任务完成', {
              body: message,
              icon: chrome.runtime.getURL('src/assets/icons/icon48.png')
            });
          } else {
            // 如果没有通知权限，在控制台显示
            console.log(`[LitHelper] ${message}`);
          }
        }
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
   * 准备页面数据（并行执行）
   * @returns {Promise<void>}
   */
  async preparePageData() {
    logger.log(`[GoogleScholarAdapter] 开始准备页面数据...`);
    
    // 添加调试信息
    const currentUrl = window.location.href;
    const extractedDomain = await this.extractDomainDebug(currentUrl);
    const expectedKey = `${extractedDomain}_${PAGE_TYPE.SEARCH_RESULTS}`;
    const expectedStorageKey = `platformSelectors.${expectedKey}`;
    
    logger.log(`[GoogleScholarAdapter] 🔍 调试信息:`);
    logger.log(`  - 当前URL: ${currentUrl}`);
    logger.log(`  - 提取的域名: ${extractedDomain}`);
    logger.log(`  - 页面类型: ${PAGE_TYPE.SEARCH_RESULTS}`);
    logger.log(`  - 预期的key: ${expectedKey}`);
    logger.log(`  - 预期的存储key: ${expectedStorageKey}`);
    
    // 直接检查Chrome存储中是否存在该key
    try {
      const storageResult = await chrome.storage.local.get([expectedStorageKey]);
      logger.log(`[GoogleScholarAdapter] 📦 存储检查结果:`);
      logger.log(`  - 存储key: ${expectedStorageKey}`);
      logger.log(`  - 是否存在: ${!!storageResult[expectedStorageKey]}`);
      if (storageResult[expectedStorageKey]) {
        logger.log(`  - 存储数据: `, storageResult[expectedStorageKey]);
      }
      
      // 检查所有以 platformSelectors 开头的存储项
      const allPlatformSelectors = await chrome.storage.local.get(null);
      const platformSelectorKeys = Object.keys(allPlatformSelectors).filter(key => key.startsWith('platformSelectors.'));
      logger.log(`[GoogleScholarAdapter] 📋 所有已存储的PlatformSelector keys:`, platformSelectorKeys);
      
    } catch (storageError) {
      logger.error(`[GoogleScholarAdapter] 存储检查失败:`, storageError);
    }
    
    // 预查询PlatformSelector，这个操作可以与UIManager初始化并行进行
    this.cachedPlatformSelector = await runTimeDataService.getPlatformSelectorForPage(
      window.location.href, 
      PAGE_TYPE.SEARCH_RESULTS
    );
    
    if (this.cachedPlatformSelector) {
      logger.log(`[GoogleScholarAdapter] ✅ 找到已保存的PlatformSelector: ${this.cachedPlatformSelector.getKey()}`);
      logger.log(`[GoogleScholarAdapter] PlatformSelector详情:`, this.cachedPlatformSelector);
    } else {
      logger.log(`[GoogleScholarAdapter] ❌ 未找到已保存的PlatformSelector，稍后将创建AI学习任务`);
    }
    
    logger.log(`[GoogleScholarAdapter] 页面数据准备完成`);
  }

  /**
   * 调试用域名提取方法
   * @param {string} url - URL
   * @returns {Promise<string>} 提取的域名
   */
  async extractDomainDebug(url) {
    try {
      // 动态导入 PlatformSelector 以确保类已加载
      const { PlatformSelector } = await import('../../../model/PlatformSelector.js');
      const domain = PlatformSelector.extractDomain(url);
      logger.log(`[GoogleScholarAdapter] 域名提取成功: ${url} -> ${domain}`);
      return domain;
    } catch (error) {
      logger.error(`[GoogleScholarAdapter] 域名提取失败:`, error);
      return '';
    }
  }

  /**
   * 在页面中嵌入UI元素（使用PlatformSelector优化版本）
   * @returns {Promise<boolean>} 操作是否成功
   */
  async injectUI() {
    logger.log("页面UI元素嵌入");
    try {
      let papers = [];
      
      // 使用已经预准备的PlatformSelector数据
      if (this.cachedPlatformSelector) {
        logger.log(`[GoogleScholarAdapter] 使用预准备的PlatformSelector: ${this.cachedPlatformSelector.getKey()}`);
        // 目前保存的selector包含论文项的selector和论文项的子元素的selector，但是后者实际上没使用。
        try {
          // 使用已保存的PlatformSelector提取论文数据
          papers = await this.extractPapersWithPlatformSelector(this.cachedPlatformSelector);
          if (papers.length <= 1) {
            logger.warn(`[GoogleScholarAdapter] 已保存的PlatformSelector未能提取到足够论文，可能页面结构已变化`);
            // 如果选择器失效，创建新任务
            await this.createPaperElementCrawlerTask();
            logger.log(`[GoogleScholarAdapter] 已创建新的AI爬取任务，等待学习新PlatformSelector`);
            return false;
          } else {
            logger.log(`[GoogleScholarAdapter] 成功提取到 ${papers.length} 篇论文，准备注入UI组件`);
            // 注释：移除自动发送论文到元数据服务的逻辑，改为在用户主动整理时触发
            // await this.sendPaperElementsToMetadataService(papers);
            // 继续执行UI注入逻辑
          }
        } catch (error) {
          logger.error(`[GoogleScholarAdapter] 使用已保存PlatformSelector提取论文时发生错误:`, error);
          // 创建新的AI任务来学习选择器，但不阻塞当前流程
          this.createPaperElementCrawlerTask().catch(err => 
            logger.error('创建AI任务失败:', err)
          );
          return false;
        }
        
      } else {
        logger.log(`[GoogleScholarAdapter] 没有可用的PlatformSelector，创建AI学习任务`);
        
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
   * 使用PlatformSelector提取论文数据
   * @param {PlatformSelector} platformSelector - PlatformSelector实例
   * @returns {Promise<Array>} 提取的论文数组
   */
  async extractPapersWithPlatformSelector(platformSelector) {
    try {
      // 首先提取论文项元素
      const paperItemElements = platformSelector.extract(EXTRACTOR_TYPE.PAPER_ITEM, document);
      
      if (!paperItemElements || paperItemElements.length === 0) {
        logger.warn(`[GoogleScholarAdapter] PlatformSelector未匹配到任何论文项`);
        return [];
      }
      
      logger.log(`[GoogleScholarAdapter] PlatformSelector匹配到 ${paperItemElements.length} 个论文项`);
      
      const papers = [];
      
      // 为每个论文项提取详细信息
      for (let i = 0; i < paperItemElements.length; i++) {
        const element = paperItemElements[i];
        let title = `论文 ${i + 1}`; // 默认标题，放在外层作用域
        let authors = ''; // 作者（整段字符串）
        
        logger.log(`[GoogleScholarAdapter] 开始提取论文项 ${i + 1}/${paperItemElements.length}`);
        
        try {
          // 验证element有效性
          if (!element) {
            logger.warn(`[GoogleScholarAdapter] 论文项 ${i} 的element为null/undefined`);
            continue;
          }

          // 提取标题
          const titleElement = element.querySelector('[id]');
          if (titleElement && titleElement.textContent) {
            title = titleElement.textContent.trim();
            if (!title) {
              title = `论文 ${i + 1}`;
            }
          }
          
          logger.log(`[GoogleScholarAdapter] 论文 ${i + 1} 标题: "${title}"`);
          
          // 提取摘要
          const abstractElement = element.querySelector('.gs_rs');
          const abstract = abstractElement ? abstractElement.textContent.trim() : '';

          // 提取作者信息（来自 .gs_a 元信息行）
          const metaLineElement = element.querySelector('.gs_a');
          if (metaLineElement && metaLineElement.textContent) {
            const metaText = metaLineElement.textContent.trim();
            let authorsText = (metaText.split(/\s*-\s*/)[0] || metaText);
            authors = authorsText || '';
          }

          // 提取All Versions链接
          const allVersionsLinkElement = Array.from(element.querySelectorAll('a'))
            .find(a => {
              const text = a.textContent.toLowerCase();
              const isEnglish = text.includes('all') && text.includes('version');
              const isChinese = text.includes('所有') && text.includes('版本');
              return isEnglish || isChinese;
            });
          
          // 确保allVersionsUrl是绝对路径
          let allVersionsUrl = '';
          if (allVersionsLinkElement) {
            const href = allVersionsLinkElement.getAttribute('href');
            if (href) {
              try {
                // 使用URL构造函数将相对路径转换为绝对路径
                allVersionsUrl = new URL(href, window.location.origin).href;
              } catch (error) {
                logger.warn(`[GoogleScholarAdapter] 无法解析All Versions URL: ${href}`, error);
                allVersionsUrl = '';
              }
            }
          }
          
          // 提取PDF链接
          const pdfLinkElement = Array.from(element.querySelectorAll('a')).find(
            a => {
              const href = a.getAttribute('href');
              if (!href) return false;

              const lowerHref = href.toLowerCase();

              // 检查是否为PDF链接：
              // 1. 以.pdf结尾（传统情况）
              // 2. 包含.pdf但后面跟着锚点（如 #page=252）
              // 3. 包含.pdf但后面跟着查询参数（如 ?download=true）
              return /\.pdf(\?|#|$)/.test(lowerHref);
            }
          );
          
          // 确保pdfUrl是绝对路径
          let pdfUrl = '';
          if (pdfLinkElement) {
            const href = pdfLinkElement.getAttribute('href');
            if (href) {
              try {
                // 使用URL构造函数将相对路径转换为绝对路径
                pdfUrl = new URL(href, window.location.origin).href;
              } catch (error) {
                logger.warn(`[GoogleScholarAdapter] 无法解析PDF URL: ${href}`, error);
                pdfUrl = '';
              }
            }
          }
          // 验证关键数据
          if (!title || title.trim() === '') {
            logger.warn(`[GoogleScholarAdapter] 论文项 ${i} 标题为空，使用默认标题`);
            title = `论文 ${i + 1}`;
          }
          
          // 创建论文对象
          const paper = new Paper({
            id: title +"#" + authors,
            title: title,
            authors: authors,
            abstract: abstract,
            allVersionsUrl: allVersionsUrl,
            pdfUrl: pdfUrl,
            platform: this.getPlatformKey(), // 统一使用platform字段
            sourceUrl: window.location.href,
            element: element,
            processing: true//标记当前论文正在处理中,后续还要在后台处理
          });
          
          // 验证创建的Paper对象
          if (!paper.id) {
            logger.error(`[GoogleScholarAdapter] 创建的Paper对象ID为undefined`, {
              paperIndex: i,
              title: title,
              paperObject: paper
            });
            paper.id = `论文 ${i + 1}`; // 修复ID
          }
          
          logger.log(`[GoogleScholarAdapter] 成功提取论文 ${i + 1}:`, {
            id: paper.id,
            title: paper.title,
            hasAbstract: !!paper.abstract,
            hasElement: !!paper.element
          });
          
          papers.push(paper);
          
        } catch (extractError) {
          logger.warn(`[GoogleScholarAdapter] 提取论文项 ${i} 的详细信息时发生错误:`, extractError);
          
          // 即使提取失败，也创建一个基本的论文对象
          const fallbackId = title || `论文 ${i + 1}`;
          const fallbackPaper = new Paper({
            id: fallbackId,
            title: fallbackId,
            platform: this.getPlatformKey(), // 统一使用platform字段
            sourceUrl: window.location.href,
            element: element // 确保element始终有值
          });
          
          logger.log(`[GoogleScholarAdapter] 创建fallback论文对象:`, {
            id: fallbackPaper.id,
            title: fallbackPaper.title,
            hasElement: !!fallbackPaper.element
          });
          
          papers.push(fallbackPaper);
        }
      }
      
      logger.log(`[GoogleScholarAdapter] 成功提取 ${papers.length} 篇论文的详细信息`);
      
      // 最终验证所有paper对象
      for (let i = 0; i < papers.length; i++) {
        const paper = papers[i];
        if (!paper.id) {
          logger.error(`[GoogleScholarAdapter] 发现ID为undefined的论文对象`, {
            paperIndex: i,
            paper: paper
          });
          paper.id = `论文 ${i + 1}`;
        }
      }
      
      return papers;
      
    } catch (error) {
      logger.error(`[GoogleScholarAdapter] 使用PlatformSelector提取论文时发生错误:`, error);
      throw error;
    }
  }

  /**
   * 创建论文元素爬虫任务
   * @returns {Promise<boolean>} 操作是否成功
   */
  async createPaperElementCrawlerTask() {
    try {
      // 传递完整的HTML到后台，压缩逻辑移至后台处理
      const taskParams = {
        url: window.location.href,
        platform: this.getPlatformKey(),
        pageHTML: document.documentElement.outerHTML,
        timestamp: Date.now()
      };

      // 生成任务键名
      const taskKey = `${AI_CRAWLER_SUPPORTED_TASK_TYPES.PAPER_ELEMENT_CRAWLER}_${this.getPlatformKey()}`;

      // 通过消息发送到后台
      const result = await this.sendTaskToBackground(taskKey, AI_CRAWLER_SUPPORTED_TASK_TYPES.PAPER_ELEMENT_CRAWLER, taskParams);
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
   * 发送论文元素列表到元数据服务
   * @param {Array} papers - 论文数组
   * @returns {Promise<void>}
   */
  async sendPaperElementsToMetadataService(papers) {
    logger.log(`[GoogleScholarAdapter] 准备发送 ${papers?.length || 0} 个论文对象到元数据服务`);

    // 验证输入参数
    if (!Array.isArray(papers)) {
      logger.error(`[GoogleScholarAdapter] 论文数据发送失败: papers参数不是数组`, {
        papersType: typeof papers,
        papers: papers
      });
      return;
    }

    if (papers.length === 0) {
      logger.warn(`[GoogleScholarAdapter] 论文数组为空，无需处理`);
      return;
    }

    try {
      // 序列化论文数据，移除DOM元素引用
      const serializedPapers = papers.map(paper => ({
        ...paper,
        html: paper.element?.outerHTML || '', // 保存HTML内容
        element: undefined // 移除DOM元素引用，避免序列化问题
      }));

      // 通过消息传递调用后台的paperMetadataService
      const result = await sendMessageToBackend(MessageActions.PROCESS_PAPERS, {
        sourceDomain: this.getPlatformKey(),
        pageType: PAGE_TYPE.SEARCH_RESULTS,
        papers: serializedPapers
      });

      if (result?.success) {
        logger.log(`[GoogleScholarAdapter] 成功将 ${papers.length} 个论文对象发送到元数据服务`);
      } else {
        logger.error(`[GoogleScholarAdapter] 元数据服务处理论文对象失败:`, result?.error);
      }
    } catch (error) {
      logger.error(`[GoogleScholarAdapter] 发送论文数据到元数据服务时发生错误:`, error);
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

}

export default GoogleScholarAdapter; 