/**
 * PaperControls.js
 *
 * Component for paper controls (add button)
 */

class PaperControls {
  constructor(paperId, container) {
    this.paperId = paperId;
    this.container = container;
    this.element = null;
    this.addButton = null;
  }

  /**
   * Load CSS file for the paper controls
   * @private
   */
  _loadStyles() {
    const cssPath = chrome.runtime.getURL('content/ui/styles/PaperControls.css');
    if (!document.querySelector(`link[href="${cssPath}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.type = 'text/css';
      link.href = cssPath;
      document.head.appendChild(link);
    }
  }

  /**
   * Initialize the paper controls
   * @param {Object} options - 配置选项
   * @param {Function} options.onAddToPaperBox - 点击添加到论文盒按钮的回调
   * @returns {Promise<void>}
   */
  async initialize(options = {}) {
    this._loadStyles();
    this.element = this.createElement(options);
    this.container.appendChild(this.element);
  }

  /**
   * Create the paper controls element
   * @param {Object} options - 配置选项
   * @param {Function} options.onAddToPaperBox - 点击添加到论文盒按钮的回调
   * @returns {HTMLElement}
   */
  createElement(options = {}) {
    // Create controls container
    const container = document.createElement('div');
    container.className = 'rs-controls';
    container.dataset.paperId = this.paperId;

    // 创建"添加到论文盒"按钮
    this.addButton = document.createElement('button');
    this.addButton.className = 'rs-add-btn';
    this.addButton.dataset.paperId = this.paperId;
    this.addButton.title = '添加到论文盒';

    // 设置初始图标
    const addIconUrl = chrome.runtime.getURL('icons/add.png');
    this.addButton.style.backgroundImage = `url("${addIconUrl}")`;

    this.addButton.addEventListener('click', () => {
      if (options.onAddToPaperBox) {
        options.onAddToPaperBox(this.paperId);
      }
    });
    container.appendChild(this.addButton);

    return container;
  }

  /**
   * 显示添加成功状态
   */
  showAddSuccess() {
    if (!this.addButton) return;

    // 平滑切换到"已添加"图标
    this.smoothTransitionTo('icons/added.png', '已添加到论文盒');

    // 2秒后平滑恢复到原始图标
    setTimeout(() => {
      this.smoothTransitionTo('icons/add.png', '添加到论文盒');
    }, 2000);
  }

  /**
   * 平滑过渡到新图标
   * @param {string} iconPath - 图标路径
   * @param {string} title - 新的标题
   */
  smoothTransitionTo(iconPath, title) {
    if (!this.addButton) return;

    // 第一阶段：淡出当前图标
    this.addButton.classList.add('rs-transitioning');

    // 等待淡出完成后切换图标并淡入
    setTimeout(() => {
      const iconUrl = chrome.runtime.getURL(iconPath);
      this.addButton.style.backgroundImage = `url("${iconUrl}")`;
      this.addButton.title = title;

      // 第二阶段：淡入新图标
      this.addButton.classList.remove('rs-transitioning');
    }, 200); // 200ms 淡出时间
  }

  /**
   * Remove the paper controls
   */
  remove() {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
}

export default PaperControls; 