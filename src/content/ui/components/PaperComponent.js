/**
 * PaperComponent.js
 * 
 * Base class for paper-related UI components
 */

class PaperComponent {
  constructor(paperId, container) {
    this.paperId = paperId;
    this.container = container;
    this.element = null;
  }

  /**
   * Initialize the component
   * @returns {Promise<void>}
   */
  async initialize() {
    // Create and append the component element
    this.element = this.createElement();
    this.container.appendChild(this.element);
  }

  /**
   * Create the component element
   * @returns {HTMLElement}
   */
  createElement() {
    // This should be implemented by subclasses
    return document.createElement('div');
  }

  /**
   * Show summary for the paper
   * @param {string} summary - Paper summary
   * @returns {Promise<void>}
   */
  async showSummary(summary) {
    // This should be implemented by subclasses
  }

  /**
   * Show summary error
   * @param {string} error - Error message
   * @returns {Promise<void>}
   */
  async showSummaryError(error) {
    // This should be implemented by subclasses
  }

  /**
   * Update loading status
   * @param {string} status - Loading status
   * @returns {Promise<void>}
   */
  async updateLoadingStatus(status) {
    // This should be implemented by subclasses
  }

  /**
   * Update download status
   * @param {string} status - Download status
   * @param {string} error - Error message if any
   * @returns {Promise<void>}
   */
  async updateDownloadStatus(status, error) {
    // This should be implemented by subclasses
  }

  /**
   * Annotate with categories
   * @param {Object} categories - Categories data
   * @returns {Promise<void>}
   */
  async annotateWithCategories(categories) {
    // This should be implemented by subclasses
  }

  /**
   * Remove the component
   */
  remove() {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
}

export default PaperComponent; 