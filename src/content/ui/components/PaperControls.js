/**
 * PaperControls.js
 * 
 * Component for paper controls (summarize and download buttons)
 */

class PaperControls {
  constructor(paperId, container) {
    this.paperId = paperId;
    this.container = container;
    this.element = null;
    this.summarizeButton = null;
    this.downloadButton = null;
  }

  /**
   * Initialize the paper controls
   * @param {Object} options - Configuration options
   * @param {boolean} options.hasPdf - Whether the paper has a PDF link
   * @param {Function} options.onSummarize - Callback for summarize action
   * @param {Function} options.onDownload - Callback for download action
   * @returns {Promise<void>}
   */
  async initialize(options) {
    this.element = this.createElement(options);
    this.container.appendChild(this.element);
  }

  /**
   * Create the paper controls element
   * @param {Object} options - Configuration options
   * @returns {HTMLElement}
   */
  createElement(options) {
    // Create controls container
    const container = document.createElement('div');
    container.className = 'rs-controls';
    container.dataset.paperId = this.paperId;
    
    // Create summarize button
    this.summarizeButton = document.createElement('button');
    this.summarizeButton.className = 'rs-summarize-btn';
    this.summarizeButton.dataset.paperId = this.paperId;
    this.summarizeButton.title = 'Summarize this paper';
    this.summarizeButton.textContent = 'Summarize';
    this.summarizeButton.addEventListener('click', () => {
      if (options.onSummarize) {
        options.onSummarize(this.paperId);
      }
    });
    container.appendChild(this.summarizeButton);
    
    // Create download button
    this.downloadButton = document.createElement('button');
    this.downloadButton.className = 'rs-download-btn';
    this.downloadButton.dataset.paperId = this.paperId;
    this.downloadButton.title = 'Download PDF';
    this.downloadButton.textContent = 'Download';
    
    // Disable download button if no PDF link
    if (!options.hasPdf) {
      this.downloadButton.disabled = true;
      this.downloadButton.title = 'No PDF available';
    } else {
      this.downloadButton.addEventListener('click', () => {
        if (options.onDownload) {
          options.onDownload(this.paperId);
        }
      });
    }
    container.appendChild(this.downloadButton);
    
    return container;
  }

  /**
   * Show loading indicator for summarize button
   */
  showSummarizeLoading() {
    if (!this.summarizeButton) return;
    
    // Save original text
    this.summarizeButton.dataset.originalText = this.summarizeButton.textContent;
    
    // Show loading state
    this.summarizeButton.textContent = 'Summarizing...';
    this.summarizeButton.disabled = true;
    this.summarizeButton.classList.add('rs-loading');
  }

  /**
   * Hide loading indicator for summarize button
   */
  hideSummarizeLoading() {
    if (!this.summarizeButton) return;
    
    // Restore original text
    if (this.summarizeButton.dataset.originalText) {
      this.summarizeButton.textContent = this.summarizeButton.dataset.originalText;
    } else {
      this.summarizeButton.textContent = 'Summarize';
    }
    
    // Restore state
    this.summarizeButton.disabled = false;
    this.summarizeButton.classList.remove('rs-loading');
  }

  /**
   * Show loading indicator for download button
   */
  showDownloadLoading() {
    if (!this.downloadButton || this.downloadButton.disabled) return;
    
    // Save original text
    this.downloadButton.dataset.originalText = this.downloadButton.textContent;
    
    // Show loading state
    this.downloadButton.textContent = 'Downloading...';
    this.downloadButton.disabled = true;
    this.downloadButton.classList.add('rs-loading');
  }

  /**
   * Hide loading indicator for download button
   */
  hideDownloadLoading() {
    if (!this.downloadButton) return;
    
    // Restore original text
    if (this.downloadButton.dataset.originalText) {
      this.downloadButton.textContent = this.downloadButton.dataset.originalText;
    } else {
      this.downloadButton.textContent = 'Download';
    }
    
    // Restore state
    this.downloadButton.disabled = false;
    this.downloadButton.classList.remove('rs-loading');
  }

  /**
   * Show download success
   */
  showDownloadSuccess() {
    if (!this.downloadButton) return;
    
    // Show success state
    this.downloadButton.textContent = 'Downloaded';
    this.downloadButton.classList.add('rs-success');
    
    // Restore after 2 seconds
    setTimeout(() => {
      this.downloadButton.textContent = 'Download';
      this.downloadButton.classList.remove('rs-success');
    }, 2000);
  }

  /**
   * Remove the paper controls
   */
  remove() {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
}

export default PaperControls; 