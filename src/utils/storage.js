/**
 * storage.js
 * 
 * Utility for interacting with Chrome's storage API
 */

/**
 * Storage utility class
 */
class Storage {
  /**
   * Set data in storage
   * @param {string} key - Storage key
   * @param {any} value - Value to store
   * @returns {Promise<void>}
   */
  set(key, value) {
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

export { Storage }; 