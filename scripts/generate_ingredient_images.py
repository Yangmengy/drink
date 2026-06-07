#!/usr/bin/env python3
"""
生成原料图片脚本
使用阿里云 DashScope SDK (qwen-image-2.0 模型)
"""

import dashscope
from dashscope import ImageSynthesis
import os
import urllib.request
from pathlib import Path

# 配置
API_KEY = 'sk-7480ef1eb9834a35868966befbd3a10d'
MODEL = 'qwen-image-2.0'
OUTPUT_DIR = Path(__file__).parent.parent / 'public' / 'ingredients'

# 设置API Key
dashscope.api_key = API_KEY

# 确保输出目录存在
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# 常见原料列表 (先测试5个)
ingredients = [
    {
        'id': 'lemon',
        'name_zh': '柠檬',
        'name_en': 'Lemon',
        'prompt': 'A fresh whole lemon with glossy yellow skin, studio lighting, white background, product photography style, 4K, ultra realistic, commercial quality'
    },
    {
        'id': 'lime',
        'name_zh': '青柠',
        'name_en': 'Lime',
        'prompt': 'A fresh whole lime with glossy green skin, studio lighting, white background, product photography style, 4K, ultra realistic, commercial quality'
    },
    {
        'id': 'mint',
        'name_zh': '薄荷叶',
        'name_en': 'Mint Leaves',
        'prompt': 'Fresh green mint leaves bunch, studio lighting, white background, product photography style, 4K, ultra realistic, commercial quality'
    },
    {
        'id': 'sugar',
        'name_zh': '白糖',
        'name_en': 'White Sugar',
        'prompt': 'White granulated sugar in a small pile, studio lighting, white background, product photography style, 4K, ultra realistic, commercial quality'
    },
    {
        'id': 'ice',
        'name_zh': '冰块',
        'name_en': 'Ice Cubes',
        'prompt': 'Clear ice cubes with water droplets, studio lighting, white background, product photography style, 4K, ultra realistic, commercial quality'
    }
]


def download_image(url, filepath):
    """下载图片"""
    try:
        urllib.request.urlretrieve(url, filepath)
        return True
    except Exception as e:
        print(f'  ❌ 下载失败: {e}')
        return False


def generate_image(ingredient):
    """生成单张图片"""
    print(f'\n🎨 正在生成: {ingredient["name_zh"]} ({ingredient["name_en"]})')
    print(f'📝 提示词: {ingredient["prompt"]}')
    
    try:
        # 调用图像生成API (使用异步模式)
        print('⏳ 调用API (异步模式)...')
        response = ImageSynthesis.async_call(
            model=MODEL,
            prompt=ingredient['prompt'],
            n=1,
            size='1024*1024'
        )
        
        # 检查响应
        if response.status_code == 200:
            # 异步任务,需要轮询结果
            task_id = response.output.task_id
            print(f'✅ 任务创建成功: {task_id}')
            print('⏳ 等待生成完成...')
            
            import time
            max_retries = 60  # 最多等待60次 * 2秒 = 2分钟
            retry_count = 0
            
            while retry_count < max_retries:
                result_response = ImageSynthesis.wait(task=response)
                
                if result_response.status_code == 200:
                    if result_response.output and result_response.output.results:
                        image_url = result_response.output.results[0].url
                        print(f'✅ 图片URL: {image_url}')
                        
                        # 下载图片
                        filename = f"{ingredient['id']}.png"
                        filepath = OUTPUT_DIR / filename
                        
                        print('⬇️  下载图片...')
                        if download_image(image_url, str(filepath)):
                            print(f'✅ 图片已保存: {filepath}')
                            return {
                                'success': True,
                                'ingredient': ingredient['name_zh'],
                                'filepath': str(filepath)
                            }
                    else:
                        raise Exception(f'任务状态异常: {result_response.output.task_status}')
                
                retry_count += 1
                time.sleep(2)
            
            raise Exception('任务超时')
        else:
            raise Exception(f'API错误: {response.code} - {response.message}')
            
    except Exception as e:
        print(f'❌ 生成失败: {e}')
        return {
            'success': False,
            'ingredient': ingredient['name_zh'],
            'error': str(e)
        }


def main():
    """主函数"""
    print('=' * 60)
    print('🚀 开始生成原料图片')
    print('=' * 60)
    print(f'📦 模型: {MODEL}')
    print(f'📁 输出目录: {OUTPUT_DIR}')
    print(f'🎯 待生成数量: {len(ingredients)}')
    
    results = []
    
    for i, ingredient in enumerate(ingredients, 1):
        print(f'\n[{i}/{len(ingredients)}]')
        result = generate_image(ingredient)
        results.append(result)
        
        # 添加延迟避免频率限制
        if i < len(ingredients):
            import time
            print('⏱️  等待2秒...')
            time.sleep(2)
    
    # 输出总结
    print('\n' + '=' * 60)
    print('📊 生成结果汇总')
    print('=' * 60)
    
    successful = [r for r in results if r['success']]
    failed = [r for r in results if not r['success']]
    
    print(f'✅ 成功: {len(successful)}/{len(results)}')
    print(f'❌ 失败: {len(failed)}/{len(results)}')
    
    if successful:
        print('\n✅ 成功生成:')
        for r in successful:
            print(f"  - {r['ingredient']}: {r['filepath']}")
    
    if failed:
        print('\n❌ 失败列表:')
        for r in failed:
            print(f"  - {r['ingredient']}: {r['error']}")
    
    print('\n' + '=' * 60)
    print('✨ 完成!')
    print('=' * 60)


if __name__ == '__main__':
    main()
