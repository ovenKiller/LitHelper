/**
 * LLMProvider.js
 * 
 * Interface for LLM providers
 */

/**
 * Abstract LLM Provider interface
 * All LLM providers should implement this interface
 */
class LLMProvider {
  /**
   * Constructor
   * @param {Object} config - Configuration for the provider
   */
  constructor(config) {
    if (new.target === LLMProvider) {
      throw new TypeError("Cannot instantiate abstract LLMProvider directly");
    }
    
    this.config = config || {};
  }

  /**
   * Initialize the provider
   * @returns {Promise<void>}
   */
  async initialize() {
    throw new Error("Method 'initialize()' must be implemented");
  }

  /**
   * Summarize a paper
   * @param {Paper} paper - Paper object to summarize
   * @param {Object} options - Summarization options
   * @returns {Promise<string>} The generated summary
   */
  async summarize(paper, options) {
    throw new Error("Method 'summarize()' must be implemented");
  }

  /**
   * Categorize a paper based on defined categories
   * @param {Paper} paper - Paper object to categorize
   * @param {Array<Object>} categories - Categories to classify the paper into
   * @returns {Promise<Object>} Categorization results
   */
  async categorize(paper, categories) {
    throw new Error("Method 'categorize()' must be implemented");
  }

  /**
   * Batch summarize multiple papers
   * @param {Array<Paper>} papers - Array of papers to summarize
   * @param {Object} options - Summarization options
   * @returns {Promise<Array<{paper: Paper, summary: string}>>} Array of papers with summaries
   */
  async batchSummarize(papers, options) {
    throw new Error("Method 'batchSummarize()' must be implemented");
  }

  /**
   * Generate a comparison between multiple papers
   * @param {Array<Paper>} papers - Papers to compare
   * @param {Object} options - Comparison options
   * @returns {Promise<string>} The comparison result
   */
  async comparePapers(papers, options) {
    throw new Error("Method 'comparePapers()' must be implemented");
  }

  /**
   * Check if the provider is properly configured
   * @returns {boolean} Whether the provider is configured
   */
  isConfigured() {
    throw new Error("Method 'isConfigured()' must be implemented");
  }

  /**
   * Get the name of the provider
   * @returns {string} Provider name
   */
  getProviderName() {
    throw new Error("Method 'getProviderName()' must be implemented");
  }

  /**
   * Get available models for this provider
   * @returns {Array<{id: string, name: string}>} Available models
   */
  getAvailableModels() {
    throw new Error("Method 'getAvailableModels()' must be implemented");
  }

  /**
   * Update provider configuration
   * @param {Object} newConfig - New configuration
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }
}

export default LLMProvider; 