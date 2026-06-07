/**
 * 生成原料图片脚本
 * 使用阿里云 DashScope API (qwen-image 模型)
 */

import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 配置
const CONFIG = {
  apiKey: 'sk-7beba2e4fd7640d88ec1364548a80363',
  baseUrl: 'https://dashscope.aliyuncs.com/api/v1',
  model: 'qwen-image-2.0',
  outputDir: path.join(__dirname, '../public/ingredients')
};

// 确保输出目录存在
if (!fs.existsSync(CONFIG.outputDir)) {
  fs.mkdirSync(CONFIG.outputDir, { recursive: true });
}

// 常见原料列表 (先测试5个)
const ingredients = [
  {
    id: 'lemon',
    name_zh: '柠檬',
    name_en: 'Lemon',
    prompt: 'A fresh whole lemon with glossy yellow skin, studio lighting, white background, product photography style, 4K, ultra realistic, commercial quality'
  },
  {
    id: 'lime',
    name_zh: '青柠',
    name_en: 'Lime',
    prompt: 'A fresh whole lime with glossy green skin, studio lighting, white background, product photography style, 4K, ultra realistic, commercial quality'
  },
  {
    id: 'mint',
    name_zh: '薄荷叶',
    name_en: 'Mint Leaves',
    prompt: 'Fresh green mint leaves bunch, studio lighting, white background, product photography style, 4K, ultra realistic, commercial quality'
  },
  {
    id: 'sugar',
    name_zh: '白糖',
    name_en: 'White Sugar',
    prompt: 'White granulated sugar in a small pile, studio lighting, white background, product photography style, 4K, ultra realistic, commercial quality'
  },
  {
    id: 'ice',
    name_zh: '冰块',
    name_en: 'Ice Cubes',
    prompt: 'Clear ice cubes with water droplets, studio lighting, white background, product photography style, 4K, ultra realistic, commercial quality'
  }
];

/**
 * 发送HTTP请求
 */
function makeRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const protocol = options.protocol === 'https:' ? https : http;
    const req = protocol.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve(data);
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });
    
    req.on('error', reject);
    
    if (postData) {
      req.write(JSON.stringify(postData));
    }
    
    req.end();
  });
}

/**
 * 下载图片
 */
function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(filepath);
    
    protocol.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(filepath);
      });
    }).on('error', (err) => {
      fs.unlink(filepath, () => {});
      reject(err);
    });
  });
}

/**
 * 生成单张图片
 */
async function generateImage(ingredient) {
  console.log(`\n🎨 正在生成: ${ingredient.name_zh} (${ingredient.name_en})`);
  console.log(`📝 提示词: ${ingredient.prompt}`);
  
  try {
    // 尝试使用 OpenAI 兼容接口
    const url = new URL('/compatible-mode/v1/images/generations', CONFIG.baseUrl);
    
    const options = {
      protocol: 'https:',
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CONFIG.apiKey}`,
        'Content-Type': 'application/json'
      }
    };
    
    const requestBody = {
      model: CONFIG.model,
      prompt: ingredient.prompt,
      n: 1,
      size: '1024x1024'
    };
    
    console.log('⏳ 发送请求...');
    const response = await makeRequest(options, requestBody);
    
    console.log('✅ API响应:', JSON.stringify(response, null, 2));
    
    // 检查响应格式
    if (response.data && response.data[0] && response.data[0].url) {
      const imageUrl = response.data[0].url;
      const filename = `${ingredient.id}.png`;
      const filepath = path.join(CONFIG.outputDir, filename);
      
      console.log('⬇️  下载图片...');
      await downloadImage(imageUrl, filepath);
      console.log(`✅ 图片已保存: ${filepath}`);
      
      return {
        success: true,
        ingredient: ingredient.name_zh,
        filepath
      };
    } else {
      throw new Error('响应格式不正确');
    }
    
  } catch (error) {
    console.error(`❌ 生成失败: ${error.message}`);
    return {
      success: false,
      ingredient: ingredient.name_zh,
      error: error.message
    };
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('='.repeat(60));
  console.log('🚀 开始生成原料图片');
  console.log('='.repeat(60));
  console.log(`📦 模型: ${CONFIG.model}`);
  console.log(`📁 输出目录: ${CONFIG.outputDir}`);
  console.log(`🎯 待生成数量: ${ingredients.length}`);
  
  const results = [];
  
  for (const ingredient of ingredients) {
    const result = await generateImage(ingredient);
    results.push(result);
    
    // 添加延迟避免频率限制
    if (ingredient !== ingredients[ingredients.length - 1]) {
      console.log('⏱️  等待3秒...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  
  // 输出总结
  console.log('\n' + '='.repeat(60));
  console.log('📊 生成结果汇总');
  console.log('='.repeat(60));
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`✅ 成功: ${successful.length}/${results.length}`);
  console.log(`❌ 失败: ${failed.length}/${results.length}`);
  
  if (successful.length > 0) {
    console.log('\n✅ 成功生成:');
    successful.forEach(r => {
      console.log(`  - ${r.ingredient}: ${r.filepath}`);
    });
  }
  
  if (failed.length > 0) {
    console.log('\n❌ 失败列表:');
    failed.forEach(r => {
      console.log(`  - ${r.ingredient}: ${r.error}`);
    });
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✨ 完成!');
  console.log('='.repeat(60));
}

// 执行
main().catch(console.error);
