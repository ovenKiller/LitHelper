/**
 * FloatingButton.js
 * 控制悬浮按钮的显示和隐藏
 * A floating button component that can be used across different platforms
 */

class FloatingButton {
  constructor() {
    this.element = null;
    this.tooltip = null;
    this.onClickCallback = null;
    this.counterBadge = null;
    this.paperCount = 0;
  }

  /**
   * 参数是点击的动作，目前实现中，点击会调用togglePopup，使得popupWindow显示或隐藏
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

    // Create counter badge
    this.counterBadge = document.createElement('div');
    this.counterBadge.className = 'rs-counter-badge';
    this.counterBadge.style.display = 'none';
    button.appendChild(this.counterBadge);
    
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

  /**
   * Set the number of collected papers and update the counter badge
   * @param {number} count - Number of collected papers
   */
  setPaperCount(count) {
    this.paperCount = count;
    if (this.counterBadge) {
      if (count > 0) {
        this.counterBadge.textContent = count.toString();
        this.counterBadge.style.display = 'flex';
      } else {
        this.counterBadge.style.display = 'none';
      }
    }
  }
}

export default FloatingButton; 