/**
 * GoogleScholarExtractor.js
 * Extractor for Google Scholar paper pages
 */

import BaseExtractor from '../base/BaseExtractor';
import { createEmptyPaper } from '../../../models/Paper';

export default class GoogleScholarExtractor extends BaseExtractor {
  constructor() {
    super();
    this.platformName = 'Google Scholar';
  }

  isSupported() {
    const url = window.location.href;
    return url.includes('scholar.google.com');
  }

  getPlatformName() {
    return this.platformName;
  }

  async extract() {
    const paperInfo = createEmptyPaper();
    paperInfo.url = window.location.href;
    paperInfo.source = 'googleScholar';
    
    // Extract title
    const titleElement = document.querySelector('#gs_top h1');
    if (titleElement) {
      paperInfo.title = titleElement.textContent.trim();
    }


    // Extract authors and publication info
    const infoElement = document.querySelector('.gs_a');
    if (infoElement) {
      const infoText = infoElement.textContent;
      const parts = infoText.split('-');
      
      if (parts.length > 0) {
        // Split authors by comma and clean up
        paperInfo.authors = parts[0].split(',')
          .map(author => author.trim())
          .filter(author => author.length > 0);
      }
      
      if (parts.length > 1) {
        paperInfo.venue = parts[1].trim();
      }

      // Extract year for publicationDate
      const yearMatch = infoText.match(/\b(19|20)\d{2}\b/);
      if (yearMatch) {
        paperInfo.publicationDate = yearMatch[0];
      }
    }

    // Extract abstract
    const abstractElement = document.querySelector('.gs_rs');
    if (abstractElement) {
      paperInfo.abstract = abstractElement.textContent.trim();
    }

    // Extract citations
    const citationElement = document.querySelector('.gs_fl a');
    if (citationElement && citationElement.textContent.includes('Cited by')) {
      const citationMatch = citationElement.textContent.match(/Cited by (\d+)/);
      if (citationMatch && citationMatch[1]) {
        paperInfo.citationCount = parseInt(citationMatch[1], 10);
      }
    }

    
    // Find PDF URL
    paperInfo.pdfUrl = this.findPDFLink(document);

    // Generate a unique ID based on title and authors
    paperInfo.id = `gs_${Buffer.from(paperInfo.title + paperInfo.authors.join('')).toString('base64')}`;

    return paperInfo;
  }
} 