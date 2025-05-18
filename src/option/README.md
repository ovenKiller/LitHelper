# LitHelper 设置模块


插件的设置页面功能

本目录采用 MVC (Model-View-Controller) 架构模式，具有清晰的职责分离和逻辑组织。

## 文件结构

### 核心MVC文件
- `SettingsModel.js` - **模型层**：负责数据管理和业务逻辑
- `SettingsView.js` - **视图层**：负责UI组件的创建和渲染
- `SettingsController.js` - **控制器层**：负责协调模型和视图之间的交互
- `settings.html` - 设置页面的HTML结构
- `settings.css` - 设置页面的样式表，视图层的样式定义
- `index.js` - MVC组件的统一导出入口

### 原始文件（已不再使用）
以下文件已重命名，仅作为历史参考：
- `config.js` → `SettingsModel.js`
- `view.js` → `SettingsView.js` 
- `settings.js` → `SettingsController.js`

## MVC职责分工

### 模型层 (Model)
- 存储和管理扩展的所有设置
- 提供配置读取、更新、重置的方法
- 定义默认配置结构
- 支持深度合并配置项
- 获取启用的AI模型配置
- 代表：`SettingsModel.js`

### 视图层 (View)
- 负责创建UI组件和视图
- 生成模型卡片UI
- 创建设置对话框
- 实现各种表单控件
- 提供UI更新方法
- 代表：`SettingsView.js`（逻辑） 和 `settings.css`（样式）

### 控制器层 (Controller)
- 处理用户交互和事件响应
- 在模型和视图之间协调通信
- 初始化应用程序
- 管理UI状态和加载数据
- 实现业务流程
- 代表：`SettingsController.js`

## 使用方法

在页面加载时，控制器会自动初始化并加载配置，无需额外代码。如需在其他模块中使用本设置模块，可以通过`index.js`导入相应组件：

```javascript
import { Model, View, Controller } from './option';

// 使用模型获取配置
const config = Model.getConfig();

// 使用视图创建UI组件
const modelSelector = View.createModelSelector(models, selectedModel, handleChange);

// 使用控制器管理交互
Controller.saveSettings();
```

## 数据流

1. 用户在UI上进行操作（如点击按钮、填写表单）
2. 控制器捕获事件并调用相应的处理方法
3. 控制器可能会更新模型中的数据
4. 模型保存更新后的数据
5. 控制器通知视图更新界面
6. 视图根据最新数据刷新UI

## 文件分离说明

为遵循关注点分离原则，项目文件按职责进行了拆分：

- 数据处理和业务逻辑 → `SettingsModel.js`
- UI组件创建和交互 → `SettingsView.js`
- 事件处理和控制流程 → `SettingsController.js`
- 页面结构 → `settings.html`
- 样式定义 → `settings.css`

这种分离使代码更易于维护、扩展和理解。 