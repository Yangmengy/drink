# 🚀 接下来的步骤

> 从这里开始继续开发

---

## 📋 当前状态

✅ **前端框架**: 90% 完成
- React + TypeScript 配置完成
- 8 个可复用组件已实现
- 发现页完整实现
- 路由配置完成
- 状态管理 (Zustand) 搭建完成
- Mock 数据准备完成

⏸️ **后端框架**: 待开始
- Tauri 项目未初始化
- 数据库未创建
- Rust 命令未实现

---

## 🎯 立即行动 (15 分钟)

### 1. 安装前端依赖

```bash
npm install
```

这将安装：
- React 18.3
- React Router 7
- Zustand (状态管理)
- TanStack Query (数据获取)
- Lucide Icons
- Framer Motion (动画)
- 其他开发依赖

### 2. 验证项目结构

```bash
# 查看组件
ls -la src/components/

# 查看页面
ls -la src/pages/

# 查看样式
ls -la src/styles/
```

应该看到：
- 8 个组件 (Button, SearchBar, Tag, TabBar, Navbar, SectionTitle, CocktailCard, LazyImage)
- 4 个页面 (DiscoverPage, SearchPage, MyBarPage, ProfilePage)
- 2 个全局样式文件

### 3. 启动开发服务器 (仅前端)

```bash
npm run dev
```

访问 http://localhost:5173 查看效果。

**注意**: 此时只能看到 UI，无法获取真实数据，因为后端还未实现。

---

## 🔧 初始化 Tauri (30 分钟)

### 1. 安装 Tauri CLI

```bash
# 使用 cargo 安装
cargo install tauri-cli --version "^2.0.0"

# 或使用 npm 安装
npm install -g @tauri-apps/cli@next
```

### 2. 初始化 Tauri 项目

```bash
npm run tauri init
```

配置项：
- App name: `Cocktail App`
- Window title: `调酒助手`
- Web assets location: `../dist`
- Dev server URL: `http://localhost:5173`
- Dev command: `npm run dev`
- Build command: `npm run build`

### 3. 项目结构检查

初始化后应该生成 `src-tauri/` 目录：

```
src-tauri/
├── src/
│   └── main.rs          # Rust 入口
├── Cargo.toml           # Rust 依赖
├── tauri.conf.json      # Tauri 配置
└── icons/               # 应用图标
```

### 4. 添加 Rust 依赖

编辑 `src-tauri/Cargo.toml`，添加：

```toml
[dependencies]
tauri = { version = "2.0", features = ["devtools"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
sqlx = { version = "0.8", features = ["runtime-tokio", "sqlite"] }
tokio = { version = "1", features = ["full"] }
chrono = "0.4"
```

### 5. 测试运行

```bash
npm run tauri dev
```

如果成功，会打开一个桌面窗口显示你的 React 应用。

---

## 🗄️ 创建数据库 (45 分钟)

### 1. 创建数据库目录

```bash
mkdir -p src-tauri/data
```

### 2. 创建 Schema 文件

创建 `src-tauri/data/schema.sql`:

```sql
-- 配方表
CREATE TABLE recipes (
    id TEXT PRIMARY KEY,
    name_zh TEXT NOT NULL,
    name_en TEXT,
    category TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    glass_type TEXT,
    ice_type TEXT,
    garnish TEXT,
    abv REAL,
    difficulty INTEGER CHECK(difficulty BETWEEN 1 AND 5),
    prep_time INTEGER,
    source TEXT,
    is_iba BOOLEAN DEFAULT 0,
    is_favorite BOOLEAN DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    last_viewed_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    synced_at INTEGER
);

-- 原料表
CREATE TABLE ingredients (
    id TEXT PRIMARY KEY,
    name_zh TEXT NOT NULL,
    name_en TEXT,
    category TEXT NOT NULL,
    subcategory TEXT,
    abv REAL,
    description TEXT,
    emoji TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    synced_at INTEGER
);

-- 配方-原料关联表
CREATE TABLE recipe_ingredients (
    id TEXT PRIMARY KEY,
    recipe_id TEXT NOT NULL,
    ingredient_id TEXT NOT NULL,
    amount REAL,
    unit TEXT,
    is_optional BOOLEAN DEFAULT 0,
    display_order INTEGER,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (recipe_id) REFERENCES recipes(id),
    FOREIGN KEY (ingredient_id) REFERENCES ingredients(id)
);

-- 制作步骤表
CREATE TABLE recipe_steps (
    id TEXT PRIMARY KEY,
    recipe_id TEXT NOT NULL,
    step_number INTEGER NOT NULL,
    title TEXT,
    instruction TEXT NOT NULL,
    duration INTEGER,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (recipe_id) REFERENCES recipes(id)
);

-- 用户库存表
CREATE TABLE user_inventory (
    id TEXT PRIMARY KEY,
    ingredient_id TEXT NOT NULL,
    amount REAL,
    unit TEXT,
    added_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (ingredient_id) REFERENCES ingredients(id)
);

-- 用户偏好表
CREATE TABLE user_preferences (
    id TEXT PRIMARY KEY DEFAULT 'default',
    preferred_language TEXT DEFAULT 'zh',
    theme TEXT DEFAULT 'system',
    unit_system TEXT DEFAULT 'metric',
    difficulty_preference INTEGER,
    abv_preference TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- 全文搜索索引 (FTS5)
CREATE VIRTUAL TABLE recipes_fts USING fts5(
    recipe_id,
    name_zh,
    name_en,
    category,
    description,
    ingredients,
    content=recipes,
    content_rowid=rowid
);

-- 索引
CREATE INDEX idx_recipes_category ON recipes(category);
CREATE INDEX idx_recipes_difficulty ON recipes(difficulty);
CREATE INDEX idx_recipes_is_favorite ON recipes(is_favorite);
CREATE INDEX idx_recipes_is_iba ON recipes(is_iba);
CREATE INDEX idx_recipe_ingredients_recipe_id ON recipe_ingredients(recipe_id);
CREATE INDEX idx_recipe_ingredients_ingredient_id ON recipe_ingredients(ingredient_id);
CREATE INDEX idx_user_inventory_ingredient_id ON user_inventory(ingredient_id);
```

### 3. 创建数据库初始化代码

创建 `src-tauri/src/db/mod.rs`:

```rust
use sqlx::SqlitePool;
use std::path::PathBuf;

pub async fn init_database() -> Result<SqlitePool, sqlx::Error> {
    // 获取数据库路径
    let data_dir = get_data_dir();
    let db_path = data_dir.join("cocktail.db");
    
    // 创建连接池
    let pool = SqlitePool::connect(&format!("sqlite:{}", db_path.display())).await?;
    
    // 执行 Schema
    let schema = include_str!("../data/schema.sql");
    sqlx::query(schema).execute(&pool).await?;
    
    Ok(pool)
}

fn get_data_dir() -> PathBuf {
    let mut path = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("cocktail-app");
    std::fs::create_dir_all(&path).unwrap();
    path
}
```

### 4. 在 main.rs 中初始化

编辑 `src-tauri/src/main.rs`:

```rust
mod db;
mod commands;

#[tokio::main]
async fn main() {
    // 初始化数据库
    let pool = db::init_database()
        .await
        .expect("Failed to initialize database");
    
    tauri::Builder::default()
        .manage(pool)
        .invoke_handler(tauri::generate_handler![
            commands::search_recipes,
            commands::get_recipe_by_id,
            commands::get_inventory,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

---

## 🔌 实现基础 IPC 命令 (30 分钟)

### 1. 创建命令模块

创建 `src-tauri/src/commands/mod.rs`:

```rust
use sqlx::SqlitePool;
use tauri::State;

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct Recipe {
    pub id: String,
    pub name_zh: String,
    pub name_en: Option<String>,
    pub category: String,
    pub description: Option<String>,
    pub image_url: Option<String>,
    pub abv: Option<f32>,
    pub difficulty: i32,
    // ... 其他字段
}

#[tauri::command]
pub async fn search_recipes(
    query: String,
    pool: State<'_, SqlitePool>,
) -> Result<Vec<Recipe>, String> {
    let recipes = sqlx::query_as!(
        Recipe,
        r#"
        SELECT * FROM recipes
        WHERE name_zh LIKE ? OR name_en LIKE ?
        LIMIT 50
        "#,
        format!("%{}%", query),
        format!("%{}%", query)
    )
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())?;
    
    Ok(recipes)
}

#[tauri::command]
pub async fn get_recipe_by_id(
    id: String,
    pool: State<'_, SqlitePool>,
) -> Result<Option<Recipe>, String> {
    let recipe = sqlx::query_as!(
        Recipe,
        "SELECT * FROM recipes WHERE id = ?",
        id
    )
    .fetch_optional(pool.inner())
    .await
    .map_err(|e| e.to_string())?;
    
    Ok(recipe)
}

#[tauri::command]
pub async fn get_inventory(
    pool: State<'_, SqlitePool>,
) -> Result<Vec<InventoryItem>, String> {
    // 实现库存查询
    Ok(vec![])
}
```

### 2. 测试命令

在前端调用：

```typescript
import { invoke } from '@tauri-apps/api/core';

// 搜索配方
const recipes = await invoke('search_recipes', { query: 'Margarita' });
console.log(recipes);
```

---

## 📊 插入测试数据 (可选)

创建 `src-tauri/data/seed.sql`:

```sql
-- 插入 Margarita 配方
INSERT INTO recipes VALUES (
    'margarita-classic',
    '玛格丽特',
    'Margarita',
    'classic',
    '经典龙舌兰鸡尾酒，口感酸甜平衡',
    NULL,
    'margarita',
    'cubed',
    '盐边 + 青柠角',
    15.0,
    2,
    5,
    'IBA',
    1,
    0,
    0,
    NULL,
    strftime('%s', 'now'),
    strftime('%s', 'now'),
    NULL
);

-- 插入原料
INSERT INTO ingredients VALUES (
    'tequila-blanco',
    '龙舌兰酒 (银)',
    'Tequila Blanco',
    'spirits',
    'tequila',
    40.0,
    '墨西哥特产烈酒',
    '🍶',
    strftime('%s', 'now'),
    strftime('%s', 'now'),
    NULL
);

-- 更多测试数据...
```

运行：

```bash
sqlite3 ~/.local/share/cocktail-app/cocktail.db < src-tauri/data/seed.sql
```

---

## ✅ 验证清单

完成以上步骤后，你应该能够：

- [ ] 运行 `npm run tauri dev` 打开应用
- [ ] 看到发现页的 UI
- [ ] 点击搜索框 (虽然还不能真正搜索)
- [ ] 看到 TabBar 切换页面
- [ ] 打开开发者工具看到无错误

---

## 📖 参考文档

- [Tauri 官方文档](https://tauri.app/v2/guides/)
- [SQLx 文档](https://docs.rs/sqlx/)
- [PRD 文档](./PRD-CocktailApp.md) - 第 5 节数据库设计
- [设计实现指南](./DESIGN-IMPLEMENTATION.md)

---

## 💬 遇到问题？

1. **依赖安装失败**: 检查 Node.js 和 npm 版本
2. **Tauri 初始化失败**: 确保安装了 Rust 和 Tauri CLI
3. **数据库错误**: 检查 SQLite 语法和路径权限
4. **IPC 调用失败**: 查看 Rust 控制台的错误信息

---

**下一个里程碑**: 前后端打通，能显示真实配方数据！🎉
