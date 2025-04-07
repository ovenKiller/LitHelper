/**
 * PDFProcessor.js
 * 
 * Interface for PDF processing capabilities
 */

/**
 * Abstract PDF Processor interface
 * All PDF processors should implement this interface
 */
class PDFProcessor {
  /**
   * Constructor
   * @param {Object} config - Configuration for the processor
   */
  constructor(config) {
    if (new.target === PDFProcessor) {
      throw new TypeError("Cannot instantiate abstract PDFProcessor directly");
    }
    
    this.config = config || {};
  }

  /**
   * Initialize the PDF processor
   * @returns {Promise<void>}
   */
  async initialize() {
    throw new Error("Method 'initialize()' must be implemented");
  }

  /**
   * Download a PDF from a URL
   * @param {string} url - URL to download the PDF from
   * @param {string} filename - Filename to save as
   * @returns {Promise<Blob>} The downloaded PDF as a Blob
   */
  async downloadPDF(url, filename) {
    throw new Error("Method 'downloadPDF()' must be implemented");
  }

  /**
   * Extract text from a PDF
   * @param {Blob|string} pdf - PDF as a Blob or a URL
   * @param {Object} options - Extraction options
   * @returns {Promise<string>} The extracted text
   */
  async extractText(pdf, options) {
    throw new Error("Method 'extractText()' must be implemented");
  }

  /**
   * Extract metadata from a PDF
   * @param {Blob|string} pdf - PDF as a Blob or a URL
   * @returns {Promise<Object>} The extracted metadata
   */
  async extractMetadata(pdf) {
    throw new Error("Method 'extractMetadata()' must be implemented");
  }

  /**
   * Extract tables from a PDF
   * @param {Blob|string} pdf - PDF as a Blob or a URL
   * @returns {Promise<Array<Object>>} Extracted tables
   */
  async extractTables(pdf) {
    throw new Error("Method 'extractTables()' must be implemented");
  }

  /**
   * Extract figures from a PDF
   * @param {Blob|string} pdf - PDF as a Blob or a URL
   * @returns {Promise<Array<{caption: string, image: Blob}>>} Extracted figures
   */
  async extractFigures(pdf) {
    throw new Error("Method 'extractFigures()' must be implemented");
  }

  /**
   * Extract references from a PDF
   * @param {Blob|string} pdf - PDF as a Blob or a URL
   * @returns {Promise<Array<string>>} Extracted references
   */
  async extractReferences(pdf) {
    throw new Error("Method 'extractReferences()' must be implemented");
  }

  /**
   * Check if the processor is properly configured
   * @returns {boolean} Whether the processor is configured
   */
  isConfigured() {
    throw new Error("Method 'isConfigured()' must be implemented");
  }

  /**
   * Get the name of the processor
   * @returns {string} Processor name
   */
  getProcessorName() {
    throw new Error("Method 'getProcessorName()' must be implemented");
  }

  /**
   * Update processor configuration
   * @param {Object} newConfig - New configuration
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }
}

export default PDFProcessor; 