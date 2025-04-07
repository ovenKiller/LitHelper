/**
 * Paper.js
 * 
 * Defines the data structure for a research paper
 */

/**
 * @typedef {Object} Paper
 * @property {string} id - Unique identifier for the paper
 * @property {string} title - Title of the paper
 * @property {string[]} authors - List of authors
 * @property {string} abstract - Abstract of the paper
 * @property {string} url - URL to the paper
 * @property {string} pdfUrl - URL to download the PDF
 * @property {string} publicationDate - Publication date
 * @property {string} venue - Conference or journal name
 * @property {string[]} keywords - Keywords associated with the paper
 * @property {number} citationCount - Number of citations
 * @property {string} source - Source platform (e.g., "googleScholar", "ieee")
 * @property {Object} metadata - Additional platform-specific metadata
 */

/**
 * @typedef {Object} PaperSummary
 * @property {string} paperId - ID of the summarized paper
 * @property {string} summary - Generated summary
 * @property {Object} categories - Categorization results
 * @property {string} createdAt - Timestamp when the summary was created
 * @property {string} llmProvider - The LLM provider used for summarization
 * @property {Object} additionalInfo - Any additional information
 */

/**
 * Create a new Paper object with default values
 * @returns {Paper} A new paper object with default values
 */
function createEmptyPaper() {
  return {
    id: '',
    title: '',
    authors: [],
    abstract: '',
    url: '',
    pdfUrl: '',
    publicationDate: '',
    venue: '',
    keywords: [],
    citationCount: 0,
    source: '',
    metadata: {}
  };
}

/**
 * Create a new PaperSummary object with default values
 * @param {string} paperId - ID of the paper being summarized
 * @returns {PaperSummary} A new paper summary object with default values
 */
function createEmptySummary(paperId) {
  return {
    paperId,
    summary: '',
    categories: {},
    createdAt: new Date().toISOString(),
    llmProvider: '',
    additionalInfo: {}
  };
}

export { createEmptyPaper, createEmptySummary }; 