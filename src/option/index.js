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
}); 