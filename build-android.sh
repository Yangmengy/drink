#!/bin/bash

# Android 构建脚本
# 设置环境变量并构建 APK

# 设置 Android SDK 和 NDK 路径
export ANDROID_HOME=/Users/yangmengying/Library/Android/sdk
export ANDROID_NDK_HOME=/Users/yangmengying/Library/Android/sdk/ndk/29.0.18460666
export NDK_HOME=$ANDROID_NDK_HOME

# 设置 Java Home (使用 Android Studio 的 JBR)
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"

# 添加必要的路径
export PATH=$ANDROID_HOME/platform-tools:$PATH
export PATH=$ANDROID_HOME/cmdline-tools/latest/bin:$PATH
export PATH=$JAVA_HOME/bin:$PATH

echo "环境变量已设置："
echo "ANDROID_HOME: $ANDROID_HOME"
echo "ANDROID_NDK_HOME: $ANDROID_NDK_HOME"
echo "JAVA_HOME: $JAVA_HOME"
echo ""

# 构建 APK
echo "开始构建 Android APK..."
npm run tauri android build

echo ""
echo "构建完成！APK 文件位置："
find src-tauri/gen/android -name "*.apk" 2>/dev/null
