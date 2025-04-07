# 研究论文摘要生成器浏览器扩展

一个帮助研究人员从搜索结果中提取和摘要学术论文的Chrome扩展。

## 功能特点

- 自动检测支持平台上的研究论文搜索结果
- 从搜索结果中下载PDF论文
- 使用AI模型生成论文摘要
- 可配置的摘要生成标准和分类
- 可自定义不同AI提供商的API密钥
- 能够根据分类对论文进行标注或高亮

## 支持的平台

- Google Scholar（谷歌学术）
- IEEE Xplore
- ACM数字图书馆
- ArXiv（预印本）
- （可扩展到更多平台）

## 架构设计

### 目录结构

```
├── public/                    # 静态资源和构建文件
│   ├── icons/                 # 扩展图标
│   ├── popup.html             # 弹出界面HTML
│   └── popup.js               # 编译后的弹出界面JS
├── src/                       # 源代码
│   ├── api/                   # API集成（LLM和其他服务）
│   │   ├── llmProviders/      # 不同LLM提供商的实现
│   │   └── pdfProcessors/     # PDF处理工具
│   ├── background/            # 后台脚本
│   │   └── background.js      # 主后台服务工作线程
│   ├── content/               # 内容脚本（在网页中运行）
│   │   ├── content.js         # 主内容脚本
│   │   ├── content.css        # 注入UI元素的样式
│   │   └── platforms/         # 平台特定内容脚本
│   ├── popup/                 # 扩展弹出UI
│   │   ├── components/        # 弹出UI组件
│   │   └── pages/             # 弹出UI中的不同页面
│   ├── utils/                 # 工具函数
│   │   ├── storage.js         # 存储工具
│   │   └── logger.js          # 日志工具
│   ├── components/            # 共享UI组件
│   ├── models/                # 数据模型和类型
│   └── config/                # 配置管理
├── manifest.json              # 扩展清单
├── package.json               # NPM包定义
└── webpack.config.js          # Webpack配置
```

## 核心组件

### 1. 后台脚本 (src/background/background.js)

后台脚本作为扩展的主控制器，主要功能：
- 处理内容脚本和弹出界面之间的通信
- 管理PDF下载
- 协调对AI服务的API调用
- 维护状态和配置

### 2. 内容脚本 (src/content/)

内容脚本注入到网页中，主要功能：
- 检测用户何时访问支持的研究平台
- 从搜索结果中提取论文信息
- 添加论文摘要生成的UI元素
- 为不同研究网站提供特定平台实现

### 3. API集成 (src/api/)

处理与外部服务的集成：
- 不同的LLM提供商（OpenAI、Anthropic等）
- PDF处理工具
- 便于切换提供商的抽象层

### 4. 用户界面 (src/popup/)

弹出界面允许用户：
- 配置API密钥
- 设置摘要偏好
- 查看摘要历史
- 管理下载的论文

### 5. 配置管理 (src/config/)

管理用户配置，包括：
- API密钥
- 摘要分类/标准
- UI偏好
- 平台特定设置

## 扩展点

该架构设计便于扩展：

1. **添加新平台**：在`src/content/platforms/`中创建新的平台特定实现
2. **支持新的LLM提供商**：在`src/api/llmProviders/`中添加新提供商
3. **自定义摘要格式**：在`src/models/`中扩展摘要模板
4. **增加功能**：模块化架构使新功能能够最小化地改变现有代码

## 开发指南

```
# 安装依赖
npm install

# 开发模式构建并监视更改
npm run dev

# 生产环境构建
npm run build
```

## 使用指南

1. 在Chrome浏览器中安装扩展
2. 点击工具栏上的扩展图标，配置您的AI提供商API密钥
3. 访问任何支持的学术搜索平台（如Google Scholar）
4. 论文搜索结果将自动显示"摘要"和"下载PDF"按钮
5. 点击"摘要"生成论文摘要
6. 通过"历史"选项卡访问之前生成的摘要

## 贡献指南

欢迎贡献！请遵循以下步骤：

1. Fork项目
2. 创建您的功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交您的更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 开一个Pull Request

## 许可证

本项目采用MIT许可证 - 详情参见LICENSE文件

## 联系方式

如有问题或建议，请通过issue系统提交您的反馈。

---

**注意**：此扩展需要配置适当的API密钥才能使用AI摘要功能。 