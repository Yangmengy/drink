# 🍸 调酒 App - Cocktail App

> 极简风格 iOS 鸡尾酒调酒助手 | Tauri v2 + React 18 + Rust

一款帮助调酒爱好者学习、管理和创作鸡尾酒的移动应用，采用 iOS 风格极简设计，支持 Android、iOS 和桌面平台。

---

## 📋 项目概览

### 核心功能
- 🔍 **智能搜索** - FTS5 全文搜索，毫秒级响应
- 🍹 **配方浏览** - 内置 277+ 经典配方（IBA 官方 + 流行配方）
- 🧊 **我的酒柜** - 管理库存，智能推荐可调制的鸡尾酒
- 📝 **制作指引** - 分步骤指导 + 计时器
- ♥️ **收藏管理** - 保存喜欢的配方
- 🎨 **深色模式** - 完整支持浅色/深色主题
- 📱 **离线优先** - 所有数据本地存储，完全离线可用

### 技术亮点
- ⚡ **极致性能** - Rust 后端 + SQLite，搜索 <50ms
- 🎭 **毛玻璃设计** - iOS 风格半透明效果
- 🔄 **前后端分离** - TypeScript + Rust，类型安全
- 📦 **轻量体积** - <10MB 安装包
- 🚀 **跨平台** - 一套代码，多端运行

---

## 📚 文档导航

### 产品文档
- **[PRD-CocktailApp.md](./PRD-CocktailApp.md)** — 产品需求文档 & 技术选型分析
  - 技术选型深度分析
  - 系统架构设计
  - 功能需求矩阵
  - 数据库设计
  - 前后端分离规范
  - 开发路线图

### 设计文档 🎨
- **[README-DESIGN.md](./README-DESIGN.md)** — 设计文档导航（从这里开始）
- **[DESIGN-SYSTEM.md](./DESIGN-SYSTEM.md)** — 设计系统规范 ⭐
- **[DESIGN-MOCKUPS.md](./DESIGN-MOCKUPS.md)** — 视觉效果图说明
- **[DESIGN-IMPLEMENTATION.md](./DESIGN-IMPLEMENTATION.md)** — 实现指南 ⭐
- **[DESIGN-ASSETS.md](./DESIGN-ASSETS.md)** — 资产清单
- **[design-tokens.css](./design-tokens.css)** — CSS 变量文件

---

## 🏗️ 技术栈

### 前端
- **React 18.3** - UI 框架
- **TypeScript 5.x** - 类型安全
- **Vite 6.x** - 构建工具
- **React Router 7** - 路由管理
- **TanStack Query** - 数据缓存
- **Framer Motion** - 动画库
- **Lucide React** - 图标库

### 后端
- **Rust 1.86+** - 核心语言
- **Tauri v2** - 跨平台框架
- **SQLite + FTS5** - 数据库 + 全文搜索
- **SQLx** - SQL 驱动
- **Serde** - 序列化

### 目标平台
- **Android** (minSdk 26, arm64)
- **iOS** (iOS 15+, arm64)
- **Desktop** (macOS, Windows, Linux)

---

## 🚀 快速开始

### 环境要求
- **Node.js** >= 18.x
- **Rust** >= 1.86
- **Tauri CLI** 2.x
- **Xcode** (iOS 开发)
- **Android Studio** + NDK (Android 开发)

### 安装依赖

```bash
# 克隆仓库
git clone <repo-url>
cd drink

# 安装前端依赖
npm install

# 安装 Tauri CLI
cargo install tauri-cli --version "^2.0.0"
```

### 开发

```bash
# 启动开发服务器
npm run tauri dev

# 前端热重载 + Rust 后端
```

### 构建

```bash
# 构建 Android
npm run tauri android build

# 构建 iOS (需 macOS)
npm run tauri ios build

# 构建桌面版
npm run tauri build
```

---

## 📂 项目结构

```
drink/
├── src/                      # React 前端
│   ├── main.tsx             # 入口
│   ├── App.tsx              # 根组件
│   ├── pages/               # 页面组件
│   ├── components/          # UI 组件
│   ├── hooks/               # 自定义 Hooks
│   ├── stores/              # 状态管理 (Zustand)
│   ├── types/               # TypeScript 类型
│   ├── lib/                 # 工具函数
│   ├── assets/              # 静态资源
│   └── styles/              # 样式文件
│       ├── design-tokens.css
│       └── global.css
│
├── src-tauri/               # Tauri + Rust 后端
│   ├── src/
│   │   ├── main.rs         # 入口
│   │   ├── commands/       # Tauri Commands
│   │   ├── services/       # 业务逻辑
│   │   ├── db/             # 数据库
│   │   ├── models/         # 数据模型
│   │   └── types/          # Rust 类型
│   ├── Cargo.toml
│   └── tauri.conf.json
│
├── PRD-CocktailApp.md       # 产品需求文档
├── README-DESIGN.md         # 设计文档导航
├── DESIGN-*.md              # 设计系统文档
├── design-tokens.css        # CSS 变量
└── package.json
```

---

## 🎨 设计理念

### 核心原则
- **极简主义** - Less is More，去除一切不必要的装饰
- **扁平化** - SF Symbols 风格图标，线条简洁
- **毛玻璃** - 半透明背景 + 背景模糊，营造轻盈感
- **iOS 原生感** - 遵循 Apple HIG，熟悉的交互体验

### 视觉风格
- **主色调**：#FF9500 (琥珀金)
- **字体**：SF Pro Display / PingFang SC
- **圆角**：8px / 12px / 16px / 24px
- **间距**：8pt Grid 系统

详细设计规范请查看 [README-DESIGN.md](./README-DESIGN.md)

---

## 🗺️ 开发路线图

### Phase 1 — 脚手架 & 契约 (Week 1) ✅
- [x] Tauri v2 项目初始化
- [x] React + TypeScript 配置
- [x] 设计系统完成
- [ ] 定义 IPC 接口契约
- [ ] 搭建测试框架

### Phase 2 — 核心数据 & 搜索 (Week 2-3)
- [ ] IBA 配方数据录入
- [ ] FTS5 搜索实现
- [ ] 配方列表页
- [ ] 配方详情页

### Phase 3 — 我的酒柜 (Week 4)
- [ ] 库存管理
- [ ] 推荐算法
- [ ] 原料清单

### Phase 4 — 进阶功能 (Week 5-6)
- [ ] 制作步骤动画
- [ ] 收藏功能
- [ ] 自定义配方
- [ ] 深色模式

### Phase 5 — 打包 & 发布 (Week 7-8)
- [ ] Android 构建
- [ ] iOS 构建
- [ ] 性能优化
- [ ] 上架准备

详细路线图请查看 [PRD-CocktailApp.md](./PRD-CocktailApp.md#9-开发路线图)

---

## 📊 项目进度

- **设计阶段**：✅ 已完成 (100%)
- **开发阶段**：🚧 进行中 (0%)
- **测试阶段**：⏸️ 未开始
- **发布阶段**：⏸️ 未开始

---

## 🤝 参与贡献

欢迎提交 Issue 和 Pull Request！

### 贡献指南
1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

### 开发规范
- 遵循 [PRD](./PRD-CocktailApp.md) 中的技术规范
- 遵循 [设计系统](./DESIGN-SYSTEM.md) 的 UI 规范
- 编写单元测试（覆盖率 > 80%）
- 提交信息使用约定式提交格式

---

## 📜 许可证

MIT License - 详见 [LICENSE](./LICENSE)

---

## 📞 联系方式

- **项目负责人**：yangmengying
- **技术支持**：提交 Issue
- **设计文档**：[README-DESIGN.md](./README-DESIGN.md)
- **产品文档**：[PRD-CocktailApp.md](./PRD-CocktailApp.md)

---

## 🙏 致谢

- [Tauri](https://tauri.app/) - 跨平台框架
- [React](https://react.dev/) - UI 框架
- [Lucide](https://lucide.dev/) - 图标库
- [Apple HIG](https://developer.apple.com/design/human-interface-guidelines/) - 设计指南
- [IBA](https://iba-world.com/) - 官方配方来源

---

*用极简的设计，探索调酒的无限可能 🍸*
