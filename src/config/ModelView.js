/**
 * ModelView.js
 * 
 * 负责模型设置的UI渲染和组件创建
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
    
    // 如果是密码字段且有值，显示掩码
    if (type === 'password' && value) {
      input.value = '••••••••••••';
      input.setAttribute('data-has-value', 'true');
    } else {
      input.value = value;
    }
    
    input.addEventListener('focus', () => {
      // 密码字段获取焦点时，如果有掩码，清空以便用户输入
      if (type === 'password' && input.getAttribute('data-has-value') === 'true') {
        input.value = '';
      }
    });
    
    input.addEventListener('blur', (e) => {
      // 保存值变化
      if (type === 'password') {
        // 对于密码字段，只有当输入了内容时才更新
        if (input.value && input.value !== '••••••••••••') {
          onChange(index, fieldName, input.value);
          input.value = '••••••••••••';
          input.setAttribute('data-has-value', 'true');
        }
      } else if (type === 'number') {
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
   * 创建温度字段
   * @private
   */
  createTemperatureField(model, index, onChange) {
    const field = document.createElement('div');
    field.className = 'model-field';
    
    const labelElement = document.createElement('label');
    labelElement.textContent = '温度';
    
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
    
    const valueDisplay = document.createElement('span');
    valueDisplay.className = 'slider-value';
    valueDisplay.textContent = model.temperature || 0.7;
    
    slider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      valueDisplay.textContent = value;
      onChange(index, 'temperature', value);
    });
    
    sliderContainer.appendChild(slider);
    sliderContainer.appendChild(valueDisplay);
    
    field.appendChild(labelElement);
    field.appendChild(sliderContainer);
    
    return field;
  }
  
  /**
   * 创建测试连接字段
   * @private
   */
  createTestConnectionField(index, onTestConnection) {
    const field = document.createElement('div');
    field.className = 'model-field';
    field.style.marginTop = '16px';
    
    const testButton = document.createElement('button');
    testButton.className = 'btn test-connection-btn';
    testButton.style.width = '100%';
    testButton.textContent = '测试连接';
    testButton.setAttribute('data-index', index);
    
    const testResultDiv = document.createElement('div');
    testResultDiv.className = 'test-result';
    testResultDiv.style.display = 'none';
    
    testButton.addEventListener('click', async (e) => {
      const btn = e.target;
      const originalText = btn.textContent;
      
      // 禁用按钮并显示加载状态
      btn.disabled = true;
      btn.textContent = '测试中...';
      
      // 清除之前的测试结果
      testResultDiv.style.display = 'none';
      testResultDiv.className = 'test-result';
      
      try {
        // 调用测试方法
        const result = await onTestConnection(index);
        
        // 显示测试结果
        testResultDiv.style.display = 'block';
        
        if (result.success) {
          testResultDiv.className = 'test-result success';
          testResultDiv.textContent = result.message;
          if (result.data) {
            testResultDiv.textContent += ` 响应: "${result.data}"`;
          }
        } else {
          testResultDiv.className = 'test-result error';
          testResultDiv.textContent = result.message;
        }
      } catch (error) {
        // 显示错误
        testResultDiv.style.display = 'block';
        testResultDiv.className = 'test-result error';
        testResultDiv.textContent = `测试失败: ${error.message}`;
      } finally {
        // 恢复按钮状态
        btn.disabled = false;
        btn.textContent = originalText;
      }
    });
    
    field.appendChild(testButton);
    field.appendChild(testResultDiv);
    
    return field;
  }
  
  /**
   * 创建模型选择器
   * @param {Array} models - 模型数组
   * @param {string} selectedModel - 当前选中的模型
   * @param {Function} onChange - 变更处理函数
   * @returns {HTMLElement} - 选择器元素
   */
  createModelSelector(models, selectedModel, onChange) {
    const select = document.createElement('select');
    select.id = 'default-ai-model';
    
    // 添加默认选项
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = '-- 请选择默认 AI 模型 --';
    select.appendChild(defaultOption);
    
    // 添加启用且有API密钥的模型
    models.forEach(model => {
      if (model.active && model.apiKey) {
        const option = document.createElement('option');
        option.value = model.name;
        option.textContent = model.name;
        select.appendChild(option);
      }
    });
    
    // 设置默认选中项
    if (selectedModel) {
      select.value = selectedModel;
    }
    
    // 添加变更事件
    select.addEventListener('change', (e) => {
      onChange(e.target.value);
    });
    
    return select;
  }
  
  /**
   * 更新测试结果显示
   * @param {HTMLElement} card - 模型卡片元素
   * @param {Object} result - 测试结果
   */
  updateTestResult(card, result) {
    const testResultDiv = card.querySelector('.test-result');
    
    if (!testResultDiv) return;
    
    testResultDiv.style.display = 'block';
    testResultDiv.className = 'test-result ' + (result.success ? 'success' : 'error');
    testResultDiv.textContent = result.message;
    
    if (result.success && result.data) {
      testResultDiv.textContent += ` 响应: "${result.data}"`;
    }
  }
  
  /**
   * 显示状态信息
   * @param {HTMLElement} statusElement - 状态元素
   * @param {string} type - 消息类型（success/error）
   * @param {string} message - 消息内容
   */
  showStatus(statusElement, type, message) {
    statusElement.className = `status ${type}`;
    statusElement.textContent = message;
    statusElement.style.display = 'block';
    
    // 5秒后自动隐藏
    setTimeout(() => {
      statusElement.className = 'status';
      statusElement.style.display = 'none';
    }, 5000);
  }
}

export default ModelView; 