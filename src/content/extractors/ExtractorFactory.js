/**
 * ExtractorFactory.js
 * Factory class to manage and create appropriate extractors
 */

import GoogleScholarExtractor from './implementations/GoogleScholarExtractor';
import ArxivExtractor from './implementations/ArxivExtractor';

export default class ExtractorFactory {
  constructor() {
    this.extractors = [
      new GoogleScholarExtractor(),
      new ArxivExtractor()
    ];
  }

  /**
   * Get appropriate extractor for current page
   * @returns {BaseExtractor|null}
   */
  getExtractor() {
    return this.extractors.find(extractor => extractor.isSupported()) || null;
  }

  /**
   * Get appropriate extractor for a given URL
   * @param {string} url - The URL to get an extractor for
   * @returns {BaseExtractor|null}
   */
  getExtractorForUrl(url) {
    console.log("getExtractorForUrl", url);
    if (url.includes('arxiv.org')) {
      return this.extractors.find(extractor => extractor instanceof ArxivExtractor);
    }
    return null;
  }

  /**
   * Extract paper information from current page
   * @returns {Promise<Object|null>}
   */
  async extract() {
    const extractor = this.getExtractor();
    if (!extractor) {
      console.warn('No suitable extractor found for current page');
      return null;
    }

    try {
      const paperInfo = await extractor.extract();
      return paperInfo;
    } catch (error) {
      console.error('Error extracting paper information:', error);
      return null;
    }
  }

  /**
   * Extract paper information from a URL
   * @param {string} url - The URL to extract paper information from
   * @returns {Promise<Object|null>}
   */
  async extractFromUrl(url) {
    const extractor = this.getExtractorForUrl(url);
    if (!extractor) {
      console.warn(`No suitable extractor found for URL: ${url}`);
      return null;
    }

    try {
      if (url.includes('arxiv.org')) {
        return await extractor.extractFromUrl(url);
      }
      return null;
    } catch (error) {
      console.error('Error extracting paper information from URL:', error);
      return null;
    }
  }

  /**
   * Get all supported platforms
   * @returns {string[]}
   */
  getSupportedPlatforms() {
    return this.extractors.map(extractor => extractor.getPlatformName());
  }
} 