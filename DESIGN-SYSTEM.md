# 调酒 App — iOS 风格设计系统

> Version: 1.0 | Date: 2026-06-05  
> Design Language: Apple Human Interface Guidelines + Glassmorphism

---

## 目录

1. [设计理念](#1-设计理念)
2. [色彩系统](#2-色彩系统)
3. [字体系统](#3-字体系统)
4. [间距与布局](#4-间距与布局)
5. [毛玻璃效果](#5-毛玻璃效果)
6. [图标系统](#6-图标系统)
7. [组件库](#7-组件库)
8. [页面设计](#8-页面设计)
9. [动效规范](#9-动效规范)
10. [深色模式](#10-深色模式)

---

## 1. 设计理念

### 1.1 核心原则

**极简 (Minimalism)**
- 去除一切不必要的装饰
- 内容优先，留白充足
- 每个元素都有其存在的理由

**扁平化 (Flat Design)**
- 无阴影、无渐变的纯色图标
- 线条简洁、几何形状清晰
- SF Symbols 风格图标系统

**毛玻璃 (Glassmorphism)**
- 半透明背景 + 背景模糊
- 轻量边框增强层次
- 营造轻盈、通透的视觉感受

**iOS 原生感**
- 遵循 Apple HIG 规范
- 使用系统字体 SF Pro
- 熟悉的交互手势和动画


### 1.2 设计参考

- **Apple Music** — 毛玻璃卡片、大标题、内容层级
- **iOS 控制中心** — 圆角卡片、模糊背景
- **Apple Health** — 清晰的数据可视化、纯色图标
- **iOS Safari** — 底部工具栏、流畅动画

---

## 2. 色彩系统

### 2.1 主色调 (Primary Colors)

```css
/* 品牌主色 — 鸡尾酒琥珀金 */
--color-primary: #FF9500;           /* 橙色(琥珀) */
--color-primary-light: #FFB340;     /* 浅橙 */
--color-primary-dark: #CC7700;      /* 深橙 */

/* 辅助色 */
--color-accent: #5856D6;            /* iOS 紫色 */
--color-success: #34C759;           /* 成功绿 */
--color-warning: #FF9500;           /* 警告橙 */
--color-error: #FF3B30;             /* 错误红 */
--color-info: #007AFF;              /* 信息蓝 */
```

### 2.2 中性色 (Neutral Colors - 浅色模式)

```css
/* 背景色 */
--bg-primary: #F2F2F7;              /* iOS 灰色背景 */
--bg-secondary: #FFFFFF;            /* 卡片/模态框背景 */
--bg-tertiary: rgba(255,255,255,0.8); /* 毛玻璃背景 */

/* 文字色 */
--text-primary: #000000;            /* 主要文字 */
--text-secondary: #3C3C43;          /* 次要文字(60%透明度) */
--text-tertiary: #3C3C43;           /* 三级文字(30%透明度) */
--text-quaternary: #8E8E93;         /* 占位符 */

/* 分割线 */
--divider: rgba(60,60,67,0.12);     /* 细分割线 */
--border: rgba(0,0,0,0.04);         /* 卡片边框 */
```

### 2.3 语义化颜色

```css
/* 酒类分类颜色 */
--cocktail-classic: #8E44AD;        /* 经典 - 紫色 */
--cocktail-tropical: #E67E22;       /* 热带 - 橙色 */
--cocktail-refreshing: #3498DB;     /* 清爽 - 蓝色 */
--cocktail-strong: #C0392B;         /* 烈酒 - 红色 */
--cocktail-sweet: #F39C12;          /* 甜酒 - 金色 */
--cocktail-mocktail: #27AE60;       /* 无酒精 - 绿色 */
```


---

## 3. 字体系统

### 3.1 字体家族

```css
/* iOS 系统字体 */
--font-family-base: -apple-system, BlinkMacSystemFont, 
                    "SF Pro Display", "SF Pro Text", 
                    "PingFang SC", "Helvetica Neue", sans-serif;

/* 等宽字体(用于数字、ABV等) */
--font-family-mono: "SF Mono", Menlo, Monaco, monospace;
```

### 3.2 字号规范

```css
/* 大标题 */
--font-size-h1: 34px;    /* Large Title */
--font-weight-h1: 700;   /* Bold */

--font-size-h2: 28px;    /* Title 1 */
--font-weight-h2: 700;

--font-size-h3: 22px;    /* Title 2 */
--font-weight-h3: 600;   /* Semibold */

--font-size-h4: 20px;    /* Title 3 */
--font-weight-h4: 600;

/* 正文 */
--font-size-body: 17px;  /* Body (iOS 默认) */
--font-weight-body: 400; /* Regular */

--font-size-callout: 16px;  /* Callout */
--font-size-subhead: 15px;  /* Subheadline */
--font-size-footnote: 13px; /* Footnote */
--font-size-caption: 12px;  /* Caption */
--font-size-caption2: 11px; /* Caption 2 */
```

### 3.3 行高

```css
--line-height-tight: 1.2;    /* 标题 */
--line-height-normal: 1.4;   /* 正文 */
--line-height-relaxed: 1.6;  /* 大段文字 */
```

---

## 4. 间距与布局

### 4.1 间距系统 (8pt Grid)

```css
--spacing-xxs: 2px;   /* 0.25 单位 */
--spacing-xs: 4px;    /* 0.5 单位 */
--spacing-sm: 8px;    /* 1 单位 */
--spacing-md: 16px;   /* 2 单位 */
--spacing-lg: 24px;   /* 3 单位 */
--spacing-xl: 32px;   /* 4 单位 */
--spacing-xxl: 48px;  /* 6 单位 */
```


### 4.2 圆角

```css
--radius-sm: 8px;     /* 小按钮、标签 */
--radius-md: 12px;    /* 输入框、小卡片 */
--radius-lg: 16px;    /* 大卡片 */
--radius-xl: 24px;    /* 模态框 */
--radius-full: 9999px; /* 圆形 */
```

### 4.3 安全区域

```css
/* iOS 安全区域 */
--safe-area-top: env(safe-area-inset-top);
--safe-area-bottom: env(safe-area-inset-bottom);
--safe-area-left: env(safe-area-inset-left);
--safe-area-right: env(safe-area-inset-right);

/* 内容边距 */
--content-padding: 16px;
--content-max-width: 428px; /* iPhone 14 Pro Max 宽度 */
```

---

## 5. 毛玻璃效果 (Glassmorphism)

### 5.1 标准毛玻璃

```css
.glass {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.15);
}
```

### 5.2 不同场景的毛玻璃

```css
/* 卡片背景 */
.glass-card {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(20px);
  border: 0.5px solid rgba(255, 255, 255, 0.5);
}

/* TabBar 背景 */
.glass-tabbar {
  background: rgba(242, 242, 247, 0.8);
  backdrop-filter: blur(30px) saturate(180%);
  border-top: 0.5px solid rgba(0, 0, 0, 0.05);
}

/* 模态框背景 */
.glass-modal {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(40px);
  border-radius: 24px;
}

/* 搜索栏背景 */
.glass-search {
  background: rgba(142, 142, 147, 0.12);
  backdrop-filter: blur(10px);
}
```


---

## 6. 图标系统

### 6.1 SF Symbols 风格

**设计原则**：
- 使用 2px 线宽
- 圆角端点 (rounded)
- 统一的视觉重量
- 24×24px 基准尺寸

**图标库来源**：
- **iOS**: SF Symbols (官方)
- **Web**: [Lucide Icons](https://lucide.dev/) (SF Symbols 风格)
- **React**: `lucide-react` npm 包

### 6.2 核心图标定义

```typescript
// src/constants/icons.ts

import {
  Home,           // 首页
  Search,         // 搜索
  Wine,           // 酒类(自定义用 Martini)
  User,           // 用户
  Plus,           // 添加
  Heart,          // 收藏
  Filter,         // 筛选
  Clock,          // 计时
  Share,          // 分享
  Settings,       // 设置
  ChevronRight,   // 右箭头
  X,              // 关闭
  Check,          // 完成
  AlertCircle,    // 警告
  Info,           // 信息
  Bookmark,       // 书签
  Star,           // 星标
  Flame,          // 热门/烈度
  Droplet,        // 液体/新鲜
  Moon,           // 深色模式
  Sun,            // 浅色模式
} from 'lucide-react';

export const Icons = {
  Home,
  Search,
  Wine,
  User,
  Plus,
  Heart,
  Filter,
  Clock,
  Share,
  Settings,
  ChevronRight,
  X,
  Check,
  AlertCircle,
  Info,
  Bookmark,
  Star,
  Flame,
  Droplet,
  Moon,
  Sun,
};
```

### 6.3 图标尺寸

```css
--icon-xs: 16px;   /* 小标签内图标 */
--icon-sm: 20px;   /* 输入框内图标 */
--icon-md: 24px;   /* 标准图标 */
--icon-lg: 32px;   /* TabBar 图标 */
--icon-xl: 48px;   /* 大图标(空状态) */
```


---

## 7. 组件库

### 7.1 按钮 (Button)

#### 主要按钮 (Primary)
```css
.btn-primary {
  background: var(--color-primary);
  color: white;
  font-size: 17px;
  font-weight: 600;
  padding: 14px 24px;
  border-radius: 12px;
  border: none;
  box-shadow: 0 2px 8px rgba(255, 149, 0, 0.3);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.btn-primary:active {
  transform: scale(0.96);
  box-shadow: 0 1px 4px rgba(255, 149, 0, 0.2);
}
```

#### 次要按钮 (Secondary)
```css
.btn-secondary {
  background: rgba(120, 120, 128, 0.16);
  color: var(--color-primary);
  font-size: 17px;
  font-weight: 600;
  padding: 14px 24px;
  border-radius: 12px;
  border: none;
}
```

#### 毛玻璃按钮 (Glass)
```css
.btn-glass {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(20px);
  color: var(--text-primary);
  font-size: 17px;
  font-weight: 600;
  padding: 14px 24px;
  border-radius: 12px;
  border: 0.5px solid rgba(255, 255, 255, 0.5);
}
```

### 7.2 搜索栏 (SearchBar)

```css
.search-bar {
  display: flex;
  align-items: center;
  background: rgba(142, 142, 147, 0.12);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  padding: 10px 12px;
  gap: 8px;
}

.search-input {
  flex: 1;
  background: transparent;
  border: none;
  font-size: 17px;
  color: var(--text-primary);
}

.search-input::placeholder {
  color: var(--text-quaternary);
}
```

**视觉结构**：
```
┌─────────────────────────────────────┐
│ 🔍  搜索鸡尾酒...            [×]   │
└─────────────────────────────────────┘
```


### 7.3 卡片 (Card)

#### 鸡尾酒卡片
```css
.cocktail-card {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(20px);
  border: 0.5px solid rgba(255, 255, 255, 0.5);
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  transition: transform 0.2s ease;
}

.cocktail-card:active {
  transform: scale(0.98);
}
```

**视觉结构**：
```
┌─────────────────────────────────┐
│  ┌─────────────────────────┐    │
│  │    [配方图片 16:9]      │    │
│  └─────────────────────────┘    │
│                                  │
│  玛格丽特                        │
│  Margarita                       │
│                                  │
│  🌟🌟 难度中等  🔥 26% ABV      │
│  🏷️ 经典 · 短饮                │
└─────────────────────────────────┘
```

### 7.4 TabBar (底部导航)

```css
.tab-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  background: rgba(242, 242, 247, 0.8);
  backdrop-filter: blur(30px) saturate(180%);
  border-top: 0.5px solid rgba(0, 0, 0, 0.05);
  padding-bottom: env(safe-area-inset-bottom);
  height: calc(49px + env(safe-area-inset-bottom));
}

.tab-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  color: var(--text-quaternary);
  transition: color 0.2s;
}

.tab-item.active {
  color: var(--color-primary);
}

.tab-item-icon {
  font-size: 28px;
}

.tab-item-label {
  font-size: 10px;
  font-weight: 500;
}
```

**视觉结构**：
```
┌────────┬────────┬────────┬────────┐
│  🍸   │   🔍   │   🧊   │   👤   │
│ 发现   │  搜索  │  酒柜  │  我的  │
└────────┴────────┴────────┴────────┘
```


### 7.5 标签 (Tag)

```css
.tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  background: rgba(120, 120, 128, 0.12);
  color: var(--text-secondary);
}

.tag-primary {
  background: rgba(255, 149, 0, 0.15);
  color: var(--color-primary);
}

.tag-success {
  background: rgba(52, 199, 89, 0.15);
  color: var(--color-success);
}
```

### 7.6 列表项 (List Item)

```css
.list-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: white;
  border-bottom: 0.5px solid var(--divider);
  transition: background 0.2s;
}

.list-item:active {
  background: rgba(0, 0, 0, 0.04);
}

.list-item-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.list-item-title {
  font-size: 17px;
  color: var(--text-primary);
}

.list-item-subtitle {
  font-size: 15px;
  color: var(--text-secondary);
}

.list-item-icon {
  margin-right: 12px;
  color: var(--color-primary);
}

.list-item-arrow {
  color: var(--text-quaternary);
}
```

**视觉结构**：
```
┌───────────────────────────────────┐
│ 🍹  玛格丽特              ›      │
│     Margarita                    │
├───────────────────────────────────┤
│ 🍸  马提尼                ›      │
│     Martini                      │
└───────────────────────────────────┘
```


---

## 8. 页面设计

### 8.1 首页 (发现页)

#### 布局结构
```
┌─────────────────────────────────────┐
│ ← 发现                    🔔 🌙   │ ← 导航栏(毛玻璃)
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────────────────────┐  │
│  │ 🔍 搜索鸡尾酒...            │  │ ← 搜索栏
│  └─────────────────────────────┘  │
│                                     │
│  ┌─────────────────────────────┐  │
│  │  🌟 今日推荐                 │  │
│  │  ┌─────┐  ┌─────┐  ┌─────┐ │  │
│  │  │ 🍹 │  │ 🍸 │  │ 🥃 │ │  │ ← 横向滚动
│  │  └─────┘  └─────┘  └─────┘ │  │
│  └─────────────────────────────┘  │
│                                     │
│  ━━━ 分类浏览 ━━━                  │ ← 分割线标题
│                                     │
│  [经典] [热带] [清爽] [烈酒]...   │ ← 横向滚动标签
│                                     │
│  ┌─────────────────────────────┐  │
│  │  [配方图片]                  │  │
│  │  玛格丽特                     │  │
│  │  Margarita                   │  │ ← 配方卡片
│  │  🌟🌟 中等 🔥 26%          │  │
│  └─────────────────────────────┘  │
│                                     │
│  ┌─────────────────────────────┐  │
│  │  [配方图片]                  │  │
│  │  马提尼                      │  │
│  └─────────────────────────────┘  │
│                                     │
├─────────────────────────────────────┤
│ 🍸 发现  🔍 搜索  🧊 酒柜  👤 我的│ ← TabBar(毛玻璃)
└─────────────────────────────────────┘
```

#### 设计要点
- **大标题**：左对齐，34px Bold，与 iOS 原生保持一致
- **搜索栏**：毛玻璃效果，12px 圆角
- **今日推荐**：横向滚动卡片，卡片间距 12px
- **分类标签**：可选中状态，选中时背景色 primary
- **配方卡片**：16px 圆角，毛玻璃效果，hover 时轻微缩放


### 8.2 配方详情页

#### 布局结构
```
┌─────────────────────────────────────┐
│                                     │
│  ┌─────────────────────────────┐  │
│  │                              │  │
│  │     [配方大图 1:1]           │  │ ← 顶部大图
│  │                              │  │
│  └─────────────────────────────┘  │
│  ← [返回]          ♥ 收藏  ⋯ 更多  │ ← 浮动操作栏
│                                     │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │ ← 下拉手柄
│                                     │
│  玛格丽特                           │ ← 28px Bold
│  Margarita                          │ ← 17px Regular
│                                     │
│  🌟🌟 中等  🔥 26% ABV            │
│  🏷️ 经典 · 短饮 · 酸甜            │
│                                     │
│  ┌─────────────────────────────┐  │
│  │ 📝 口感描述                  │  │
│  │ 酸甜平衡，盐边点缀，是最受   │  │ ← 毛玻璃卡片
│  │ 欢迎的特基拉鸡尾酒           │  │
│  └─────────────────────────────┘  │
│                                     │
│  ━━━ 原料清单 ━━━                  │
│                                     │
│  ┌─────────────────────────────┐  │
│  │ 🍋 特基拉        50ml   ✓  │  │
│  │ 🍊 君度          20ml   ✓  │  │ ← 原料列表
│  │ 🟢 鲜榨青柠汁    15ml   ✗  │  │
│  └─────────────────────────────┘  │
│                                     │
│  [ 🧊 我拥有 2/3 原料 ]            │ ← 库存状态
│                                     │
│  ━━━ 制作步骤 ━━━                  │
│                                     │
│  ┌─────────────────────────────┐  │
│  │ 1️⃣ 用青柠汁润湿杯沿，蘸盐  │  │
│  │    做盐边                    │  │
│  └─────────────────────────────┘  │
│                                     │
│  ┌─────────────────────────────┐  │
│  │ 2️⃣ 所有原料加冰摇和10秒    │  │
│  │    ⏱️ 00:10                 │  │ ← 带计时器
│  └─────────────────────────────┘  │
│                                     │
│  [ 🎯 开始制作 ]                   │ ← 主操作按钮
│                                     │
└─────────────────────────────────────┘
```

#### 设计要点
- **顶部图片**：全屏宽，1:1 或 16:9
- **浮动操作栏**：毛玻璃效果，固定在图片上方
- **卡片内容**：白色毛玻璃，16px 圆角
- **原料列表**：右侧显示拥有状态（✓/✗）
- **制作步骤**：序号 + 描述 + 计时器


### 8.3 我的酒柜页

#### 布局结构
```
┌─────────────────────────────────────┐
│ 我的酒柜                  [+ 添加]  │ ← 导航栏
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────────────────────┐  │
│  │ 🎯 能做什么                  │  │
│  │                              │  │
│  │ 基于你的库存，可以调制       │  │ ← 推荐卡片
│  │ 12 种鸡尾酒 →               │  │
│  └─────────────────────────────┘  │
│                                     │
│  ━━━ 已拥有原料 (15) ━━━           │
│                                     │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐     │
│  │ 🥃 │ │ 🍋 │ │ 🍊 │ │ 🟢 │     │
│  │特基│ │君度│ │柠檬│ │薄荷│     │ ← 网格布局
│  │拉  │ │    │ │汁  │ │叶  │     │
│  └────┘ └────┘ └────┘ └────┘     │
│                                     │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐     │
│  │ 🧊 │ │ 🍸 │ │ 🥂 │ │ 🍷 │     │
│  │冰块│ │伏特│ │香槟│ │红酒│     │
│  └────┘ └────┘ └────┘ └────┘     │
│                                     │
│  ━━━ 推荐添加 ━━━                  │
│                                     │
│  ┌─────────────────────────────┐  │
│  │ 🍊 君度                      │  │
│  │ 可解锁 8 种新配方       [+] │  │ ← 建议列表
│  └─────────────────────────────┘  │
│                                     │
│  ┌─────────────────────────────┐  │
│  │ 🟢 薄荷叶                    │  │
│  │ 可解锁 5 种新配方       [+] │  │
│  └─────────────────────────────┘  │
│                                     │
├─────────────────────────────────────┤
│ 🍸 发现  🔍 搜索  🧊 酒柜  👤 我的│
└─────────────────────────────────────┘
```

#### 设计要点
- **推荐卡片**：主色调橙色渐变，突出"能做什么"
- **原料网格**：4列布局，每个卡片 80×80px
- **原料图标**：48px，居中显示
- **推荐添加**：列表形式，显示可解锁配方数


### 8.4 搜索页

#### 布局结构
```
┌─────────────────────────────────────┐
│  ┌─────────────────────────────┐  │
│  │ 🔍 搜索鸡尾酒...      [取消]│  │ ← 大号搜索栏
│  └─────────────────────────────┘  │
│                                     │
│  ┌─────────────────────────────┐  │
│  │ 🎛️ 筛选                      │  │
│  │ [所有分类] [难度] [度数]    │  │ ← 筛选栏
│  └─────────────────────────────┘  │
│                                     │
│  ━━━ 搜索历史 ━━━                  │
│                                     │
│  [×] 莫吉托                         │
│  [×] 玛格丽特                       │ ← 历史记录
│  [×] 马提尼                         │
│                                     │
│  ━━━ 热门搜索 ━━━                  │
│                                     │
│  [🔥] 长岛冰茶                      │
│  [🔥] Espresso Martini              │ ← 热门标签
│  [🔥] 血腥玛丽                      │
│                                     │
├─────────────────────────────────────┤
│ 🍸 发现  🔍 搜索  🧊 酒柜  👤 我的│
└─────────────────────────────────────┘
```

**搜索结果页**：
```
┌─────────────────────────────────────┐
│  ┌─────────────────────────────┐  │
│  │ 🔍 mojito           [取消]  │  │
│  └─────────────────────────────┘  │
│                                     │
│  找到 3 个结果                       │
│                                     │
│  ┌─────────────────────────────┐  │
│  │ [图] 莫吉托                  │  │
│  │      Mojito                  │  │
│  │      🌟 简单  🔥 10%        │  │
│  └─────────────────────────────┘  │
│                                     │
│  ┌─────────────────────────────┐  │
│  │ [图] 草莓莫吉托              │  │
│  │      Strawberry Mojito       │  │
│  └─────────────────────────────┘  │
│                                     │
└─────────────────────────────────────┘
```


### 8.5 个人中心页

#### 布局结构
```
┌─────────────────────────────────────┐
│                                     │
│       ┌────────┐                   │
│       │  头像  │                   │ ← 用户信息
│       └────────┘                   │
│       调酒爱好者                     │
│                                     │
│  ┌─────────────────────────────┐  │
│  │ 📊 我的数据                  │  │
│  │                              │  │
│  │  15        23        8       │  │ ← 数据卡片
│  │  已拥有    收藏      自创     │  │
│  └─────────────────────────────┘  │
│                                     │
│  ┌─────────────────────────────┐  │
│  │ ♥ 我的收藏              ›   │  │
│  └─────────────────────────────┘  │
│                                     │
│  ┌─────────────────────────────┐  │
│  │ 📝 我的配方              ›   │  │
│  └─────────────────────────────┘  │
│                                     │
│  ┌─────────────────────────────┐  │
│  │ 📊 口味偏好              ›   │  │ ← 功能列表
│  └─────────────────────────────┘  │
│                                     │
│  ┌─────────────────────────────┐  │
│  │ ⚙️ 设置                     ›   │  │
│  │   · 深色模式                 │  │
│  │   · 语言                     │  │
│  │   · 关于                     │  │
│  └─────────────────────────────┘  │
│                                     │
├─────────────────────────────────────┤
│ 🍸 发现  🔍 搜索  🧊 酒柜  👤 我的│
└─────────────────────────────────────┘
```

#### 设计要点
- **头像**：圆形，80×80px，居中
- **数据卡片**：横向三列均分，毛玻璃效果
- **列表项**：iOS 原生风格，右侧箭头

---

## 9. 动效规范

### 9.1 缓动曲线 (Easing)

```css
/* iOS 标准曲线 */
--ease-in-out: cubic-bezier(0.42, 0, 0.58, 1);
--ease-out: cubic-bezier(0, 0, 0.2, 1);
--ease-in: cubic-bezier(0.4, 0, 1, 1);

/* iOS 弹性曲线 */
--ease-spring: cubic-bezier(0.175, 0.885, 0.32, 1.275);
```


### 9.2 动画时长

```css
--duration-fast: 150ms;      /* 快速反馈(按钮按下) */
--duration-normal: 250ms;    /* 标准动画(卡片展开) */
--duration-slow: 350ms;      /* 慢速动画(页面切换) */
```

### 9.3 关键动画

#### 按钮点击
```css
.button:active {
  transform: scale(0.96);
  transition: transform 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}
```

#### 卡片hover
```css
.card {
  transition: all 0.25s cubic-bezier(0, 0, 0.2, 1);
}

.card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}
```

#### 页面切换 (React Router)
```css
.page-enter {
  opacity: 0;
  transform: translateX(100%);
}

.page-enter-active {
  opacity: 1;
  transform: translateX(0);
  transition: all 0.35s cubic-bezier(0.42, 0, 0.58, 1);
}

.page-exit {
  opacity: 1;
  transform: translateX(0);
}

.page-exit-active {
  opacity: 0;
  transform: translateX(-30%);
  transition: all 0.35s cubic-bezier(0.42, 0, 0.58, 1);
}
```

#### 模态框弹出
```css
.modal-backdrop {
  background: rgba(0, 0, 0, 0);
  transition: background 0.25s;
}

.modal-backdrop.show {
  background: rgba(0, 0, 0, 0.4);
}

.modal {
  transform: translateY(100%);
  transition: transform 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.modal.show {
  transform: translateY(0);
}
```


---

## 10. 深色模式 (Dark Mode)

### 10.1 色彩系统 (深色模式)

```css
/* 背景色 */
--bg-primary-dark: #000000;              /* 纯黑背景 */
--bg-secondary-dark: #1C1C1E;            /* 卡片背景 */
--bg-tertiary-dark: rgba(28,28,30,0.8);  /* 毛玻璃背景 */

/* 文字色 */
--text-primary-dark: #FFFFFF;            /* 主要文字 */
--text-secondary-dark: rgba(235,235,245,0.6);  /* 次要文字 */
--text-tertiary-dark: rgba(235,235,245,0.3);   /* 三级文字 */
--text-quaternary-dark: #8E8E93;         /* 占位符 */

/* 分割线 */
--divider-dark: rgba(84,84,88,0.6);
--border-dark: rgba(255,255,255,0.08);
```

### 10.2 毛玻璃效果 (深色模式)

```css
.glass-dark {
  background: rgba(28, 28, 30, 0.7);
  backdrop-filter: blur(20px) saturate(180%);
  border: 0.5px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.4);
}

.glass-tabbar-dark {
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(30px) saturate(180%);
  border-top: 0.5px solid rgba(255, 255, 255, 0.1);
}
```

### 10.3 自动切换

```css
/* CSS 变量自动切换 */
:root {
  --bg-primary: var(--bg-primary-light);
  --text-primary: var(--text-primary-light);
  /* ... 其他变量 */
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg-primary: var(--bg-primary-dark);
    --text-primary: var(--text-primary-dark);
    /* ... 其他变量 */
  }
}

/* 或者使用 data 属性手动切换 */
[data-theme="dark"] {
  --bg-primary: var(--bg-primary-dark);
  --text-primary: var(--text-primary-dark);
}
```

---

## 11. 响应式设计

### 11.1 断点

```css
/* 移动端优先 */
--breakpoint-sm: 375px;   /* iPhone SE */
--breakpoint-md: 390px;   /* iPhone 14 Pro */
--breakpoint-lg: 428px;   /* iPhone 14 Pro Max */
--breakpoint-xl: 768px;   /* iPad Mini */
--breakpoint-xxl: 1024px; /* iPad Pro */
```

### 11.2 适配策略

- **优先移动端**：设计以 390px 为基准
- **内容区域**：最大宽度 428px，超出居中显示
- **图片**：使用 `aspect-ratio` 保持比例
- **文字**：避免固定宽度，使用 `max-width`

---

## 附录：设计资源

### A. 设计工具推荐

- **Figma** — UI 设计、原型制作
- **SF Symbols App** — iOS 图标预览
- **ColorSlurp** — 取色工具
- **Principle** — 交互动效设计

### B. 参考资源

- [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)
- [SF Symbols](https://developer.apple.com/sf-symbols/)
- [iOS Design Resources](https://developer.apple.com/design/resources/)
- [Glassmorphism Generator](https://hype4.academy/tools/glassmorphism-generator)

### C. 字体资源

- [SF Pro Display/Text](https://developer.apple.com/fonts/) — Apple 官方
- [Inter](https://rsms.me/inter/) — 替代方案(Web)

---

*本设计系统为调酒 App 的视觉规范基础，所有组件和页面设计需遵循此规范。*

**设计版本**: 1.0 | **最后更新**: 2026-06-05
