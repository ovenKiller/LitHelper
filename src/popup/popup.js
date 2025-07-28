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
    this.init();
  }

  async init() {
    this.setupEventListeners();
    this.setupTabNavigation(); // 设置标签页导航
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


}

document.addEventListener('DOMContentLoaded', () => {
  new Popup();
}); 