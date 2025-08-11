# Extending the Research Paper Summarizer

This document provides guidance on how to extend the Research Paper Summarizer architecture to add new features, platforms, or integrations.

## Table of Contents

1. [Adding New LLM Providers](#adding-new-llm-providers)
2. [Supporting New Platforms](#supporting-new-platforms)
3. [Implementing PDF Processors](#implementing-pdf-processors)
4. [Adding New Summarization Categories](#adding-new-summarization-categories)
5. [Enhancing the UI](#enhancing-the-ui)
6. [Adding Analytics](#adding-analytics)

## Adding New LLM Providers

The architecture is designed to easily support multiple LLM providers through the abstract `LLMProvider` interface.

### Steps to Add a New LLM Provider:

1. Create a new file in `src/api/llmProviders/` following the naming convention `[ProviderName]Provider.js`
2. Implement the required interface methods from `LLMProvider`:
   - `initialize()`: Set up API credentials and any provider-specific configuration
   - `summarize()`: Generate a summary for a paper
   - `categorize()`: Categorize a paper based on defined categories
   - `batchSummarize()`: Process multiple papers at once
   - `comparePapers()`: Compare multiple papers
   - `isConfigured()`: Check if provider is properly configured
   - `getProviderName()`: Return the provider name
   - `getAvailableModels()`: Return available models for this provider

### Example:

```javascript
// src/api/llmProviders/AnthropicProvider.js
import LLMProvider from './LLMProvider';

class AnthropicProvider extends LLMProvider {
  constructor(config) {
    super(config);
    this.apiKey = config?.apiKey || '';
    this.model = config?.model || 'claude-3-opus';
    // ... more initialization
  }
  
  async initialize() {
    if (!this.apiKey) {
      throw new Error('Anthropic API key is required');
    }
    
    this.initialized = true;
  }
  
  // Implement all required methods
  // ...
}

export default AnthropicProvider;
```

3. Add the provider to the UI options in `public/popup.html`
4. Register the provider in the config factory in `src/config/config.js`

## Supporting New Platforms

To support new academic platforms, implement a new platform adapter.

### Steps to Add a New Platform Adapter:

1. Create a new file in `src/content/platforms/` following the naming convention `[PlatformName]Adapter.js`
2. Implement the required interface methods from `PlatformAdapter`:
   - `initialize()`: Initialize platform-specific resources
   - `isPageSupported()`: Check if the current page belongs to this platform
   - `extractCurrentPagePapers()`: Extract paper information from the page
   - `injectUI()`: Add UI elements to the page
   - `getPDFUrl()`: Retrieve PDF download URL for papers
   - And other required methods for UI manipulation

### Example:

```javascript
// src/content/platforms/ScienceDirectAdapter.js
import PlatformAdapter from './PlatformAdapter';
import { createEmptyPaper } from '../../models/Paper';

class ScienceDirectAdapter extends PlatformAdapter {
  constructor(config) {
    super(config);
    this.hostPattern = /sciencedirect\.com/i;
    this.resultsSelector = '.ResultList';
    // ... more initialization
  }
  
  isPageSupported() {
    return this.hostPattern.test(window.location.hostname) && 
           document.querySelector(this.resultsSelector) !== null;
  }
  
  // Implement all required methods
  // ...
}

export default ScienceDirectAdapter;
```

3. Add the platform adapter to the imports in `src/content/content.js`
4. Add the platform to the UI options in `public/popup.html`
5. Register the platform in the config file under the `platforms` section

## Implementing PDF Processors

The architecture uses PDF processors to handle PDF downloading and extraction.

### Steps to Add a New PDF Processor:

1. Create a new file in `src/api/pdfProcessors/` following the naming convention `[Name]Processor.js`
2. Implement the required interface methods from `PDFProcessor`
3. Register the processor in the background script's initialization

### Example:

```javascript
// src/api/pdfProcessors/PDFLibProcessor.js
import PDFProcessor from './PDFProcessor';

class PDFLibProcessor extends PDFProcessor {
  constructor(config) {
    super(config);
    // ... initialization
  }
  
  async initialize() {
    // Import the PDF library
    this.pdfLib = await import('pdf-lib');
  }
  
  // Implement all required methods
  // ...
}

export default PDFLibProcessor;
```


2. Update the UI in `public/popup.html` to include the new category
3. Update the prompts in your LLM providers to include the new category

## Enhancing the UI

### Content Script UI Enhancements:

1. Modify platform adapter implementations to inject new UI elements
2. Add new CSS styles in the appropriate component stylesheet in `src/content/ui/styles/`:
   - For common styles: `base.css`
   - For platform-specific styles: `platforms.css`
   - For component-specific styles: Create or modify the respective component CSS file
3. Make sure to import any new CSS files in `src/content/ui/styles/index.css`
4. Update event handlers in platform adapters

### Popup UI Enhancements:

1. Update `public/popup.html` with new UI elements
2. Add event handlers in `src/popup/popup.js`

## Adding Analytics

To add analytics or tracking features:

1. Create a new module in `src/utils/analytics.js`
2. Implement methods to track events, user interactions, etc.
3. Import and use the analytics module in background, content, and popup scripts

### Example:

```javascript
// src/utils/analytics.js
export class Analytics {
  constructor(config) {
    this.enabled = config?.enabled || false;
    this.userId = config?.userId || null;
  }
  
  trackEvent(category, action, label, value) {
    if (!this.enabled) return;
    
    // Implement tracking logic
    logger.log(`Analytics: ${category} - ${action} - ${label} - ${value}`);
  }
  
  // More analytics methods
}
```

## Best Practices for Extension

1. **Maintain Interface Compatibility**: Always implement all required methods from base classes
2. **Configuration-Driven**: Make all new features configurable
3. **Error Handling**: Implement proper error handling and fallbacks
4. **Performance**: Be mindful of performance, especially in content scripts that run on web pages
5. **Testing**: Test your extensions on multiple browsers and versions
6. **Documentation**: Document your changes and how to use new features

## Advanced Extensions

### Cross-Platform Comparison

To add functionality that compares papers across platforms:

1. Enhance the `Paper` model to include platform-specific identifiers
2. Implement a paper matching algorithm to identify duplicates
3. Add UI elements for comparison views

### Custom Summarization Templates

To add user-defined summarization templates:

1. Extend the configuration to include customizable templates
2. Update LLM providers to use these templates
3. Add UI elements for template editing 