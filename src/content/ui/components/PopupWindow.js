/**
 * PopupWindow.js
 *
 * A popup window component that can be used across different platforms
 */

import { logger } from '../../../util/logger.js';
import { sendMessageToBackend, MessageActions } from '../../../util/message.js';
import { fileManagementService } from '../../../service/fileManagementService.js';
import { configService } from '../../../service/configService.js';

// 正确的路径，与manifest.json中的web_accessible_resources配置一致
const DELETE_ICON_PATH = 'icons/delete-icon.svg';

class PopupWindow {
  constructor() {
    this.element = null;
    this.header = null;
    this.content = null;
    this.paperList = null;
    this.actionButtons = null;
    this.isVisible = false;
    this.selectedOptions = {
      downloadPdf: false,
      translation: {
        enabled: false,
        targetLanguage: 'zh-CN'
      },
      classification: {
        enabled: false,
        selectedStandard: 'research_method'
      },
      storage: {
        workingDirectory: fileManagementService.getWorkingDirectoryName(), // 工作目录路径（固定为LitHelperData）
        taskDirectory: '',    // 任务目录名
        fullPath: ''          // 完整路径预览
      }
    };

    // 缓存配置数据
    this.translationLanguages = [];
    this.classificationStandards = [];
    logger.log('PopupWindow constructor');
  }

  /**
   * Load CSS file for the popup window
   * @private
   */
  _loadStyles() {
    const cssPath = chrome.runtime.getURL('content/ui/styles/PopupWindow.css');
    if (!document.querySelector(`link[href="${cssPath}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.type = 'text/css';
      link.href = cssPath;
      document.head.appendChild(link);
    }
  }

  /**
   * Initialize the popup window
   * @param {Object} options - Configuration options
   * @param {string} options.title - Popup title
   * @param {string} options.query - Current search query
   * @param {Function} options.onClose - Callback when popup is closed
   * @param {Function} options.onStartOrganize - Callback for "开始整理" action
   * @param {Function} options.onRemovePaper - Callback for removing a paper
   * @returns {Promise<void>}
   */
  async initialize(options) {
    try {
      // 加载样式
      this._loadStyles();

      // 加载配置数据
      await this._loadConfigData();

      // 创建元素
      this.element = this.createElement(options);
      document.body.appendChild(this.element);

      // 设置初始状态
      this.isVisible = false;
      this.element.style.display = 'none';
    } catch (error) {
      logger.error('Failed to initialize popup window:', error);
      throw error;
    }
  }

  /**
   * 加载配置数据
   * @private
   */
  async _loadConfigData() {
    try {
      logger.log('[POPUP] 开始加载配置数据...');

      // 直接从 configService 加载数据
      this.translationLanguages = await configService.getTranslationLanguages();
      logger.log('[POPUP] 翻译语言加载完成:', this.translationLanguages);

      this.classificationStandards = await configService.getClassificationStandards();
      logger.log('[POPUP] 分类标准加载完成:', this.classificationStandards);

      // 加载默认配置
      const defaultConfig = await configService.getOrganizeDefaults();
      logger.log('[POPUP] 默认配置加载完成:', defaultConfig);

      this.selectedOptions = { ...this.selectedOptions, ...defaultConfig };

      logger.log('[POPUP] 配置数据加载完成', {
        languages: this.translationLanguages.length,
        standards: this.classificationStandards.length,
        options: this.selectedOptions
      });
    } catch (error) {
      logger.error('[POPUP] 加载配置数据失败:', error);
      // 使用默认值继续
      this.translationLanguages = [];
      this.classificationStandards = [];
    }
  }

  /**
   * 创建popup窗口
   * @param {Object} options - Configuration options
   * @returns {HTMLElement}
   */
  createElement(options) {
    // Create popup container
    const popup = document.createElement('div');
    popup.className = 'rs-popup';
    popup.style.display = 'flex'; // Ensure flex display

    // Create wrapper for content (everything except action buttons)
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'rs-popup-content-wrapper';
    popup.appendChild(contentWrapper);

    // Create header
    this.header = this.createHeader(options.title, options.onClose);
    contentWrapper.appendChild(this.header);

    // Create content
    this.content = document.createElement('div');
    this.content.className = 'rs-popup-content';

    // Create query info
    const queryInfo = document.createElement('div');
    queryInfo.className = 'rs-popup-query';
    this.content.appendChild(queryInfo);


    // Create scrollable paper list container
    const paperListContainer = document.createElement('div');
    paperListContainer.className = 'rs-popup-paper-list-container';

    // Create paper list
    this.paperList = document.createElement('div');
    this.paperList.className = 'rs-popup-paper-list';
    paperListContainer.appendChild(this.paperList);
    this.content.appendChild(paperListContainer);

    // Add content to wrapper
    contentWrapper.appendChild(this.content);

    // Create action buttons section as a separate fixed section
    this.actionButtons = this.createActionButtons(options.onStartOrganize);
    this.actionButtons.className = 'rs-action-buttons rs-action-buttons-fixed';
    popup.appendChild(this.actionButtons);

    return popup;
  }

  /**
   * Create the popup header
   * @param {string} title - Popup title
   * @param {Function} onClose - Callback when popup is closed
   * @returns {HTMLElement}
   */
  createHeader(title, onClose) {
    const header = document.createElement('div');
    header.className = 'rs-popup-header';

    // Create title
    const titleElement = document.createElement('h2');
    titleElement.textContent = title || 'Research Summarizer';
    header.appendChild(titleElement);

    // Create close button
    const closeButton = document.createElement('button');
    closeButton.className = 'rs-popup-close';
    closeButton.textContent = '×';
    closeButton.addEventListener('click', () => {
      this.hide();
      if (onClose) {
        onClose();
      }
    });
    header.appendChild(closeButton);

    return header;
  }

  /**
   * Create action buttons section
   * @param {Function} onStartOrganize - Callback for "开始整理" action
   * @returns {HTMLElement}
   */
  createActionButtons(onStartOrganize) {
    const actionButtons = document.createElement('div');
    actionButtons.className = 'rs-action-buttons';

    // 1. PDF下载开关
    const pdfOption = this._createToggleOption('downloadPdf', 'PDF下载', this.selectedOptions.downloadPdf);
    actionButtons.appendChild(pdfOption);

    // 2. 翻译功能
    const translationSection = this._createTranslationSection();
    actionButtons.appendChild(translationSection);

    // 3. 分类功能
    const classificationSection = this._createClassificationSection();
    actionButtons.appendChild(classificationSection);

    // 4. 存储路径设置
    const storageSection = this._createStorageSection();
    actionButtons.appendChild(storageSection);

    // 5. 开始整理按钮
    const startOrganizeButton = document.createElement('button');
    startOrganizeButton.className = 'rs-start-organize-btn';
    startOrganizeButton.textContent = '开始整理';
    startOrganizeButton.addEventListener('click', () => {
      if (onStartOrganize) {
        onStartOrganize(this.selectedOptions);
      }
    });
    actionButtons.appendChild(startOrganizeButton);

    return actionButtons;
  }

  /**
   * Create a paper item element
   * @param {Object} paper - Paper object
   * @param {Function} onRemovePaper - Callback for paper removal
   * @returns {HTMLElement}
   */
  createPaperItem(paper, onRemovePaper) {
    if (!paper || !paper.id) {
      logger.error('[POPUP] createPaperItem: 无效的论文对象', paper);
      throw new Error('无效的论文对象');
    }

    logger.log('[POPUP] createPaperItem: 创建论文项', paper.id, paper.title);

    const paperItem = document.createElement('div');
    paperItem.className = 'rs-popup-paper-item';
    paperItem.dataset.paperId = paper.id;

    // Create paper info
    const paperInfo = document.createElement('div');
    paperInfo.className = 'rs-popup-paper-info';

    const paperTitle = document.createElement('div');
    paperTitle.className = 'rs-popup-paper-title';
    paperTitle.textContent = paper.title || 'Untitled Paper';
    paperInfo.appendChild(paperTitle);

    const paperAuthors = document.createElement('div');
    paperAuthors.className = 'rs-popup-paper-authors';
    paperAuthors.textContent = paper.authors || 'Unknown Authors';
    paperInfo.appendChild(paperAuthors);

    const paperYear = document.createElement('div');
    paperYear.className = 'rs-popup-paper-year';
    paperYear.textContent = paper.year || '';
    paperInfo.appendChild(paperYear);

    paperItem.appendChild(paperInfo);

    // Create remove button (SVG icon)
    const removeButton = document.createElement('div');
    removeButton.className = 'rs-popup-paper-remove';

    // 添加明显的删除按钮样式
    removeButton.style.cursor = 'pointer';
    removeButton.style.minWidth = '30px';
    removeButton.style.minHeight = '30px';
    removeButton.style.display = 'flex';
    removeButton.style.alignItems = 'center';
    removeButton.style.justifyContent = 'center';
    removeButton.style.borderRadius = '50%';
    removeButton.style.backgroundColor = 'rgba(255, 0, 0, 0.1)';
    removeButton.style.margin = '0 0 0 10px';
    removeButton.title = '删除此论文';

    try {
      // 使用图片标签加载SVG
      const iconUrl = chrome.runtime.getURL(DELETE_ICON_PATH);
      logger.log('[POPUP] createPaperItem: 删除图标URL:', iconUrl);

      const img = document.createElement('img');
      img.src = iconUrl;
      img.alt = 'Delete';
      img.className = 'rs-delete-icon';
      img.style.width = '20px';
      img.style.height = '20px';
      removeButton.appendChild(img);
    } catch (error) {
      logger.error('[POPUP] createPaperItem: 无法加载删除图标:', error);
      // 如果图标加载失败，使用文字替代
      removeButton.textContent = '×';
      removeButton.style.fontSize = '20px';
      removeButton.style.fontWeight = 'bold';
      removeButton.style.color = 'red';
    }

    // 确保回调函数存在
    if (typeof onRemovePaper !== 'function') {
      logger.error('[POPUP] createPaperItem: onRemovePaper 不是一个函数', onRemovePaper);
      // 即使没有回调，也添加删除按钮的视觉样式，但不添加功能
      paperItem.appendChild(removeButton);
      return paperItem;
    }

    // 通过debugger和更详细的logger.log来调试
    logger.log('[POPUP] createPaperItem: 为论文添加删除按钮事件监听器:', paper.id);

    // 直接使用点击事件，而不是异步包装
    removeButton.addEventListener('click', function(event) {
      // 阻止事件冒泡
      event.stopPropagation();

      logger.log('[POPUP] 删除按钮被点击:', paper.id);
      logger.log('[POPUP] 删除回调函数:', onRemovePaper);

      // 视觉反馈
      this.style.backgroundColor = 'rgba(255, 0, 0, 0.3)';

      try {
        // 显示加载状态
        const loadingText = document.createElement('span');
        loadingText.textContent = '...';
        loadingText.style.fontSize = '16px';
        this.innerHTML = '';
        this.appendChild(loadingText);

        // 先调用回调函数
        onRemovePaper(paper.id)
          .then(() => {
            logger.log('[POPUP] 论文删除成功，移除UI元素:', paper.id);
            // 删除成功后移除DOM元素
            if (paperItem.parentNode) {
              paperItem.parentNode.removeChild(paperItem);
            }
          })
          .catch(error => {
            logger.error(`[POPUP] 删除论文失败 ${paper.id}:`, error);
            // 恢复按钮状态
            this.style.backgroundColor = 'rgba(255, 0, 0, 0.1)';
            this.innerHTML = '';
            this.textContent = '×';
            this.style.fontSize = '20px';
            this.style.fontWeight = 'bold';

            // 添加错误提示UI
            const errorMessage = document.createElement('div');
            errorMessage.className = 'rs-error-message';
            errorMessage.textContent = '删除论文失败，请重试。';
            errorMessage.style.color = 'red';
            errorMessage.style.fontSize = '12px';
            errorMessage.style.marginTop = '4px';

            // 将错误消息插入到paperItem中
            paperItem.appendChild(errorMessage);

            // 3秒后移除错误消息
            setTimeout(() => {
              if (errorMessage.parentNode) {
                errorMessage.parentNode.removeChild(errorMessage);
              }
            }, 3000);
          });
      } catch (error) {
        logger.error(`[POPUP] 调用删除回调时出错 ${paper.id}:`, error);
        // 恢复按钮状态
        this.style.backgroundColor = 'rgba(255, 0, 0, 0.1)';
        this.textContent = '×';
      }
    });

    paperItem.appendChild(removeButton);

    return paperItem;

  }


  /**
   * 更新弹窗中的论文列表
   * @param {Array<Object>} papers - 论文对象数组
   * @param {Function} onSummarize - 点击“总结”回调（预留，当前未使用）
   * @param {Function} onDownload - 点击“下载”回调（预留，当前未使用）
   * @param {Function} onSelect - 勾选选择回调（预留，当前未使用）
   * @param {Function} onRemovePaper - 删除论文回调
   */
  updatePaperList(papers, onSummarize, onDownload, onSelect, onRemovePaper) {
    try {
      logger.log('[POPUP] updatePaperList 调用', {
        count: Array.isArray(papers) ? papers.length : 'invalid',
      });

      if (!this.paperList) {
        logger.error('[POPUP] updatePaperList: paperList 容器尚未初始化');
        return;
      }

      // 清空现有列表
      this.paperList.innerHTML = '';

      // 空态处理
      if (!Array.isArray(papers) || papers.length === 0) {
        const emptyState = document.createElement('div');
        emptyState.className = 'rs-empty-state';
        emptyState.textContent = '暂无论文，请先添加';
        this.paperList.appendChild(emptyState);
        return;
      }

      // 渲染每一项论文
      papers.forEach((paper) => {
        try {
          const item = this.createPaperItem(paper, onRemovePaper);
          this.paperList.appendChild(item);
        } catch (err) {
          logger.error('[POPUP] 渲染论文项失败:', err, paper);
        }
      });

      // 论文列表更新后，检查是否需要自动生成任务目录名
      this._onPaperListUpdated();
    } catch (error) {
      logger.error('[POPUP] updatePaperList 执行失败:', error);
    }
  }

  /**
   * Show the popup window
   */
  show() {
    if (this.element) {
      this.element.style.display = 'flex';
      this.isVisible = true;
    }
  }

  /**
   * Hide the popup window
   */
  hide() {
    if (this.element) {
      this.element.style.display = 'none';
      this.isVisible = false;
    }
  }

  /**
   * Remove the popup window
   */
  remove() {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }

  /**
   * Get the selected options
   * @returns {Object} The selected options
   */
  getSelectedOptions() {
    return this.selectedOptions;
  }

  // --- 辅助方法：创建UI组件 ---

  /**
   * 创建开关选项
   * @param {string} id 选项ID
   * @param {string} label 标签文本
   * @param {boolean} checked 是否选中
   * @returns {HTMLElement}
   */
  _createToggleOption(id, label, checked = false) {
    const toggleOption = document.createElement('div');
    toggleOption.className = 'rs-toggle-option';

    const labelElement = document.createElement('label');
    labelElement.textContent = label;
    toggleOption.appendChild(labelElement);

    const toggleSwitch = document.createElement('label');
    toggleSwitch.className = 'rs-toggle-switch';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `rs-${id}`;
    checkbox.checked = checked;
    checkbox.addEventListener('change', (e) => {
      if (id === 'downloadPdf') {
        this.selectedOptions.downloadPdf = e.target.checked;
      }
    });

    const slider = document.createElement('span');
    slider.className = 'rs-toggle-slider';

    toggleSwitch.appendChild(checkbox);
    toggleSwitch.appendChild(slider);
    toggleOption.appendChild(toggleSwitch);

    return toggleOption;
  }

  /**
   * 创建翻译功能区域
   * @returns {HTMLElement}
   */
  _createTranslationSection() {
    const section = document.createElement('div');
    section.className = 'rs-config-section';

    // 翻译开关
    const toggleOption = document.createElement('div');
    toggleOption.className = 'rs-toggle-option';

    const label = document.createElement('label');
    label.textContent = '翻译功能';
    toggleOption.appendChild(label);

    const toggleSwitch = document.createElement('label');
    toggleSwitch.className = 'rs-toggle-switch';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = 'rs-translation-enabled';
    checkbox.checked = this.selectedOptions.translation.enabled;
    checkbox.addEventListener('change', (e) => {
      this.selectedOptions.translation.enabled = e.target.checked;
      languageSelect.style.display = e.target.checked ? 'block' : 'none';
    });

    const slider = document.createElement('span');
    slider.className = 'rs-toggle-slider';

    toggleSwitch.appendChild(checkbox);
    toggleSwitch.appendChild(slider);
    toggleOption.appendChild(toggleSwitch);
    section.appendChild(toggleOption);

    // 语言选择下拉框
    const languageSelect = document.createElement('select');
    languageSelect.className = 'rs-language-select';
    languageSelect.style.display = this.selectedOptions.translation.enabled ? 'block' : 'none';
    languageSelect.style.marginTop = '8px';
    languageSelect.style.width = '100%';

    logger.log('[POPUP] 创建翻译语言下拉框，语言数量:', this.translationLanguages.length);

    if (this.translationLanguages && this.translationLanguages.length > 0) {
      this.translationLanguages.forEach(lang => {
        const option = document.createElement('option');
        option.value = lang.code;
        option.textContent = lang.name;
        option.selected = lang.code === this.selectedOptions.translation.targetLanguage;
        languageSelect.appendChild(option);
      });
    } else {
      // 添加默认选项
      const defaultOption = document.createElement('option');
      defaultOption.value = '';
      defaultOption.textContent = '暂无可用语言';
      languageSelect.appendChild(defaultOption);
    }

    languageSelect.addEventListener('change', (e) => {
      this.selectedOptions.translation.targetLanguage = e.target.value;
    });

    section.appendChild(languageSelect);
    return section;
  }

  /**
   * 创建分类功能区域
   * @returns {HTMLElement}
   */
  _createClassificationSection() {
    const section = document.createElement('div');
    section.className = 'rs-config-section';

    // 分类开关
    const toggleOption = document.createElement('div');
    toggleOption.className = 'rs-toggle-option';

    const label = document.createElement('label');
    label.textContent = '分类功能';
    toggleOption.appendChild(label);

    const toggleSwitch = document.createElement('label');
    toggleSwitch.className = 'rs-toggle-switch';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = 'rs-classification-enabled';
    checkbox.checked = this.selectedOptions.classification.enabled;
    checkbox.addEventListener('change', (e) => {
      this.selectedOptions.classification.enabled = e.target.checked;
      standardSelect.style.display = e.target.checked ? 'block' : 'none';
      editButton.style.display = e.target.checked ? 'block' : 'none';
    });

    const slider = document.createElement('span');
    slider.className = 'rs-toggle-slider';

    toggleSwitch.appendChild(checkbox);
    toggleSwitch.appendChild(slider);
    toggleOption.appendChild(toggleSwitch);
    section.appendChild(toggleOption);

    // 分类标准选择下拉框
    const standardSelect = document.createElement('select');
    standardSelect.className = 'rs-standard-select';
    standardSelect.style.display = this.selectedOptions.classification.enabled ? 'block' : 'none';
    standardSelect.style.marginTop = '8px';
    standardSelect.style.width = '100%';

    logger.log('[POPUP] 创建分类标准下拉框，标准数量:', this.classificationStandards.length);

    if (this.classificationStandards && this.classificationStandards.length > 0) {
      this.classificationStandards.forEach(standard => {
        const option = document.createElement('option');
        option.value = standard.id;
        option.textContent = standard.title;
        option.selected = standard.id === this.selectedOptions.classification.selectedStandard;
        standardSelect.appendChild(option);
      });
    } else {
      // 添加默认选项
      const defaultOption = document.createElement('option');
      defaultOption.value = '';
      defaultOption.textContent = '暂无可用分类标准';
      standardSelect.appendChild(defaultOption);
    }

    standardSelect.addEventListener('change', (e) => {
      this.selectedOptions.classification.selectedStandard = e.target.value;
    });

    section.appendChild(standardSelect);

    // 编辑prompt按钮
    const editButton = document.createElement('button');
    editButton.className = 'rs-edit-prompt-btn';
    editButton.textContent = '编辑Prompt';
    editButton.style.display = this.selectedOptions.classification.enabled ? 'block' : 'none';
    editButton.style.marginTop = '8px';
    editButton.style.width = '100%';
    editButton.style.padding = '6px';
    editButton.style.fontSize = '12px';
    editButton.style.backgroundColor = '#f0f0f0';
    editButton.style.border = '1px solid #ccc';
    editButton.style.borderRadius = '4px';
    editButton.style.cursor = 'pointer';

    editButton.addEventListener('click', async () => {
      try {
        await sendMessageToBackend(MessageActions.OPEN_SETTINGS_SECTION, { section: 'classification' });
      } catch (error) {
        logger.error('[POPUP] 打开设置页面失败:', error);
      }
    });

    section.appendChild(editButton);
    return section;
  }

  /**
   * 创建存储路径设置区域
   * @returns {HTMLElement}
   */
  _createStorageSection() {
    const section = document.createElement('div');
    section.className = 'rs-storage-section';

    // 标题
    const title = document.createElement('div');
    title.className = 'rs-storage-title';
    title.textContent = '📁 结果存储路径';
    section.appendChild(title);

    // 工作目录显示（固定为LitHelperData）
    const workingDirContainer = document.createElement('div');
    workingDirContainer.className = 'rs-storage-container';

    const workingDirLabel = document.createElement('div');
    workingDirLabel.className = 'rs-storage-label';
    workingDirLabel.textContent = '工作目录:';
    workingDirContainer.appendChild(workingDirLabel);

    const workingDirRow = document.createElement('div');
    workingDirRow.className = 'rs-storage-row';

    const workingDirInput = document.createElement('input');
    workingDirInput.type = 'text';
    workingDirInput.className = 'rs-working-dir-input rs-readonly';
    workingDirInput.value = this.selectedOptions.storage.workingDirectory;
    workingDirInput.readOnly = true; // 只读显示
    workingDirInput.title = '工作目录已固定为 LitHelperData';

    const folderButton = document.createElement('button');
    folderButton.className = 'rs-folder-btn';
    folderButton.textContent = '📁';
    folderButton.title = '打开工作目录';

    folderButton.addEventListener('click', () => {
      this._openWorkingDirectory();
    });

    workingDirRow.appendChild(workingDirInput);
    workingDirRow.appendChild(folderButton);
    workingDirContainer.appendChild(workingDirRow);
    section.appendChild(workingDirContainer);

    // 任务目录设置
    const taskDirContainer = document.createElement('div');
    taskDirContainer.className = 'rs-storage-container';

    const taskDirLabel = document.createElement('div');
    taskDirLabel.className = 'rs-storage-label';
    taskDirLabel.textContent = '任务目录:';
    taskDirContainer.appendChild(taskDirLabel);

    const taskDirRow = document.createElement('div');
    taskDirRow.className = 'rs-storage-row';

    const taskDirInput = document.createElement('input');
    taskDirInput.type = 'text';
    taskDirInput.className = 'rs-task-dir-input';
    taskDirInput.placeholder = '任务目录名...';
    taskDirInput.value = this.selectedOptions.storage.taskDirectory;

    const autoGenButton = document.createElement('button');
    autoGenButton.className = 'rs-auto-gen-btn';
    autoGenButton.textContent = '🔄 自动';

    autoGenButton.addEventListener('click', () => {
      this._generateTaskDirectoryName();
    });

    taskDirInput.addEventListener('input', (e) => {
      this.selectedOptions.storage.taskDirectory = e.target.value;
      this._updateFullPath();
    });

    taskDirRow.appendChild(taskDirInput);
    taskDirRow.appendChild(autoGenButton);
    taskDirContainer.appendChild(taskDirRow);
    section.appendChild(taskDirContainer);

    // 完整路径预览
    const previewContainer = document.createElement('div');
    previewContainer.className = 'rs-path-preview-container';

    const previewLabel = document.createElement('div');
    previewLabel.className = 'rs-storage-label';
    previewLabel.textContent = '完整路径预览:';
    previewContainer.appendChild(previewLabel);

    const previewPath = document.createElement('div');
    previewPath.className = 'rs-path-preview';
    previewPath.textContent = this.selectedOptions.storage.fullPath || '请先选择工作目录';

    previewContainer.appendChild(previewPath);
    section.appendChild(previewContainer);

    // 保存引用以便后续更新
    this.workingDirInput = workingDirInput;
    this.taskDirInput = taskDirInput;
    this.pathPreview = previewPath;

    return section;
  }



  /**
   * 生成任务目录名（基于第一篇论文标题的前10个字符）
   */
  _generateTaskDirectoryName() {
    try {
      // 获取当前论文列表中的第一篇论文
      const paperItems = this.paperList?.querySelectorAll('.rs-paper-item');
      if (paperItems && paperItems.length > 0) {
        const firstPaperTitle = paperItems[0].querySelector('.rs-paper-title')?.textContent;
        if (firstPaperTitle) {
          // 取前10个字符，并清理不适合作为文件夹名的字符
          let dirName = firstPaperTitle.substring(0, 10)
            .replace(/[<>:"/\\|?*]/g, '_') // 替换不合法的文件名字符
            .replace(/\s+/g, '_') // 替换空格为下划线
            .replace(/_{2,}/g, '_') // 合并多个下划线
            .replace(/^_|_$/g, ''); // 移除开头和结尾的下划线

          if (dirName) {
            this.selectedOptions.storage.taskDirectory = dirName;
            this.taskDirInput.value = dirName;
            this._updateFullPath();
            logger.log('[POPUP] 自动生成任务目录名:', dirName);
            return;
          }
        }
      }

      // 如果没有论文或无法获取标题，使用默认名称
      const defaultName = `task_${new Date().toISOString().slice(0, 10)}`;
      this.selectedOptions.storage.taskDirectory = defaultName;
      this.taskDirInput.value = defaultName;
      this._updateFullPath();
      logger.log('[POPUP] 使用默认任务目录名:', defaultName);
    } catch (error) {
      logger.error('[POPUP] 生成任务目录名失败:', error);
    }
  }

  /**
   * 更新完整路径预览
   */
  _updateFullPath() {
    const taskDir = this.selectedOptions.storage.taskDirectory;

    if (taskDir) {
      try {
        // 使用文件管理服务构建完整路径
        const fullPath = fileManagementService.buildFullPath(taskDir);
        this.selectedOptions.storage.fullPath = fullPath;
        this.pathPreview.textContent = fullPath;
      } catch (error) {
        logger.error('[POPUP] 构建路径失败:', error);
        this.pathPreview.textContent = `${this.selectedOptions.storage.workingDirectory}/[任务目录名无效]`;
      }
    } else {
      this.pathPreview.textContent = `${this.selectedOptions.storage.workingDirectory}/[请输入任务目录名]`;
    }
  }

  /**
   * 打开工作目录
   * 使用 chrome.downloads.search() + show() 方案直接定位到目录
   * 注意：不弹出任何提示窗，静默处理
   */
  _openWorkingDirectory() {
    try {
      const workingDirectory = this.selectedOptions.storage.workingDirectory;
      const taskDirectory = this.selectedOptions.storage.taskDirectory;

      logger.log('[POPUP] 请求打开工作目录:', { workingDirectory, taskDirectory });

      // 发送消息到后台脚本，请求打开工作目录（静默处理结果）
      sendMessageToBackend(MessageActions.OPEN_WORKING_DIRECTORY, {
        workingDirectory,
        taskDirectory // 传递任务目录，优先显示具体任务目录（后台会优先尝试工作目录）
      }).then(response => {
        if (response && response.success) {
          logger.log('[POPUP] 文件管理器已打开');
        } else {
          logger.warn('[POPUP] 打开工作目录失败:', response?.error || response);
        }
      }).catch(error => {
        logger.error('[POPUP] 打开工作目录时发生错误:', error);
      });
    } catch (error) {
      logger.error('[POPUP] 打开工作目录失败:', error);
    }
  }


  /**
   * 当论文列表更新时，如果任务目录为空，自动生成目录名
   */
  _onPaperListUpdated() {
    if (!this.selectedOptions.storage.taskDirectory) {
      this._generateTaskDirectoryName();
    }
  }
}

export default PopupWindow;