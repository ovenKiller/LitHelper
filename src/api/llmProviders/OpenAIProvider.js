/**
 * OpenAIProvider.js
 * 
 * Implementation of LLM provider using OpenAI API
 */

import LLMProvider from './LLMProvider';

/**
 * OpenAI implementation of the LLM Provider
 */
class OpenAIProvider extends LLMProvider {
  /**
   * Constructor
   * @param {Object} config - Configuration for the provider
   */
  constructor(config) {
    super(config);
    
    this.apiKey = config?.apiKey || '';
    this.model = config?.model || 'gpt-4';
    this.maxTokens = config?.maxTokens || 2000;
    this.temperature = config?.temperature || 0.7;
    this.initialized = false;
    this.apiBase = 'https://api.openai.com/v1';
  }

  /**
   * Initialize the provider
   * @returns {Promise<void>}
   */
  async initialize() {
    if (!this.apiKey) {
      throw new Error('OpenAI API key is required');
    }
    
    this.initialized = true;
  }

  /**
   * Summarize a paper
   * @param {Paper} paper - Paper object to summarize
   * @param {Object} options - Summarization options
   * @returns {Promise<string>} The generated summary
   */
  async summarize(paper, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    // Build prompt based on paper and options
    const prompt = this.buildSummarizationPrompt(paper, options);
    
    // Call the OpenAI API
    const response = await this.callAPI('completions', {
      model: this.model,
      messages: [
        { role: 'system', content: 'You are a research assistant summarizing academic papers.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: this.maxTokens,
      temperature: this.temperature
    });
    
    // Extract the summary from the response
    const summary = response.choices?.[0]?.message?.content?.trim() || '';
    
    return summary;
  }

  /**
   * Categorize a paper based on defined categories
   * @param {Paper} paper - Paper object to categorize
   * @param {Array<Object>} categories - Categories to classify the paper into
   * @returns {Promise<Object>} Categorization results
   */
  async categorize(paper, categories) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    // Build prompt for categorization
    const prompt = this.buildCategorizationPrompt(paper, categories);
    
    // Call the OpenAI API
    const response = await this.callAPI('completions', {
      model: this.model,
      messages: [
        { role: 'system', content: 'You are a research assistant categorizing academic papers.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 1000,
      temperature: 0.3
    });
    
    // Extract the categorization from the response
    const result = response.choices?.[0]?.message?.content?.trim() || '';
    
    // Parse the result into a categories object
    return this.parseCategorization(result, categories);
  }

  /**
   * Batch summarize multiple papers
   * @param {Array<Paper>} papers - Array of papers to summarize
   * @param {Object} options - Summarization options
   * @returns {Promise<Array<{paper: Paper, summary: string}>>} Array of papers with summaries
   */
  async batchSummarize(papers, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    // Process papers one by one (could be optimized for parallel processing)
    const results = [];
    
    for (const paper of papers) {
      try {
        const summary = await this.summarize(paper, options);
        
        let categories = {};
        if (options?.categorize) {
          categories = await this.categorize(paper, options.categories || []);
        }
        
        results.push({
          paper,
          summary,
          categories
        });
      } catch (error) {
        console.error(`Failed to summarize paper: ${paper.title}`, error);
        
        // Add failed result
        results.push({
          paper,
          summary: '',
          categories: {},
          error: error.message
        });
      }
    }
    
    return results;
  }

  /**
   * Generate a comparison between multiple papers
   * @param {Array<Paper>} papers - Papers to compare
   * @param {Object} options - Comparison options
   * @returns {Promise<string>} The comparison result
   */
  async comparePapers(papers, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    // Build prompt for paper comparison
    const prompt = this.buildComparisonPrompt(papers, options);
    
    // Call the OpenAI API
    const response = await this.callAPI('completions', {
      model: this.model,
      messages: [
        { 
          role: 'system', 
          content: 'You are a research assistant comparing multiple academic papers.' 
        },
        { role: 'user', content: prompt }
      ],
      max_tokens: this.maxTokens * 2, // Allow more tokens for comparison
      temperature: 0.5
    });
    
    // Extract the comparison from the response
    const comparison = response.choices?.[0]?.message?.content?.trim() || '';
    
    return comparison;
  }

  /**
   * Check if the provider is properly configured
   * @returns {boolean} Whether the provider is configured
   */
  isConfigured() {
    return Boolean(this.apiKey);
  }

  /**
   * Get the name of the provider
   * @returns {string} Provider name
   */
  getProviderName() {
    return 'OpenAI';
  }

  /**
   * Get available models for this provider
   * @returns {Array<{id: string, name: string}>} Available models
   */
  getAvailableModels() {
    return [
      { id: 'gpt-4', name: 'GPT-4' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' }
    ];
  }

  /**
   * Update provider configuration
   * @param {Object} newConfig - New configuration
   */
  updateConfig(newConfig) {
    super.updateConfig(newConfig);
    
    if (newConfig.apiKey !== undefined) {
      this.apiKey = newConfig.apiKey;
    }
    
    if (newConfig.model !== undefined) {
      this.model = newConfig.model;
    }
    
    if (newConfig.maxTokens !== undefined) {
      this.maxTokens = newConfig.maxTokens;
    }
    
    if (newConfig.temperature !== undefined) {
      this.temperature = newConfig.temperature;
    }
  }

  /**
   * Call the OpenAI API
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request data
   * @returns {Promise<Object>} API response
   * @private
   */
  async callAPI(endpoint, data) {
    try {
      const url = `${this.apiBase}/chat/${endpoint}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `API request failed with status ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('OpenAI API call failed:', error);
      throw error;
    }
  }

  /**
   * Build a prompt for paper summarization
   * @param {Paper} paper - Paper to summarize
   * @param {Object} options - Summarization options
   * @returns {string} Prompt for the LLM
   * @private
   */
  buildSummarizationPrompt(paper, options) {
    let prompt = `Please provide a concise and informative summary of the following research paper:\n\n`;
    
    prompt += `Title: ${paper.title}\n`;
    prompt += `Authors: ${paper.authors.join(', ')}\n`;
    
    if (paper.abstract && options.includeAbstract !== false) {
      prompt += `Abstract: ${paper.abstract}\n\n`;
    }
    
    prompt += `Your summary should cover:\n`;
    prompt += `1. The main research questions or objectives\n`;
    prompt += `2. The methodology used\n`;
    prompt += `3. The key findings and results\n`;
    prompt += `4. The significance and implications of the work\n`;
    prompt += `5. Any limitations mentioned\n\n`;
    
    prompt += `Please keep the summary clear, objective, and focused on the paper's content.`;
    
    return prompt;
  }

  /**
   * Build a prompt for paper categorization
   * @param {Paper} paper - Paper to categorize
   * @param {Array<Object>} categories - Categories to classify into
   * @returns {string} Prompt for the LLM
   * @private
   */
  buildCategorizationPrompt(paper, categories) {
    let prompt = `Please categorize the following research paper according to the specified categories:\n\n`;
    
    prompt += `Title: ${paper.title}\n`;
    prompt += `Authors: ${paper.authors.join(', ')}\n`;
    
    if (paper.abstract) {
      prompt += `Abstract: ${paper.abstract}\n\n`;
    }
    
    prompt += `Categories to consider:\n`;
    
    categories.forEach(category => {
      prompt += `- ${category.name}: ${category.description || ''}\n`;
    });
    
    prompt += `\nFor each category, provide a score from 1-5 where 1 means not relevant and 5 means highly relevant.\n`;
    prompt += `Additionally, provide a brief explanation for each score.\n\n`;
    
    prompt += `Format your response as JSON like this:\n`;
    prompt += `{\n`;
    categories.forEach((category, index) => {
      prompt += `  "${category.id}": {\n`;
      prompt += `    "score": <score>,\n`;
      prompt += `    "explanation": "<brief explanation>"\n`;
      prompt += `  }${index < categories.length - 1 ? ',' : ''}\n`;
    });
    prompt += `}\n`;
    
    return prompt;
  }

  /**
   * Build a prompt for paper comparison
   * @param {Array<Paper>} papers - Papers to compare
   * @param {Object} options - Comparison options
   * @returns {string} Prompt for the LLM
   * @private
   */
  buildComparisonPrompt(papers, options) {
    let prompt = `Please compare the following ${papers.length} research papers:\n\n`;
    
    papers.forEach((paper, index) => {
      prompt += `Paper ${index + 1}:\n`;
      prompt += `Title: ${paper.title}\n`;
      prompt += `Authors: ${paper.authors.join(', ')}\n`;
      
      if (paper.abstract) {
        prompt += `Abstract: ${paper.abstract}\n\n`;
      }
    });
    
    prompt += `Your comparison should cover:\n`;
    prompt += `1. Common themes and approaches across the papers\n`;
    prompt += `2. Key differences in methodology\n`;
    prompt += `3. Complementary findings\n`;
    prompt += `4. Contradictory findings (if any)\n`;
    prompt += `5. How these papers collectively advance the field\n\n`;
    
    if (options.focusAreas?.length) {
      prompt += `Please focus particularly on comparing these areas:\n`;
      options.focusAreas.forEach(area => {
        prompt += `- ${area}\n`;
      });
      prompt += `\n`;
    }
    
    prompt += `Please structure your comparison clearly.`;
    
    return prompt;
  }

  /**
   * Parse categorization response from LLM
   * @param {string} result - Raw LLM output
   * @param {Array<Object>} categories - Category definitions
   * @returns {Object} Parsed category results
   * @private
   */
  parseCategorization(result, categories) {
    try {
      // Try to extract JSON from the response
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        // Validate the parsed result
        const categoryResults = {};
        
        categories.forEach(category => {
          if (parsed[category.id]) {
            categoryResults[category.id] = {
              score: parsed[category.id].score || 0,
              explanation: parsed[category.id].explanation || ''
            };
          } else {
            // Default if category not found in response
            categoryResults[category.id] = {
              score: 0,
              explanation: 'Category not evaluated'
            };
          }
        });
        
        return categoryResults;
      }
    } catch (error) {
      console.error('Failed to parse categorization result:', error);
    }
    
    // Fallback for parsing failure
    const fallbackResults = {};
    
    categories.forEach(category => {
      fallbackResults[category.id] = {
        score: 0,
        explanation: 'Failed to parse category result'
      };
    });
    
    return fallbackResults;
  }
}

export default OpenAIProvider; 