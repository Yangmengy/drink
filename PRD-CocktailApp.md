# 调酒 App — 产品需求文档 & 技术选型分析

> Version: 2.0 | Date: 2026-06-05 | Author: AI + yangmengying  
> Changelog: 新增前后端分离规范、IPC 契约定义、工程化规范、测试策略

---

## 目录

1. [技术选型深度分析](#1-技术选型深度分析)
2. [最终技术栈](#2-最终技术栈)
3. [系统架构](#3-系统架构)
4. [功能需求](#4-功能需求)
5. [数据库设计](#5-数据库设计)
6. [项目结构](#6-项目结构)
7. [前后端分离规范](#7-前后端分离规范)
8. [工程化规范](#8-工程化规范)
9. [开发路线图](#9-开发路线图)

---

## 1. 技术选型深度分析

### 1.1 候选方案

| 方案 | 前端 | 后端 | 移动端方案 | 渲染方式 |
|------|------|------|-----------|---------|
| A: Tauri v2 + React | React 18 + TS | Rust | Tauri v2 原生 | WebView |
| B: Leptos 全栈 | Leptos (Rust WASM) | Rust | 实验性 | WASM + WebView |
| C: Dioxus 全栈 | Dioxus (Rust) | Rust | Tauri 底层 | 多渲染器 |

### 1.2 移动端成熟度（权重 35%）

**Tauri v2 ✅** (评分: 9/10)
- 官方正式支持 Android + iOS，有完整文档和示例
- `tauri-plugin-sql` / `tauri-plugin-shell` / `tauri-plugin-fs` 等插件生态丰富
- Android 端基于 Chromium WebView (Android 10+ 独立更新)
- iOS 端基于 WKWebView (硬件加速，性能优秀)
- 社区活跃，GitHub 95k+ stars，bug 修复快

**Leptos ❌** (评分: 3/10)
- 官方目前专注于 Web CSR/SSR，移动端依赖第三方
- 使用 `leptos-axum` 跑在服务端，无法做离线 App
- 无官方移动端打包方案，需自己折腾 WebView 封装
- 社区规模小，遇到移动端问题求助困难

**Dioxus ⚠️** (评分: 5/10)
- v0.6 通过 `dioxus-mobile` 底层复用 Tauri 做移动端
- 本质上是 Tauri + Dioxus 渲染器，多了一层抽象
- 移动端 UI 组件库几乎为零，需手写大量原生组件
- Dioxus 本身还在快速迭代，API breaking changes 频繁

> **结论：Tauri v2 是唯一真正可上生产环境的移动端方案。**

### 1.3 UI 生态 & 开发效率（权重 30%）

**Tauri + React ✅** (评分: 9/10)
- React 生态 == 全世界最大的前端生态
- 移动端组件库：TDesign Mobile、Ant Design Mobile、Vant、NutUI
- 动画库：Framer Motion、react-spring
- 手势库：react-use-gesture、hammer.js
- 状态管理：Zustand / Jotai
- React Native 开发者可快速迁移（JSX/TS 语法相通）
- 招人或交接成本低

**Dioxus / Leptos ❌** (评分: 2/10)
- 移动端 UI 组件 == 零。列表、下拉刷新、轮播、TabBar、搜索栏全都要手写
- Rust 前端开发者极少，招聘困难
- CSS-in-Rust 方案不成熟，无法复用主流 UI 库
- 无法使用 npm 生态的 300 万+ 包

### 1.4 性能分析（权重 25%）

#### "会不会卡？" — 场景化分析

| 场景 | Tauri+React | 原生 Compose/SwiftUI |
|------|------------|---------------------|
| 首页列表滚动 (<200条) | 60fps ✅ | 60fps |
| 搜索过滤 (本地 SQLite) | <50ms ✅ | <50ms |
| 图片加载 & 缓存 | Lazy load ✅ | 原生 |
| 页面切换动画 | CSS Transitions 60fps ✅ | 原生动画 |
| 复杂手势 (拖拽排序) | 可行，需调优 | 原生 |
| 相机扫条形码 | Tauri Plugin ✅ | 原生 |
| 3D 渲染 / 游戏 | ❌ 不适合 | ✅ |

**关键结论**：

> 调酒 App 是「内容展示型应用」—— 列表、搜索、表单、图片、文字。这些操作 WebView 完全胜任。Discord、VS Code (部分)、Slack 都使用 WebView，没人说它们卡。
>
> 真正需要担心的场景是：3D 游戏、AR、实时视频处理。调酒 App 不涉及这些。

#### Tauri v2 性能优化措施

1. **Rust 后端处理重计算** — 配方匹配、全文搜索、数据库查询全在 Rust 侧，不阻塞 UI 线程
2. **虚拟列表** — 配方库 >500 条时启用 `react-window` 虚拟滚动
3. **图片懒加载 + WebP 格式** — 减少带宽和渲染开销
4. **SQLite FTS5 全文索引** — 搜索速度毫秒级
5. **build 时预编译 Rust → native binary** — 运行时无 JIT 预热开销
6. **CSS `will-change` / `transform` 硬件加速** — 动画走 GPU 合成层

### 1.5 不可忽视的风险（权重 10%）

| 方案 | 核心风险 |
|------|---------|
| Tauri + React | WebView 兼容性差异（可通过 Tauri plugin 桥接原生能力兜底） |
| Leptos | 移动端无官方支持，可能明年才能用 |
| Dioxus | API 不稳定，移动端 UI 需从零搭建，时间不可控 |

---

## 2. 最终技术栈

```
┌─────────────────────────────────────────────────────┐
│                     前端 (React)                     │
│  React 18.3 · TypeScript 5.x · Vite 6               │
│  TDesign Mobile · Zustand · React Router 7           │
│  CSS Modules + PostCSS                                │
├─────────────────────────────────────────────────────┤
│                   Repository 抽象层                    │
│  RecipeRepository trait (本地 / 云端 双实现)            │
│  InventoryRepository trait                             │
├─────────────────────────────────────────────────────┤
│                   桥接层 (Tauri v2)                   │
│  @tauri-apps/api 2.x · tauri::command                │
│  IPC invoke() · Event System · State Management       │
├─────────────────────────────────────────────────────┤
│                   后端 (Rust)                         │
│  Rust 1.86+ · Serde · SQLx · tokio                   │
│  tantivy (全文搜索) · uuid · chrono                   │
├─────────────────────────────────────────────────────┤
│                   数据存储                            │
│  SQLite (via tauri-plugin-sql)                       │
│  同步字段: synced_at / deleted_at / version / device_id│
├─────────────────────────────────────────────────────┤
│                   目标平台                            │
│  Android (minSdk 26 · NDK r29 · arm64)               │
│  iOS (iOS 15+ · arm64 · Xcode 16)                    │
│  Desktop (macOS / Windows / Linux)                   │
└─────────────────────────────────────────────────────┘
```

### 2.1 依赖版本清单

| 组件 | 版本 | 用途 |
|------|------|------|
| Rust | 1.86+ | 后端语言 |
| Tauri CLI | 2.x | 项目脚手架 & 构建 |
| React | 18.3 | 前端 UI |
| TypeScript | 5.x | 前端类型安全 |
| Vite | 6.x | 前端构建 |
| TDesign Mobile React | latest | 移动端组件库 |
| Zustand | 5.x | 前端状态管理 |
| React Router | 7.x | 前端路由 |
| tauri-plugin-sql | 2.x | SQLite 存储 |
| sqlx | 0.8.x | Rust SQL 驱动 |
| serde | 1.x | Rust 序列化 |
| tantivy | 0.22 | 全文搜索引擎 |
| tokio | 1.x | Rust 异步运行时 |
| uuid | 1.x | 设备 ID / 记录 ID 生成 |
| chrono | 0.4.x | 时间戳处理 |

---

## 3. 系统架构

### 3.1 前后端分离架构说明

**本项目采用「物理前后端分离」模式**：

```
┌─────────────────────────────────────────────────────────┐
│                    前端层 (Frontend)                     │
│  语言: TypeScript + React                                │
│  运行环境: WebView (浏览器引擎)                           │
│  职责: UI 渲染、用户交互、状态管理、路由                   │
│  不可访问: 数据库、文件系统、系统 API                      │
└─────────────────────────────────────────────────────────┘
                    ↕ IPC (进程间通信 - JSON 序列化)
┌─────────────────────────────────────────────────────────┐
│                    后端层 (Backend)                      │
│  语言: Rust                                              │
│  运行环境: Native Binary (编译后的原生二进制)              │
│  职责: 业务逻辑、数据库操作、文件 I/O、系统调用            │
│  不负责: UI 渲染                                         │
└─────────────────────────────────────────────────────────┘
                    ↕ SQLite / File System
┌─────────────────────────────────────────────────────────┐
│                    数据层 (Data)                         │
│  SQLite + JSON 文件                                      │
└─────────────────────────────────────────────────────────┘
```

**关键特性**：
- ✅ **进程隔离**：前端和后端运行在不同进程/线程中
- ✅ **语言分离**：前端 TypeScript，后端 Rust，各自发挥语言优势
- ✅ **职责分离**：前端管 UI，后端管数据和业务逻辑
- ✅ **安全隔离**：前端无法直接操作数据库/文件（需通过后端授权）
- ⚠️ **非网络分离**：不是传统 HTTP API（是本地 IPC），但架构模式相同

**与传统 Web 前后端分离的对比**：

| 维度 | 传统 Web (HTTP API) | Tauri (IPC) |
|------|-------------------|-------------|
| 通信协议 | HTTP/HTTPS | 进程间消息队列 |
| 序列化格式 | JSON | JSON |
| 网络开销 | 有（延迟+带宽） | 无（< 1ms） |
| 部署方式 | 前端静态站 + 后端服务器 | 打包成单个 App |
| 调试方式 | 前后端分离调试 | `tauri dev` 同时启动 |
| 安全模型 | CORS + JWT Token | Capabilities 权限控制 |
| 可扩展性 | 后期可拆分微服务 | 后期可加云端 API |

### 3.2 分层架构

```
┌──────────────────────────────────────────────┐
│  Pages (pages/)                              │
│  ├── DiscoverPage     首页 (推荐/分类)        │
│  ├── SearchPage       搜索                    │
│  ├── RecipeDetailPage 配方详情                │
│  ├── MyBarPage        我的酒柜                │
│  ├── MakePage         制作指引                │
│  └── ProfilePage      个人中心                │
├──────────────────────────────────────────────┤
│  Components (components/)                    │
│  ├── CocktailCard     配方卡片               │
│  ├── IngredientTag    原料标签               │
│  ├── SearchBar        搜索栏                 │
│  ├── TabBar           底部导航               │
│  ├── RecipeStep       制作步骤               │
│  └── InventoryList    库存列表               │
├──────────────────────────────────────────────┤
│  Hooks / Stores                              │
│  ├── useRecipes()     配方数据 hook          │
│  ├── useSearch()      搜索 hook              │
│  └── useInventory()   库存 hook              │
├─────────────── IPC 边界 ────────────────────┤
│  Tauri Commands (src-tauri/src/commands/)    │
│  ├── recipes.rs       配方 CRUD + 搜索       │
│  ├── inventory.rs     库存管理               │
│  ├── recommend.rs     智能推荐引擎           │
│  └── ai.rs            AI 建议 (可选)         │
├──────────────────────────────────────────────┤
│  Business Logic (src-tauri/src/services/)    │
│  ├── recipe_service.rs   配方业务逻辑        │
│  ├── search_service.rs   搜索引擎           │
│  ├── recommend_service.rs 推荐算法          │
│  └── abv_calculator.rs   酒精度计算         │
├──────────────────────────────────────────────┤
│  Data (src-tauri/src/db/)                    │
│  ├── schema.rs        SQLite 表结构          │
│  ├── seed.rs          预置数据 (IBA 配方)    │
│  └── migrations/      数据库迁移             │
└──────────────────────────────────────────────┘
```

### 3.3 数据流详解

```
┌──────────────────────────────────────────────────────────────┐
│  1. 用户点击"搜索鸡尾酒"                                       │
└──────────────────┬───────────────────────────────────────────┘
                   ↓
┌──────────────────────────────────────────────────────────────┐
│  2. React Component (SearchPage.tsx)                         │
│     const results = await invoke<Recipe[]>(                  │
│       "search_recipes",                                      │
│       { query: "mojito", filters: {...} }                    │
│     )                                                        │
└──────────────────┬───────────────────────────────────────────┘
                   ↓ 序列化为 JSON
┌──────────────────────────────────────────────────────────────┐
│  3. Tauri IPC Bridge (前后端边界)                             │
│     - 消息队列传递                                            │
│     - 参数类型校验                                            │
│     - 权限检查 (capabilities)                                 │
└──────────────────┬───────────────────────────────────────────┘
                   ↓ 反序列化为 Rust struct
┌──────────────────────────────────────────────────────────────┐
│  4. Rust Command Handler (commands/recipes.rs)               │
│     #[tauri::command]                                        │
│     pub async fn search_recipes(                             │
│       args: SearchRecipesArgs                                │
│     ) -> Result<Vec<Recipe>, AppError> {                     │
│       recipe_service::search(&args).await                    │
│     }                                                        │
└──────────────────┬───────────────────────────────────────────┘
                   ↓
┌──────────────────────────────────────────────────────────────┐
│  5. Business Logic (services/search_service.rs)              │
│     - FTS5 全文搜索                                           │
│     - 过滤条件应用                                            │
│     - 结果排序和分页                                          │
└──────────────────┬───────────────────────────────────────────┘
                   ↓
┌──────────────────────────────────────────────────────────────┐
│  6. SQLite Database Query                                    │
│     SELECT * FROM recipes_fts WHERE recipes_fts MATCH ?      │
└──────────────────┬───────────────────────────────────────────┘
                   ↓ 返回 Vec<Recipe>
┌──────────────────────────────────────────────────────────────┐
│  7. Rust 返回 Result<Vec<Recipe>, AppError>                  │
└──────────────────┬───────────────────────────────────────────┘
                   ↓ 序列化为 JSON
┌──────────────────────────────────────────────────────────────┐
│  8. IPC Bridge 返回前端                                       │
└──────────────────┬───────────────────────────────────────────┘
                   ↓ 反序列化为 TypeScript 对象
┌──────────────────────────────────────────────────────────────┐
│  9. React 更新状态                                            │
│     setSearchResults(results)                                │
└──────────────────┬───────────────────────────────────────────┘
                   ↓
┌──────────────────────────────────────────────────────────────┐
│  10. UI 重新渲染                                              │
│      {results.map(recipe => <CocktailCard {...recipe} />)}  │
└──────────────────────────────────────────────────────────────┘
```

**性能开销分析**：
- IPC 通信：< 1ms
- SQLite FTS5 查询：10-50ms
- JSON 序列化/反序列化：< 5ms
- React 渲染：16ms (60fps)
- **总计：< 100ms**（用户无感知
    device_id: String,
}
impl RecipeRepository for LocalRecipeRepo { ... }

// src-tauri/src/repository/cloud.rs — Phase 2 加这个
pub struct CloudRecipeRepo {
    api_base: String,
    token: String,
    local: LocalRecipeRepo,  // 离线时降级到本地
}
impl RecipeRepository for CloudRecipeRepo { ... }
```

**TypeScript 侧 API 抽象：**

```typescript
// src/api/client.ts — 现在就建好，后期只改这个文件
const API_BASE = __TAURI__ ? '/api' : 'https://your-api.com';

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  // Phase 1: 直接调用 Tauri command
  // Phase 2: 注入 token、重试、离线队列
  if (__TAURI__) {
    return invoke(path.replace('/api/', ''), options?.body ? JSON.parse(options.body as string) : {});
  }
  const res = await fetch(`${API_BASE}${path}`, options);
  return res.json();
}
```

### 3.3 数据流

```
【Phase 1: 纯本地】
用户操作 → React Component
              ↓ invoke("get_recipes")
         Tauri IPC
              ↓
         LocalRecipeRepo.fetch()
              ↓
         SQLite (本地)
              ↓
         Result<Vec<Recipe>>
              ↓
         React State 更新 → UI 重渲染

【Phase 2: 加云同步（新增，原有逻辑不变）】
用户操作 → React Component
              ↓ invoke("sync_now")  // 新增同步命令
         Tauri IPC
              ↓
         SyncEngine.pull() + push()
              ↓
         Cloud API ←→ PostgreSQL
              ↓
         本地 SQLite 更新
              ↓
         React State 更新 → UI 重渲染
```

---

## 4. 功能需求

### 4.1 功能模块矩阵

#### M1 - 核心 MVP（第一个版本）

| ID | 功能 | 优先级 | 描述 |
|----|------|--------|------|
| F01 | 配方浏览 | P0 | 按分类浏览鸡尾酒配方，支持列表+卡片视图 |
| F02 | 配方详情 | P0 | 展示配方：原料、用量、步骤、图片、口感描述 |
| F03 | 搜索 | P0 | 按名称、原料、口味、度数搜索（FTS5 全文索引）|
| F04 | 筛选 | P0 | 按基酒、口味、难度、度数筛选 |
| F05 | 我的酒柜 | P0 | 管理用户已有原料库存 |
| F06 | 能做什么 | P0 | 基于库存推荐可调制的鸡尾酒 |
| F07 | 预置数据 | P0 | 内置 IBA 官方 77 款 + 经典配方 200+ 款 |
| F08 | 导出分享 | P0 | 导出配方 JSON / 生成分享链接 |

#### M2 - 进阶功能

| ID | 功能 | 优先级 | 描述 |
|----|------|--------|------|
| F09 | 制作指引 | P1 | 分步骤制作动画，计时器 |
| F10 | 收藏夹 | P1 | 收藏喜欢配方，自定义列表 |
| F11 | 缺原料清单 | P1 | 展示"差 X 种材料就能做的酒" |
| F12 | 酒精度计算 | P1 | 自动计算最终调酒的酒精度 |
| F13 | 自定义配方 | P1 | 用户创建自己的配方（本地存储）|
| F14 | 比例换算 | P1 | 从 1 杯 → N 杯自动换算 |
| F15 | 深色模式 | P1 | 暗黑主题（酒吧环境友好）|

#### M3 - 云同步 & 社区（Phase 2）

| ID | 功能 | 优先级 | 描述 |
|----|------|--------|------|
| F16 | 用户注册/登录 | P2 | 手机号 / 微信登录 |
| F17 | 云同步库存 | P2 | 跨设备同步酒柜和收藏 |
| F18 | 云同步自定义配方 | P2 | 自定义配方多端同步 |
| F19 | 社区配方浏览 | P2 | 浏览他人分享的配方 |
| F20 | 发布配方到社区 | P2 | 上传自定义配方到云端 |
| F21 | 点赞/收藏社区配方 | P2 | 社区互动 |

#### M4 - 智能功能（Phase 3）

| ID | 功能 | 优先级 | 描述 |
|----|------|--------|------|
| F22 | AI 推荐 | P3 | 基于口味偏好+天气+时间智能推荐 |
| F23 | 口味画像 | P3 | 分析用户历史记录，建立口味偏好模型 |
| F24 | 拍照识别原料 | P3 | 拍酒瓶自动识别原料（ML Kit）|
| F25 | i18n | P3 | 中/英双语 |

### 4.2 核心页面

```
TabBar (底部3个Tab)
├── 🍸 发现 (Discover)
│   ├── 搜索栏
│   ├── 分类标签 (经典/热带/短饮/长饮/无酒精...)
│   ├── AI推荐卡片（Phase 3）
│   └── 配方瀑布流
├── 🧊 酒柜 (MyBar)
│   ├── 已拥有原料网格
│   ├── 添加原料
│   ├── "能做什么"按钮
│   ├── 缺原料清单
│   └── 云同步开关（Phase 2）
└── 👤 我的 (Profile)
    ├── 收藏配方
    ├── 自定义配方
    ├── 口味偏好设置
    ├── 深色模式切换
    └── 关于/同步状态
```

---

## 5. 数据库设计

### 5.1 ER 图核心实体（同步就绪版）

> **设计原则**：现在就加同步字段，后期不用改表结构。所有删除用软删除。

```sql
-- 配方表（含同步字段）
CREATE TABLE recipes (
    id            TEXT PRIMARY KEY,      -- UUID (本地生成)
    server_id     TEXT DEFAULT NULL,     -- 云端 ID（同步后回填）
    name_zh       TEXT NOT NULL,
    name_en       TEXT,
    category      TEXT,                  -- classic/tropical/short/long/mocktail
    glass_type    TEXT,                  -- martini/highball/coupe/rocks...
    method        TEXT,                  -- shake/stir/build/blend
    difficulty    INTEGER DEFAULT 1,      -- 难度 1-5
    abv           REAL,                  -- 酒精度 %
    description   TEXT,
    story         TEXT,
    image_url     TEXT,
    steps         JSON NOT NULL,         -- [{order, text, duration_sec}]
    is_custom     BOOLEAN DEFAULT 0,     -- 是否用户自定义
    is_public     BOOLEAN DEFAULT 0,     -- 是否发布到社区（Phase 2）
    -- 同步字段
    device_id     TEXT NOT NULL,         -- 创建设备 ID
    version       INTEGER DEFAULT 1,      -- 版本号（冲突解决）
    synced_at     TEXT DEFAULT NULL,      -- 上次同步时间（NULL=未同步）
    deleted_at    TEXT DEFAULT NULL,      -- 软删除（同步用）
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL,
    CONSTRAINT unique_server_id UNIQUE (server_id)
);

-- 原料表
CREATE TABLE ingredients (
    id          TEXT PRIMARY KEY,
    name_zh     TEXT NOT NULL,
    name_en     TEXT,
    category    TEXT,                   -- spirit/liqueur/mixer/syrup/garnish/ice
    abv         REAL,
    unit        TEXT DEFAULT 'ml',
    color       TEXT,
    description TEXT
);

-- 配方-原料关联
CREATE TABLE recipe_ingredients (
    recipe_id     TEXT NOT NULL REFERENCES recipes(id),
    ingredient_id TEXT NOT NULL REFERENCES ingredients(id),
    amount        REAL NOT NULL,
    unit          TEXT NOT NULL,
    is_optional   BOOLEAN DEFAULT 0,
    note          TEXT,
    PRIMARY KEY (recipe_id, ingredient_id)
);

-- 用户库存
CREATE TABLE inventory (
    ingredient_id TEXT PRIMARY KEY REFERENCES ingredients(id),
    owned         BOOLEAN NOT NULL DEFAULT 1,
    amount_ml     REAL,
    -- 同步字段
    device_id     TEXT NOT NULL,
    synced_at     TEXT DEFAULT NULL,
    deleted_at    TEXT DEFAULT NULL,
    added_at      TEXT NOT NULL,
    updated_at    TEXT NOT NULL
);

-- 收藏表
CREATE TABLE favorites (
    recipe_id   TEXT PRIMARY KEY REFERENCES recipes(id),
    -- 同步字段
    device_id   TEXT NOT NULL,
    synced_at   TEXT DEFAULT NULL,
    deleted_at  TEXT DEFAULT NULL,
    added_at    TEXT NOT NULL
);

-- 用户自定义配方（本地，同步到云端后转 recipes 表）
CREATE TABLE custom_recipes (
    id          TEXT PRIMARY KEY,
    recipe_id   TEXT REFERENCES recipes(id),  -- 对应 recipes 表 ID
    -- 同步字段
    server_id   TEXT DEFAULT NULL,
    device_id   TEXT NOT NULL,
    synced_at   TEXT DEFAULT NULL,
    deleted_at  TEXT DEFAULT NULL,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

-- 同步状态表（记录每次同步的 checkpoint）
CREATE TABLE sync_state (
    id            INTEGER PRIMARY KEY,
    device_id     TEXT NOT NULL,
    last_sync_at  TEXT,
    server_cursor TEXT,      -- 云端分页游标
    sync_status   TEXT DEFAULT 'idle',  -- idle/syncing/error
    error_msg     TEXT
);

-- 设备信息表
CREATE TABLE device_info (
    device_id    TEXT PRIMARY KEY,
    device_name  TEXT,
    platform     TEXT,         -- android/ios/macos/windows
    created_at   TEXT NOT NULL
);

-- 全文搜索 (FTS5)
CREATE VIRTUAL TABLE recipes_fts USING fts5(
    name_zh, name_en, description, story,
    content='recipes',
    content_rowid='rowid'
);

-- 同步触发器：本地数据变更时清除 synced_at，标记为"待同步"
CREATE TRIGGER recipes_mark_unsynced 
AFTER UPDATE ON recipes 
BEGIN
    UPDATE recipes SET synced_at = NULL WHERE id = NEW.id;
END;
```

### 5.2 同步字段说明

| 字段 | 用途 | 说明 |
|------|------|------|
| `server_id` | 云端主键 | 新建时为 NULL，首次同步后回填云端 ID |
| `device_id` | 设备标识 | 用 `uuid v4` 生成，存在 `device_info` 表 |
| `version` | 冲突解决 | 每次本地修改 +1，同步时以高 version 为准 |
| `synced_at` | 同步标记 | NULL=待同步，非 NULL=已同步（存 ISO8601）|
| `deleted_at` | 软删除 | NULL=未删除，非 NULL=删除时间（同步前不物理删除）|

### 5.3 预置数据来源

| 来源 | 数量 | 说明 |
|------|------|------|
| IBA Official Cocktails | 77 款 | 国际调酒师协会官方配方 |
| IBA Unforgettables | 33 款 | 经典永流传系列 |
| IBA Contemporary Classics | 31 款 | 当代经典 |
| IBA New Era Drinks | 13 款 | 新时代饮品 |
| 补充流行配方 | ~200 款 | Cosmopolitan, Espresso Martini 等 |

---

## 6. 项目结构

```
drink/
├── src/                                 # React 前端
│   ├── main.tsx                        # 入口
│   ├── App.tsx                         # 根组件 + TDesign 主题
│   ├── routes.tsx                      # React Router 7 路由配置
│   ├── pages/
│   │   ├── DiscoverPage.tsx            # 发现/首页
│   │   ├── RecipeDetailPage.tsx        # 配方详情
│   │   ├── SearchPage.tsx             # 搜索页
│   │   ├── MyBarPage.tsx              # 我的酒柜
│   │   ├── MakePage.tsx               # 制作指引
│   │   └── ProfilePage.tsx            # 个人中心
│   ├── components/
│   │   ├── CocktailCard.tsx            # 配方卡片
│   │   ├── IngredientTag.tsx           # 原料标签
│   │   ├── SearchBar.tsx              # 搜索栏
│   │   ├── TabBar.tsx                 # 底部导航
│   │   ├── RecipeStep.tsx             # 制作步骤
│   │   ├── InventoryGrid.tsx          # 库存网格
│   │   └── SyncStatusBadge.tsx       # 同步状态指示器 (Phase 2)
│   ├── hooks/
│   │   ├── useRecipes.ts              # 配方数据 hook（离线优先）
│   │   ├── useSearch.ts               # 搜索 hook
│   │   ├── useInventory.ts            # 库存 hook
│   │   └── useSync.ts                 # 同步状态 hook (Phase 2)
│   ├── stores/
│   │   ├── recipeStore.ts             # Zustand - 配方
│   │   ├── inventoryStore.ts          # Zustand - 库存
│   │   └── syncStore.ts              # Zustand - 同步状态 (Phase 2)
│   ├── api/
│   │   ├── client.ts                  # API 抽象层（关键！）
│   │   ├── recipes.ts                 # 配方 API
│   │   ├── inventory.ts               # 库存 API
│   │   └── sync.ts                   # 同步 API (Phase 2)
│   ├── types/
│   │   └── index.ts                   # TypeScript 类型定义
│   └── styles/
│       ├── global.css
│       └── variables.css               # CSS 变量（支持深色模式）
├── src-tauri/                           # Tauri + Rust 后端
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── capabilities/
│   │   └── default.json
│   ├── src/
│   │   ├── main.rs                    # Tauri 入口
│   │   ├── lib.rs                     # 库入口
│   │   ├── commands/
│   │   │   ├── mod.rs
│   │   │   ├── recipes.rs            # #[tauri::command] 配方 CRUD
│   │   │   ├── inventory.rs          # 库存操作
│   │   │   ├── recommend.rs         # 推荐引擎
│   │   │   ├── sync.rs               # ⭐ 同步命令（Phase 2）
│   │   │   └── auth.rs               # ⭐ 用户认证（Phase 2）
│   │   ├── repository/               # ⭐ Repository 抽象层
│   │   │   ├── mod.rs
│   │   │   ├── trait.rs              # RecipeRepository trait
│   │   │   ├── local.rs              # 本地 SQLite 实现
│   │   │   └── cloud.rs              # 云端 API 实现（Phase 2）
│   │   ├── sync/                     # ⭐ 同步引擎（Phase 2）
│   │   │   ├── mod.rs
│   │   │   ├── engine.rs             # 增量同步逻辑
│   │   │   ├── conflict.rs           # 冲突解决策略（Last Write Wins）
│   │   │   └── push.rs               # 推送本地变更
│   │   ├── db/
│   │   │   ├── mod.rs
│   │   │   ├── schema.rs             # SQL 建表（含同步字段）
│   │   │   ├── seed.rs               # 预置数据
│   │   │   └── migrations/           # 数据库迁移
│   │   ├── models/
│   │   │   ├── mod.rs
│   │   │   ├── recipe.rs             # Recipe 结构体
│   │   │   └── ingredient.rs         # Ingredient 结构体
│   │   ├── auth/                     # ⭐ 认证模块（Phase 2）
│   │   │   ├── mod.rs
│   │   │   └── jwt.rs
│   │   └── utils/
│   │       ├── mod.rs
│   │       ├── search.rs             # FTS5 搜索
│   │       ├── abv.rs                # 酒精度计算
│   │       └── device_id.rs          # 设备 ID 生成 & 存储
│   ├── icons/                         # App 图标
│   └── gen/                           # Tauri 生成文件
├── server/                              # ⭐ 云端后端（Phase 2）
│   ├── Cargo.toml
│   ├── src/
│   │   ├── main.rs                    # Axum 服务入口
│   │   ├── routes/
│   │   │   ├── mod.rs
│   │   │   ├── recipes.rs            # 配方 CRUD API
│   │   │   ├── sync.rs               # 同步 API（增量拉取/推送）
│   │   │   └── auth.rs               # 认证 API
│   │   ├── db/
│   │   │   ├── mod.rs
│   │   │   └── postgres.rs           # PostgreSQL 操作
│   │   └── models/
│   │       └── sync_payload.rs        # 同步载荷结构体
│   └── Dockerfile
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── PRD-CocktailApp.md                 # 本文档
└── .gitignore
```

---

## 7. 前后端分离规范

### 7.1 前后端职责边界

#### 前端职责 (React + TypeScript)

| 职责类型 | 具体内容 | 禁止操作 |
|---------|---------|---------|
| **UI 渲染** | 组件渲染、样式、动画、手势 | ❌ 不直接操作数据库 |
| **用户交互** | 点击、滑动、输入、表单验证 | ❌ 不访问文件系统 |
| **状态管理** | UI 状态、缓存、临时数据 | ❌ 不做复杂业务计算 |
| **路由管理** | 页面跳转、参数传递 | ❌ 不调用系统 API |
| **数据获取** | 通过 `invoke()` 调用后端命令 | ❌ 不直接发 HTTP 请求（除非用 Tauri 插件） |
| **轻量计算** | UI 展示用的简单过滤、排序 | ❌ 不做全文搜索、推荐算法 |

#### 后端职责 (Rust)

| 职责类型 | 具体内容 | 禁止操作 |
|---------|---------|---------|
| **数据持久化** | SQLite CRUD、事务管理 | ❌ 不渲染 UI |
| **业务逻辑** | 配方匹配、推荐算法、酒精度计算 | ❌ 不处理 CSS/动画 |
| **全文搜索** | FTS5 索引、搜索排序 | ❌ 不管理 React 状态 |
| **文件操作** | 图片读写、配置文件、日志 | ❌ 不处理用户点击事件 |
| **系统调用** | 权限申请、通知、后台任务 | ❌ 不构建 DOM |
| **数据校验** | 参数验证、业务规则校验 | ❌ 不直接操作 WebView |

### 7.2 IPC 接口契约规范

#### TypeScript 侧定义

```typescript
// src/types/commands.ts (前端)

/**
 * 所有 Tauri 命令的统一返回格式
 */
export type CommandResult<T> = 
  | { success: true; data: T }
  | { success: false; error: CommandError };

export interface CommandError {
  code: string;           // 错误码: "DB_ERROR" | "NOT_FOUND" | "INVALID_ARGS"
  message: string;        // 用户友好的错误信息
  details?: string;       // 技术细节（可选，调试用）
}

// ============ 配方相关 ============

export interface Recipe {
  id: string;
  name_zh: string;
  name_en: string | null;
  category: RecipeCategory;
  glass_type: string;
  method: MakeMethod;
  difficulty: number;        // 1-5
  abv: number | null;        // 酒精度百分比
  description: string;
  story: string | null;
  image_url: string | null;
  steps: RecipeStep[];
  ingredients: RecipeIngredient[];
  created_at: string;        // ISO 8601
  updated_at: string;
}

export type RecipeCategory = 
  | "classic" | "contemporary" | "tropical" 
  | "short" | "long" | "mocktail";

export type MakeMethod = "shake" | "stir" | "build" | "blend";

export interface RecipeStep {
  order: number;
  text: string;
  duration_sec: number;
}

export interface RecipeIngredient {
  ingredient_id: string;
  name_zh: string;
  amount: number;
  unit: string;              // "ml" | "dash" | "slice" | "piece"
  is_optional: boolean;
  note: string | null;
}

// 搜索参数
export interface SearchRecipesArgs {
  query?: string;            // 关键词
  filters?: RecipeFilters;
  limit?: number;            // 默认 50
  offset?: number;           // 分页偏移
}

export interface RecipeFilters {
  categories?: RecipeCategory[];
  methods?: MakeMethod[];
  difficulty_max?: number;
  abv_range?: [number, number];  // [min, max]
  owned_only?: boolean;          // 只看能做的
}

// ============ 库存相关 ============

export interface Ingredient {
  id: string;
  name_zh: string;
  name_en: string | null;
  category: IngredientCategory;
  abv: number;
  unit: string;
  color: string | null;
  description: string | null;
}

export type IngredientCategory = 
  | "spirit" | "liqueur" | "mixer" 
  | "syrup" | "garnish" | "ice";

export interface InventoryItem {
  ingredient_id: string;
  ingredient: Ingredient;
  owned: boolean;
  amount_ml: number | null;
  added_at: string;
  updated_at: string;
}

export interface AddToInventoryArgs {
  ingredient_id: string;
  amount_ml?: number;
}

// ============ 推荐相关 ============

export interface RecommendArgs {
  based_on?: "inventory" | "favorites" | "taste_profile";
  limit?: number;
}

export interface RecommendedRecipe {
  recipe: Recipe;
  match_score: number;       // 0-100
  missing_ingredients: string[];
  reason: string;            // "你拥有所有原料" | "只差 1 种原料"
}
```

#### Rust 侧定义

```rust
// src-tauri/src/types/mod.rs (后端)

use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

/// 统一错误类型
#[derive(Debug, Serialize)]
pub struct AppError {
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<String>,
}

impl AppError {
    pub fn not_found(msg: &str) -> Self {
        Self {
            code: "NOT_FOUND".to_string(),
            message: msg.to_string(),
            details: None,
        }
    }

    pub fn db_error(e: sqlx::Error) -> Self {
        Self {
            code: "DB_ERROR".to_string(),
            message: "数据库操作失败".to_string(),
            details: Some(e.to_string()),
        }
    }

    pub fn invalid_args(msg: &str) -> Self {
        Self {
            code: "INVALID_ARGS".to_string(),
            message: msg.to_string(),
            details: None,
        }
    }
}

/// 统一返回格式
#[derive(Serialize)]
#[serde(untagged)]
pub enum CommandResult<T> {
    Success { success: bool, data: T },
    Error { success: bool, error: AppError },
}

impl<T> CommandResult<T> {
    pub fn ok(data: T) -> Self {
        Self::Success { success: true, data }
    }

    pub fn err(error: AppError) -> Self {
        Self::Error { success: false, error }
    }
}

// ============ 配方相关 ============

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Recipe {
    pub id: String,
    pub name_zh: String,
    pub name_en: Option<String>,
    pub category: RecipeCategory,
    pub glass_type: String,
    pub method: MakeMethod,
    pub difficulty: i32,
    pub abv: Option<f64>,
    pub description: String,
    pub story: Option<String>,
    pub image_url: Option<String>,
    #[sqlx(json)]
    pub steps: Vec<RecipeStep>,
    #[sqlx(skip)]  // 需要 JOIN 查询
    pub ingredients: Vec<RecipeIngredient>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "TEXT")]
#[serde(rename_all = "snake_case")]
pub enum RecipeCategory {
    Classic,
    Contemporary,
    Tropical,
    Short,
    Long,
    Mocktail,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecipeStep {
    pub order: u32,
    pub text: String,
    pub duration_sec: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecipeIngredient {
    pub ingredient_id: String,
    pub name_zh: String,
    pub amount: f64,
    pub unit: String,
    pub is_optional: bool,
    pub note: Option<String>,
}

// 搜索参数
#[derive(Debug, Deserialize)]
pub struct SearchRecipesArgs {
    pub query: Option<String>,
    pub filters: Option<RecipeFilters>,
    #[serde(default = "default_limit")]
    pub limit: u32,
    #[serde(default)]
    pub offset: u32,
}

fn default_limit() -> u32 { 50 }

#[derive(Debug, Deserialize)]
pub struct RecipeFilters {
    pub categories: Option<Vec<RecipeCategory>>,
    pub methods: Option<Vec<MakeMethod>>,
    pub difficulty_max: Option<i32>,
    pub abv_range: Option<(f64, f64)>,
    pub owned_only: Option<bool>,
}

// ============ Command 函数示例 ============

// src-tauri/src/commands/recipes.rs
use crate::types::*;

#[tauri::command]
pub async fn search_recipes(
    args: SearchRecipesArgs,
    state: tauri::State<'_, AppState>,
) -> Result<CommandResult<Vec<Recipe>>, String> {
    match state.recipe_service.search(&args).await {
        Ok(recipes) => Ok(CommandResult::ok(recipes)),
        Err(e) => Ok(CommandResult::err(AppError::db_error(e))),
    }
}

#[tauri::command]
pub async fn get_recipe_by_id(
    id: String,
    state: tauri::State<'_, AppState>,
) -> Result<CommandResult<Recipe>, String> {
    match state.recipe_service.get_by_id(&id).await {
        Ok(Some(recipe)) => Ok(CommandResult::ok(recipe)),
        Ok(None) => Ok(CommandResult::err(
            AppError::not_found(&format!("配方 {} 不存在", id))
        )),
        Err(e) => Ok(CommandResult::err(AppError::db_error(e))),
    }
}
```

### 7.3 前端调用规范

#### 封装统一调用函数

```typescript
// src/lib/tauri.ts

import { invoke as tauriInvoke } from '@tauri-apps/api/core';
import type { CommandResult, CommandError } from '@/types/commands';

/**
 * 封装 Tauri invoke，统一处理错误
 */
export async function invoke<T>(
  command: string,
  args?: Record<string, unknown>
): Promise<T> {
  try {
    const result = await tauriInvoke<CommandResult<T>>(command, args);
    
    if (!result.success) {
      const error = (result as any).error as CommandError;
      
      // 统一错误处理
      switch (error.code) {
        case 'NOT_FOUND':
          throw new NotFoundError(error.message);
        case 'DB_ERROR':
          throw new DatabaseError(error.message, error.details);
        case 'INVALID_ARGS':
          throw new ValidationError(error.message);
        default:
          throw new AppError(error.code, error.message);
      }
    }
    
    return (result as any).data;
  } catch (e) {
    // Tauri 层面的错误（IPC 失败等）
    if (e instanceof Error && e.message.includes('invoke')) {
      console.error('[Tauri IPC Error]', e);
      throw new IPCError('与后端通信失败');
    }
    throw e;
  }
}

// 自定义错误类型
export class AppError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super('NOT_FOUND', message);
    this.name = 'NotFoundError';
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, public details?: string) {
    super('DB_ERROR', message);
    this.name = 'DatabaseError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super('INVALID_ARGS', message);
    this.name = 'ValidationError';
  }
}

export class IPCError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IPCError';
  }
}
```

#### 使用示例

```typescript
// src/hooks/useRecipes.ts

import { invoke } from '@/lib/tauri';
import type { Recipe, SearchRecipesArgs } from '@/types/commands';
import { useQuery } from '@tanstack/react-query';

export function useSearchRecipes(args: SearchRecipesArgs) {
  return useQuery({
    queryKey: ['recipes', 'search', args],
    queryFn: () => invoke<Recipe[]>('search_recipes', args),
    staleTime: 5 * 60 * 1000, // 5 分钟内不重新请求
  });
}

export function useRecipeDetail(id: string) {
  return useQuery({
    queryKey: ['recipes', id],
    queryFn: () => invoke<Recipe>('get_recipe_by_id', { id }),
    enabled: !!id,
  });
}

// ============ 组件中使用 ============

// src/pages/SearchPage.tsx
import { useSearchRecipes } from '@/hooks/useRecipes';

export function SearchPage() {
  const [query, setQuery] = useState('');
  const { data: recipes, isLoading, error } = useSearchRecipes({ 
    query,
    filters: { owned_only: true },
  });

  if (isLoading) return <Loading />;
  if (error) return <ErrorView error={error} />;
  
  return (
    <div>
      {recipes?.map(recipe => (
        <CocktailCard key={recipe.id} recipe={recipe} />
      ))}
    </div>
  );
}
```

### 7.4 数据流方向规则

```
✅ 允许的数据流：
  前端 → invoke() → 后端 → 数据库 ✓
  数据库 → 后端 → IPC → 前端 ✓
  前端 → Zustand → 前端组件 ✓

❌ 禁止的数据流：
  前端 → 直接访问 SQLite ✗
  前端 → 直接读写文件 ✗
  后端 → 直接操作 DOM ✗
  后端 → 修改 React 状态 ✗
```

### 7.5 缓存策略

| 数据类型 | 缓存位置 | 缓存时长 | 更新策略 |
|---------|---------|---------|---------|
| 配方列表 | TanStack Query | 5 分钟 | 后台自动刷新 |
| 配方详情 | TanStack Query | 10 分钟 | 用户手动刷新 |
| 用户库存 | Zustand + SQLite | 永久 | 立即写入后端 |
| 搜索结果 | TanStack Query | 2 分钟 | 参数变化时重新请求 |
| 用户配置 | Zustand | 永久 | 变更时写入 JSON |

---

## 8. 工程化规范

### 8.1 状态管理策略

| 状态类型 | 方案 | 示例 | 为什么 |
|---------|------|------|--------|
| **UI 临时状态** | React useState | 弹窗开关、表单输入、动画状态 | 局部使用，无需共享 |
| **全局 UI 状态** | Zustand | 主题、语言、底栏显隐 | 跨页面共享，但不需要持久化 |
| **服务端数据** | TanStack Query | 配方、原料、搜索结果 | 需要缓存、重新验证、后台刷新 |
| **持久化配置** | Zustand + persist | 用户偏好、收藏列表 | 需要跨会话保存 |
| **表单状态** | React Hook Form | 自定义配方表单 | 复杂校验、性能优化 |

```typescript
// src/stores/uiStore.ts (全局 UI 状态)
import { create } from 'zustand';

interface UIStore {
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  showTabBar: boolean;
  setShowTabBar: (show: boolean) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  theme: 'light',
  setTheme: (theme) => set({ theme }),
  showTabBar: true,
  setShowTabBar: (show) => set({ showTabBar: show }),
}));

// src/stores/inventoryStore.ts (持久化状态)
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface InventoryStore {
  ownedIngredients: Set<string>;
  addIngredient: (id: string) => void;
  removeIngredient: (id: string) => void;
}

export const useInventoryStore = create<InventoryStore>()(
  persist(
    (set) => ({
      ownedIngredients: new Set(),
      addIngredient: (id) => set((state) => ({
        ownedIngredients: new Set(state.ownedIngredients).add(id)
      })),
      removeIngredient: (id) => {
        return set((state) => {
          const next = new Set(state.ownedIngredients);
          next.delete(id);
          return { ownedIngredients: next };
        });
      },
    }),
    { name: 'inventory-storage' }
  )
);
```

### 8.2 错误处理规范

#### 后端错误分类

```rust
// src-tauri/src/types/error.rs

#[derive(Debug)]
pub enum AppError {
    // 数据库错误
    DatabaseError(sqlx::Error),
    
    // 业务逻辑错误
    NotFound(String),
    AlreadyExists(String),
    InvalidInput(String),
    
    // 系统错误
    IOError(std::io::Error),
    SerializationError(serde_json::Error),
    
    // 外部服务错误（未来可能有）
    NetworkError(String),
}

impl From<AppError> for CommandResult<()> {
    fn from(e: AppError) -> Self {
        let (code, message, details) = match e {
            AppError::DatabaseError(e) => (
                "DB_ERROR",
                "数据库操作失败",
                Some(e.to_string())
            ),
            AppError::NotFound(msg) => (
                "NOT_FOUND",
                &msg,
                None
            ),
            AppError::InvalidInput(msg) => (
                "INVALID_ARGS",
                &msg,
                None
            ),
            // ... 其他映射
        };
        
        CommandResult::err(AppError {
            code: code.to_string(),
            message: message.to_string(),
            details,
        })
    }
}
```

#### 前端错误展示

```typescript
// src/components/ErrorBoundary.tsx

import { toast } from '@/components/ui/toast';

export function handleError(error: unknown) {
  if (error instanceof NotFoundError) {
    toast.warning(error.message);
  } else if (error instanceof DatabaseError) {
    toast.error('数据加载失败，请重试');
    console.error('[DB Error]', error.details);
  } else if (error instanceof ValidationError) {
    toast.error(error.message);
  } else if (error instanceof IPCError) {
    toast.error('网络异常，请检查连接');
  } else {
    toast.error('发生未知错误');
    console.error('[Unknown Error]', error);
  }
}
```

### 8.3 测试策略

#### 测试金字塔

```
        ┌─────────────┐
        │   E2E (10%)  │  Playwright 测试关键流程
        │  ~10 个测试   │  
        ├─────────────┤
        │ 集成 (20%)   │  Tauri Command 测试
        │ ~30 个测试   │  前后端联调
        ├─────────────┤
        │ 单元 (70%)   │  Rust 业务逻辑 + React 组件
        │ ~100 个测试  │  
        └─────────────┘
```

#### Rust 单元测试

```rust
// src-tauri/src/services/recipe_service.rs

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_search_by_name() {
        let service = RecipeService::new_test().await;
        let results = service.search(&SearchRecipesArgs {
            query: Some("mojito".to_string()),
            ..Default::default()
        }).await.unwrap();
        
        assert!(!results.is_empty());
        assert!(results[0].name_en.as_ref().unwrap().contains("Mojito"));
    }

    #[tokio::test]
    async fn test_get_nonexistent_recipe() {
        let service = RecipeService::new_test().await;
        let result = service.get_by_id("nonexistent").await.unwrap();
        assert!(result.is_none());
    }
}
```

#### React 组件测试

```typescript
// src/components/CocktailCard.test.tsx

import { render, screen } from '@testing-library/react';
import { CocktailCard } from './CocktailCard';

describe('CocktailCard', () => {
  const mockRecipe: Recipe = {
    id: '1',
    name_zh: '莫吉托',
    difficulty: 2,
    abv: 15,
    // ...
  };

  it('renders recipe name', () => {
    render(<CocktailCard recipe={mockRecipe} />);
    expect(screen.getByText('莫吉托')).toBeInTheDocument();
  });

  it('shows difficulty stars', () => {
    render(<CocktailCard recipe={mockRecipe} />);
    const stars = screen.getAllByTestId('difficulty-star');
    expect(stars).toHaveLength(2);
  });
});
```

#### E2E 测试

```typescript
// tests/e2e/search.spec.ts

import { test, expect } from '@playwright/test';

test('search and view recipe', async ({ page }) => {
  await page.goto('http://localhost:1420');
  
  // 搜索配方
  await page.fill('[data-testid="search-input"]', 'mojito');
  await page.click('[data-testid="search-button"]');
  
  // 等待结果
  await expect(page.locator('.cocktail-card')).toBeVisible();
  
  // 点击第一个结果
  await page.click('.cocktail-card:first-child');
  
  // 验证详情页
  await expect(page).toHaveURL(/\/recipe\/.+/);
  await expect(page.locator('h1')).toContainText('莫吉托');
});
```

### 8.4 性能监控

#### 关键指标

| 指标 | 目标 | 监控方式 |
|------|------|---------|
| IPC 调用延迟 | < 50ms | 自定义日志 |
| SQLite 查询 | < 100ms | sqlx 日志 |
| 首屏渲染 | < 2s | Lighthouse |
| 列表滚动 FPS | ≥ 55fps | React DevTools Profiler |
| 内存占用 | < 200MB | Tauri 内置监控 |

#### 埋点代码

```typescript
// src/lib/performance.ts

export async function measureCommand<T>(
  name: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = performance.now();
  try {
    const result = await fn();
    const duration = performance.now() - start;
    
    if (duration > 100) {
      console.warn(`[Slow Command] ${name} took ${duration.toFixed(2)}ms`);
    }
    
    // 发送到监控系统（可选）
    // sendMetric('command_duration', duration, { command: name });
    
    return result;
  } catch (e) {
    const duration = performance.now() - start;
    console.error(`[Command Failed] ${name} after ${duration.toFixed(2)}ms`, e);
    throw e;
  }
}

// 使用
export async function searchRecipes(args: SearchRecipesArgs) {
  return measureCommand('search_recipes', () =>
    invoke<Recipe[]>('search_recipes', args)
  );
}
```

### 8.5 代码规范

#### 命名约定

| 类型 | 规范 | 示例 |
|------|------|------|
| React 组件 | PascalCase | `CocktailCard.tsx` |
| Hooks | camelCase + use 前缀 | `useRecipes.ts` |
| Tauri Command | snake_case | `search_recipes` |
| Rust 函数 | snake_case | `get_recipe_by_id` |
| Rust 结构体 | PascalCase | `Recipe`, `AppError` |
| CSS Module | camelCase | `.recipeCard` |

#### 注释规范

```rust
/// 搜索配方
///
/// # Arguments
/// * `args` - 搜索参数，包含关键词和过滤条件
///
/// # Returns
/// * `Ok(Vec<Recipe>)` - 匹配的配方列表
/// * `Err(AppError)` - 数据库错误或参数错误
///
/// # Example
/// ```
/// let results = search_recipes(SearchRecipesArgs {
///     query: Some("mojito".to_string()),
///     ..Default::default()
/// }).await?;
/// ```
#[tauri::command]
pub async fn search_recipes(
    args: SearchRecipesArgs,
) -> Result<CommandResult<Vec<Recipe>>, String> {
    // 实现
}
```

---

## 9. 开发路线图

### Phase 1 — 项目脚手架 & 契约定义 (Week 1)

```
□ Tauri v2 项目初始化 (tauri create)
□ React 18 + TS + Vite 6 配置
□ TDesign Mobile 引入 & 主题定制
□ 定义 TypeScript 接口 (src/types/commands.ts)
□ 定义 Rust 类型 (src-tauri/src/types/mod.rs)
□ 实现统一错误处理 (前后端)
□ 搭建测试框架 (Vitest + cargo test)
□ 页面路由搭建 (React Router 7)
□ TabBar 底部导航实现
□ SQLite 初始化 + Schema 建表（含同步字段）
□ device_id 生成 & 存储
□ 第一个 Command: ping() 验证 IPC 通道
□ API client 抽象层搭建 (src/lib/tauri.ts)
```

### Phase 2 — 核心数据 & 搜索 (Week 2-3)

```
□ IBA 77 款配方数据录入 (JSON)
□ 200+ 流行配方录入
□ 原料数据库 (200+ 常见原料)
□ 数据 Seed 脚本 (src-tauri/src/db/seed.rs)
□ FTS5 全文搜索索引搭建
□ 实现 search_recipes Command
□ 实现 get_recipe_by_id Command
□ 配方列表页 UI (虚拟滚动 - react-window)
□ 配方详情页 UI
□ 搜索页 UI + 筛选器组件
□ TanStack Query 集成（数据缓存）
□ 单元测试覆盖率 > 60%
□ 集成测试：搜索 → 查看详情流程
```

### Phase 3 — 我的酒柜 (Week 4)

```
□ 库存 CRUD Commands (add_ingredient, remove_ingredient, get_inventory)
□ 库存管理 UI (网格布局 + 搜索添加)
□ 推荐引擎实现 (recommend_recipes Command)
  - 算法1: 完全匹配（库存包含所有原料）
  - 算法2: 缺1-2种原料的配方
□ 缺原料清单 UI 组件
□ 酒精度计算工具 (abv_calculator.rs)
□ Zustand 持久化库存状态
□ 单元测试：推荐算法 + 库存 CRUD
□ E2E 测试：添加库存 → 查看推荐 → 制作流程
```

### Phase 4 — 进阶功能 (Week 5-6)

```
□ 制作步骤动画组件 (Framer Motion)
□ 计时器功能 (每步倒计时提示)
□ 收藏功能 (favorites 表 + Commands)
□ 比例换算器 (1杯 → N杯)
□ 自定义配方表单 (React Hook Form)
  - 表单验证
  - 图片上传（本地存储）
□ 深色模式切换 (CSS variables + Zustand)
□ 图片懒加载优化 (Intersection Observer)
□ 性能埋点接入 (measureCommand helper)
□ 单元测试覆盖率 > 80%
□ 回归测试：确保新功能不破坏已有流程
```

### Phase 5 — 打包 & 发布 (Week 7-8)

```
□ Android 构建配置 (tauri.conf.json)
□ Android apk/aab 本地构建测试
□ iOS 构建配置 (需 macOS + Xcode 16)
□ iOS IPA 本地构建测试
□ E2E 测试完整覆盖 (Playwright)
  - 搜索 → 详情 → 收藏
  - 添加库存 → 推荐 → 制作
  - 创建自定义配方 → 分享
□ 性能优化
  - Lighthouse 评分 > 90
  - 首屏渲染 < 2s
  - 列表滚动 FPS ≥ 55
□ 错误监控接入 (Sentry 或自建)
□ 用户文档编写 (README + 使用指南)
□ 隐私政策 & 服务条款起草
□ App Store / Google Play 上架资料准备
  - 应用描述
  - 截图 (5-10张)
  - 预览视频
□ 提交审核 & 发布 v1.0.0
```

### Phase 6 — 云同步 & 社区 (可选 - Week 9-16)

```
Week 9-10: 后端搭建
□ Rust/Axum 云端后端初始化
□ PostgreSQL 数据库设计
□ 用户注册/登录 API（JWT）
□ 配方/库存云端 CRUD API
□ 增量同步 API 实现
□ 冲突解决策略 (Last Write Wins + version)

Week 11-12: 同步引擎
□ SyncEngine 实现 (pull + push)
□ 离线队列
□ 同步状态 UI 指示器
□ 跨设备测试

Week 13-14: 社区功能
□ 社区配方浏览页
□ 发布配方到社区
□ 点赞/收藏社区配方
□ 用户主页

Week 15-16: 智能功能
□ AI 推荐 (基于 LLM)
□ 拍照识别原料 (OCR)
□ 多语言支持 (i18n)
```

---

## 10. 附录

### 8.1 三阶段部署策略

| 阶段 | 数据存储 | 交互方式 | 服务器需求 | 成本 |
|------|---------|---------|-----------|------|
| **Phase 1** 纯本地 | SQLite 本地 | 文件导出/扫码分享 | 无 | ¥0 |
| **Phase 2** 云同步 | 本地 + PostgreSQL 云端 | 跨设备同步、社区 | 1核2G 云服务器 | ~¥60/月 |
| **Phase 3** 社区运营 | 本地 + 云端 + CDN | 完整社区交互 | 2核4G + CDN | ~¥300/月 |

### 8.2 Phase 1：纯本地（当前阶段）

```
┌─────────────────────────────────────┐
│          用户手机                    │
│  SQLite 本地数据库                   │
│  配方 / 库存 / 收藏 全在本地         │
│                                     │
│  分享方式：                          │
│  • 导出 JSON 文件 → 微信/邮件发送    │
│  • 生成分享链接（含配方数据的 URL）    │
│  • 扫码分享（通过 URL Scheme）       │
└─────────────────────────────────────┘
```

**优点**：
- 零运维成本
- 隐私友好，数据不离手机
- 完全离线可用
- 快速上线验证产品

**分享实现方案**：

```typescript
// 导出 JSON 文件分享
import { writeTextFile, BaseDirectory } from '@tauri-apps/plugin-fs';
import { share } from '@tauri-apps/plugin-share';  // 需安装

async function shareRecipe(recipe: Recipe) {
  // 1. 导出为 JSON 文件
  const json = JSON.stringify(recipe, null, 2);
  await writeTextFile('recipe-share.json', json, { baseDir: BaseDirectory.AppData });
  
  // 2. 调用系统分享 Sheet
  await share({ title: recipe.name_zh, url: 'recipe-share.json' });
  
  // 3. 或者生成分享链接（数据编码到 URL hash）
  const encoded = btoa(encodeURIComponent(json));
  const shareUrl = `cocktail://recipe#${encoded}`;
  // 对方 App 注册 cocktail:// URL Scheme 后可直接打开
}
```

### 8.3 Phase 2：加云同步

```
┌──────────┐    Sync (增量)     ┌──────────────┐
│ 手机 A   │ ◄───────────────►  │              │
├──────────┤                    │  云服务器     │
│ 手机 B   │ ◄───────────────►  │  (Rust/Axum)│
├──────────┤                    │  PostgreSQL   │
│ 平板     │ ◄───────────────►  │  + Redis缓存 │
└──────────┘                    └──────────────┘
        ▲            ▲
        │  WebSocket │  (实时通知，可选)
        └────────────┘
```

**同步策略：离线优先（Offline First）**

```
1. App 启动 → 从本地 SQLite 加载数据（瞬间完成）
2. 检测网络 → 有网则后台同步（不阻塞 UI）
3. 本地操作 → 立即写入本地 SQLite + 标记 synced_at=NULL
4. 后台同步 → 推送 synced_at=NULL 的记录到云端
5. 拉取更新 → 从云端拉取 updated_at > last_sync_at 的记录
6. 冲突解决 → version 高的胜出（Last Write Wins）
```

**云端后端技术栈（Rust/Axum）**：

```rust
// server/src/main.rs
use axum::{Router, routing::{get, post}};

#[tokio::main]
async fn main() {
    let app = Router::new()
        .route("/api/auth/register", post(register))
        .route("/api/auth/login", post(login))
        .route("/api/recipes/sync", get(pull_recipes).post(push_recipes))
        .route("/api/inventory/sync", get(pull_inventory).post(push_inventory))
        .route("/api/community/recipes", get(list_community_recipes))
        .layer(TraceLayer::new_for_http());

    let listener = tokio::net::TcpListener::bind("0.0.0.0:8080").await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
```

**部署方案对比**：

| 方案 | 成本 | 适用阶段 | 说明 |
|------|------|---------|------|
| 腾讯云轻量服务器 2核2G | ¥60/月 | Phase 2 起步 | 足够 1000 用户以内 |
| Supabase（BaaS） | 免费额度够用 | Phase 2 快速验证 | 不用写后端，但直接用其 API 会绑定平台 |
| Cloudflare Workers + D1 | 几乎免费 | Phase 2 技术探索 | Rust 可编译到 WASM，但 D1 功能有限 |
| 自建服务器（家中 NAS） | 电费 ~¥10/月 | 测试用 | 生产不稳定，无备用 IP |

### 8.4 云同步对现有代码的影响

**好消息：影响可控，UI 层几乎不用改。**

| 层级 | Phase 1 代码量 | Phase 2 改动 | 改动比例 |
|------|--------------|-------------|---------|
| React UI 组件 | ~3000 行 | **0 行**（不变） | 0% |
| Zustand stores | ~800 行 | ~100 行（加 sync action） | 12% |
| Tauri commands | ~1500 行 | ~300 行（加 sync/auth） | 20% |
| Repository 层 | ~1000 行 | 新增 CloudRecipeRepo (~800 行) | 新增 |
| 同步引擎 | 0 | 新增 (~1500 行) | 新增 |
| 云端后端 | 0 | 新增 (~3000 行) | 新增 |
| **总计** | **~6300 行** | **~5700 行新增** | **~90% 增量（但 UI 不变）** |

> **关键**：因为 Phase 1 就用了 Repository 模式，加云同步时所有 Tauri commands 和 React 组件都不用改，只需新增 CloudRecipeRepo 实现并切换实例。

---

## 9. 分阶段交互方案

### 9.1 交互场景 vs 技术方案

| 交互类型 | 举例 | Phase 1（本地）| Phase 2（云同步）| Phase 3（社区）|
|----------|------|----------------|-----------------|---------------|
| 分享单个配方 | A 把配方发给 B | 导出 JSON / 分享链接 | 同左，或云端链接 | 云端链接 |
| 分享酒柜清单 | A 把自己的库存发给 B | 导出 JSON | 同左 | 同左 |
| 浏览他人配方 | 发现页看别人创作的酒 | ❌ 不支持 | ❌ 不支持 | ✅ 社区 API |
| 跨设备同步 | 手机和平板数据一致 | ❌ 不支持 | ✅ 自动同步 | ✅ |
| 实时协作 | 多人同时编辑一个配方 | ❌ | ❌ | ❌ 太复杂，暂不规划 |

### 9.2 Phase 1 分享实现细节

**方案 A：JSON 文件分享（推荐，最简单）**

```typescript
// 导出配方为 JSON，通过系统分享 Sheet 发送
async function exportRecipeAsFile(recipe: Recipe) {
  const exportData = {
    version: '1.0',
    type: 'cocktail-recipe',
    data: recipe,
    exported_at: new Date().toISOString(),
  };
  const json = JSON.stringify(exportData, null, 2);
  const filePath = await invoke('save_file_dialog', { content: json, filename: `${recipe.name_zh}.json` });
  // 调用系统分享
  await invoke('share_file', { path: filePath });
}
```

**方案 B：URL 分享（适合社交平台传播）**

```typescript
// 将配方数据编码到 URL（适合 < 8KB 的数据）
async function generateShareUrl(recipe: Recipe): Promise<string> {
  const minimal = {
    n: recipe.name_zh,
    i: recipe.ingredients.map(ing => ({
      n: ing.ingredient_name,
      a: ing.amount,
      u: ing.unit,
    })),
    s: recipe.steps.map(s => s.text),
    abv: recipe.abv,
  };
  const encoded = btoa(encodeURIComponent(JSON.stringify(minimal)));
  return `https://cocktail.app/r#${encoded}`;
  // 对方打开链接 → 前端解析 hash → 展示配方
  // Phase 1 可以先用纯前端解析，不用后端
}
```

**方案 C：扫码分享（适合线下场景，聚会时分享）**

```typescript
// 生成二维码，对方扫码直接导入
import QRCode from 'qrcode';

async function generateQRCode(recipe: Recipe): Promise<string> {
  const shareUrl = await generateShareUrl(recipe);
  const qrDataUrl = await QRCode.toDataURL(shareUrl, { width: 300 });
  return qrDataUrl;  // 展示在 App 内，对方扫码
}
```

---

## 附录 A: Tauri v2 与 React Native / Flutter 对比

| 维度 | Tauri v2 + React | React Native | Flutter |
|------|-----------------|--------------|---------|
| 跨平台 | Android/iOS/Desktop | Android/iOS | Android/iOS/Desktop |
| 渲染引擎 | WebView | 原生组件桥接 | Skia 自绘 |
| 性能 | 良好 (WebView 60fps) | 优秀 (原生) | 优秀 (自绘) |
| Bundle 体积 | ~5MB (React) + ~3MB (Rust) | ~10MB | ~15MB |
| 学习曲线 | React 开发者 0 cost | 需学 RN 特有 API | 需学 Dart |
| Rust 后端 | 原生支持 | 需 FFI 桥接 | 需 FFI 桥接 |
| 热更新 | ❌ (需审核) | ✅ (CodePush) | ❌ (需审核) |
| 适用场景 | 内容展示型 App | 社交/工具型 App | 炫酷 UI/游戏 |

> **调酒 App 选择 Tauri 的理由**：需要 Rust 做重计算（搜索/推荐），同时又需要成熟 UI 生态（React）。Tauri 是这两者的最佳结合点。

## 附录 B: 预置数据示例 (JSON)

```json
{
  "id": "iba-margarita",
  "name_zh": "玛格丽特",
  "name_en": "Margarita",
  "category": "contemporary_classic",
  "glass_type": "margarita",
  "method": "shake",
  "difficulty": 2,
  "abv": 26.0,
  "description": "酸甜平衡，盐边点缀，是最受欢迎的特基拉鸡尾酒",
  "story": "1948年由社交名流 Margarita Sames 在 Acapulco 创作",
  "steps": [
    {"order": 1, "text": "用青柠汁润湿杯沿，蘸盐做盐边", "duration_sec": 0},
    {"order": 2, "text": "所有原料加冰摇和10秒", "duration_sec": 10},
    {"order": 3, "text": "双重过滤倒入冰镇玛格丽特杯", "duration_sec": 5}
  ],
  "ingredients": [
    {"name_zh": "特基拉", "name_en": "Tequila", "amount": 50, "unit": "ml", "is_optional": false},
    {"name_zh": "君度", "name_en": "Cointreau", "amount": 20, "unit": "ml", "is_optional": false},
    {"name_zh": "鲜榨青柠汁", "name_en": "Lime Juice", "amount": 15, "unit": "ml", "is_optional": false}
  ]
}
```

## 附录 C: 设备 ID 生成方案

```rust
// src-tauri/src/utils/device_id.rs
use uuid::Uuid;
use tauri::Manager;

pub fn get_or_create_device_id(app: &tauri::AppHandle) -> String {
    let app_data_dir = app.path().app_data_dir().unwrap();
    let device_file = app_data_dir.join("device_id");
    
    if device_file.exists() {
        std::fs::read_to_string(device_file).unwrap_or_else(|_| {
            let id = Uuid::new_v4().to_string();
            std::fs::write(&device_file, &id).ok();
            id
        })
    } else {
        let id = Uuid::new_v4().to_string();
        std::fs::create_dir_all(&app_data_dir).ok();
        std::fs::write(&device_file, &id).ok();
        id
    }
}
```

---

*本文档为调酒 App 项目的技术基石与工程规范。后续开发以此为基准。如有变更需同步更新此文档。*

**文档版本**: 2.0 | **最后更新**: 2026-06-05

**主要改进**:
- ✅ 新增前后端分离架构说明
- ✅ 新增 IPC 接口契约规范（TypeScript + Rust 双端定义）
- ✅ 新增状态管理、错误处理、测试策略
- ✅ 新增性能监控和代码规范
- ✅ 优化开发路线图，细化到 Week 粒度
- ✅ 明确前后端职责边界和禁止操作
- ✅ 补充缓存策略和数据流方向规则
