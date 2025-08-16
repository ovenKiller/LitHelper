/**
 * index.js
 * 
 * MVC架构模式的组件统一导出入口
 */

import { Controller } from './controller.js';

export {
  // 模型层 - 负责数据管理
  // 视图层 - 负责UI渲染
  Controller  // 控制器层 - 负责业务逻辑
};

// 页面加载完成后初始化控制器
document.addEventListener('DOMContentLoaded', () => {
  const controller = new Controller();
  controller.init();

  // 处理URL锚点，支持直接跳转到特定设置部分
  handleUrlAnchor();
});

/**
 * 处理URL锚点，切换到对应的设置部分
 */
function handleUrlAnchor() {
  const hash = window.location.hash.substring(1); // 移除 # 符号
  if (hash) {
    // 查找对应的导航项
    const navItem = document.querySelector(`[data-section="${hash}"]`);
    if (navItem) {
      // 移除所有活动状态
      document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
      });
      document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
      });

      // 激活对应的导航项和内容区域
      navItem.classList.add('active');
      const section = document.getElementById(hash);
      if (section) {
        section.classList.add('active');
      }
    }
  }
}

// 监听导航点击事件
document.addEventListener('click', (event) => {
  const navItem = event.target.closest('.nav-item');
  if (navItem) {
    const sectionId = navItem.dataset.section;
    console.log('[NAVIGATION] Clicked nav item:', sectionId);
    if (sectionId) {
      // 移除所有活动状态
      document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
      });
      document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
      });

      // 激活点击的导航项和对应内容
      navItem.classList.add('active');
      const section = document.getElementById(sectionId);
      if (section) {
        section.classList.add('active');
        console.log('[NAVIGATION] Activated section:', sectionId);
      } else {
        console.error('[NAVIGATION] Section not found:', sectionId);
      }

      // 更新URL锚点
      window.location.hash = sectionId;
    }
  }
});