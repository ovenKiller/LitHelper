/**
 * popup.js
 * 
 * This script handles the logic for the extension's popup window.
 */
// popup.js 在popup上下文中运行，不能直接导入background模块
// 使用chrome extension API进行通信

class Popup {
  constructor() {
    this.statusMessage = document.getElementById('settings-status');
    this.clearCssSelectorsBtn = document.getElementById('clear-css-selectors-btn');
    this.clearAllTasksBtn = document.getElementById('clear-all-tasks-btn');
    // 新增权限相关按钮
    this.testPermissionBtn = document.getElementById('test-permission-btn');
    this.requestAllPermissionBtn = document.getElementById('request-all-permissions-btn');
    this.diagnosePermissionsBtn = document.getElementById('diagnose-permissions-btn');
    this.init();
  }

  async init() {
    this.setupEventListeners();
    this.setupTabNavigation(); // 设置标签页导航
    this.loadPermissionStatus(); // 加载权限状态
  }

  setupEventListeners() {
    // 清除所有CSS选择器按钮事件
    if (this.clearCssSelectorsBtn) {
      this.clearCssSelectorsBtn.addEventListener('click', async () => {
        await this.handleClearCssSelectors();
      });
    }
    
    // 清除所有任务数据按钮事件
    if (this.clearAllTasksBtn) {
      this.clearAllTasksBtn.addEventListener('click', async () => {
        await this.handleClearAllTasks();
      });
    }

    // 权限测试按钮事件
    if (this.testPermissionBtn) {
      this.testPermissionBtn.addEventListener('click', async () => {
        await this.handleTestPermission();
      });
    }

    // 请求所有权限按钮事件  
    if (this.requestAllPermissionBtn) {
      this.requestAllPermissionBtn.addEventListener('click', async () => {
        await this.handleRequestAllPermissions();
      });
    }

    // 诊断权限按钮事件
    if (this.diagnosePermissionsBtn) {
      this.diagnosePermissionsBtn.addEventListener('click', async () => {
        await this.handleDiagnosePermissions();
      });
    }
  }



  updateStatus(message) {
    this.statusMessage.textContent = message;
    this.statusMessage.style.display = 'block';
    this.statusMessage.className = 'status success';
    setTimeout(() => {
      this.statusMessage.textContent = '';
      this.statusMessage.style.display = 'none';
      this.statusMessage.className = 'status';
    }, 3000);
  }

  showError(message) {
    this.statusMessage.textContent = message;
    this.statusMessage.style.display = 'block';
    this.statusMessage.className = 'status error';
    setTimeout(() => {
      this.statusMessage.textContent = '';
      this.statusMessage.style.display = 'none';
      this.statusMessage.className = 'status';
    }, 3000);
  }

  /**
   * 设置标签页导航
   */
  setupTabNavigation() {
    // 获取所有标签页按钮和内容
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');

    // 为每个标签页按钮添加点击事件
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetTab = tab.getAttribute('data-tab');
        
        // 移除所有活动状态
        tabs.forEach(t => t.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));
        
        // 激活当前标签页
        tab.classList.add('active');
        const targetContent = document.getElementById(targetTab);
        if (targetContent) {
          targetContent.classList.add('active');
        }
        
      });
    });
  }

  /**
   * 处理清除所有CSS选择器
   */
  async handleClearCssSelectors() {
    try {
      // 显示确认提示
      const confirmed = confirm(
        '确定要删除所有已保存的CSS选择器吗？\n\n' +
        '这将清除所有平台的自动论文提取配置，' +
        'AI需要重新学习页面结构。\n\n' +
        '此操作不可撤销！'
      );
      
      if (!confirmed) {
        return;
      }

      // 显示加载状态
      this.clearCssSelectorsBtn.disabled = true;
      this.clearCssSelectorsBtn.textContent = '清除中...';

      // 直接使用chrome.storage API清除CSS选择器
      const success = await this.clearAllCssSelectors();
      
      if (success) {
        this.updateStatus('所有CSS选择器已清除');
        console.log('[Popup] 成功清除所有CSS选择器');
      } else {
        this.showError('清除CSS选择器失败');
        console.error('[Popup] 清除CSS选择器失败');
      }

    } catch (error) {
      this.showError('清除CSS选择器时发生错误');
      console.error('[Popup] 清除CSS选择器时发生错误:', error);
    } finally {
      // 恢复按钮状态
      this.clearCssSelectorsBtn.disabled = false;
      this.clearCssSelectorsBtn.textContent = '清除所有CSS选择器';
    }
  }

  /**
   * 处理清除所有任务数据
   */
  async handleClearAllTasks() {
    try {
      // 确认对话框
      const confirmed = window.confirm(
        '确定要删除所有任务数据吗？\n\n' +
        '这将清除：\n' +
        '• 所有任务队列数据\n' +
        '• 所有任务历史记录\n\n' +
        '此操作不可撤销！'
      );
      
      if (!confirmed) {
        return;
      }

      // 显示加载状态
      this.clearAllTasksBtn.disabled = true;
      this.clearAllTasksBtn.textContent = '清除中...';

      // 通过background script调用runTimeDataService
      const response = await chrome.runtime.sendMessage({
        action: 'clearAllTaskData'
      });
      
      if (response && response.success) {
        const stats = response.statistics;
        this.updateStatus(
          `任务数据清除成功！删除了 ${stats.totalKeys} 个数据项 ` +
          `(队列: ${stats.taskQueues}, 历史: ${stats.taskHistory})`
        );
        console.log('[Popup] 成功清除所有任务数据:', stats);
      } else {
        const errorMsg = response ? response.error : '未知错误';
        this.showError(`清除任务数据失败: ${errorMsg}`);
        console.error('[Popup] 清除任务数据失败:', response);
      }

    } catch (error) {
      this.showError('清除任务数据时发生错误');
      console.error('[Popup] 清除任务数据时发生错误:', error);
    } finally {
      // 恢复按钮状态
      this.clearAllTasksBtn.disabled = false;
      this.clearAllTasksBtn.textContent = '清除所有任务数据';
    }
  }

  /**
   * 加载权限状态
   */
  async loadPermissionStatus() {
    try {
      // 检查常用域名的权限状态
      const testDomains = [
        'https://books.google.com',
        'https://scholar.google.com', 
        'https://ieeexplore.ieee.org',
        'https://dl.acm.org',
        'https://arxiv.org'
      ];

      const permissionStatus = document.getElementById('permission-status');
      if (!permissionStatus) return;

      let statusHtml = '<h4>权限状态：</h4><ul>';
      
      for (const domain of testDomains) {
        try {
          const hasPermission = await chrome.permissions.contains({
            origins: [domain + '/*']
          });
          const status = hasPermission ? '✅' : '❌';
          statusHtml += `<li>${status} ${domain}</li>`;
        } catch (error) {
          statusHtml += `<li>❓ ${domain} (检查失败)</li>`;
        }
      }
      
      statusHtml += '</ul>';
      permissionStatus.innerHTML = statusHtml;
      
    } catch (error) {
      console.error('[Popup] 加载权限状态失败:', error);
    }
  }

  /**
   * 处理权限测试
   */
  async handleTestPermission() {
    try {
      this.testPermissionBtn.disabled = true;
      this.testPermissionBtn.textContent = '测试中...';

      // 测试Google Books权限请求
      const testUrl = 'https://books.google.com/books?id=test';
      
      const response = await chrome.runtime.sendMessage({
        action: 'testPermissionRequest',
        url: testUrl
      });
      
      if (response && response.success) {
        this.updateStatus(`权限测试成功！\n测试前: ${response.data.hasPermissionBefore}\n授权结果: ${response.data.granted}\n测试后: ${response.data.hasPermissionAfter}`);
        await this.loadPermissionStatus(); // 刷新权限状态
      } else {
        const errorMsg = response ? response.error : '未知错误';
        this.showError(`权限测试失败: ${errorMsg}`);
      }

    } catch (error) {
      this.showError('权限测试时发生错误');
      console.error('[Popup] 权限测试时发生错误:', error);
    } finally {
      this.testPermissionBtn.disabled = false;
      this.testPermissionBtn.textContent = '测试权限请求';
    }
  }

  /**
   * 处理请求所有权限
   */
  async handleRequestAllPermissions() {
    try {
      this.requestAllPermissionBtn.disabled = true;
      this.requestAllPermissionBtn.textContent = '请求中...';

      // 请求通用权限（这个请求在用户手势上下文中，应该可以成功）
      const granted = await chrome.permissions.request({
        origins: ['*://*/*']
      });
      
      if (granted) {
        this.updateStatus('权限授权成功！现在可以访问所有网站。');
        await this.loadPermissionStatus(); // 刷新权限状态
      } else {
        this.showError('用户拒绝了权限请求');
      }

    } catch (error) {
      this.showError('权限请求时发生错误');
      console.error('[Popup] 权限请求时发生错误:', error);
    } finally {
      this.requestAllPermissionBtn.disabled = false;
      this.requestAllPermissionBtn.textContent = '请求所有权限';
    }
  }

  /**
   * 清除所有CSS选择器（直接使用chrome.storage API）
   */
  async clearAllCssSelectors() {
    try {
      // 获取所有存储数据
      const allData = await chrome.storage.local.get(null);
      const keysToRemove = [];
      
      // 找到所有CSS选择器相关的键
      for (const key in allData) {
        if (key.startsWith('cssSelectors.')) {
          keysToRemove.push(key);
        }
      }
      
      if (keysToRemove.length > 0) {
        // 删除所有CSS选择器数据
        await chrome.storage.local.remove(keysToRemove);
        console.log(`[Popup] 清除CSS选择器数据，删除了 ${keysToRemove.length} 条记录`);
        return true;
      } else {
        console.log('[Popup] 未找到CSS选择器数据');
        return true;
      }
    } catch (error) {
      console.error('[Popup] 清除CSS选择器数据失败:', error);
      return false;
    }
  }

  /**
   * 处理权限诊断
   */
  async handleDiagnosePermissions() {
    try {
      this.diagnosePermissionsBtn.disabled = true;
      this.diagnosePermissionsBtn.textContent = '诊断中...';

      const response = await chrome.runtime.sendMessage({
        action: 'diagnosePermissions'
      });
      
      if (response && response.success) {
        this.showPermissionDiagnosisResults(response.data);
      } else {
        const errorMsg = response ? response.error : '未知错误';
        this.showError(`权限诊断失败: ${errorMsg}`);
      }

    } catch (error) {
      this.showError('权限诊断时发生错误');
      console.error('[Popup] 权限诊断时发生错误:', error);
    } finally {
      this.diagnosePermissionsBtn.disabled = false;
      this.diagnosePermissionsBtn.textContent = '诊断权限问题';
    }
  }

  /**
   * 显示权限诊断结果
   */
  showPermissionDiagnosisResults(data) {
    const statusElement = document.getElementById('permission-status');
    if (!statusElement) return;

    let html = '<h4>🔍 权限诊断结果：</h4>';
    
    // 通用权限状态
    if (data.universalPermission) {
      const status = data.universalPermission.hasPermission ? '✅' : '❌';
      html += `<div><strong>通用权限 (*://*/*):</strong> ${status}</div>`;
    }

    // 域名权限状态
    html += '<div style="margin-top: 8px;"><strong>域名权限:</strong></div>';
    html += '<ul style="margin: 4px 0; padding-left: 16px;">';
    
    for (const [domain, info] of Object.entries(data.permissions)) {
      const status = info.hasPermission ? '✅' : '❌';
      const displayDomain = domain.replace('https://', '');
      html += `<li>${status} ${displayDomain}</li>`;
    }
    html += '</ul>';

    // 建议
    if (data.recommendations && data.recommendations.length > 0) {
      html += '<div style="margin-top: 8px;"><strong>建议:</strong></div>';
      html += '<ul style="margin: 4px 0; padding-left: 16px;">';
      data.recommendations.forEach(rec => {
        html += `<li>${rec}</li>`;
      });
      html += '</ul>';
    }

    // 诊断时间
    if (data.timestamp) {
      const time = new Date(data.timestamp).toLocaleString();
      html += `<div style="margin-top: 8px; font-size: 11px; color: #757575;">诊断时间: ${time}</div>`;
    }

    statusElement.innerHTML = html;
    
    // 显示成功消息
    this.updateStatus('权限诊断完成！请查看上方的详细结果。');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new Popup();
}); 