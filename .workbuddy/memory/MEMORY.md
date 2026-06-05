# 调酒 App (Mixology) 项目长期记忆

## 项目基础
- 名称：Mixology（调酒助手 App）
- 技术栈：Tauri v2 + React 18 + TypeScript + Rust
- 设计风格：iOS 极简毛玻璃（Apple HIG + 小红书灵感）
- 架构：Repository 抽象模式，支持纯本地 → 云同步平滑迁移

## 设计系统 (2026-06-05)
- 色彩：极简灰度系，--color-primary: #0A84FF（仅交互元素）
- 背景：iOS 系统色 #F2F2F7（浅）/ #000000（深）
- 卡片：backdrop-filter: blur(24px) + rgba(255,255,255,0.72)
- 字体：SF Pro + PingFang SC，Apple HIG 字号体系
- 圆角：8-24px 体系，标签用全圆角 pill
- 阴影：极轻柔，sm: 0 2px 8px rgba(0,0,0,0.06)

## 关键设计决策
1. 组件文件结构：`src/components/` + `.module.css` 同目录
2. 页面文件：`src/pages/` + `.module.css`
3. 类型定义集中管理：`src/types/index.ts`
4. Mock 数据分离：`src/data/mockRecipes.ts`（10 款 IBA 配方）
5. API 抽象层预留：`src/api/client.ts`
6. 状态管理：Zustand（未在此次重构中大量使用）
