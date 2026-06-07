#!/bin/bash

# Android APK 构建状态检查脚本

echo "🔍 检查 Android APK 构建状态..."
echo ""

# 检查 Gradle 进程
GRADLE_COUNT=$(ps aux | grep gradle | grep -v grep | wc -l | tr -d ' ')
echo "📊 Gradle 进程数: $GRADLE_COUNT"

if [ "$GRADLE_COUNT" -gt 0 ]; then
    echo "✅ Gradle 正在运行"
else
    echo "❌ Gradle 未运行"
fi

echo ""

# 检查 Cargo/Rust 进程
RUST_COUNT=$(ps aux | grep -E "cargo|rustc" | grep -v grep | wc -l | tr -d ' ')
echo "🦀 Rust 编译进程数: $RUST_COUNT"

if [ "$RUST_COUNT" -gt 0 ]; then
    echo "✅ Rust 编译正在运行"
else
    echo "✅ Rust 编译已完成"
fi

echo ""

# 检查 .so 文件（Rust 库）
echo "📚 Rust 库文件状态:"
if [ -f "/Users/yangmengying/workspace/drink/src-tauri/target/aarch64-linux-android/release/libcocktail_app_lib.so" ]; then
    SIZE=$(du -h "/Users/yangmengying/workspace/drink/src-tauri/target/aarch64-linux-android/release/libcocktail_app_lib.so" | cut -f1)
    echo "  ✅ ARM64: $SIZE"
else
    echo "  ❌ ARM64: 未找到"
fi

if [ -f "/Users/yangmengying/workspace/drink/src-tauri/target/armv7-linux-androideabi/release/libcocktail_app_lib.so" ]; then
    SIZE=$(du -h "/Users/yangmengying/workspace/drink/src-tauri/target/armv7-linux-androideabi/release/libcocktail_app_lib.so" | cut -f1)
    echo "  ✅ ARMv7: $SIZE"
else
    echo "  ❌ ARMv7: 未找到"
fi

echo ""

# 检查 APK 文件
echo "📦 APK 文件状态:"
APK_COUNT=$(find /Users/yangmengying/workspace/drink/src-tauri/gen/android -name "*.apk" 2>/dev/null | wc -l | tr -d ' ')

if [ "$APK_COUNT" -gt 0 ]; then
    echo "  ✅ 找到 $APK_COUNT 个 APK 文件:"
    find /Users/yangmengying/workspace/drink/src-tauri/gen/android -name "*.apk" 2>/dev/null | while read apk; do
        SIZE=$(du -h "$apk" | cut -f1)
        NAME=$(basename "$apk")
        echo "     • $NAME ($SIZE)"
    done
else
    echo "  ⏳ 暂未生成 APK（Gradle 还在打包中）"
fi

echo ""

# 检查构建目录
echo "🗂️  构建目录状态:"
if [ -d "/Users/yangmengying/workspace/drink/src-tauri/gen/android/app/build" ]; then
    echo "  ✅ app/build 目录存在"
    
    if [ -d "/Users/yangmengying/workspace/drink/src-tauri/gen/android/app/build/outputs" ]; then
        echo "  ✅ outputs 目录存在"
        
        if [ -d "/Users/yangmengying/workspace/drink/src-tauri/gen/android/app/build/outputs/apk" ]; then
            echo "  ✅ apk 目录存在"
        else
            echo "  ⏳ apk 目录未创建"
        fi
    else
        echo "  ⏳ outputs 目录未创建"
    fi
else
    echo "  ⏳ build 目录未创建（构建刚开始）"
fi

echo ""

# 总结
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ "$APK_COUNT" -gt 0 ]; then
    echo "🎉 构建完成！APK 已生成！"
    echo ""
    echo "下一步："
    echo "1. 复制 APK 到桌面："
    echo "   cp \$(find /Users/yangmengying/workspace/drink/src-tauri/gen/android -name '*universal*.apk' | head -1) ~/Desktop/调酒助手.apk"
    echo ""
    echo "2. 通过微信发送到手机"
elif [ "$GRADLE_COUNT" -gt 0 ]; then
    echo "⏳ 构建进行中..."
    echo ""
    echo "当前阶段: Gradle 打包"
    echo "预计剩余时间: 2-5 分钟"
    echo ""
    echo "提示: 每隔 30 秒运行此脚本查看进度"
else
    echo "❓ 构建状态不明确"
    echo ""
    echo "可能需要重新开始构建:"
    echo "  npm run tauri android build"
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
