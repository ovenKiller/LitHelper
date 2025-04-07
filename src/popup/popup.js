/**
 * popup.js
 * 
 * JavaScript for the extension popup UI
 */

import Config from '../config/config';
import { Storage } from '../utils/storage';

// Initialize popup controller
class PopupController {
  constructor() {
    this.config = Config;
    this.storage = new Storage();
    this.tabs = document.querySelectorAll('.tab');
    this.tabContents = document.querySelectorAll('.tab-content');
    this.currentTab = 'home';
    this.currentTabId = 'home';
    this.activePapersCount = 0;
    this.activePapers = [];
    this.settings = {};
    this.currentPage = '';
  }

  /**
   * Initialize the popup
   */
  async initialize() {
    try {
      // Initialize configuration
      await this.config.init();
      this.settings = this.config.getConfig();
      
      // Set up event listeners
      this.setupTabNavigation();
      this.setupSettingsUI();
      this.setupHomeUI();
      this.setupHistoryUI();
      
      // Get the active tab
      await this.getActiveTabInfo();
      
      // Load settings into the UI
      this.populateSettingsUI();
    } catch (error) {
      console.error('Failed to initialize popup:', error);
      this.showError('Failed to initialize: ' + error.message);
    }
  }

  /**
   * Set up tab navigation
   */
  setupTabNavigation() {
    this.tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const tabId = tab.getAttribute('data-tab');
        this.switchTab(tabId);
      });
    });
  }

  /**
   * Switch to a different tab
   * @param {string} tabId - Tab ID to switch to
   */
  switchTab(tabId) {
    // Remove active class from all tabs and tab contents
    this.tabs.forEach(tab => tab.classList.remove('active'));
    this.tabContents.forEach(content => content.classList.remove('active'));
    
    // Add active class to selected tab and content
    document.querySelector(`.tab[data-tab="${tabId}"]`).classList.add('active');
    document.getElementById(tabId).classList.add('active');
    
    this.currentTabId = tabId;
    
    // Refresh specific tab content if needed
    if (tabId === 'history') {
      this.refreshHistoryUI();
    } else if (tabId === 'home') {
      this.refreshHomeUI();
    }
  }

  /**
   * Set up settings UI event listeners
   */
  setupSettingsUI() {
    // Save settings button
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    saveSettingsBtn.addEventListener('click', () => this.saveSettings());
    
    // API key input
    const apiKeyInput = document.getElementById('api-key');
    apiKeyInput.addEventListener('input', () => {
      // Clear any success/error messages when the user starts typing
      const statusEl = document.getElementById('settings-status');
      statusEl.style.display = 'none';
    });
    
    // LLM provider select
    const llmProviderSelect = document.getElementById('llm-provider');
    llmProviderSelect.addEventListener('change', () => this.updateModelOptions());
  }

  /**
   * Set up home UI event listeners
   */
  setupHomeUI() {
    // Summarize all button
    const summarizeAllBtn = document.getElementById('summarize-all-btn');
    summarizeAllBtn.addEventListener('click', () => this.summarizeAllPapers());
  }

  /**
   * Set up history UI event listeners
   */
  setupHistoryUI() {
    // Nothing specific to set up for history tab yet
  }

  /**
   * Get information about the active tab
   */
  async getActiveTabInfo() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentTab = tabs[0];
      
      if (!currentTab) return;
      
      this.currentPage = currentTab.url;
      
      // Update UI
      document.getElementById('current-page').textContent = 
        new URL(this.currentPage).hostname;
      
      // Get any detected papers from the content script
      chrome.tabs.sendMessage(currentTab.id, {
        action: 'getPapers'
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.log('Could not connect to content script:', chrome.runtime.lastError);
          return;
        }
        
        if (response && response.success) {
          this.activePapers = response.papers || [];
          this.activePapersCount = this.activePapers.length;
          this.updatePapersUI();
        }
      });
    } catch (error) {
      console.error('Failed to get active tab info:', error);
    }
  }

  /**
   * Update the papers UI in the home tab
   */
  updatePapersUI() {
    const noPapersMessage = document.getElementById('no-papers-message');
    const papersList = document.getElementById('papers-list');
    const papersCount = document.getElementById('papers-count');
    const papersContainer = document.getElementById('papers-container');
    
    if (this.activePapersCount > 0) {
      noPapersMessage.style.display = 'none';
      papersList.style.display = 'block';
      papersCount.textContent = this.activePapersCount;
      
      // Clear and rebuild papers container
      papersContainer.innerHTML = '';
      
      // Add papers to the container
      this.activePapers.forEach(paper => {
        const paperEl = document.createElement('div');
        paperEl.className = 'paper-item';
        paperEl.style.cssText = 'border-bottom: 1px solid #eee; padding: 8px 0; margin-bottom: 8px;';
        
        const titleEl = document.createElement('div');
        titleEl.className = 'paper-title';
        titleEl.textContent = paper.title;
        titleEl.style.cssText = 'font-weight: 500; margin-bottom: 4px;';
        
        const authorsEl = document.createElement('div');
        authorsEl.className = 'paper-authors';
        authorsEl.textContent = paper.authors.join(', ');
        authorsEl.style.cssText = 'font-size: 12px; color: #666; margin-bottom: 4px;';
        
        const actionsEl = document.createElement('div');
        actionsEl.className = 'paper-actions';
        actionsEl.style.cssText = 'display: flex; gap: 8px; margin-top: 8px;';
        
        const summarizeBtn = document.createElement('button');
        summarizeBtn.className = 'btn';
        summarizeBtn.textContent = 'Summarize';
        summarizeBtn.style.cssText = 'padding: 4px 8px; font-size: 12px;';
        summarizeBtn.addEventListener('click', () => this.summarizePaper(paper));
        
        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'btn';
        downloadBtn.textContent = 'Download PDF';
        downloadBtn.style.cssText = 'padding: 4px 8px; font-size: 12px; background-color: #34a853;';
        downloadBtn.addEventListener('click', () => this.downloadPaper(paper));
        
        actionsEl.appendChild(summarizeBtn);
        actionsEl.appendChild(downloadBtn);
        
        paperEl.appendChild(titleEl);
        paperEl.appendChild(authorsEl);
        paperEl.appendChild(actionsEl);
        
        papersContainer.appendChild(paperEl);
      });
    } else {
      noPapersMessage.style.display = 'block';
      papersList.style.display = 'none';
    }
  }

  /**
   * Refresh the home UI
   */
  refreshHomeUI() {
    // Get fresh data from the active tab
    this.getActiveTabInfo();
  }

  /**
   * Populate the settings UI with current configuration
   */
  populateSettingsUI() {
    try {
      // API key (masked)
      const apiKeyInput = document.getElementById('api-key');
      if (this.settings.llm?.apiKey) {
        apiKeyInput.value = '•'.repeat(12); // Show masked placeholder
        apiKeyInput.setAttribute('data-has-key', 'true');
      } else {
        apiKeyInput.value = '';
        apiKeyInput.setAttribute('data-has-key', 'false');
      }
      
      // LLM provider
      const llmProviderSelect = document.getElementById('llm-provider');
      if (this.settings.llm?.provider) {
        llmProviderSelect.value = this.settings.llm.provider;
      }
      
      // Update model options based on provider
      this.updateModelOptions();
      
      // Model
      const llmModelSelect = document.getElementById('llm-model');
      if (this.settings.llm?.model) {
        llmModelSelect.value = this.settings.llm.model;
      }
      
      // Categories
      const categories = this.settings.summarization?.categories || [];
      categories.forEach(category => {
        const checkbox = document.getElementById(`category-${category.id}`);
        if (checkbox) {
          checkbox.checked = category.enabled;
        }
      });
      
      // Platforms
      const platforms = this.settings.platforms || {};
      Object.entries(platforms).forEach(([platform, settings]) => {
        const checkbox = document.getElementById(`platform-${platform}`);
        if (checkbox) {
          checkbox.checked = settings.enabled;
        }
      });
    } catch (error) {
      console.error('Failed to populate settings UI:', error);
    }
  }

  /**
   * Update model options based on the selected provider
   */
  updateModelOptions() {
    const provider = document.getElementById('llm-provider').value;
    const modelSelect = document.getElementById('llm-model');
    
    // Clear current options
    modelSelect.innerHTML = '';
    
    // Add options based on provider
    if (provider === 'openai') {
      const options = [
        { id: 'gpt-4', name: 'GPT-4' },
        { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
        { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' }
      ];
      
      options.forEach(option => {
        const optionEl = document.createElement('option');
        optionEl.value = option.id;
        optionEl.textContent = option.name;
        modelSelect.appendChild(optionEl);
      });
    } else if (provider === 'anthropic') {
      const options = [
        { id: 'claude-3-opus', name: 'Claude 3 Opus' },
        { id: 'claude-3-sonnet', name: 'Claude 3 Sonnet' },
        { id: 'claude-3-haiku', name: 'Claude 3 Haiku' }
      ];
      
      options.forEach(option => {
        const optionEl = document.createElement('option');
        optionEl.value = option.id;
        optionEl.textContent = option.name;
        modelSelect.appendChild(optionEl);
      });
    } else if (provider === 'gemini') {
      const options = [
        { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
        { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' }
      ];
      
      options.forEach(option => {
        const optionEl = document.createElement('option');
        optionEl.value = option.id;
        optionEl.textContent = option.name;
        modelSelect.appendChild(optionEl);
      });
    }
    
    // Try to select the current model if it exists in the new options
    if (this.settings.llm?.model) {
      // Find if current model exists in options
      const currentModelExists = Array.from(modelSelect.options)
        .some(option => option.value === this.settings.llm.model);
      
      if (currentModelExists) {
        modelSelect.value = this.settings.llm.model;
      }
    }
  }

  /**
   * Save settings from the UI
   */
  async saveSettings() {
    try {
      const newConfig = {
        llm: {
          provider: document.getElementById('llm-provider').value,
          model: document.getElementById('llm-model').value
        },
        summarization: {
          categories: [
            {
              id: 'methodology',
              name: 'Methodology',
              enabled: document.getElementById('category-methodology').checked
            },
            {
              id: 'findings',
              name: 'Key Findings',
              enabled: document.getElementById('category-findings').checked
            },
            {
              id: 'limitations',
              name: 'Limitations',
              enabled: document.getElementById('category-limitations').checked
            },
            {
              id: 'futureWork',
              name: 'Future Work',
              enabled: document.getElementById('category-futureWork').checked
            }
          ]
        },
        platforms: {
          googleScholar: {
            enabled: document.getElementById('platform-googleScholar').checked
          },
          ieee: {
            enabled: document.getElementById('platform-ieee').checked
          },
          acm: {
            enabled: document.getElementById('platform-acm').checked
          },
          arxiv: {
            enabled: document.getElementById('platform-arxiv').checked
          }
        }
      };
      
      // Handle API key separately (only update if changed from placeholder)
      const apiKeyInput = document.getElementById('api-key');
      if (apiKeyInput.value && !apiKeyInput.value.match(/^•+$/)) {
        newConfig.llm.apiKey = apiKeyInput.value;
      } else if (apiKeyInput.getAttribute('data-has-key') === 'false') {
        // Key was cleared
        newConfig.llm.apiKey = '';
      }
      
      // Save to storage and update configuration
      await this.config.updateConfig(newConfig);
      
      // Update settings object
      this.settings = this.config.getConfig();
      
      // Notify the background script and content scripts of the update
      chrome.runtime.sendMessage({
        action: 'updateConfig',
        data: newConfig
      });
      
      // Update active tabs
      const tabs = await chrome.tabs.query({ active: true });
      for (const tab of tabs) {
        chrome.tabs.sendMessage(tab.id, {
          action: 'updateConfig',
          data: newConfig
        }).catch(() => {
          // Ignore errors for tabs that don't have our content script
        });
      }
      
      // Show success message
      const statusEl = document.getElementById('settings-status');
      statusEl.textContent = 'Settings saved successfully!';
      statusEl.className = 'status success';
      statusEl.style.display = 'block';
      
      // Hide message after 3 seconds
      setTimeout(() => {
        statusEl.style.display = 'none';
      }, 3000);
    } catch (error) {
      console.error('Failed to save settings:', error);
      
      // Show error message
      const statusEl = document.getElementById('settings-status');
      statusEl.textContent = 'Failed to save settings: ' + error.message;
      statusEl.className = 'status error';
      statusEl.style.display = 'block';
    }
  }

  /**
   * Refresh the history UI
   */
  async refreshHistoryUI() {
    try {
      // Get stored summaries
      const response = await chrome.runtime.sendMessage({
        action: 'getStoredSummaries'
      });
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to get summaries');
      }
      
      const summaries = response.summaries || [];
      const noSummariesMessage = document.getElementById('no-summaries-message');
      const summariesContainer = document.getElementById('summaries-container');
      
      if (summaries.length > 0) {
        noSummariesMessage.style.display = 'none';
        summariesContainer.style.display = 'block';
        
        // Clear and rebuild summaries container
        summariesContainer.innerHTML = '';
        
        // Add summaries to the container (most recent first)
        summaries.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .forEach(summary => {
            const summaryEl = document.createElement('div');
            summaryEl.className = 'summary-item';
            summaryEl.style.cssText = 'border-bottom: 1px solid #eee; padding: 12px 0; margin-bottom: 8px;';
            
            // Try to find the paper details from stored papers
            chrome.runtime.sendMessage({
              action: 'getPaperDetails',
              data: { paperId: summary.paperId }
            }, (response) => {
              let paperTitle = 'Unknown Paper';
              let paperAuthors = '';
              
              if (response && response.success && response.paper) {
                paperTitle = response.paper.title;
                paperAuthors = response.paper.authors.join(', ');
              }
              
              const titleEl = document.createElement('div');
              titleEl.className = 'summary-title';
              titleEl.textContent = paperTitle;
              titleEl.style.cssText = 'font-weight: 500; margin-bottom: 4px;';
              
              const authorsEl = document.createElement('div');
              authorsEl.className = 'summary-authors';
              authorsEl.textContent = paperAuthors;
              authorsEl.style.cssText = 'font-size: 12px; color: #666; margin-bottom: 8px;';
              
              const dateEl = document.createElement('div');
              dateEl.className = 'summary-date';
              dateEl.textContent = `Summarized: ${new Date(summary.createdAt).toLocaleString()}`;
              dateEl.style.cssText = 'font-size: 11px; color: #999; margin-bottom: 8px;';
              
              const summaryTextEl = document.createElement('div');
              summaryTextEl.className = 'summary-text';
              summaryTextEl.textContent = summary.summary;
              summaryTextEl.style.cssText = 'font-size: 14px; line-height: 1.4; margin-bottom: 8px; white-space: pre-wrap;';
              
              // Add categories if available
              if (summary.categories && Object.keys(summary.categories).length > 0) {
                const categoriesEl = document.createElement('div');
                categoriesEl.className = 'summary-categories';
                categoriesEl.style.cssText = 'display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px;';
                
                Object.entries(summary.categories).forEach(([categoryId, categoryData]) => {
                  if (categoryData.score > 0) {
                    const categoryEl = document.createElement('div');
                    categoryEl.className = 'category-tag';
                    categoryEl.textContent = `${categoryId}: ${categoryData.score}/5`;
                    categoryEl.title = categoryData.explanation;
                    
                    // Color based on score
                    const hue = 120 * (categoryData.score - 1) / 4;
                    categoryEl.style.cssText = `
                      padding: 2px 6px;
                      background-color: hsl(${hue}, 80%, 90%);
                      color: hsl(${hue}, 80%, 30%);
                      border: 1px solid hsl(${hue}, 80%, 80%);
                      border-radius: 12px;
                      font-size: 12px;
                      cursor: help;
                    `;
                    
                    categoriesEl.appendChild(categoryEl);
                  }
                });
                
                summaryEl.appendChild(titleEl);
                summaryEl.appendChild(authorsEl);
                summaryEl.appendChild(dateEl);
                summaryEl.appendChild(summaryTextEl);
                summaryEl.appendChild(categoriesEl);
              } else {
                summaryEl.appendChild(titleEl);
                summaryEl.appendChild(authorsEl);
                summaryEl.appendChild(dateEl);
                summaryEl.appendChild(summaryTextEl);
              }
              
              summariesContainer.appendChild(summaryEl);
            });
          });
      } else {
        noSummariesMessage.style.display = 'block';
        summariesContainer.style.display = 'none';
      }
    } catch (error) {
      console.error('Failed to refresh history UI:', error);
    }
  }

  /**
   * Summarize a paper
   * @param {Object} paper - Paper to summarize
   */
  summarizePaper(paper) {
    try {
      // Send message to background script
      chrome.runtime.sendMessage({
        action: 'summarizePaper',
        data: {
          paper,
          options: {
            categorize: true
          }
        }
      }, (response) => {
        if (!response || !response.success) {
          const error = response?.error || 'Failed to summarize paper';
          console.error('Failed to summarize paper:', error);
          alert('Failed to summarize paper: ' + error);
          return;
        }
        
        // Show success notification and switch to history tab
        alert('Paper summarized successfully! Check the History tab to view it.');
        this.switchTab('history');
      });
    } catch (error) {
      console.error('Failed to summarize paper:', error);
      alert('Failed to summarize paper: ' + error.message);
    }
  }

  /**
   * Download a paper
   * @param {Object} paper - Paper to download
   */
  downloadPaper(paper) {
    try {
      // Send message to background script
      chrome.runtime.sendMessage({
        action: 'downloadPDF',
        data: { paper }
      }, (response) => {
        if (!response || !response.success) {
          const error = response?.error || 'Failed to download paper';
          console.error('Failed to download paper:', error);
          alert('Failed to download paper: ' + error);
          return;
        }
        
        // Show success notification
        alert('Paper download started!');
      });
    } catch (error) {
      console.error('Failed to download paper:', error);
      alert('Failed to download paper: ' + error.message);
    }
  }

  /**
   * Summarize all papers
   */
  summarizeAllPapers() {
    try {
      if (this.activePapers.length === 0) {
        alert('No papers to summarize!');
        return;
      }
      
      // Confirm with user for large number of papers
      if (this.activePapers.length > 5) {
        const confirmed = confirm(`Are you sure you want to summarize ${this.activePapers.length} papers? This may take some time.`);
        if (!confirmed) return;
      }
      
      // Send message to background script
      chrome.runtime.sendMessage({
        action: 'batchSummarizePapers',
        data: {
          papers: this.activePapers,
          options: {
            categorize: true
          }
        }
      }, (response) => {
        if (!response || !response.success) {
          const error = response?.error || 'Failed to batch summarize papers';
          console.error('Failed to batch summarize papers:', error);
          alert('Failed to batch summarize papers: ' + error);
          return;
        }
        
        // Show success notification and switch to history tab
        alert(`${response.results.length} papers summarized successfully! Check the History tab to view them.`);
        this.switchTab('history');
      });
    } catch (error) {
      console.error('Failed to batch summarize papers:', error);
      alert('Failed to batch summarize papers: ' + error.message);
    }
  }

  /**
   * Show an error message
   * @param {string} message - Error message to show
   */
  showError(message) {
    // Create error element if it doesn't exist
    let errorEl = document.getElementById('global-error');
    
    if (!errorEl) {
      errorEl = document.createElement('div');
      errorEl.id = 'global-error';
      errorEl.className = 'status error';
      errorEl.style.cssText = 'margin: 16px; display: block;';
      
      // Insert before the container
      const container = document.querySelector('.container');
      container.parentNode.insertBefore(errorEl, container);
    }
    
    errorEl.textContent = message;
    errorEl.style.display = 'block';
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const popup = new PopupController();
  popup.initialize();
}); 