/**
 * 测试阿里云 DashScope 兼容 OpenAI 接口
 */

const API_KEY = 'sk-7beba2e4fd7640d88ec1364548a80363';
const BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
const MODEL = 'qwen-plus';

async function testLLMConnection() {
  console.log('=== 测试 DashScope 兼容 OpenAI 接口 ===\n');
  console.log('配置信息:');
  console.log('- Base URL:', BASE_URL);
  console.log('- Model:', MODEL);
  console.log('- API Key:', API_KEY.substring(0, 10) + '...\n');

  try {
    const url = `${BASE_URL}/chat/completions`;
    console.log('请求 URL:', url);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: 'system',
            content: '你是一个友好的助手。'
          },
          {
            role: 'user',
            content: '你好，请用一句话回复。'
          }
        ],
        max_tokens: 100
      })
    });

    console.log('响应状态:', response.status, response.statusText);
    
    const responseText = await response.text();
    console.log('\n原始响应:');
    console.log(responseText);

    if (!response.ok) {
      console.error('\n❌ 请求失败');
      console.error('状态码:', response.status);
      console.error('响应内容:', responseText);
      return;
    }

    const data = JSON.parse(responseText);
    console.log('\n✅ 请求成功!');
    console.log('回复内容:', data.choices[0]?.message?.content || '(无内容)');
    console.log('\n完整响应结构:');
    console.log(JSON.stringify(data, null, 2));

  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    if (error.cause) {
      console.error('原因:', error.cause);
    }
  }
}

// 运行测试
testLLMConnection();
