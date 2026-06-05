# 应用图标

目前使用占位图标。

实际发布前需要准备以下尺寸的图标：
- 32x32.png
- 128x128.png
- 128x128@2x.png
- icon.icns (macOS)
- icon.ico (Windows)

可以使用 Tauri 的图标生成工具：
```bash
npm install -g @tauri-apps/tauricon
tauricon path/to/icon.png
```
