/**
 * background.js
 * 
 * 扩展的后台服务脚本，处理跨页面数据和API调用
 */

// 存储摘要、分类和下载的论文
const storedData = {
  papers: {},
  summaries: {},
  downloads: {}
};

// 导入LLM提供商工厂(将在实际实现中导入)
// import { getLLMProvider } from '../api/llmProviders/index.js';

// 初始化配置
let config = {
  llm: {
    provider: 'openai',
    model: 'gpt-3.5-turbo',
    apiKey: ''
  },
  summarization: {
    categories: [
      { id: 'methodology', name: 'Methodology', enabled: true },
      { id: 'findings', name: 'Key Findings', enabled: true },
      { id: 'limitations', name: 'Limitations', enabled: true },
      { id: 'futureWork', name: 'Future Work', enabled: true }
    ]
  },
  platforms: {
    googleScholar: { enabled: true },
    ieee: { enabled: true },
    acm: { enabled: true },
    arxiv: { enabled: true }
  }
};

// 加载存储的配置
async function loadConfig() {
  try {
    const result = await chrome.storage.local.get('config');
    if (result.config) {
      config = { ...config, ...result.config };
      console.log('配置已加载', config);
    }
  } catch (error) {
    console.error('加载配置失败:', error);
  }
}

// 保存配置到存储
async function saveConfig(newConfig) {
  try {
    config = { ...config, ...newConfig };
    await chrome.storage.local.set({ config });
    console.log('配置已保存', config);
  } catch (error) {
    console.error('保存配置失败:', error);
  }
}

// 监听来自内容脚本或弹出窗口的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('收到消息:', message, '来自:', sender);
  
  if (!message || !message.action) {
    sendResponse({ success: false, error: '无效的消息格式' });
    return;
  }
  
  // 处理各种操作
  handleAction(message, sender)
    .then(response => sendResponse(response))
    .catch(error => {
      console.error('处理消息失败:', error);
      sendResponse({ 
        success: false, 
        error: error.message || '未知错误' 
      });
    });
  
  // 表示我们将异步回应
  return true;
});

// 处理不同类型的操作
async function handleAction(message, sender) {
  const { action, data } = message;
  
  switch (action) {
    case 'getConfig':
      return { success: true, config };
      
    case 'updateConfig':
      await saveConfig(data);
      // 通知所有内容脚本配置更新
      notifyConfigUpdate(data);
      return { success: true };
      
    case 'summarizePaper':
      return await summarizePaper(data.paper, data.options);
      
    case 'batchSummarizePapers':
      return await batchSummarizePapers(data.papers, data.options);
      
    case 'downloadPDF':
      return await downloadPDF(data.paper);
      
    case 'batchDownloadPapers':
      return await batchDownloadPapers(data.papers);
      
    case 'getStoredSummaries':
      return { success: true, summaries: Object.values(storedData.summaries) };
      
    case 'getPaperDetails':
      return await getPaperDetails(data.paperId);
      
    case 'openPopup':
      // 在实际实现中会处理打开弹出窗口并跳转到特定标签
      return { success: true };
      
    default:
      throw new Error(`未知操作: ${action}`);
  }
}

// 通知所有内容脚本配置已更新
async function notifyConfigUpdate(newConfig) {
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      chrome.tabs.sendMessage(tab.id, {
        action: 'updateConfig',
        data: newConfig
      }).catch(() => {
        // 忽略没有内容脚本的标签页错误
      });
    }
  } catch (error) {
    console.error('通知配置更新失败:', error);
  }
}

// 获取论文详情
async function getPaperDetails(paperId) {
  if (storedData.papers[paperId]) {
    return {
      success: true,
      paper: storedData.papers[paperId]
    };
  }
  
  return {
    success: false,
    error: '未找到论文'
  };
}

// 摘要单篇论文 - 模拟实现
async function summarizePaper(paper, options) {
  console.log('开始摘要论文:', paper.title, '选项:', options);
  
  try {
    // 存储论文以供后续参考
    storedData.papers[paper.id] = paper;
    
    // 模拟摘要生成过程
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 创建摘要
    const summary = {
      paperId: paper.id,
      summary: `这是${paper.title}的摘要。在实际实现中，这将通过LLM生成。`,
      createdAt: new Date().toISOString()
    };
    
    // 如果需要分类
    if (options?.categorize) {
      summary.categories = {
        methodology: { score: 4, explanation: '该论文的方法论很完善。' },
        findings: { score: 5, explanation: '论文中的发现很重要。' },
        limitations: { score: 3, explanation: '论文没有充分讨论局限性。' },
        futureWork: { score: 4, explanation: '对未来工作的展望很好。' }
      };
    }
    
    // 存储摘要
    storedData.summaries[paper.id] = summary;
    
    return {
      success: true,
      summary: summary.summary,
      categories: summary.categories
    };
  } catch (error) {
    console.error('摘要论文失败:', error);
    return {
      success: false,
      error: error.message || '摘要生成失败'
    };
  }
}

// 批量摘要论文 - 模拟实现
async function batchSummarizePapers(papers, options) {
  console.log('开始批量摘要', papers.length, '篇论文');
  
  try {
    const results = [];
    
    // 为每篇论文生成摘要
    for (const paper of papers) {
      const result = await summarizePaper(paper, options);
      if (result.success) {
        results.push({
          paper,
          summary: result.summary,
          categories: result.categories
        });
      }
    }
    
    return {
      success: true,
      results
    };
  } catch (error) {
    console.error('批量摘要失败:', error);
    return {
      success: false,
      error: error.message || '批量摘要失败'
    };
  }
}

// 下载PDF - 模拟实现
async function downloadPDF(paper) {
  console.log('尝试下载PDF:', paper.title);
  
  try {
    // 存储论文以供后续参考
    storedData.papers[paper.id] = paper;
    
    // 获取PDF URL
    const pdfUrl = paper.pdfUrl || await findPDFUrl(paper);
    
    if (!pdfUrl) {
      return {
        success: false,
        error: '找不到PDF链接'
      };
    }
    
    // 记录下载
    storedData.downloads[paper.id] = {
      paperId: paper.id,
      pdfUrl,
      downloadedAt: new Date().toISOString()
    };
    
    // 使用Chrome下载API下载PDF
    const downloadId = await chrome.downloads.download({
      url: pdfUrl,
      filename: `${paper.title.replace(/[\\/:*?"<>|]/g, '_')}.pdf`,
      saveAs: false
    });
    
    return {
      success: true,
      downloadId
    };
  } catch (error) {
    console.error('下载PDF失败:', error);
    return {
      success: false,
      error: error.message || '下载PDF失败'
    };
  }
}

// 批量下载PDF - 模拟实现
async function batchDownloadPapers(papers) {
  console.log('开始批量下载', papers.length, '篇论文的PDF');
  
  try {
    const results = [];
    
    // 为每篇论文下载PDF
    for (const paper of papers) {
      if (paper.pdfUrl) {
        const result = await downloadPDF(paper);
        results.push({
          paper,
          success: result.success,
          error: result.error
        });
      }
    }
    
    return {
      success: true,
      results
    };
  } catch (error) {
    console.error('批量下载失败:', error);
    return {
      success: false,
      error: error.message || '批量下载失败'
    };
  }
}

// 查找PDF URL的辅助函数 - 模拟实现
async function findPDFUrl(paper) {
  // 在实际实现中，这将尝试从论文页面或其他来源查找PDF URL
  return paper.pdfUrl || null;
}

// 当扩展安装或更新时
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('扩展已安装/更新:', details.reason);
  
  // 加载配置
  await loadConfig();
  
  // 第一次安装时显示欢迎页面或设置
  if (details.reason === 'install') {
    // chrome.tabs.create({ url: 'public/welcome.html' });
    console.log('扩展首次安装，可以在这里显示欢迎页面');
  }
});

console.log('Research Summarizer 后台服务已启动'); 