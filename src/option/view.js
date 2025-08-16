/**
 * view.js
 * 
 * 负责设置页面的所有UI渲染和DOM操作。
 * 它不包含任何业务逻辑，只负责展示数据和捕获用户交互，
 * 然后通过回调函数通知Controller。
 */
export class View {
  constructor() {
    // --- General ---
    this.saveStatus = document.getElementById('status-message');
    this.resetButton = document.getElementById('reset-defaults');
    this.saveButton = document.getElementById('save-settings');

    // --- AI Model Settings ---
    this.modelSettingsContainer = document.getElementById('model-cards-container');
    this.addModelButton = document.getElementById('add-custom-model');

    // --- Custom Model Dialog ---
    this.customModelDialog = document.getElementById('custom-model-modal');
    this.confirmAddModelBtn = document.getElementById('modal-add');
    this.cancelAddModelBtn = document.getElementById('modal-cancel');
    this.closeModalBtn = document.getElementById('modal-close');

    // --- Default Model Selector ---
    this.defaultModelSelect = document.getElementById('default-ai-model');
    
    // --- Summarization settings ---
    // Note: summarize-prompt does not exist in the HTML, so related properties are removed.

    // --- Classification Management ---
    this.classificationContainer = document.getElementById('classification-standards-container');
    this.addClassificationButton = document.getElementById('add-classification-standard');

    console.log('[VIEW] Classification elements:', {
      container: this.classificationContainer,
      button: this.addClassificationButton
    });
  }

  // --- Modal Helpers ---
  _showModal() {
    if (this.customModelDialog) {
      this.customModelDialog.style.display = 'flex';
      // 强制重新计算样式后再添加active类，以确保过渡效果正常
      this.customModelDialog.offsetHeight;
      this.customModelDialog.classList.add('active');
      // 重置表单
      this._resetModalForm();
      // 设置动态交互
      this._setupModalInteractions();
    }
  }

  _hideModal() {
    if (this.customModelDialog) {
      this.customModelDialog.classList.remove('active');
      // 等待过渡动画完成后再隐藏
      setTimeout(() => {
        this.customModelDialog.style.display = 'none';
      }, 300);
    }
  }

  _resetModalForm() {
    // 重置所有表单字段为默认值
    const form = this.customModelDialog;
    if (form) {
      form.querySelector('#model-name').value = '';
      form.querySelector('#model-api-key').value = '';
      form.querySelector('#model-api-url').value = '';
      form.querySelector('#model-available-models').value = '';
      form.querySelector('#model-default-model').innerHTML = '<option value="">-- 请先输入可用模型 --</option>';
      form.querySelector('#model-max-tokens').value = '2000';
      form.querySelector('#model-temperature').value = '0.7';
      form.querySelector('#temperature-value').textContent = '0.7';
      form.querySelector('#model-active').checked = true;
    }
  }

  _setupModalInteractions() {
    const form = this.customModelDialog;
    if (!form) return;

    const modelsTextarea = form.querySelector('#model-available-models');
    const defaultModelSelect = form.querySelector('#model-default-model');
    const temperatureSlider = form.querySelector('#model-temperature');
    const temperatureValue = form.querySelector('#temperature-value');

    // 移除之前的事件监听器以避免重复绑定
    modelsTextarea.removeEventListener('input', this._updateDefaultModelOptions);
    temperatureSlider.removeEventListener('input', this._updateTemperatureValue);

    // 当可用模型文本框内容改变时，更新默认模型选择器
    this._updateDefaultModelOptions = () => {
      const models = modelsTextarea.value.split(/[,\n\r\n]+/).map(m => m.trim()).filter(m => m);
      defaultModelSelect.innerHTML = models.length === 0 
        ? '<option value="">-- 请先输入可用模型 --</option>'
        : models.map(model => `<option value="${model}">${model}</option>`).join('');
    };

    // 当温度滑块改变时，更新显示值
    this._updateTemperatureValue = () => {
      temperatureValue.textContent = temperatureSlider.value;
    };

    modelsTextarea.addEventListener('input', this._updateDefaultModelOptions);
    temperatureSlider.addEventListener('input', this._updateTemperatureValue);
  }

  // --- General Event Binding ---

  bindSaveSettings(handler) {
    if (this.saveButton) {
      this.saveButton.addEventListener('click', () => {
        handler();
      });
    }
  }

  bindResetSettings(handler) {
    if (this.resetButton) {
      this.resetButton.addEventListener('click', () => {
        if (confirm('Are you sure you want to reset all settings to their defaults?')) {
          handler();
        }
      });
    }
  }
  
  bindDefaultModelChange(handler) {
    if (this.defaultModelSelect) {
        this.defaultModelSelect.addEventListener('change', (event) => {
        handler(event.target.value);
      });
    }
  }

  // --- AI Model Event Binding ---

  bindAddModel(handler) {
    if (this.addModelButton) {
      this.addModelButton.addEventListener('click', () => this._showModal());
    }
    if (this.closeModalBtn) {
      this.closeModalBtn.addEventListener('click', () => this._hideModal());
    }
    if (this.cancelAddModelBtn) {
      this.cancelAddModelBtn.addEventListener('click', () => this._hideModal());
    }
    if (this.confirmAddModelBtn) {
      this.confirmAddModelBtn.addEventListener('click', () => {
        const modelData = {
          name: document.getElementById('model-name').value,
          provider: document.getElementById('model-name').value,
          apiKey: document.getElementById('model-api-key').value,
          url: document.getElementById('model-api-url').value,
          selectedModel: document.getElementById('model-default-model').value,
          supportedModels: document.getElementById('model-available-models').value.split(/[,\\n\r\n]+/).map(m => m.trim()),
          maxTokens: parseInt(document.getElementById('model-max-tokens').value, 10),
          temperature: parseFloat(document.getElementById('model-temperature').value),
          active: document.getElementById('model-active').checked,
          isCustom: true
        };

        if (!modelData.name || !modelData.apiKey || !modelData.url) {
          this.showAlert('Please fill in all required fields for the custom model.');
          return;
        }

        handler(modelData);
        this._hideModal();
      });
    }
  }

  bindModelSettingsChange(handler) {
    if (this.modelSettingsContainer) {
      this.modelSettingsContainer.addEventListener('change', (event) => {
        const target = event.target;
        if (target.dataset.index !== undefined) {
          const index = parseInt(target.dataset.index, 10);
          const key = target.name;
          const value = target.type === 'checkbox' ? target.checked : target.value;
          
          handler(index, { [key]: value });
        }
      });
    }
  }

  bindModelAction(handler) {
    if (this.modelSettingsContainer) {
      this.modelSettingsContainer.addEventListener('click', (event) => {
        const button = event.target.closest('button');
        if (!button || button.dataset.index === undefined) return;

        const action = button.dataset.action;
        const index = parseInt(button.dataset.index, 10);

        if (action) {
          handler(action, index);
        }
      });
    }
  }

  // --- Classification Management Event Binding ---

  bindAddClassificationStandard(handler) {
    console.log('[VIEW] bindAddClassificationStandard called, button:', this.addClassificationButton);
    if (this.addClassificationButton) {
      this.addClassificationButton.addEventListener('click', () => {
        console.log('[VIEW] Add classification standard button clicked');
        handler();
      });
      console.log('[VIEW] Event listener added to add classification button');
    } else {
      console.error('[VIEW] Add classification button not found!');
    }
  }

  bindClassificationAction(handler) {
    if (this.classificationContainer) {
      this.classificationContainer.addEventListener('click', (event) => {
        const button = event.target.closest('button');
        if (!button || !button.dataset.action) return;

        const action = button.dataset.action;
        const standardId = button.dataset.standardId;

        if (action && standardId) {
          handler(action, standardId);
        }
      });
    }
  }

  bindClassificationChange(handler) {
    if (this.classificationContainer) {
      this.classificationContainer.addEventListener('input', (event) => {
        const target = event.target;
        if (target.tagName === 'TEXTAREA' && target.dataset.standardId) {
          const standardId = target.dataset.standardId;
          const field = target.dataset.field;
          const value = target.value;

          if (field && standardId) {
            handler(standardId, field, value);
          }
        } else if (target.tagName === 'INPUT' && target.dataset.standardId) {
          const standardId = target.dataset.standardId;
          const field = target.dataset.field;
          const value = target.value;

          if (field && standardId) {
            handler(standardId, field, value);
          }
        }
      });
    }
  }
  

  // --- Rendering Logic ---

  render(config) {
    this.renderModelSettings(config.aiModels);
    this.renderDefaultModelSelector(config.aiModels, config.selectedAiModel);
    this.renderClassificationStandards(config.classificationStandards);
    // Removed renderPromptSettings call as the element doesn't exist
  }

  renderModelSettings(models) {
    if (!this.modelSettingsContainer) return;
    this.modelSettingsContainer.innerHTML = '';
    if (!models) return;

    models.forEach((model, index) => {
      const modelElement = this.createModelElement(model, index);
      this.modelSettingsContainer.appendChild(modelElement);
    });
  }

  renderDefaultModelSelector(models, selectedModel) {
    if (!this.defaultModelSelect) return;
    this.defaultModelSelect.innerHTML = '';
    if (!models) return;
    
    models.forEach(model => {
      if (model.active) {
        const option = document.createElement('option');
        option.value = model.name;
        option.textContent = model.name;
        if (model.name === selectedModel) {
          option.selected = true;
        }
        this.defaultModelSelect.appendChild(option);
      }
    });
  }

  createModelElement(model, index) {
    const isCustom = model.isCustom || false;
    const element = document.createElement('div');
    element.className = 'model-card';
    element.innerHTML = `
      <div class="model-header">
        <h3>${model.name} ${isCustom ? '<span class="custom-badge">Custom</span>' : ''}</h3>
        <label class="switch">
          <input type="checkbox" name="active" data-index="${index}" ${model.active ? 'checked' : ''}>
          <span class="slider round"></span>
        </label>
      </div>
      <div class="model-body">
        <div class="form-group">
          <label for="apiKey-${index}">API Key:</label>
          <input type="password" id="apiKey-${index}" name="apiKey" data-index="${index}" value="${model.apiKey || ''}" placeholder="Enter your API key">
        </div>
        <div class="form-group">
          <label for="url-${index}">API URL:</label>
          <input type="text" id="url-${index}" name="url" data-index="${index}" value="${model.url || ''}" ${!isCustom ? 'readonly' : ''}>
        </div>
        <div class="form-group">
          <label for="model-select-${index}">Selected Model:</label>
          <input type="text" id="model-select-${index}" name="selectedModel" data-index="${index}" value="${model.selectedModel || ''}" placeholder="e.g., gpt-4-turbo">
        </div>
        <div class="test-connection-field">
          <button class="test-btn" data-index="${index}" data-action="test">测试连接</button>
          <div id="test-status-${index}" class="test-status" style="display: none;"></div>
        </div>
      </div>
      <div class="model-footer">
        ${isCustom ? `<button class="delete-btn" data-index="${index}" data-action="delete">Delete</button>` : ''}
      </div>
    `;
    return element;
  }

  // --- UI Feedback ---

  /**
   * 显示模型测试状态
   * @param {number} index - 模型索引
   * @param {string} status - 状态类型: 'testing', 'success', 'error'
   * @param {string} message - 状态消息
   * @param {string} [data] - 额外数据（可选）
   */
  showTestStatus(index, status, message, data = null) {
    const statusElement = document.getElementById(`test-status-${index}`);
    const testButton = document.querySelector(`button[data-index="${index}"][data-action="test"]`);
    
    if (!statusElement) return;
    
    // 清除之前的状态
    statusElement.className = 'test-status';
    statusElement.innerHTML = '';
    
    switch (status) {
      case 'testing':
        statusElement.className += ' testing';
        statusElement.innerHTML = `
          <div class="loader">
            <div class="loader-dot"></div>
            <div class="loader-dot"></div>
            <div class="loader-dot"></div>
          </div>
          <span>${message}</span>
        `;
        if (testButton) testButton.disabled = true;
        break;
        
      case 'success':
        statusElement.className += ' success';
        statusElement.innerHTML = `
          <span>✓ ${message}</span>
        `;
        if (testButton) testButton.disabled = false;
        break;
        
      case 'error':
        statusElement.className += ' error';
        statusElement.innerHTML = `<span>✗ ${message}</span>`;
        if (testButton) testButton.disabled = false;
        break;
    }
    
    statusElement.style.display = 'block';
    
    // 3秒后自动隐藏成功或错误状态（但不隐藏测试中状态）
    if (status !== 'testing') {
      setTimeout(() => {
        statusElement.style.display = 'none';
      }, 5000);
    }
  }

  showSaveStatus(message, isSuccess = true) {
    if (!this.saveStatus) return;
    this.saveStatus.textContent = message;
    this.saveStatus.className = isSuccess ? 'status success' : 'status error';
    this.saveStatus.style.display = 'block';
    setTimeout(() => {
      this.saveStatus.style.display = 'none';
    }, 3000);
  }

  showAlert(message) {
    alert(message);
  }

  // --- Classification Standards Rendering ---

  renderClassificationStandards(standards) {
    if (!this.classificationContainer) return;
    this.classificationContainer.innerHTML = '';
    if (!standards) return;

    standards.forEach((standard) => {
      const standardElement = this.createClassificationStandardElement(standard);
      this.classificationContainer.appendChild(standardElement);
    });
  }

  createClassificationStandardElement(standard) {
    const element = document.createElement('div');
    element.className = 'classification-standard-card';
    element.innerHTML = `
      <div class="classification-standard-header">
        <div>
          <span class="classification-standard-title">${standard.title}</span>
          ${standard.isCustom ? '<span class="classification-standard-badge">自定义</span>' : '<span class="classification-standard-badge">系统</span>'}
        </div>
        <div class="classification-standard-actions">
          ${standard.isCustom ? `<button data-action="delete" data-standard-id="${standard.id}" class="btn-danger">删除</button>` : ''}
        </div>
      </div>
      <div class="classification-prompt">
        <label>分类提示词:</label>
        <textarea
          data-standard-id="${standard.id}"
          data-field="prompt"
          ${!standard.isCustom ? 'readonly' : ''}
          placeholder="请输入分类提示词..."
        >${standard.prompt || ''}</textarea>
      </div>
    `;
    return element;
  }

  // 添加新分类标准的对话框
  showAddClassificationStandardDialog() {
    console.log('[VIEW] showAddClassificationStandardDialog called');
    const title = prompt('请输入分类标准标题:');
    console.log('[VIEW] Title entered:', title);
    if (!title) return null;

    const promptText = prompt('请输入分类提示词:');
    console.log('[VIEW] Prompt entered:', promptText);
    if (!promptText) return null;

    return { title, prompt: promptText };
  }
}