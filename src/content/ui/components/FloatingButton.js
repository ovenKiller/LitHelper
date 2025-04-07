/**
 * FloatingButton.js
 * 
 * A floating button component that can be used across different platforms
 */

class FloatingButton {
  constructor() {
    this.element = null;
    this.tooltip = null;
    this.onClickCallback = null;
  }

  /**
   * Initialize the floating button
   * @param {Function} onClickCallback - Callback function when button is clicked
   * @returns {Promise<void>}
   */
  async initialize(onClickCallback) {
    this.onClickCallback = onClickCallback;
    this.element = this.createElement();
    document.body.appendChild(this.element);
  }

  /**
   * Create the floating button element
   * @returns {HTMLElement}
   */
  createElement() {
    // Create button element
    const button = document.createElement('button');
    button.className = 'rs-floating-button';
    button.title = 'Research Summarizer';
    button.textContent = 'RS';
    
    // Create tooltip
    this.tooltip = document.createElement('span');
    this.tooltip.className = 'rs-tooltip';
    this.tooltip.textContent = 'Research Summarizer';
    button.appendChild(this.tooltip);
    
    // Add click event
    button.addEventListener('click', () => {
      if (this.onClickCallback) {
        this.onClickCallback();
      }
    });
    
    return button;
  }

  /**
   * Show the floating button
   */
  show() {
    if (this.element) {
      this.element.style.display = 'flex';
      console.log('Floating button shown');
    } else {
      console.warn('Cannot show floating button: element is null');
    }
  }

  /**
   * Hide the floating button
   */
  hide() {
    if (this.element) {
      this.element.style.display = 'none';
    }
  }

  /**
   * Remove the floating button
   */
  remove() {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
}

export default FloatingButton; 