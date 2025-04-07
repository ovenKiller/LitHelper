/**
 * PopupWindow.js
 * 
 * A popup window component that can be used across different platforms
 */

class PopupWindow {
  constructor() {
    this.element = null;
    this.header = null;
    this.content = null;
    this.paperList = null;
    this.batchActions = null;
    this.isVisible = false;
    console.log('PopupWindow constructor');
  }

  /**
   * Initialize the popup window
   * @param {Object} options - Configuration options
   * @param {string} options.title - Popup title
   * @param {string} options.query - Current search query
   * @param {Function} options.onClose - Callback when popup is closed
   * @param {Function} options.onSummarizeAll - Callback for summarize all action
   * @param {Function} options.onDownloadAll - Callback for download all action
   * @param {Function} options.onCompare - Callback for compare action
   * @returns {Promise<void>}
   */
  async initialize(options) {
    this.element = this.createElement(options);
    document.body.appendChild(this.element);
    this.isVisible = false;
    this.element.style.display = 'none';
    console.log("paperCount",options.paperCount,"currentPaperNumber",options.currentPaperNumber);
  }

  /**
   * Create the popup window element
   * @param {Object} options - Configuration options
   * @returns {HTMLElement}
   */
  createElement(options) {
    // Create popup container
    const popup = document.createElement('div');
    popup.className = 'rs-popup';
    console.log(options);
    // Create header
    this.header = this.createHeader(options.title, options.onClose);
    popup.appendChild(this.header);
    
    // Create content
    this.content = document.createElement('div');
    this.content.className = 'rs-popup-content';
    
    // Create query info
    const queryInfo = document.createElement('div');
    queryInfo.className = 'rs-popup-query';
    queryInfo.textContent = `Current search: "${options.query || 'Unknown query'}"`;
    this.content.appendChild(queryInfo);
    
    // Create paper count
    const paperCount = document.createElement('div');
    paperCount.className = 'rs-popup-paper-count';
    this.content.appendChild(paperCount);
    
    // Create batch actions
    this.batchActions = this.createBatchActions(
      options.onSummarizeAll,
      options.onDownloadAll,
      options.onCompare
    );
    this.content.appendChild(this.batchActions);
    
    // Create paper list
    this.paperList = document.createElement('div');
    this.paperList.className = 'rs-popup-paper-list';
    this.content.appendChild(this.paperList);
    
    popup.appendChild(this.content);
    
    return popup;
  }

  /**
   * Create the popup header
   * @param {string} title - Popup title
   * @param {Function} onClose - Callback when popup is closed
   * @returns {HTMLElement}
   */
  createHeader(title, onClose) {
    const header = document.createElement('div');
    header.className = 'rs-popup-header';
    
    // Create title
    const titleElement = document.createElement('h2');
    titleElement.textContent = title || 'Research Summarizer';
    header.appendChild(titleElement);
    
    // Create close button
    const closeButton = document.createElement('button');
    closeButton.className = 'rs-popup-close';
    closeButton.textContent = '×';
    closeButton.addEventListener('click', () => {
      this.hide();
      if (onClose) {
        onClose();
      }
    });
    header.appendChild(closeButton);
    
    return header;
  }

  /**
   * Create batch actions section
   * @param {Function} onSummarizeAll - Callback for summarize all action
   * @param {Function} onDownloadAll - Callback for download all action
   * @param {Function} onCompare - Callback for compare action
   * @returns {HTMLElement}
   */
  createBatchActions(onSummarizeAll, onDownloadAll, onCompare) {
    const batchActions = document.createElement('div');
    batchActions.className = 'rs-popup-batch-actions';
    
    // Create summarize all button
    const summarizeAllButton = document.createElement('button');
    summarizeAllButton.className = 'rs-batch-summarize-btn';
    summarizeAllButton.textContent = 'Summarize All Papers';
    summarizeAllButton.addEventListener('click', () => {
      if (onSummarizeAll) {
        onSummarizeAll();
      }
    });
    batchActions.appendChild(summarizeAllButton);
    
    // Create download all button
    const downloadAllButton = document.createElement('button');
    downloadAllButton.className = 'rs-batch-download-btn';
    downloadAllButton.textContent = 'Download All PDFs';
    downloadAllButton.addEventListener('click', () => {
      if (onDownloadAll) {
        onDownloadAll();
      }
    });
    batchActions.appendChild(downloadAllButton);
    
    // Create compare button
    const compareButton = document.createElement('button');
    compareButton.className = 'rs-compare-btn';
    compareButton.textContent = 'Compare Selected Papers';
    compareButton.disabled = true;
    compareButton.addEventListener('click', () => {
      if (onCompare) {
        onCompare();
      }
    });
    batchActions.appendChild(compareButton);
    
    return batchActions;
  }

  /**
   * Update the paper list
   * @param {Array} papers - Array of paper objects
   * @param {Function} onSummarize - Callback for summarize action
   * @param {Function} onDownload - Callback for download action
   * @param {Function} onSelect - Callback for paper selection
   */
  updatePaperList(papers, onSummarize, onDownload, onSelect) {
    if (!this.paperList) return;
    
    // Update paper count
    const paperCount = this.element.querySelector('.rs-popup-paper-count');
    if (paperCount) {
      paperCount.textContent = `${papers.length} papers found on this page`;
    }
    
    // Clear existing list
    this.paperList.innerHTML = '';
    
    // Add papers to list
    papers.forEach(paper => {
      const paperItem = this.createPaperItem(paper, onSummarize, onDownload, onSelect);
      this.paperList.appendChild(paperItem);
    });
  }

  /**
   * Create a paper item element
   * @param {Object} paper - Paper object
   * @param {Function} onSummarize - Callback for summarize action
   * @param {Function} onDownload - Callback for download action
   * @param {Function} onSelect - Callback for paper selection
   * @returns {HTMLElement}
   */
  createPaperItem(paper, onSummarize, onDownload, onSelect) {
    const paperItem = document.createElement('div');
    paperItem.className = 'rs-popup-paper-item';
    paperItem.dataset.paperId = paper.id;
    
    // Create checkbox for selection
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'rs-paper-checkbox';
    checkbox.dataset.paperId = paper.id;
    checkbox.addEventListener('change', () => {
      if (onSelect) {
        onSelect(paper.id, checkbox.checked);
      }
    });
    paperItem.appendChild(checkbox);
    
    // Create paper info
    const paperInfo = document.createElement('div');
    paperInfo.className = 'rs-popup-paper-info';
    
    const paperTitle = document.createElement('div');
    paperTitle.className = 'rs-popup-paper-title';
    paperTitle.textContent = paper.title;
    paperInfo.appendChild(paperTitle);
    
    const paperAuthors = document.createElement('div');
    paperAuthors.className = 'rs-popup-paper-authors';
    paperAuthors.textContent = paper.authors;
    paperInfo.appendChild(paperAuthors);
    
    const paperYear = document.createElement('div');
    paperYear.className = 'rs-popup-paper-year';
    paperYear.textContent = paper.year;
    paperInfo.appendChild(paperYear);
    
    paperItem.appendChild(paperInfo);
    
    // Create paper actions
    const paperActions = document.createElement('div');
    paperActions.className = 'rs-popup-paper-actions';
    
    const summarizeButton = document.createElement('button');
    summarizeButton.className = 'rs-summarize-btn';
    summarizeButton.dataset.paperId = paper.id;
    summarizeButton.textContent = 'Summarize';
    summarizeButton.addEventListener('click', () => {
      if (onSummarize) {
        onSummarize(paper.id);
      }
    });
    paperActions.appendChild(summarizeButton);
    
    const downloadButton = document.createElement('button');
    downloadButton.className = 'rs-download-btn';
    downloadButton.dataset.paperId = paper.id;
    downloadButton.textContent = 'Download';
    if (!paper.pdfUrl) {
      downloadButton.disabled = true;
      downloadButton.title = 'No PDF available';
    }
    downloadButton.addEventListener('click', () => {
      if (onDownload) {
        onDownload(paper.id);
      }
    });
    paperActions.appendChild(downloadButton);
    
    paperItem.appendChild(paperActions);
    
    return paperItem;
  }

  /**
   * Show the popup window
   */
  show() {
    if (this.element) {
      this.element.style.display = 'block';
      this.isVisible = true;
    }
  }

  /**
   * Hide the popup window
   */
  hide() {
    if (this.element) {
      this.element.style.display = 'none';
      this.isVisible = false;
    }
  }

  /**
   * Remove the popup window
   */
  remove() {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }

  /**
   * Update the compare button state
   * @param {boolean} enabled - Whether the compare button should be enabled
   */
  updateCompareButton(enabled) {
    const compareButton = this.element.querySelector('.rs-compare-btn');
    if (compareButton) {
      compareButton.disabled = !enabled;
    }
  }
}

export default PopupWindow; 