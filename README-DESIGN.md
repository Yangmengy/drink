# 🎨 调酒 App - 设计文档导航

> iOS 风格极简设计系统 | 毛玻璃效果 | 扁平化图标

---

## 📚 文档结构

本设计系统包含以下文档：

### 1. [DESIGN-SYSTEM.md](./DESIGN-SYSTEM.md) — 设计系统规范 ⭐
**核心设计规范文档**，包含：
- 设计理念（极简、扁平化、毛玻璃）
- 色彩系统（浅色/深色模式）
- 字体系统（SF Pro 风格）
- 间距与布局（8pt Grid）
- 毛玻璃效果定义
- 图标系统（Lucide Icons）
- 组件库规范
- 动效规范

**适用人群**：UI 设计师、前端开发者

---

### 2. [DESIGN-MOCKUPS.md](./DESIGN-MOCKUPS.md) — 视觉效果图说明
**详细的页面设计描述**，包含：
- 启动页设计
- 首页（发现页）布局
- 配方详情页布局
- 我的酒柜页布局
- 搜索页布局
- 个人中心页布局
- 交互动效清单

**适用人群**：UI 设计师、产品经理、前端开发者

---

### 3. [DESIGN-IMPLEMENTATION.md](./DESIGN-IMPLEMENTATION.md) — 实现指南 ⭐
**代码实现指导文档**，包含：
- 组件实现示例（Button、SearchBar、CocktailCard、TabBar 等）
- 页面布局实现
- 动画效果实现
- 性能优化技巧
- 主题切换实现
- 工具函数
- 开发建议

**适用人群**：前端开发者

---

### 4. [DESIGN-ASSETS.md](./DESIGN-ASSETS.md) — 资产清单
**设计资源清单**，包含：
- 所需依赖列表
- 图标列表（Lucide Icons）
- App 图标规范
- 配方图片规范
- 原料图标设计
- 启动图设计
- 设计工具推荐
- 资产文件结构

**适用人群**：UI 设计师、前端开发者、项目管理

---

### 5. [design-tokens.css](./design-tokens.css) — CSS 变量
**可直接使用的 CSS Token 文件**，包含：
- 色彩变量
- 字体变量
- 间距变量
- 圆角变量
- 阴影变量
- 动画变量
- 毛玻璃样式类
- 深色模式支持

**使用方式**：
```typescript
// src/main.tsx
import './design-tokens.css';
```

---

## 🎯 设计理念

### 核心原则

**1. 极简主义 (Minimalism)**
- 去除一切不必要的装饰
- 内容优先，留白充足
- 每个元素都有其存在的理由

**2. 扁平化 (Flat Design)**
- 无阴影、无渐变的纯色图标
- 线条简洁、几何形状清晰
- SF Symbols 风格图标系统

**3. 毛玻璃 (Glassmorphism)**
- 半透明背景 + 背景模糊
- 轻量边框增强层次
- 营造轻盈、通透的视觉感受

**4. iOS 原生感**
- 遵循 Apple HIG 规范
- 使用系统字体 SF Pro
- 熟悉的交互手势和动画

---

## 🎨 快速预览

### 色彩
```css
主色调：#FF9500 (琥珀金)
辅助色：#5856D6 (iOS 紫)、#34C759 (成功绿)、#FF3B30 (错误红)
背景：#F2F2F7 (浅色) / #000000 (深色)
```

### 字体
```
主字体：SF Pro Display (Apple)
备选：PingFang SC (中文)、Helvetica Neue
字号：17px (正文)、28px (大标题)、34px (超大标题)
```

### 圆角
```
小：8px  中：12px  大：16px  超大：24px
```

### 间距 (8pt Grid)
```
xs: 4px  sm: 8px  md: 16px  lg: 24px  xl: 32px
```

---

## 📱 关键页面预览

### 首页
```
┌─────────────────────────────────────┐
│ ← 发现                    🔔 🌙   │ ← 毛玻璃导航栏
├─────────────────────────────────────┤
│  🔍 搜索鸡尾酒...                   │ ← 搜索栏
│                                     │
│  🌟 今日推荐                        │
│  [卡片1] [卡片2] [卡片3] →         │ ← 横向滚动
│                                     │
│  [经典] [热带] [清爽] →            │ ← 分类标签
│                                     │
│  ┌─────────────────────────────┐  │
│  │ [配方图片]                   │  │
│  │ 玛格丽特 ♥                   │  │ ← 毛玻璃卡片
│  │ 🌟🌟 中等 🔥 26%          │  │
│  └─────────────────────────────┘  │
├─────────────────────────────────────┤
│ 🍸 发现  🔍 搜索  🧊 酒柜  👤 我的│ ← 毛玻璃TabBar
└─────────────────────────────────────┘
```

### 配方详情页
```
┌─────────────────────────────────────┐
│         [配方大图]                   │
│  ← 返回        ♥ 收藏  ⋯ 更多      │ ← 浮动操作栏
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│                                     │
│  玛格丽特                           │
│  Margarita                          │
│  🌟🌟 中等  🔥 26% ABV            │
│                                     │
│  ━━━ 原料清单 ━━━                  │
│  🥃 特基拉 50ml ✓                  │
│  🍊 君度 20ml ✓                    │
│                                     │
│  ━━━ 制作步骤 ━━━                  │
│  1️⃣ 用青柠汁润湿杯沿...            │
│  2️⃣ 所有原料加冰摇和 ⏱️ 00:10    │
│                                     │
│  [ 🎯 开始制作 ]                   │
└─────────────────────────────────────┘
```

---

## 🚀 快速开始

### 1. 查看设计系统
```bash
# 阅读核心规范
open DESIGN-SYSTEM.md
```

### 2. 查看页面设计
```bash
# 阅读视觉效果图
open DESIGN-MOCKUPS.md
```

### 3. 开始实现
```bash
# 阅读实现指南
open DESIGN-IMPLEMENTATION.md

# 复制 CSS Token
cp design-tokens.css src/styles/
```

### 4. 准备资产
```bash
# 查看资产清单
open DESIGN-ASSETS.md

# 创建资产目录
mkdir -p src/assets/{icons,images,splash}
```

---

## 📦 依赖安装

```bash
# 核心依赖
npm install react react-dom react-router-dom
npm install lucide-react framer-motion
npm install @tanstack/react-query @tanstack/react-virtual

# 开发依赖
npm install -D typescript vite
npm install -D @types/react @types/react-dom
```

---

## 🎯 设计交付清单

### 已完成 ✅
- [x] 设计系统规范文档
- [x] 视觉效果图说明
- [x] 代码实现指南
- [x] 资产清单
- [x] CSS Token 文件

### 待设计 🎨
- [ ] Figma 设计稿（完整原型）
- [ ] App Icon (1024×1024px)
- [ ] 启动图设计
- [ ] 配方图片收集（277张）
- [ ] 原料图标设计（200+）

### 待开发 💻
- [ ] 组件库实现
- [ ] 页面实现
- [ ] 动画实现
- [ ] 深色模式适配
- [ ] 响应式适配

---

## 🛠️ 设计工具

### 推荐工具
- **Figma** — UI 设计、原型制作
- **SF Symbols App** — iOS 图标预览
- **ColorSlurp** — 取色工具
- **Principle** — 交互动效设计

### 在线工具
- [App Icon Generator](https://appicon.co/)
- [Glassmorphism Generator](https://hype4.academy/tools/glassmorphism-generator)
- [Coolors](https://coolors.co/)
- [Squoosh](https://squoosh.app/)

---

## 📚 参考资源

### Apple 官方
- [Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)
- [SF Symbols](https://developer.apple.com/sf-symbols/)
- [iOS Design Resources](https://developer.apple.com/design/resources/)

### 设计灵感
- Apple Music — 毛玻璃卡片、大标题
- iOS 控制中心 — 圆角卡片、模糊背景
- Apple Health — 数据可视化
- iOS Safari — 底部工具栏

---

## 💡 设计提示

### 开发时注意
1. **优先移动端**：设计以 390px 宽度为基准
2. **安全区域**：注意 iPhone 刘海屏和底部 Home Indicator
3. **触摸目标**：按钮最小 44×44px
4. **性能优化**：图片懒加载、虚拟列表
5. **深色模式**：所有颜色使用 CSS 变量

### 设计原则
- **Less is More**：能用一个元素表达，绝不用两个
- **一致性**：间距、圆角、字号保持一致
- **反馈**：所有交互都要有视觉/触觉反馈
- **可访问性**：颜色对比度 ≥ 4.5:1

---

## 🤝 贡献指南

### 修改设计规范
1. 修改对应的 .md 文档
2. 更新 design-tokens.css（如涉及变量）
3. 更新本导航文档的版本号
4. 提交 PR 并说明修改原因

### 添加新组件
1. 在 DESIGN-SYSTEM.md 添加组件规范
2. 在 DESIGN-MOCKUPS.md 添加视觉描述（如需要）
3. 在 DESIGN-IMPLEMENTATION.md 添加实现示例
4. 更新组件清单

---

## 📜 版本历史

- **v1.0** (2026-06-05)
  - 初始版本发布
  - 完成核心设计系统
  - 完成主要页面设计
  - 完成实现指南

---

## 📞 联系方式

**设计负责人**：AI + yangmengying  
**文档更新时间**：2026-06-05  
**设计语言版本**：iOS 风格 v1.0

---

*开始你的极简调酒 App 设计之旅吧！🍸*
