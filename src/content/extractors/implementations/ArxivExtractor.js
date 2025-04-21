/**
 * ArxivExtractor.js
 * Extractor for arXiv paper pages
 */

import BaseExtractor from '../base/BaseExtractor';
import { createEmptyPaper } from '../../../models/Paper';
import axios from 'axios';

export default class ArxivExtractor extends BaseExtractor {
  constructor() {
    super();
    this.platformName = 'arXiv';
  }

  /**
   * Check if the current page is supported by this extractor
   * @returns {boolean}
   */
  isSupported() {
    const url = window.location.href;
    return url.includes('arxiv.org');
  }

  /**
   * Extract abstract from the current page
   * @returns {Promise<string>} Abstract text
   */
  async extractAbstract() {
    const abstractElement = document.querySelector('.abstract');
    return abstractElement ? abstractElement.textContent.trim() : '';
  }

  getPlatformName() {
    return this.platformName;
  }

  /**
   * Extract paper information from an arXiv URL
   * @param {string} url - The arXiv paper URL
   * @returns {Promise<Object>} Paper information
   */
  async extractFromUrl(url) {
    console.log("extractFromUrl", url);
    try {
      // 使用消息传递机制，让后台脚本代理获取页面内容，避免CORS问题
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          action: 'fetchPageContent',
          data: { url }
        }, (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else if (response.success) {
            resolve(response);
          } else {
            reject(new Error(response.error || 'Failed to fetch page content'));
          }
        });
      });

      const html = response.data;
      console.log("html", html);
      // Create a DOM parser to parse the HTML string
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      const paperInfo = createEmptyPaper();
      paperInfo.url = url;
      paperInfo.source = 'arxiv';
      paperInfo.venue = 'arXiv';

      // Extract title
      const titleElement = doc.querySelector('h1.title');
      if (titleElement) {
        paperInfo.title = titleElement.textContent.replace(/^Title:\s*/, '').trim();
      }

      // Extract authors
      const authorElements = doc.querySelectorAll('.authors a');
      if (authorElements.length > 0) {
        paperInfo.authors = Array.from(authorElements)
          .map(author => author.textContent.trim());
      }

      // Extract abstract
      const abstractElement = doc.querySelector('.abstract');
      if (abstractElement) {
        paperInfo.abstract = abstractElement.textContent.replace(/^Abstract:\s*/, '').trim();
      }

      // Extract date
      const dateElement = doc.querySelector('.submission-history');
      if (dateElement) {
        const dateMatch = dateElement.textContent.match(/\[v1\]\s+(.*\d{4})/);
        if (dateMatch) {
          paperInfo.publicationDate = new Date(dateMatch[1]).toISOString().split('T')[0];
        }
      }

      // Get PDF URL
      const pdfLink = doc.querySelector('a[href$=".pdf"]');
      if (pdfLink) {
        paperInfo.pdfUrl = pdfLink.href;
      }

      // Extract keywords/categories
      const subjectsElement = doc.querySelector('.subjects');
      if (subjectsElement) {
        paperInfo.keywords = subjectsElement.textContent
          .split(';')
          .map(keyword => keyword.trim())
          .filter(keyword => keyword.length > 0);
      }

      // Generate a unique ID from the arXiv URL
      const arxivIdMatch = url.match(/(\d+\.\d+)/);
      if (arxivIdMatch) {
        paperInfo.id = `arxiv_${arxivIdMatch[1]}`;
      } else {
        paperInfo.id = `arxiv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }

      return paperInfo;
    } catch (error) {
      console.error('Error extracting paper info from URL:', error);
      throw error;
    }
  }

  async extract() {
    const paperInfo = createEmptyPaper();
    paperInfo.url = window.location.href;
    paperInfo.source = 'arxiv';
    paperInfo.venue = 'arXiv';

    // Extract title
    const titleElement = document.querySelector('h1.title');
    if (titleElement) {
      // Remove "Title:" prefix if present
      paperInfo.title = titleElement.textContent.replace(/^Title:\s*/, '').trim();
    }

    // Extract authors
    const authorElements = document.querySelectorAll('.authors a');
    if (authorElements.length > 0) {
      paperInfo.authors = Array.from(authorElements)
        .map(author => author.textContent.trim());
    }

    // Extract abstract
    const abstractElement = document.querySelector('.abstract');
    if (abstractElement) {
      // Remove "Abstract:" prefix if present
      paperInfo.abstract = abstractElement.textContent.replace(/^Abstract:\s*/, '').trim();
    }

    // Extract date
    const dateElement = document.querySelector('.submission-history');
    if (dateElement) {
      const dateMatch = dateElement.textContent.match(/\[v1\]\s+(.*\d{4})/);
      if (dateMatch) {
        paperInfo.publicationDate = new Date(dateMatch[1]).toISOString().split('T')[0];
      }
    }

    // Get PDF URL
    const pdfLink = document.querySelector('a[href$=".pdf"]');
    if (pdfLink) {
      paperInfo.pdfUrl = pdfLink.href;
    }

    // Extract keywords/categories
    const subjectsElement = document.querySelector('.subjects');
    if (subjectsElement) {
      paperInfo.keywords = subjectsElement.textContent
        .split(';')
        .map(keyword => keyword.trim())
        .filter(keyword => keyword.length > 0);
    }

    // Generate a unique ID from the arXiv URL
    const arxivIdMatch = paperInfo.url.match(/(\d+\.\d+)/);
    if (arxivIdMatch) {
      paperInfo.id = `arxiv_${arxivIdMatch[1]}`;
    } else {
      paperInfo.id = `arxiv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    return paperInfo;
  }
} 