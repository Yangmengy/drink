import { useState, useEffect, useRef } from 'react';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Settings, Trash2, Send, Bot, User } from 'lucide-react';
import { useBackground } from '../hooks/useBackground';
import type { 
  UserProfileExtended,
  ChatMessagePayload
} from '../types';
import styles from './AIBartenderPage.module.css';

const MOOD_OPTIONS = [
  { value: 'happy', label: '开心', emoji: '😊' },
  { value: 'relaxed', label: '放松', emoji: '😌' },
  { value: 'excited', label: '兴奋', emoji: '🤩' },
  { value: 'celebrate', label: '庆祝', emoji: '🎉' },
  { value: 'romantic', label: '浪漫', emoji: '💕' },
  { value: 'creative', label: '创造', emoji: '🎨' },
  { value: 'tired', label: '疲惫', emoji: '😴' },
  { value: 'stressed', label: '压力', emoji: '😰' },
  { value: 'sad', label: '低落', emoji: '😢' },
  { value: 'lonely', label: '孤单', emoji: '🥺' },
  { value: 'anxious', label: '焦虑', emoji: '😟' },
  { value: 'bored', label: '无聊', emoji: '😑' },
];

const WEATHER_OPTIONS = [
  { value: 'sunny', label: '晴天', emoji: '☀️' },
  { value: 'cloudy', label: '多云', emoji: '☁️' },
  { value: 'rainy', label: '雨天', emoji: '🌧️' },
  { value: 'snowy', label: '雪天', emoji: '❄️' },
];

export default function AIBartenderPage() {
  const navigate = useNavigate();
  
  // 应用全局背景
  useBackground();
  
  // 对话状态
  const [messages, setMessages] = useState<ChatMessagePayload[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 上下文选项
  const [selectedMood, setSelectedMood] = useState<string>('');
  const [selectedWeather, setSelectedWeather] = useState<string>('');

  // 用户与LLM配置状态
  const [userProfile, setUserProfile] = useState<UserProfileExtended | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  const [tempMbti, setTempMbti] = useState('');
  const [tempZodiac, setTempZodiac] = useState('');
  const [tempLlmKey, setTempLlmKey] = useState('');
  const [tempLlmModel, setTempLlmModel] = useState('');
  const [tempLlmBaseUrl, setTempLlmBaseUrl] = useState('');

  // 初始加载
  useEffect(() => {
    loadUserProfile();
    loadChatHistory();
  }, []);

  const loadUserProfile = async () => {
    try {
      const profile = await invoke<UserProfileExtended>('get_user_profile');
      setUserProfile(profile);
      
      // 加载保存的心情和天气
      if (profile.current_mood) {
        setSelectedMood(profile.current_mood);
      }
      if (profile.current_weather) {
        setSelectedWeather(profile.current_weather);
      }
    } catch (error) {
      console.error('加载用户信息失败:', error);
    }
  };

  const loadChatHistory = async () => {
    try {
      const history = await invoke<ChatMessagePayload[]>('get_chat_history');
      setMessages(history);
    } catch (error) {
      console.error('加载聊天记录失败:', error);
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // 保存心情到本地
  const handleMoodChange = async (mood: string) => {
    setSelectedMood(mood);
    try {
      await invoke('update_mood_weather', {
        mood: mood || null,
        weather: selectedWeather || null,
      });
    } catch (error) {
      console.error('保存心情失败:', error);
    }
  };

  // 保存天气到本地
  const handleWeatherChange = async (weather: string) => {
    setSelectedWeather(weather);
    try {
      await invoke('update_mood_weather', {
        mood: selectedMood || null,
        weather: weather || null,
      });
    } catch (error) {
      console.error('保存天气失败:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;
    if (!selectedMood || !selectedWeather) {
      alert("请先在顶部选择心情和天气！");
      return;
    }

    // 先添加到UI展示
    const tempUserMessage: ChatMessagePayload = {
      id: Date.now().toString(),
      role: 'user',
      text: inputText.trim(),
      recipes: []
    };
    
    setMessages(prev => [...prev, tempUserMessage]);
    const currentInput = inputText.trim();
    setInputText('');
    setIsTyping(true);

    try {
      // 检查是否配置了API Key
      if (!userProfile?.llm_api_key) {
        setIsSettingsOpen(true);
        throw new Error('请先配置大模型 API Key');
      }

      const response = await invoke<ChatMessagePayload>('send_chat_message', {
        message: currentInput,
        mood: selectedMood || null,
        weather: selectedWeather || null,
      });
      setMessages(prev => [...prev, response]);
    } catch (error) {
      console.error('发送消息失败:', error);
      alert(`发送失败: ${error}`);
    } finally {
      setIsTyping(false);
    }
  };

  const handleQuickGenerate = async () => {
    if (!selectedMood || !selectedWeather) {
      alert("请先在顶部选择心情和天气！");
      return;
    }

    const quickText = "请根据我的心情和天气给我推荐。";
    
    const tempUserMessage: ChatMessagePayload = {
      id: Date.now().toString(),
      role: 'user',
      text: quickText,
      recipes: []
    };
    
    setMessages(prev => [...prev, tempUserMessage]);
    setIsTyping(true);

    try {
      if (!userProfile?.llm_api_key) {
        setIsSettingsOpen(true);
        throw new Error('请先配置大模型 API Key');
      }

      const response = await invoke<ChatMessagePayload>('send_chat_message', {
        message: quickText,
        mood: selectedMood,
        weather: selectedWeather,
      });
      setMessages(prev => [...prev, response]);
    } catch (error) {
      console.error('发送消息失败:', error);
      alert(`发送失败: ${error}`);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleClearHistory = async () => {
    if (confirm('确定要清空所有对话记录吗？')) {
      try {
        await invoke('clear_chat_history');
        setMessages([]);
      } catch (error) {
        console.error('清空记录失败:', error);
        alert('清空记录失败');
      }
    }
  };

  // 设置模态框操作
  const handleOpenSettings = () => {
    setIsSettingsOpen(true);
    setTempMbti(userProfile?.mbti || '');
    setTempZodiac(userProfile?.zodiac || '');
    setTempLlmKey(userProfile?.llm_api_key || '');
    setTempLlmModel(userProfile?.llm_model || 'qwen-max');
    setTempLlmBaseUrl(userProfile?.llm_base_url || 'https://dashscope.aliyuncs.com/compatible-mode/v1');
  };

  const handleSaveSettings = async () => {
    try {
      await invoke('update_user_personality', {
        mbti: tempMbti.trim() || null,
        zodiac: tempZodiac || null,
      });
      
      await invoke('update_llm_config', {
        llmApiKey: tempLlmKey.trim() || null,
        llmModel: tempLlmModel.trim() || null,
        llmBaseUrl: tempLlmBaseUrl.trim() || null,
      });

      await loadUserProfile();
      setIsSettingsOpen(false);
    } catch (error) {
      console.error('保存设置失败:', error);
      alert(`保存失败：${error}`);
    }
  };

  return (
    <div className={styles.container}>
      {/* 背景装饰 */}
      <div className={styles.backgroundDecor}>
        <div className={styles.neonCircle}></div>
        <div className={styles.neonCircle2}></div>
      </div>

      {/* 导航栏 */}
      <header className={styles.header}>
        <button className={styles.iconButton} onClick={() => navigate('/')}>
          <ArrowLeft size={18} strokeWidth={2} />
        </button>
        
        <div className={styles.headerTitle}>AI 调酒师</div>
        
        <div className={styles.headerActions}>
          <button className={styles.iconButton} onClick={handleClearHistory} title="清空对话">
            <Trash2 size={18} strokeWidth={2} />
          </button>
          <button className={styles.iconButton} onClick={handleOpenSettings} title="偏好设置">
            <Settings size={18} strokeWidth={2} />
          </button>
        </div>
      </header>

      {/* 顶部上下文选择器 */}
      <div className={styles.topContextArea}>
        <div className={styles.contextSelectors}>
          <select 
            className={`${styles.contextSelect} ${!selectedMood ? styles.required : ''}`}
            value={selectedMood}
            onChange={(e) => handleMoodChange(e.target.value)}
          >
            <option value="">* 选择心情...</option>
            {MOOD_OPTIONS.map(m => (
              <option key={m.value} value={m.label}>{m.emoji} {m.label}</option>
            ))}
          </select>

          <select 
            className={`${styles.contextSelect} ${!selectedWeather ? styles.required : ''}`}
            value={selectedWeather}
            onChange={(e) => handleWeatherChange(e.target.value)}
          >
            <option value="">* 选择天气...</option>
            {WEATHER_OPTIONS.map(w => (
              <option key={w.value} value={w.label}>{w.emoji} {w.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 消息列表 */}
      <div className={styles.messageList}>
        {messages.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyStateIcon}>🍹</div>
            <p>告诉我想喝点什么，或者今天的心情如何？</p>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div key={msg.id || index} className={`${styles.messageWrapper} ${styles[msg.role]}`}>
              <div className={styles.messageBubble}>
                {msg.text}
              </div>
              
              {/* 如果包含推荐酒款 */}
              {msg.recipes && msg.recipes.length > 0 && (
                <div className={styles.recipeCarousel}>
                  {msg.recipes.map(recipe => (
                    <div 
                      key={recipe.id} 
                      className={styles.recipeCard}
                      onClick={() => navigate(`/recipe/${recipe.id}`)}
                    >
                      <div 
                        className={styles.recipeImage}
                        style={{ 
                          backgroundImage: recipe.image_url ? `url(${convertFileSrc(recipe.image_url)})` : 'none',
                          backgroundColor: recipe.image_url ? 'transparent' : '#eee'
                        }}
                      />
                      <div className={styles.recipeInfo}>
                        <h4 className={styles.recipeName}>{recipe.name_zh}</h4>
                        <div className={styles.recipeMeta}>
                          <span>🍸 {recipe.glass_type || '鸡尾酒杯'}</span>
                          <span>⭐ 难度 {recipe.difficulty || 1}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}

        {isTyping && (
          <div className={`${styles.messageWrapper} ${styles.assistant}`}>
            <div className={styles.loadingIndicator}>
              <div className={styles.dot}></div>
              <div className={styles.dot}></div>
              <div className={styles.dot}></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className={styles.floatingQuickGen}>
        <button 
          className={styles.quickGenButton}
          onClick={handleQuickGenerate}
          disabled={!selectedMood || !selectedWeather || isTyping}
          title="根据心情和天气快速生成"
        >
          ✨ 快速生成
        </button>
      </div>

      {/* 底部输入区 */}
      <div className={styles.bottomArea}>
        <div className={styles.inputArea}>
          <input
            type="text"
            className={styles.inputField}
            placeholder="今天想喝点什么..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isTyping}
          />
          <button 
            className={styles.sendButton} 
            onClick={handleSendMessage}
            disabled={!inputText.trim() || isTyping || !selectedMood || !selectedWeather}
          >
            <Send size={18} strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* 设置模态框 */}
      {isSettingsOpen && (
        <div className={styles.modal} onClick={() => setIsSettingsOpen(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>AI 调酒师设置</h3>
            
            <div className={styles.settingSection}>
              <div className={styles.sectionTitle}>
                <User size={18} /> 个人档案
              </div>
              <div className={styles.inputGroup}>
                <label className={styles.label}>MBTI 类型</label>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="如: INTJ, ENFP"
                  value={tempMbti}
                  onChange={(e) => setTempMbti(e.target.value.toUpperCase())}
                  maxLength={4}
                />
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.label}>星座</label>
                <select
                  className={styles.select}
                  value={tempZodiac}
                  onChange={(e) => setTempZodiac(e.target.value)}
                >
                  <option value="">请选择</option>
                  <option value="Aries">白羊座</option>
                  <option value="Taurus">金牛座</option>
                  <option value="Gemini">双子座</option>
                  <option value="Cancer">巨蟹座</option>
                  <option value="Leo">狮子座</option>
                  <option value="Virgo">处女座</option>
                  <option value="Libra">天秤座</option>
                  <option value="Scorpio">天蝎座</option>
                  <option value="Sagittarius">射手座</option>
                  <option value="Capricorn">摩羯座</option>
                  <option value="Aquarius">水瓶座</option>
                  <option value="Pisces">双鱼座</option>
                </select>
              </div>
            </div>

            <div className={styles.settingSection}>
              <div className={styles.sectionTitle}>
                <Bot size={18} /> 大模型配置 (支持兼容OpenAI的接口)
              </div>
              <div className={styles.inputGroup}>
                <label className={styles.label}>Base URL (接口地址)</label>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="例如: https://dashscope.aliyuncs.com/compatible-mode/v1"
                  value={tempLlmBaseUrl}
                  onChange={(e) => setTempLlmBaseUrl(e.target.value)}
                />
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.label}>API Key (密钥)</label>
                <input
                  type="password"
                  className={styles.input}
                  placeholder="sk-..."
                  value={tempLlmKey}
                  onChange={(e) => setTempLlmKey(e.target.value)}
                />
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.label}>Model (模型名称)</label>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="例如: qwen-max"
                  value={tempLlmModel}
                  onChange={(e) => setTempLlmModel(e.target.value)}
                />
              </div>
            </div>

            <div className={styles.modalButtons}>
              <button 
                className={styles.cancelButton}
                onClick={() => setIsSettingsOpen(false)}
              >
                取消
              </button>
              <button 
                className={styles.saveButton}
                onClick={handleSaveSettings}
              >
                保存设置
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
