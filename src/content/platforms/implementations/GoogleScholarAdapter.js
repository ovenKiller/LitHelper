/**
 * GoogleScholarAdapter.js
 * 
 * Google Scholar platform adapter
 */

import PlatformAdapter from '../base/PlatformAdapter';

export default class GoogleScholarAdapter extends PlatformAdapter {
  constructor() {
    super();
    this.platformName = 'Google Scholar';
    this.allPapers = []; // Store all papers from current and next page
  }
  
  /**
   * Check if current page is supported
   * @returns {boolean} Whether the page is a Google Scholar search results page
   */
  isPageSupported() {
    const url = window.location.href;
    
    // Check if it's a Google Scholar page
    if (!url.includes('scholar.google.com')) {
      return false;
    }
    
    // Check if it has a query parameter, indicating it's a search results page
    return url.includes('q=');
  }
  getPlatformName() {
    return this.platformName;
  }
  getPaperCount(){
    // The correct selector for the results count element
    const resultCountElement = document.querySelector('#gs_ab_md .gs_ab_mdw');
    console.log("resultCountElement", resultCountElement);
    if (!resultCountElement) return 0;
    
    const text = resultCountElement.textContent;
    // Updated pattern to match both "about X results" and "About X results" with or without commas
    const match = text.match(/(?:About|about) ([\d,]+) results/);
    console.log("match", match);
    if (match && match[1]) {
      // Remove commas and convert to number
      return parseInt(match[1].replace(/,/g, ''), 10);
    }
    return 0;
  }
  getCurrentPaperNumber(){
    // 获取当前论文序号,可以从url中获取 https://scholar.google.com/scholar?start=50&q=medical+report+generation+survey&hl=en&as_sdt=0,5
    const url = window.location.href;
    const match = url.match(/start=(\d+)/);
    if (match && match[1]) {
      return parseInt(match[1], 10);
    }
    return 0;
  }
  /**
   * Initialize the adapter
   */

  async initialize() {
    console.log('Google Scholar adapter initializing...');
  }
  
  /**
   * Extract papers from elements
   * @param {NodeList|Element[]} resultItems - Paper result elements
   * @param {string} sourceTag - Source tag for the papers
   * @param {string} idPrefix - ID prefix for the papers
   * @returns {Array} Extracted papers
   */
  extractPapersFromElements(resultItems, sourceTag = 'google_scholar', idPrefix = '') {
    const papers = [];
    
    resultItems.forEach((item, index) => {
      // Extract title
      const titleElement = item.querySelector('.gs_rt a');
      if (!titleElement) return;
      
      const title = titleElement.textContent.trim();
      const url = titleElement.href;
      
      // Extract authors, publication and year
      const infoElement = item.querySelector('.gs_a');
      let authors = '';
      let publication = '';
      let year = '';
      
      if (infoElement) {
        const infoText = infoElement.textContent;
        
        // Try to extract authors (before the first -)
        const authorMatch = infoText.split('-');
        if (authorMatch.length > 0) {
          authors = authorMatch[0].trim();
        }
        
        // Try to extract year (usually in parentheses at the end)
        const yearMatch = infoText.match(/(\d{4})/);
        if (yearMatch) {
          year = yearMatch[1];
        }
        
        // Try to extract publication (between second - and year)
        if (authorMatch.length > 1) {
          publication = authorMatch[1].trim();
          if (yearMatch) {
            publication = publication.replace(yearMatch[0], '').trim();
          }
        }
      }
      
      // Extract abstract
      const abstractElement = item.querySelector('.gs_rs');
      const abstract = abstractElement ? abstractElement.textContent.trim() : '';
      
      // Extract citation count
      const citationElement = item.querySelector('.gs_fl a');
      let citations = 0;
      
      if (citationElement && citationElement.textContent.includes('Cited by')) {
        const citationMatch = citationElement.textContent.match(/Cited by (\d+)/);
        if (citationMatch && citationMatch[1]) {
          citations = parseInt(citationMatch[1], 10);
        }
      }
      
      // Try to find PDF link
      let pdfUrl = null;
      const pdfLink = item.querySelector('a[href$=".pdf"]');
      if (pdfLink) {
        pdfUrl = pdfLink.href;
      }
      
      // Generate unique ID
      const id = `${idPrefix}paper_${index}_${Date.now()}`;
      
      // Create paper object
      papers.push({
        id,
        title,
        authors,
        year,
        publication,
        abstract,
        url,
        pdfUrl,
        citations,
        source: sourceTag,
        element: item // Store reference to DOM element for UI injection
      });
    });
    
    return papers;
  }
  
  /**
   * Extract papers from current page
   */
  async extractPapers() {
    const resultItems = document.querySelectorAll('.gs_r.gs_or.gs_scl');
    return this.extractPapersFromElements(resultItems);
  }
  
  /**
   * Extract papers from HTML content
   */
  extractPapersFromHTML(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const resultItems = doc.querySelectorAll('.gs_r.gs_or.gs_scl');
    return this.extractPapersFromElements(resultItems, 'google_scholar_next_page', 'next_');
  }
  
  /**
   * Get papers by URL
   */
  async getPapersByUrl(url) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'same-origin',
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml',
          'Cache-Control': 'no-cache'
        }
      });
      
      if (response.ok) {
        const html = await response.text();
        return this.extractPapersFromHTML(html);
      }
      
      return [];
    } catch (error) {
      console.error('Error fetching papers by URL:', error);
      return [];
    }
  }
  
  /**
   * Get results container
   * @returns {HTMLElement} Results container element
   */
  getResultsContainer() {
    return document.getElementById('gs_res_ccl_mid') || document.body;
  }
  
  /**
   * Check if DOM mutations require re-extracting papers
   * @param {Array} mutations DOM mutation records
   * @returns {boolean} Whether papers should be re-extracted
   */
  shouldReextractOnMutation(mutations) {
    // Check if search results have changed
    for (const mutation of mutations) {
      if (mutation.type === 'childList' && 
          (mutation.target.id === 'gs_res_ccl_mid' || 
           mutation.target.closest('#gs_res_ccl_mid'))) {
        return true;
      }
    }
    return false;
  }
} 