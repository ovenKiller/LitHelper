/**
 * storage.js
 * 
 * Utility for interacting with Chrome's storage API
 */

/**
 * Extension storage utility class implemented as singleton
 */
class ExtensionStorage {
  static instance = null;

  /**
   * Private constructor to enforce singleton pattern
   */
  constructor() {
    if (ExtensionStorage.instance) {
      throw new Error('ExtensionStorage is a singleton. Use ExtensionStorage.getInstance()');
    }
    ExtensionStorage.instance = this;
  }

  /**
   * Get the singleton instance
   * @returns {ExtensionStorage}
   */
  static getInstance() {
    if (!ExtensionStorage.instance) {
      ExtensionStorage.instance = new ExtensionStorage();
    }
    return ExtensionStorage.instance;
  }

  /**
   * Set data in storage
   * @param {string} key - Storage key
   * @param {any} value - Value to store
   * @returns {Promise<void>}
   */
  set(key, value) {
    if (typeof key !== 'string') {
      return Promise.reject(new Error('Storage key must be a string'));
    }

    return new Promise((resolve, reject) => {
      const data = { [key]: value };
      
      chrome.storage.local.set(data, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Get data from storage
   * @param {string|null} key - Storage key (null to get all)
   * @returns {Promise<any>} The retrieved data
   */
  get(key = null) {
    if (key !== null && typeof key !== 'string') {
      return Promise.reject(new Error('Storage key must be a string or null'));
    }

    return new Promise((resolve, reject) => {
      if (key === null) {
        // Get all data
        chrome.storage.local.get(null, (items) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(items);
          }
        });
      } else {
        // Get specific key
        chrome.storage.local.get([key], (items) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(items[key]);
          }
        });
      }
    });
  }

  /**
   * Remove data from storage
   * @param {string} key - Storage key
   * @returns {Promise<void>}
   */
  remove(key) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.remove(key, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Clear all extension storage
   * @returns {Promise<void>}
   */
  clear() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.clear(() => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Check if a key exists in storage
   * @param {string} key - Storage key
   * @returns {Promise<boolean>} Whether the key exists
   */
  async has(key) {
    const value = await this.get(key);
    return value !== undefined;
  }

  /**
   * Get the size of the storage in bytes
   * @returns {Promise<number>} Size in bytes
   */
  getSize() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.getBytesInUse(null, (bytesInUse) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(bytesInUse);
        }
      });
    });
  }

  /**
   * Listen for changes to storage
   * @param {Function} callback - Function to call when storage changes
   * @returns {Function} Function to remove the listener
   */
  onChange(callback) {
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }

    const listener = (changes, areaName) => {
      if (areaName === 'local') {
        callback(changes);
      }
    };
    
    chrome.storage.onChanged.addListener(listener);
    
    // Return function to remove listener
    return () => chrome.storage.onChanged.removeListener(listener);
  }
}

// Export singleton instance
export const storage = ExtensionStorage.getInstance(); 