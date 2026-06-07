# 图标资源说明

## TabBar 图标

需要以下 6 个图标文件（每个 Tab 需要普通和选中两个状态）：

### 发现页
- `tab-discover.png` - 未选中状态
- `tab-discover-active.png` - 选中状态

### 酒柜页
- `tab-mybar.png` - 未选中状态
- `tab-mybar-active.png` - 选中状态

### 我的页
- `tab-profile.png` - 未选中状态
- `tab-profile-active.png` - 选中状态

## 图标规范

- **尺寸**: 81x81 像素（3倍图）
- **格式**: PNG（支持透明）
- **颜色**: 
  - 未选中: 灰色 #999999
  - 选中: 橙色 #FF9500

## 快速解决方案

### 方案 1: 暂时使用 emoji（推荐快速测试）

修改 `app.json`，使用 iconfont 代替图片：

```json
"tabBar": {
  "color": "#999999",
  "selectedColor": "#FF9500",
  "backgroundColor": "#ffffff",
  "borderStyle": "black",
  "list": [
    {
      "pagePath": "pages/discover/discover",
      "text": "🍸 发现"
    },
    {
      "pagePath": "pages/mybar/mybar",
      "text": "🧊 酒柜"
    },
    {
      "pagePath": "pages/profile/profile",
      "text": "👤 我的"
    }
  ]
}
```

### 方案 2: 使用占位图标

我会创建简单的占位图标供你使用。

### 方案 3: 自己设计图标

使用以下工具：
- Figma（免费）
- Sketch
- 在线工具: https://www.iconfont.cn/

## 临时解决

为了让你能立即运行小程序，我建议先用方案 1（文字 + emoji）。
