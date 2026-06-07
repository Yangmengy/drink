#!/bin/bash

# Gradle 构建进度详细监控

echo "🔍 Gradle 构建进度监控"
echo "═══════════════════════════════════════════════════"
echo ""

# 1. 检查 Gradle 进程
echo "📊 进程状态:"
GRADLE_PROCS=$(ps aux | grep gradle | grep -v grep | grep -v "gradle-progress")
if [ -n "$GRADLE_PROCS" ]; then
    echo "✅ Gradle 正在运行"
    
    # 显示进程运行时间
    GRADLE_PID=$(echo "$GRADLE_PROCS" | head -1 | awk '{print $2}')
    GRADLE_TIME=$(ps -o etime= -p $GRADLE_PID 2>/dev/null | tr -d ' ')
    echo "   运行时间: $GRADLE_TIME"
    
    # CPU 使用率
    GRADLE_CPU=$(ps -o %cpu= -p $GRADLE_PID 2>/dev/null | tr -d ' ')
    echo "   CPU 使用: ${GRADLE_CPU}%"
    
    # 内存使用
    GRADLE_MEM=$(ps -o %mem= -p $GRADLE_PID 2>/dev/null | tr -d ' ')
    echo "   内存使用: ${GRADLE_MEM}%"
else
    echo "❌ Gradle 未运行"
fi

echo ""

# 2. 检查构建目录结构
echo "🗂️  构建目录进度:"

BUILD_DIR="/Users/yangmengying/workspace/drink/src-tauri/gen/android/app/build"

if [ ! -d "$BUILD_DIR" ]; then
    echo "⏳ 0% - build 目录未创建（刚开始）"
else
    echo "✅ 10% - build 目录已创建"
    
    if [ -d "$BUILD_DIR/generated" ]; then
        echo "✅ 20% - generated 目录已创建（代码生成中）"
    fi
    
    if [ -d "$BUILD_DIR/intermediates" ]; then
        echo "✅ 30% - intermediates 目录已创建（编译中间文件）"
        
        # 统计编译的文件数
        CLASS_COUNT=$(find "$BUILD_DIR" -name "*.class" 2>/dev/null | wc -l | tr -d ' ')
        if [ "$CLASS_COUNT" -gt 0 ]; then
            echo "✅ 40% - 已编译 $CLASS_COUNT 个类文件"
        fi
        
        DEX_COUNT=$(find "$BUILD_DIR" -name "*.dex" 2>/dev/null | wc -l | tr -d ' ')
        if [ "$DEX_COUNT" -gt 0 ]; then
            echo "✅ 50% - 已生成 $DEX_COUNT 个 DEX 文件"
        fi
    fi
    
    if [ -d "$BUILD_DIR/intermediates/merged_res" ]; then
        echo "✅ 60% - 资源文件已合并"
    fi
    
    if [ -d "$BUILD_DIR/intermediates/merged_native_libs" ]; then
        echo "✅ 70% - 原生库已合并"
        
        # 检查 .so 文件
        SO_COUNT=$(find "$BUILD_DIR/intermediates/merged_native_libs" -name "*.so" 2>/dev/null | wc -l | tr -d ' ')
        if [ "$SO_COUNT" -gt 0 ]; then
            echo "   └─ 找到 $SO_COUNT 个 .so 库文件"
        fi
    fi
    
    if [ -d "$BUILD_DIR/intermediates/apk_list" ]; then
        echo "✅ 80% - APK 列表已生成（即将打包）"
    fi
    
    if [ -d "$BUILD_DIR/outputs" ]; then
        echo "✅ 90% - outputs 目录已创建（正在打包）"
        
        if [ -d "$BUILD_DIR/outputs/apk" ]; then
            APK_COUNT=$(find "$BUILD_DIR/outputs/apk" -name "*.apk" 2>/dev/null | wc -l | tr -d ' ')
            if [ "$APK_COUNT" -gt 0 ]; then
                echo "🎉 100% - 构建完成！找到 $APK_COUNT 个 APK 文件！"
            else
                echo "⏳ 95% - APK 目录已创建，正在打包..."
            fi
        fi
    fi
fi

echo ""

# 3. 检查生成的文件数量
echo "📁 生成文件统计:"

if [ -d "$BUILD_DIR" ]; then
    TOTAL_FILES=$(find "$BUILD_DIR" -type f 2>/dev/null | wc -l | tr -d ' ')
    BUILD_SIZE=$(du -sh "$BUILD_DIR" 2>/dev/null | cut -f1)
    echo "   总文件数: $TOTAL_FILES"
    echo "   总大小: $BUILD_SIZE"
else
    echo "   暂无数据"
fi

echo ""

# 4. 最近修改的文件（显示 Gradle 正在处理什么）
echo "📝 最近活动:"
if [ -d "$BUILD_DIR" ]; then
    echo "   最近修改的文件:"
    find "$BUILD_DIR" -type f -mmin -1 2>/dev/null | head -5 | while read file; do
        REL_PATH=$(echo $file | sed "s|$BUILD_DIR/||")
        echo "   • $REL_PATH"
    done
    
    RECENT_COUNT=$(find "$BUILD_DIR" -type f -mmin -1 2>/dev/null | wc -l | tr -d ' ')
    if [ "$RECENT_COUNT" -eq 0 ]; then
        echo "   ⚠️  过去 1 分钟没有文件变化"
        echo "   可能: 正在下载依赖或等待其他资源"
    else
        echo "   ✅ 过去 1 分钟有 $RECENT_COUNT 个文件被修改"
    fi
else
    echo "   等待 Gradle 初始化..."
fi

echo ""

# 5. APK 文件检查
echo "📦 APK 文件:"
APK_FILES=$(find /Users/yangmengying/workspace/drink/src-tauri/gen/android -name "*.apk" 2>/dev/null)
if [ -n "$APK_FILES" ]; then
    echo "$APK_FILES" | while read apk; do
        SIZE=$(du -h "$apk" | cut -f1)
        NAME=$(basename "$apk")
        echo "   ✅ $NAME ($SIZE)"
    done
else
    echo "   ⏳ 暂未生成"
fi

echo ""

# 6. 预估剩余时间
echo "⏱️  预估:"
if [ -d "$BUILD_DIR/outputs/apk" ]; then
    APK_EXISTS=$(find "$BUILD_DIR/outputs/apk" -name "*.apk" 2>/dev/null | wc -l | tr -d ' ')
    if [ "$APK_EXISTS" -gt 0 ]; then
        echo "   🎉 构建已完成！"
    else
        echo "   ⏳ 剩余时间: 1-2 分钟（正在打包 APK）"
    fi
elif [ -d "$BUILD_DIR/intermediates" ]; then
    echo "   ⏳ 剩余时间: 2-4 分钟（编译中）"
elif [ -d "$BUILD_DIR" ]; then
    echo "   ⏳ 剩余时间: 3-5 分钟（初始化中）"
else
    echo "   ⏳ 剩余时间: 4-6 分钟（刚开始）"
fi

echo ""
echo "═══════════════════════════════════════════════════"
echo "💡 提示: 运行 'watch -n 10 ./gradle-progress.sh' 可以自动刷新"
