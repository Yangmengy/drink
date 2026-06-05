# 🚀 运行指南

> 快速启动鸡尾酒 App

---

## ✅ 前置检查

在运行前，确认以下内容已完成：

```bash
# 1. 检查 Node.js 版本
node --version  # 应该 >= 18.x

# 2. 检查 Rust 版本
rustc --version  # 应该 >= 1.70

# 3. 检查依赖安装
ls node_modules  # 应该有内容 (已完成)

# 4. 检查 Tauri 文件
ls src-tauri/src/main.rs  # 应该存在
```

---

## 🎯 运行方式

### 方式 1: 完整应用 (推荐)

启动 Tauri 桌面应用 (前端 + 后端)：

```bash
npm run tauri:dev
```

**首次运行**会比较慢 (5-10 分钟)，因为需要：
1. 编译 Rust 后端代码
2. 下载 Rust 依赖
3. 创建并初始化数据库
4. 插入测试数据

**后续运行**会快很多 (~30 秒)。

### 方式 2: 仅前端预览

如果只想查看 UI（不需要真实数据）：

```bash
npm run dev
```

然后访问: http://localhost:5173

⚠️ 注意：此模式下 API 调用会失败，因为没有后端。

---

## 📱 预期效果

### 启动成功后

1. **控制台输出**:
```
Initializing database at: ~/Library/Application Support/cocktail-app/cocktail.db
Creating database schema...
Seeding initial data...
Database initialized with 3 recipes
Database initialized successfully!
Database health check: OK
```

2. **桌面窗口**:
- 窗口标题: "调酒助手"
- 窗口大小: 375×812 (iPhone 尺寸)
- 可以调整大小

3. **应用界面**:
- 顶部: Navbar ("发现" 标题 + 通知按钮 + 主题按钮)
- 搜索栏
- "今日推荐" 横向滚动卡片
- "分类浏览" 标签
- 配方列表 (3 个测试配方)
- 底部: TabBar (发现/搜索/酒柜/我的)

---

## 🧪 测试功能

### 1. 查看配方列表
- 应该能看到 3 个配方卡片:
  - 玛格丽特 (Margarita)
  - 莫吉托 (Mojito)
  - 白俄罗斯 (White Russian)

### 2. 测试搜索栏
- 点击搜索栏
- 输入文字 (目前还没连接到搜索功能)

### 3. 测试分类标签
- 点击 "经典"、"热带" 等标签
- 标签会变色表示选中

### 4. 测试 TabBar
- 点击底部不同的标签
- 应该能切换到不同页面
- 其他页面目前是占位符

### 5. 打开开发者工具
**macOS**: `Cmd + Option + I`
**Windows/Linux**: `Ctrl + Shift + I`

在控制台测试 API：
```javascript
// 测试搜索
window.__TAURI_INTERNALS__.invoke('search_recipes', { 
  args: { query: '玛格丽特' } 
}).then(console.log);

// 测试获取配方详情
window.__TAURI_INTERNALS__.invoke('get_recipe_by_id', { 
  id: 'margarita-classic' 
}).then(console.log);

// 测试获取推荐
window.__TAURI_INTERNALS__.invoke('get_recommended_recipes', { 
  limit: 10 
}).then(console.log);
```

---

## 🐛 问题排查

### 问题 1: "command not found: tauri"

**解决方案**:
```bash
# 安装 Tauri CLI
cargo install tauri-cli --version "^2.0.0"

# 或使用 npx
npx tauri dev
```

### 问题 2: Rust 编译错误

**解决方案**:
```bash
# 更新 Rust
rustup update

# 清理并重新编译
cd src-tauri
cargo clean
cd ..
npm run tauri:dev
```

### 问题 3: 窗口打开但是空白

**可能原因**:
- Vite 开发服务器未启动
- 端口 5173 被占用

**解决方案**:
```bash
# 检查 5173 端口
lsof -i :5173

# 如果被占用，先停止占用进程，然后重新运行
npm run tauri:dev
```

### 问题 4: 数据库错误

**解决方案**:
```bash
# 删除数据库重新初始化
rm ~/Library/Application\ Support/cocktail-app/cocktail.db

# 重新运行
npm run tauri:dev
```

### 问题 5: 编译太慢

首次编译 Rust 会很慢 (5-10 分钟)，这是正常的。

**加速技巧**:
1. 确保网络连接良好 (下载 Rust 依赖)
2. 使用 SSD 硬盘
3. 关闭杀毒软件扫描 (临时)

---

## 📊 性能基准

正常情况下的性能指标：

| 指标 | 预期值 |
|------|--------|
| 首次启动时间 | 5-10 分钟 (编译) |
| 后续启动时间 | 10-30 秒 |
| 应用启动时间 | < 1 秒 |
| 数据库初始化 | < 100ms |
| 配方搜索 | < 50ms |
| UI 渲染 | 60 FPS |
| 内存占用 | < 100MB |

---

## 🎨 开发模式特性

### 热重载
- **前端**: 修改 React/CSS 代码会自动刷新
- **后端**: 修改 Rust 代码需要重新编译 (自动)

### 开发者工具
- 按 `Cmd/Ctrl + Shift + I` 打开
- 可以查看网络请求、控制台输出、React 组件树

### 数据库
- 位于: `~/Library/Application Support/cocktail-app/cocktail.db`
- 可以用 SQLite 工具查看和修改

---

## 📝 开发检查清单

启动应用前检查：

- [ ] Node.js 已安装 (>= 18)
- [ ] Rust 已安装 (>= 1.70)
- [ ] npm 依赖已安装
- [ ] 端口 5173 未被占用
- [ ] 有足够的硬盘空间 (>= 2GB)

启动后验证：

- [ ] 控制台显示 "Database initialized successfully!"
- [ ] 桌面窗口打开
- [ ] 看到 3 个配方卡片
- [ ] TabBar 可以点击切换
- [ ] 开发者工具可以打开
- [ ] 没有控制台错误

---

## 🚀 下一步

应用运行成功后，可以：

1. **查看代码**
   - 前端: `src/pages/DiscoverPage.tsx`
   - 后端: `src-tauri/src/commands/recipe.rs`
   - 数据库: `src-tauri/data/schema.sql`

2. **添加功能**
   - 实现真实的搜索功能
   - 添加更多配方数据
   - 实现收藏功能

3. **优化 UI**
   - 调整样式
   - 添加动画
   - 实现深色模式

---

**准备好了？运行命令启动吧！**

```bash
npm run tauri:dev
```

🎉 祝开发顺利！
