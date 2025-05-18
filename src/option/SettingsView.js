/**
 * SettingsView.js (原 view.js)
 * 
 * 视图(View)层：负责模型设置的UI渲染和组件创建
 */

class ModelView {
  /**
   * 创建模型卡片
   * @param {Object} model - 模型配置
   * @param {number} index - 模型索引
   * @param {Object} handlers - 事件处理函数集合
   * @returns {HTMLElement} - 模型卡片元素
   */
  createModelCard(model, index, handlers) {
    const card = document.createElement('div');
    card.className = `model-card ${model.active ? 'active' : ''}`;
    card.setAttribute('data-index', index);
    
    // 卡片内容容器
    const cardContent = document.createElement('div');
    cardContent.className = 'card-simple-content';
    
    // 左侧：模型名称（最多显示8个字符）
    const modelName = document.createElement('div');
    modelName.className = 'model-name';
    
    // 截断名称，最多显示8个字符
    const displayName = model.name.length > 8 ? model.name.substring(0, 8) + '...' : model.name;
    modelName.textContent = displayName;
    modelName.title = model.name; // 完整名称显示在悬停提示中
    
    // 右侧上方：启用按钮
    const toggleContainer = document.createElement('div');
    toggleContainer.className = 'toggle-container';
    
    const toggleLabel = document.createElement('label');
    toggleLabel.className = 'switch small';
    
    const toggleInput = document.createElement('input');
    toggleInput.type = 'checkbox';
    toggleInput.checked = model.active;
    toggleInput.setAttribute('data-index', index);
    toggleInput.addEventListener('change', (e) => {
      handlers.onToggleChange(index, e.target.checked);
      card.classList.toggle('active', e.target.checked);
    });
    
    const toggleSlider = document.createElement('span');
    toggleSlider.className = 'slider';
    
    toggleLabel.appendChild(toggleInput);
    toggleLabel.appendChild(toggleSlider);
    toggleContainer.appendChild(toggleLabel);
    
    // 右侧下方：修改设置按钮
    const settingsBtn = document.createElement('button');
    settingsBtn.className = 'settings-btn';
    settingsBtn.textContent = '修改设置';
    settingsBtn.addEventListener('click', () => {
      this.openModelSettings(model, index, handlers);
    });
    
    // 删除按钮（仅对自定义模型显示）
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = '删除';
    deleteBtn.style.display = model.isCustom ? 'block' : 'none';
    deleteBtn.addEventListener('click', () => {
      handlers.onDeleteClick(model, index);
    });
    
    // 布局卡片
    cardContent.appendChild(modelName);
    cardContent.appendChild(toggleContainer);
    cardContent.appendChild(settingsBtn);
    if (model.isCustom) {
      cardContent.appendChild(deleteBtn);
    }
    
    card.appendChild(cardContent);
    
    return card;
  }
  
  /**
   * 打开模型设置对话框
   * @param {Object} model - 模型配置
   * @param {number} index - 模型索引
   * @param {Object} handlers - 事件处理函数集合
   */
  openModelSettings(model, index, handlers) {
    // 移除之前可能存在的对话框
    const existingModal = document.getElementById(`model-settings-${index}`);
    if (existingModal) {
      existingModal.remove();
    }
    
    // 创建对话框
    const modal = document.createElement('div');
    modal.id = `model-settings-${index}`;
    modal.className = 'model-settings-modal';
    
    // 创建统一的模态框容器
    const modalContainer = document.createElement('div');
    modalContainer.className = 'model-settings-container';
    
    // 对话框标题
    const modalHeader = document.createElement('div');
    modalHeader.className = 'modal-header';
    
    const modalTitle = document.createElement('h3');
    modalTitle.textContent = `${model.name} 设置`;
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'close-btn';
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', () => {
      modal.remove();
    });
    
    modalHeader.appendChild(modalTitle);
    modalHeader.appendChild(closeBtn);
    
    // 对话框内容
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    
    // 添加各设置字段
    modalContent.appendChild(this.createInputField('API 密钥', 'password', model.apiKey || '', index, 'apiKey', handlers.onFieldChange));
    modalContent.appendChild(this.createInputField('API 地址', 'text', model.url || '', index, 'url', handlers.onFieldChange));
    modalContent.appendChild(this.createModelSelectField(model, index, handlers.onFieldChange));
    modalContent.appendChild(this.createInputField('最大 Token 数', 'number', model.maxTokens || 2000, index, 'maxTokens', handlers.onFieldChange));
    modalContent.appendChild(this.createTemperatureField(model, index, handlers.onFieldChange));
    modalContent.appendChild(this.createTestConnectionField(index, handlers.onTestConnection));
    
    // 对话框底部
    const modalFooter = document.createElement('div');
    modalFooter.className = 'modal-footer';
    
    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn save-btn';
    saveBtn.textContent = '保存并关闭';
    saveBtn.addEventListener('click', () => {
      modal.remove();
    });
    
    modalFooter.appendChild(saveBtn);
    
    // 组装对话框
    modalContainer.appendChild(modalHeader);
    modalContainer.appendChild(modalContent);
    modalContainer.appendChild(modalFooter);
    
    // 将容器添加到模态框
    modal.appendChild(modalContainer);
    
    // 添加到页面
    document.body.appendChild(modal);
    
    // 显示对话框
    setTimeout(() => {
      modal.classList.add('active');
    }, 10);
  }
  
  /**
   * 创建输入字段
   * @private
   */
  createInputField(label, type, value, index, fieldName, onChange) {
    const field = document.createElement('div');
    field.className = 'model-field';
    
    const labelElement = document.createElement('label');
    labelElement.textContent = label;
    
    const input = document.createElement('input');
    input.type = type;
    input.setAttribute('data-index', index);
    input.setAttribute('data-field', fieldName);
    input.value = value; // 直接设置值，无需特殊处理
    
    input.addEventListener('change', (e) => {
      if (type === 'number') {
        onChange(index, fieldName, parseInt(input.value, 10));
      } else {
        onChange(index, fieldName, input.value);
      }
    });
    
    field.appendChild(labelElement);
    field.appendChild(input);
    
    return field;
  }
  
  /**
   * 创建模型选择字段
   * @private
   */
  createModelSelectField(model, index, onChange) {
    const field = document.createElement('div');
    field.className = 'model-field';
    
    const labelElement = document.createElement('label');
    labelElement.textContent = '选择模型';
    
    const select = document.createElement('select');
    select.setAttribute('data-index', index);
    select.setAttribute('data-field', 'selectedModel');
    
    const modelsArray = Array.isArray(model.models) ? model.models : [model.models];
    
    modelsArray.forEach(modelName => {
      const option = document.createElement('option');
      option.value = modelName;
      option.textContent = modelName;
      if (model.selectedModel === modelName) {
        option.selected = true;
      }
      select.appendChild(option);
    });
    
    select.addEventListener('change', (e) => {
      onChange(index, 'selectedModel', e.target.value);
    });
    
    field.appendChild(labelElement);
    field.appendChild(select);
    
    return field;
  }
  
  /**
   * 创建温度设置字段
   * @private
   */
  createTemperatureField(model, index, onChange) {
    const field = document.createElement('div');
    field.className = 'model-field';
    
    const labelElement = document.createElement('label');
    labelElement.textContent = '响应温度';
    
    const sliderContainer = document.createElement('div');
    sliderContainer.className = 'slider-container';
    
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '1';
    slider.step = '0.1';
    slider.value = model.temperature || 0.7;
    slider.setAttribute('data-index', index);
    slider.setAttribute('data-field', 'temperature');
    
    const sliderValue = document.createElement('span');
    sliderValue.className = 'slider-value';
    sliderValue.textContent = slider.value;
    
    slider.addEventListener('input', (e) => {
      sliderValue.textContent = e.target.value;
    });
    
    slider.addEventListener('change', (e) => {
      onChange(index, 'temperature', parseFloat(e.target.value));
    });
    
    sliderContainer.appendChild(slider);
    sliderContainer.appendChild(sliderValue);
    
    field.appendChild(labelElement);
    field.appendChild(sliderContainer);
    
    return field;
  }
  
  /**
   * 创建测试连接字段
   * @param {number} index - 模型索引
   * @param {Function} onTestConnection - 测试连接回调函数
   * @private
   */
  createTestConnectionField(index, onTestConnection) {
    const field = document.createElement('div');
    field.className = 'test-connection-field';
    
    const testBtn = document.createElement('button');
    testBtn.className = 'test-btn';
    testBtn.textContent = '测试连接';
    testBtn.setAttribute('data-index', index);
    
    const statusElement = document.createElement('div');
    statusElement.className = 'test-status';
    statusElement.textContent = '';
    
    // 创建 loading 指示器
    const loader = document.createElement('div');
    loader.className = 'loader';
    loader.style.display = 'none';
    
    for (let i = 0; i < 3; i++) {
      const dot = document.createElement('div');
      dot.className = 'loader-dot';
      loader.appendChild(dot);
    }
    
    testBtn.addEventListener('click', async () => {
      // 更新 UI 状态为加载中
      statusElement.textContent = '';
      statusElement.className = 'test-status';
      testBtn.disabled = true;
      loader.style.display = 'flex';
      
      try {
        // 调用测试连接函数
        const result = await onTestConnection(index);
        
        // 更新 UI 显示测试结果
        if (result.success) {
          this.showStatus(statusElement, 'success', '连接成功');
        } else {
          this.showStatus(statusElement, 'error', result.error || '连接失败');
        }
      } catch (error) {
        // 显示错误信息
        this.showStatus(statusElement, 'error', error.message || '测试时发生错误');
        console.error('测试连接失败:', error);
      } finally {
        // 恢复 UI 状态
        testBtn.disabled = false;
        loader.style.display = 'none';
      }
    });
    
    field.appendChild(testBtn);
    field.appendChild(loader);
    field.appendChild(statusElement);
    
    return field;
  }
  
  /**
   * 创建模型选择器
   * @param {Array|string} models - 可用模型列表或单个模型名称
   * @param {string} selectedModel - 当前选择的模型
   * @param {Function} onChange - 变更处理函数
   * @returns {HTMLElement} - 选择器元素
   */
  createModelSelector(models, selectedModel, onChange) {
    const select = document.createElement('select');
    
    const modelsArray = Array.isArray(models) ? models : [models];
    
    modelsArray.forEach(modelName => {
      const option = document.createElement('option');
      option.value = modelName;
      option.textContent = modelName;
      if (selectedModel === modelName) {
        option.selected = true;
      }
      select.appendChild(option);
    });
    
    if (onChange) {
      select.addEventListener('change', (e) => {
        onChange(e.target.value);
      });
    }
    
    return select;
  }
  
  /**
   * 更新测试结果
   * @param {HTMLElement} card - 模型卡片元素
   * @param {Object} result - 测试结果
   */
  updateTestResult(card, result) {
    const statusElement = card.querySelector('.test-status');
    
    if (!statusElement) return;
    
    if (result.success) {
      this.showStatus(statusElement, 'success', '连接成功');
    } else {
      this.showStatus(statusElement, 'error', result.error || '连接失败');
    }
  }
  
  /**
   * 显示状态信息
   * @param {HTMLElement} statusElement - 状态元素
   * @param {string} type - 状态类型 ('success' 或 'error')
   * @param {string} message - 状态消息
   */
  showStatus(statusElement, type, message) {
    statusElement.textContent = message;
    statusElement.className = `test-status ${type}`;
    
    // 设置动画效果 (可选)
    statusElement.style.animation = 'none';
    setTimeout(() => {
      statusElement.style.animation = 'fadeIn 0.3s';
    }, 10);
  }
}

export default ModelView; 