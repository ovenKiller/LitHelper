/**
 * index.js
 * 
 * MVC架构模式的组件统一导出入口
 */

import Model from './SettingsModel';
import View from './SettingsView';
import Controller from './SettingsController';

export {
  Model,   // 模型层 - 负责数据管理
  View,    // 视图层 - 负责UI渲染
  Controller  // 控制器层 - 负责业务逻辑
};

// 页面加载完成后初始化控制器
// 注意：这个逻辑已经移至 SettingsController.js 中，此处保留注释供参考
// document.addEventListener('DOMContentLoaded', () => {
//   Controller.init();
// }); 