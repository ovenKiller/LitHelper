/**
 * SummaryContainer.js
 * 
 * Component for displaying paper summaries
 */

class SummaryContainer {
  constructor(paperId, container) {
    this.paperId = paperId;
    this.container = container;
    this.element = null;
  }

  /**
   * Initialize the summary container
   * @returns {Promise<void>}
   */
  async initialize() {
    // Create and append the component element
    this.element = this.createElement();
    this.container.appendChild(this.element);
  }

  /**
   * Create the summary container element
   * @returns {HTMLElement}
   */
  createElement() {
    const container = document.createElement('div');
    container.className = 'rs-summary-container';
    container.dataset.paperId = this.paperId;
    
    // Create summary title
    const title = document.createElement('div');
    title.className = 'rs-summary-title';
    title.textContent = 'Summary';
    
    // Create summary content
    const content = document.createElement('div');
    content.className = 'rs-summary-content';
    
    // Create close button
    const closeButton = document.createElement('button');
    closeButton.className = 'rs-summary-close';
    closeButton.textContent = '×';
    closeButton.addEventListener('click', () => {
      this.remove();
    });
    
    // Add elements to container
    container.appendChild(title);
    container.appendChild(content);
    container.appendChild(closeButton);
    
    return container;
  }

  /**
   * Show summary for the paper
   * @param {string} summary - Paper summary
   * @returns {Promise<void>}
   */
  async showSummary(summary) {
    if (!this.element) return;
    
    const content = this.element.querySelector('.rs-summary-content');
    if (content) {
      content.textContent = summary;
    }
  }

  /**
   * Show summary error
   * @param {string} error - Error message
   * @returns {Promise<void>}
   */
  async showSummaryError(error) {
    if (!this.element) return;
    
    // Add error class
    this.element.classList.add('rs-summary-error');
    
    // Update title
    const title = this.element.querySelector('.rs-summary-title');
    if (title) {
      title.textContent = 'Error';
    }
    
    // Update content
    const content = this.element.querySelector('.rs-summary-content');
    if (content) {
      content.textContent = `Error: ${error}`;
      content.classList.add('rs-error-message');
    }
  }

  /**
   * Update loading status
   * @param {string} status - Loading status
   * @returns {Promise<void>}
   */
  async updateLoadingStatus(status) {
    if (!this.element) return;
    
    const content = this.element.querySelector('.rs-summary-content');
    if (content) {
      if (status === 'loading') {
        content.textContent = 'Loading summary...';
      } else if (status === 'complete') {
        // Do nothing, summary will be set by showSummary
      } else if (status === 'error') {
        // Do nothing, error will be set by showSummaryError
      }
    }
  }

  /**
   * Remove the summary container
   */
  remove() {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
}

export default SummaryContainer; 