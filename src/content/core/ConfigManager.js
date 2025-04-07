/**
 * ConfigManager.js
 * 
 * Responsible for managing extension configuration
 */

class ConfigManager {
  constructor() {
    this.config = {};
  }

  /**
   * Load configuration from storage
   * @returns {Promise<void>}
   */
  async loadConfig() {
    try {
      const result = await chrome.storage.local.get('config');
      if (result.config) {
        this.config = result.config;
      }
    } catch (error) {
      console.error('Failed to load config:', error);
      throw error;
    }
  }

  /**
   * Get current configuration
   * @returns {Object} Current configuration
   */
  getConfig() {
    return this.config;
  }

  /**
   * Update configuration
   * @param {Object} newConfig - New configuration to merge
   * @returns {Promise<void>}
   */
  async updateConfig(newConfig) {
    try {
      this.config = { ...this.config, ...newConfig };
      await chrome.storage.local.set({ config: this.config });
    } catch (error) {
      console.error('Failed to update config:', error);
      throw error;
    }
  }
}

export default ConfigManager; 