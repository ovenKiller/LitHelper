/**
 * BaseExtractor.js
 * Base class for extracting information from academic paper pages
 */

import { Paper } from '../../../models/Paper';

export default class BaseExtractor {
  constructor() {
    if (this.constructor === BaseExtractor) {
      throw new Error('BaseExtractor is an abstract class and cannot be instantiated directly');
    }
  }

  /**
   * Check if the current page is supported by this extractor
   * @returns {boolean}
   */
  isSupported() {
    throw new Error('isSupported() must be implemented by subclass');
  }

  /**
   * Extract abstract from the current page
   * @returns {Promise<string>} Abstract text
   */
  async extractAbstract() {
    throw new Error('extractAbstract() must be implemented by subclass');
  }

  /**
   * Extract paper information from the current page
   * @returns {Promise<Object>} Paper information object
   */
  async extract() {
  }
  async extract(url) {
  }
  /**
   * Get the name of the platform
   * @returns {string}
   */
  getPlatformName() {
    throw new Error('getPlatformName() must be implemented by subclass');
  }

  /**
   * Helper method to safely extract text content from an element
   * @param {Element} element 
   * @param {string} selector 
   * @returns {string}
   */
  safeQuerySelector(element, selector) {
    const found = element.querySelector(selector);
    return found ? found.textContent.trim() : '';
  }

  /**
   * Helper method to safely extract attribute from an element
   * @param {Element} element 
   * @param {string} selector 
   * @param {string} attribute 
   * @returns {string}
   */
  safeQuerySelectorAttribute(element, selector, attribute) {
    const found = element.querySelector(selector);
    return found ? found.getAttribute(attribute) : '';
  }

  /**
   * Helper method to find PDF links in the page
   * @param {Element} element 
   * @returns {string|null}
   */
  findPDFLink(element) {
    // Common PDF link patterns
    const pdfSelectors = [
      'a[href$=".pdf"]',
      'a[href*="pdf"]',
      'a[href*="PDF"]',
      'a[title*="PDF"]',
      'a[title*="pdf"]'
    ];

    for (const selector of pdfSelectors) {
      const link = element.querySelector(selector);
      if (link && link.href) {
        return link.href;
      }
    }

    return null;
  }
} 