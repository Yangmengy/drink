# 设计资产清单

> 本文档列出项目所需的所有设计资产和图标

---

## 📦 所需安装的依赖

```json
{
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-router-dom": "^7.0.0",
    "lucide-react": "^0.400.0",
    "framer-motion": "^11.0.0",
    "@tanstack/react-query": "^5.0.0",
    "@tanstack/react-virtual": "^3.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "vite": "^6.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0"
  }
}
```

---

## 🎨 图标列表 (Lucide Icons)

### 导航 & 操作
- `Home` - 首页
- `Search` - 搜索
- `User` - 用户
- `Settings` - 设置
- `ChevronLeft` - 返回
- `ChevronRight` - 下一步
- `ChevronDown` - 下拉
- `X` - 关闭
- `Check` - 完成
- `Plus` - 添加
- `Minus` - 减少
- `MoreHorizontal` - 更多

### 功能
- `Heart` - 收藏/喜欢
- `Bookmark` - 书签
- `Share` - 分享
- `Download` - 下载
- `Upload` - 上传
- `Filter` - 筛选
- `SlidersHorizontal` - 调节
- `Bell` - 通知
- `AlertCircle` - 警告
- `Info` - 信息

### 酒类相关
- `Wine` - 葡萄酒杯
- `Martini` - 马提尼杯（需自定义或用 Wine 替代）
- `Package` - 酒柜/库存
- `Droplet` - 液体/新鲜
- `Flame` - 烈度/热门
- `Sparkles` - 特色/推荐
- `Star` - 评分

### 制作相关
- `Clock` - 计时
- `Timer` - 计时器
- `Play` - 开始
- `Pause` - 暂停
- `RotateCw` - 重置

### 其他
- `Image` - 图片
- `Camera` - 相机
- `Eye` - 查看
- `EyeOff` - 隐藏
- `Moon` - 深色模式
- `Sun` - 浅色模式
- `Loader` - 加载

---

## 🖼️ App 图标设计规范

### App Icon (应用图标)

**尺寸要求**：
- iOS: 1024×1024px (App Store)
- Android: 512×512px (Google Play)

**设计建议**：
```
背景：橙色渐变 (#FF9500 → #FFB340)
主体：简化的鸡尾酒杯轮廓（白色描边）
风格：扁平化、圆角、极简
```

**所需尺寸**（iOS）：
- 20×20px @1x, @2x, @3x
- 29×29px @1x, @2x, @3x
- 40×40px @1x, @2x, @3x
- 60×60px @2x, @3x
- 76×76px @1x, @2x
- 83.5×83.5px @2x
- 1024×1024px

**所需尺寸**（Android）：
- 48×48px (mdpi)
- 72×72px (hdpi)
- 96×96px (xhdpi)
- 144×144px (xxhdpi)
- 192×192px (xxxhdpi)
- 512×512px (Google Play)

### Launch Screen (启动屏)

**设计**：
```
背景：橙色渐变
中心：App Icon (120×120px) + App 名称
动画：Icon 从 0.8 → 1.0 scale + fade in
时长：1.5s
```

**尺寸**：
- 自适应，使用 SVG 或多倍图

---

## 🎯 配方图片规范

### 图片要求
- **格式**：WebP (优先) 或 JPEG
- **尺寸**：
  - 列表缩略图：400×225px (16:9)
  - 详情大图：1080×1080px (1:1)
- **质量**：80% (平衡质量与大小)
- **占位图**：纯色或渐变背景 + Emoji

### 占位色方案
```typescript
const placeholderGradients = {
  classic: ['#8E44AD', '#9B59B6'],    // 紫色
  tropical: ['#E67E22', '#F39C12'],   // 橙色
  refreshing: ['#3498DB', '#5DADE2'], // 蓝色
  strong: ['#C0392B', '#E74C3C'],     // 红色
  sweet: ['#F39C12', '#F1C40F'],      // 金色
  mocktail: ['#27AE60', '#2ECC71'],   // 绿色
};
```

---

## 🎭 原料图标设计

### 图标风格
- **尺寸**：48×48px
- **风格**：扁平化、圆角、纯色
- **格式**：SVG 或 PNG @3x

### 常用原料图标 (Emoji 替代方案)

| 原料 | Emoji | 说明 |
|------|-------|------|
| 特基拉 | 🥃 | 威士忌杯 |
| 伏特加 | 🍸 | 马提尼杯 |
| 朗姆酒 | 🥃 | 威士忌杯 |
| 金酒 | 🍸 | 马提尼杯 |
| 君度 | 🍊 | 橙子 |
| 柠檬汁 | 🍋 | 柠檬 |
| 青柠汁 | 🟢 | 青柠 |
| 糖浆 | 🍯 | 蜂蜜 |
| 薄荷叶 | 🌿 | 叶子 |
| 冰块 | 🧊 | 冰块 |
| 苏打水 | 💧 | 水滴 |
| 可乐 | 🥤 | 饮料杯 |

### 自定义图标需求
如果不使用 Emoji，需要设计 200+ 原料图标：
- 基酒类：20+ 种
- 利口酒：30+ 种
- 调味料：40+ 种
- 装饰物：30+ 种
- 其他：80+ 种

---

## 📱 启动图设计 (Splash Screen)

### iOS
```swift
// LaunchScreen.storyboard
背景：橙色渐变
中心：App Icon + 名称
适配：Safe Area
```

### Android
```xml
<!-- splash.xml -->
<layer-list>
  <item>
    <shape>
      <gradient
        android:startColor="#FF9500"
        android:endColor="#FFB340"
        android:angle="135" />
    </shape>
  </item>
  <item android:gravity="center">
    <bitmap android:src="@drawable/ic_launcher" />
  </item>
</layer-list>
```

---

## 🎨 设计工具推荐

### Figma 插件
- **Iconify** - 快速插入 Lucide Icons
- **Unsplash** - 图片占位
- **Stark** - 无障碍检查
- **iOS 18 UI Kit** - Apple 官方组件库

### 在线工具
- [App Icon Generator](https://appicon.co/) - 一键生成所有尺寸
- [Glassmorphism Generator](https://hype4.academy/tools/glassmorphism-generator) - 毛玻璃效果
- [Coolors](https://coolors.co/) - 配色方案
- [Squoosh](https://squoosh.app/) - 图片压缩

---

## 📋 资产文件结构

```
drink/
├── src/
│   ├── assets/
│   │   ├── icons/
│   │   │   ├── app-icon.svg
│   │   │   └── ingredients/
│   │   │       ├── vodka.svg
│   │   │       ├── rum.svg
│   │   │       └── ...
│   │   ├── images/
│   │   │   ├── recipes/
│   │   │   │   ├── mojito.webp
│   │   │   │   ├── margarita.webp
│   │   │   │   └── ...
│   │   │   └── placeholders/
│   │   │       └── recipe-placeholder.svg
│   │   └── splash/
│   │       ├── splash-light.svg
│   │       └── splash-dark.svg
│   └── styles/
│       ├── design-tokens.css
│       └── global.css
└── src-tauri/
    └── icons/
        ├── icon.png (1024×1024)
        ├── icon.icns (macOS)
        ├── icon.ico (Windows)
        └── ...
```

---

## ✅ 设计完成度检查清单

### 设计文档
- [x] 设计系统 (DESIGN-SYSTEM.md)
- [x] 视觉效果图 (DESIGN-MOCKUPS.md)
- [x] 实现指南 (DESIGN-IMPLEMENTATION.md)
- [x] 资产清单 (本文档)
- [x] CSS Token (design-tokens.css)

### App 图标
- [ ] 设计 App Icon (1024×1024px)
- [ ] 生成所有尺寸 (iOS + Android)
- [ ] 设计 Launch Screen
- [ ] 适配深色模式

### 配方图片
- [ ] 准备 IBA 77 款配方图片
- [ ] 准备 200+ 流行配方图片
- [ ] 设计占位图方案
- [ ] 图片压缩和格式转换

### 原料图标
- [ ] 确定使用 Emoji 或自定义图标
- [ ] 如果自定义，设计 200+ 图标
- [ ] 统一风格和尺寸

### UI 组件
- [ ] 完成所有组件设计稿 (Figma)
- [ ] 标注尺寸和间距
- [ ] 导出切图
- [ ] 深色模式适配

---

*本文档为设计资产的完整清单，确保所有资源就绪后开始开发。*
