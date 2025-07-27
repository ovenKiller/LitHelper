import {
  extractTextStructure,
  extractLargeTextBlocks
} from '../util/htmlParser.js';

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.target !== 'offscreen') {
    return;
  }

  if (request.action === 'parseHTML') {
    const { html, platform } = request.data;
    const doc = new DOMParser().parseFromString(html, 'text/html');

    const selectors = generateSelectors(doc, platform);
    const validation = validateSelectors(doc, selectors);

    sendResponse({
      success: true,
      data: {
        selectors,
        validation,
      },
    });
  } else if (request.action === 'extractElements') {
    const { html, selector } = request.data;
    
    try {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const elements = doc.querySelectorAll(selector);
      
      const results = [];
      elements.forEach((element, index) => {
        results.push({
          index: index,
          textContent: element.textContent?.trim() || '',
          innerHTML: element.innerHTML || '',
          outerHTML: element.outerHTML || '',
          tagName: element.tagName?.toLowerCase() || '',
          attributes: getElementAttributes(element)
        });
      });

      sendResponse({
        success: true,
        data: {
          selector: selector,
          matchCount: results.length,
          elements: results
        }
      });
    } catch (error) {
      sendResponse({
        success: false,
        error: `Invalid selector or parsing error: ${error.message}`
      });
    }
  } else if (request.action === 'compressHtml') {
    const { html, minLength = 20 } = request.data;
    
    try {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const compressedHtml = extractTextStructure(doc.documentElement, minLength);
      
      sendResponse({
        success: true,
        data: {
          compressedHtml: compressedHtml
        }
      });
    } catch (error) {
      sendResponse({
        success: false,
        error: `HTML compression error: ${error.message}`
      });
    }
  } else if (request.action === 'extractLargeTextBlocks') {
    const { html, minLength = 100 } = request.data;
    
    try {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const textBlocks = extractLargeTextBlocks(doc.documentElement, minLength);
      
      sendResponse({
        success: true,
        data: {
          textBlocks: textBlocks
        }
      });
    } catch (error) {
      sendResponse({
        success: false,
        error: `Extracting large text blocks error: ${error.message}`
      });
    }
  }

  return true; 
});



function generateSelectors(doc, platform) {
  const selectors = {};
  
  if (platform === 'googleScholar') {
    const paperItemCandidates = ['.gs_ri', '.gs_or', '.gs_scl', '.gs_ri.gs_or.gs_scl'];
    selectors.paperItems = findBestSelector(doc, paperItemCandidates);
    
    const titleCandidates = ['.gs_rt a', '.gs_rt h3 a', 'h3 a'];
    selectors.paperTitle = findBestSelector(doc, titleCandidates);
    
    const authorCandidates = ['.gs_a'];
    selectors.paperAuthors = findBestSelector(doc, authorCandidates);
    
    const abstractCandidates = ['.gs_rs'];
    selectors.paperAbstract = findBestSelector(doc, abstractCandidates);
  }
  
  return selectors;
}

function findBestSelector(doc, candidates) {
  let bestSelector = null;
  let maxCount = 0;
  
  for (const candidate of candidates) {
    try {
      const elements = doc.querySelectorAll(candidate);
      if (elements.length > maxCount) {
        maxCount = elements.length;
        bestSelector = {
          selector: candidate,
          matchCount: elements.length
        };
      }
    } catch (error) {
      console.warn(`[Offscreen] Invalid selector: ${candidate}`);
    }
  }
  
  return bestSelector;
}

function validateSelectors(doc, selectors) {
  const validation = {};
  
  for (const [key, selectorInfo] of Object.entries(selectors)) {
    if (selectorInfo && selectorInfo.selector) {
      try {
        const elements = doc.querySelectorAll(selectorInfo.selector);
        validation[key] = {
          isValid: elements.length > 0,
          elementCount: elements.length,
          selector: selectorInfo.selector
        };
      } catch (error) {
        validation[key] = {
          isValid: false,
          error: error.message
        };
      }
    } else {
      validation[key] = {
        isValid: false,
        error: 'No valid selector found'
      };
    }
  }
  
  return validation;
}

/**
 * 获取元素的所有属性
 * @param {Element} element - DOM元素
 * @returns {Object} 属性对象
 */
function getElementAttributes(element) {
  const attributes = {};
  if (element.attributes) {
    for (let i = 0; i < element.attributes.length; i++) {
      const attr = element.attributes[i];
      attributes[attr.name] = attr.value;
    }
  }
  return attributes;
}