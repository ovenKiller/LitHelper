/**
 * config.js
 * 
 * Configuration management for the extension
 */

import { Storage } from '../utils/storage';

// Default configuration
const DEFAULT_CONFIG = {
  llm: {
    provider: 'openai', // Default LLM provider
    apiKey: '',         // User's API key
    model: 'gpt-4',     // Default model
    maxTokens: 2000,    // Default token limit
    temperature: 0.7    // Default temperature
  },
  summarization: {
    categories: [
      { id: 'methodology', name: 'Methodology', enabled: true },
      { id: 'findings', name: 'Key Findings', enabled: true },
      { id: 'limitations', name: 'Limitations', enabled: true },
      { id: 'futureWork', name: 'Future Work', enabled: true }
    ],
    maxPapersPerBatch: 10,
    includeAbstract: true,
    includeCitations: true
  },
  platforms: {
    googleScholar: { enabled: true },
    ieee: { enabled: true },
    acm: { enabled: true },
    arxiv: { enabled: true }
  },
  ui: {
    theme: 'light',
    highlightColor: '#ffeb3b',
    badgePosition: 'topRight',
    showNotifications: true
  },
  storage: {
    maxSavedSummaries: 100,
    maxDownloadedPapers: 50
  }
};

/**
 * Configuration class for managing extension settings
 */
class Config {
  constructor() {
    this.storage = new Storage();
    this.currentConfig = null;
  }

  /**
   * Initialize configuration from storage or defaults
   * @returns {Promise<Object>} The current configuration
   */
  async init() {
    try {
      const savedConfig = await this.storage.get('config');
      this.currentConfig = savedConfig ? 
        this._mergeWithDefaults(savedConfig) : 
        { ...DEFAULT_CONFIG };
      return this.currentConfig;
    } catch (error) {
      console.error('Failed to initialize config:', error);
      this.currentConfig = { ...DEFAULT_CONFIG };
      return this.currentConfig;
    }
  }

  /**
   * Get the current configuration
   * @returns {Object} The current configuration
   */
  getConfig() {
    if (!this.currentConfig) {
      // Return a copy of defaults if not initialized
      return { ...DEFAULT_CONFIG };
    }
    return { ...this.currentConfig };
  }

  /**
   * Update configuration
   * @param {Object} newConfig - New configuration values to apply
   * @returns {Promise<Object>} Updated configuration
   */
  async updateConfig(newConfig) {
    if (!this.currentConfig) {
      await this.init();
    }
    
    // Deep merge existing config with new values
    this.currentConfig = this._deepMerge(this.currentConfig, newConfig);
    
    // Save to storage
    await this.storage.set('config', this.currentConfig);
    
    return { ...this.currentConfig };
  }

  /**
   * Reset configuration to defaults
   * @returns {Promise<Object>} Default configuration
   */
  async resetConfig() {
    this.currentConfig = { ...DEFAULT_CONFIG };
    await this.storage.set('config', this.currentConfig);
    return this.currentConfig;
  }

  /**
   * Get a specific section of the configuration
   * @param {string} section - Section name (e.g., 'llm', 'summarization')
   * @returns {Object} The requested configuration section
   */
  getSection(section) {
    if (!this.currentConfig) {
      return { ...DEFAULT_CONFIG[section] };
    }
    return { ...(this.currentConfig[section] || DEFAULT_CONFIG[section]) };
  }

  /**
   * Merge saved config with defaults to ensure all required fields exist
   * @param {Object} savedConfig - Configuration from storage
   * @returns {Object} Merged configuration
   * @private
   */
  _mergeWithDefaults(savedConfig) {
    return this._deepMerge({ ...DEFAULT_CONFIG }, savedConfig);
  }

  /**
   * Deep merge two objects
   * @param {Object} target - Target object
   * @param {Object} source - Source object to merge in
   * @returns {Object} Merged object
   * @private
   */
  _deepMerge(target, source) {
    const output = { ...target };
    
    if (source && typeof source === 'object' && !Array.isArray(source)) {
      Object.keys(source).forEach(key => {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          if (target[key]) {
            output[key] = this._deepMerge(target[key], source[key]);
          } else {
            output[key] = { ...source[key] };
          }
        } else {
          output[key] = source[key];
        }
      });
    }
    
    return output;
  }
}

export default new Config(); 