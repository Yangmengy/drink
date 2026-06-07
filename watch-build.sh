#!/bin/bash

echo "🔍 实时监控 Android 构建进度"
echo "═══════════════════════════════════════"
echo ""

while true; do
    clear
    echo "🔍 Android 构建进度监控 - $(date '+%H:%M:%S')"
    echo "═══════════════════════════════════════════════════"
    echo ""
    
    # 检查 Gradle 进程
    if pgrep -f "gradle" > /dev/null 2>&1; then
        GRADLE_PID=$(pgrep -f "gradle" | head -1)
        GRADLE_TIME=$(ps -p $GRADLE_PID -o etime= 2>/dev/null | tr -d ' ')
        GRADLE_CPU=$(ps -p $GRADLE_PID -o %cpu= 2>/dev/null | tr -d ' ')
        GRADLE_MEM=$(ps -p $GRADLE_PID -o %mem= 2>/dev/null | tr -d ' ')
        
        echo "📦 Gradle 打包: 运行中"
        echo "   运行时间: $GRADLE_TIME"
        echo "   CPU: ${GRADLE_CPU}%"
        echo "   内存: ${GRADLE_MEM}%"
    else
        echo "📦 Gradle 打包: 未运行"
    fi
    
    echo ""
    echo "─────────────────────────────────────────────────"
    echo ""
    
    # 检查构建目录
    BUILD_DIR="src-tauri/gen/android/app/build"
    if [ -d "$BUILD_DIR" ]; then
        echo "✅ 构建目录已创建"
        
        # 统计文件数
        FILE_COUNT=$(find "$BUILD_DIR" -type f 2>/dev/null | wc -l | tr -d ' ')
        DIR_SIZE=$(du -sh "$BUILD_DIR" 2>/dev/null | cut -f1)
        
        echo "   文件数: $FILE_COUNT"
        echo "   目录大小: $DIR_SIZE"
        
        # 检查中间产物
        if [ -d "$BUILD_DIR/intermediates" ]; then
            echo "   ✓ 中间文件生成中"
        fi
        
        # 检查 APK
        APK_DIR="$BUILD_DIR/outputs/apk"
        if [ -d "$APK_DIR" ]; then
            echo ""
            echo "🎉 APK 输出目录已创建！"
            
            # 查找 APK 文件
            APK_FILES=$(find "$APK_DIR" -name "*.apk" 2>/dev/null)
            if [ -n "$APK_FILES" ]; then
                echo ""
                echo "🎊 APK 文件生成完成！"
                echo ""
                echo "$APK_FILES" | while read apk; do
                    SIZE=$(du -h "$apk" 2>/dev/null | cut -f1)
                    echo "   📱 $(basename $apk) - $SIZE"
                done
                echo ""
                echo "═══════════════════════════════════════════════════"
                echo "✅ 构建完成！按 Ctrl+C 退出监控"
                exit 0
            fi
        fi
    else
        echo "⏳ 等待 Gradle 初始化..."
    fi
    
    echo ""
    echo "─────────────────────────────────────────────────"
    echo "💡 每 10 秒自动刷新 | 按 Ctrl+C 退出"
    echo "═══════════════════════════════════════════════════"
    
    sleep 10
done
