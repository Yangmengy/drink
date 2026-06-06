import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useBackground } from '../hooks/useBackground';
import type { 
  RecommendationRequest, 
  RecommendationResponse, 
  MoodTag, 
  WeatherType,
  UserProfileExtended,
} from '../types';
import styles from './AIBartenderPage.module.css';

const MOOD_OPTIONS: { value: MoodTag; label: string; emoji: string }[] = [
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

const WEATHER_OPTIONS: { value: WeatherType; label: string; emoji: string }[] = [
  { value: 'sunny', label: '晴天', emoji: '☀️' },
  { value: 'cloudy', label: '多云', emoji: '☁️' },
  { value: 'rainy', label: '雨天', emoji: '🌧️' },
  { value: 'snowy', label: '雪天', emoji: '❄️' },
];

type ViewState = 'input' | 'loading' | 'result';

export default function AIBartenderPage() {
  const navigate = useNavigate();
  
  // 应用全局背景
  useBackground();
  
  // 状态管理
  const [viewState, setViewState] = useState<ViewState>('input');
  const [selectedMoods, setSelectedMoods] = useState<MoodTag[]>([]);
  const [selectedWeather, setSelectedWeather] = useState<WeatherType>('sunny');
  const [userProfile, setUserProfile] = useState<UserProfileExtended | null>(null);
  const [recommendation, setRecommendation] = useState<RecommendationResponse | null>(null);
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isEditingPersonality, setIsEditingPersonality] = useState(false);
  const [tempMbti, setTempMbti] = useState('');
  const [tempZodiac, setTempZodiac] = useState('');
  
  // LLM 配置状态
  const [isEditingLlm, setIsEditingLlm] = useState(false);
  const [tempLlmKey, setTempLlmKey] = useState('');
  const [tempLlmModel, setTempLlmModel] = useState('');
  const [tempLlmBaseUrl, setTempLlmBaseUrl] = useState('');

  // 加载用户信息
  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      const profile = await invoke<UserProfileExtended>('get_user_profile');
      setUserProfile(profile);
    } catch (error) {
      console.error('加载用户信息失败:', error);
    }
  };

  // 切换心情标签
  const toggleMood = (mood: MoodTag) => {
    setSelectedMoods(prev => 
      prev.includes(mood) 
        ? prev.filter(m => m !== mood)
        : [...prev, mood]
    );
  };

  // 开始推荐
  const handleStartRecommendation = async () => {
    if (selectedMoods.length === 0) {
      alert('请至少选择一个心情标签');
      return;
    }

    setViewState('loading');
    setDisplayedText('');

    try {
      const request: RecommendationRequest = {
        moodTags: selectedMoods,
        weather: selectedWeather,
        temperature: 25, // 可以从天气 API 获取
        useLlm: false, // Phase 1: 使用模板生成
      };

      const result = await invoke<RecommendationResponse>('get_ai_recommendation', { request });
      setRecommendation(result);
      setViewState('result');

      // 打字机效果
      typewriterEffect(result.reason);
    } catch (error) {
      console.error('获取推荐失败:', error);
      alert(`推荐失败: ${error}`);
      setViewState('input');
    }
  };

  // 打字机效果
  const typewriterEffect = (text: string) => {
    setIsTyping(true);
    let index = 0;
    const interval = setInterval(() => {
      if (index < text.length) {
        setDisplayedText(prev => prev + text[index]);
        index++;
      } else {
        clearInterval(interval);
        setIsTyping(false);
      }
    }, 30); // 30ms per character
  };

  // 提交反馈
  const handleFeedback = async (feedback: 1 | 0) => {
    if (!recommendation) return;

    try {
      await invoke('submit_recommendation_feedback', {
        feedback: {
          recommendationId: recommendation.recommendationId,
          feedback,
        },
      });

      alert(feedback === 1 ? '感谢您的喜欢 👍' : '已记录您的反馈 👎');
    } catch (error) {
      console.error('提交反馈失败:', error);
    }
  };

  // 添加到待做清单
  const handleAddToTodo = async () => {
    if (!recommendation) return;

    try {
      await invoke('add_to_todo_from_ai', {
        recipeId: recommendation.recipe.id,
        moodContext: selectedMoods,
      });

      alert('已添加到待做清单 🎯');
    } catch (error) {
      console.error('添加到待做清单失败:', error);
      alert(`添加失败: ${error}`);
    }
  };

  // 查看完整配方
  const handleViewRecipe = () => {
    if (recommendation) {
      navigate(`/recipe/${recommendation.recipe.id}`);
    }
  };

  // 重新推荐
  const handleRestart = () => {
    setViewState('input');
    setRecommendation(null);
    setDisplayedText('');
    setSelectedMoods([]);
  };

  // 更新个性信息
  const handleUpdatePersonality = async () => {
    setIsEditingPersonality(true);
    setTempMbti(userProfile?.mbti || '');
    setTempZodiac(userProfile?.zodiac || '');
  };

  const handleSavePersonality = async () => {
    try {
      await invoke('update_user_personality', {
        mbti: tempMbti.trim() || null,
        zodiac: tempZodiac || null,
      });
      await loadUserProfile();
      setIsEditingPersonality(false);
      alert('个性信息已更新');
    } catch (error) {
      console.error('更新失败:', error);
      alert(`更新失败：${error}`);
    }
  };

  const handleCancelEdit = () => {
    setIsEditingPersonality(false);
    setTempMbti('');
    setTempZodiac('');
  };

  // LLM 配置相关函数
  const handleOpenLlmSettings = () => {
    setIsEditingLlm(true);
    setTempLlmKey(userProfile?.llm_api_key || '');
    setTempLlmModel(userProfile?.llm_model || 'gpt-3.5-turbo');
    setTempLlmBaseUrl(userProfile?.llm_base_url || 'https://api.openai.com/v1');
  };

  const handleSaveLlmSettings = async () => {
    try {
      await invoke('update_llm_config', {
        llmApiKey: tempLlmKey.trim() || null,
        llmModel: tempLlmModel.trim() || null,
        llmBaseUrl: tempLlmBaseUrl.trim() || null,
      });
      await loadUserProfile();
      setIsEditingLlm(false);
      alert('LLM 配置已保存');
    } catch (error) {
      console.error('保存 LLM 配置失败:', error);
      alert(`保存失败：${error}`);
    }
  };

  const handleCancelLlmEdit = () => {
    setIsEditingLlm(false);
  };

  return (
    <div className={styles.container}>
      {/* 返回按钮 */}
      <button 
        className={styles.backButton}
        onClick={() => navigate('/')}
      >
        <ArrowLeft size={24} />
      </button>

      {/* 设置按钮 */}
      <button 
        className={styles.settingsButton}
        onClick={handleOpenLlmSettings}
        style={{ position: 'absolute', top: 'env(safe-area-inset-top, 20px)', right: '16px', zIndex: 10, background: 'rgba(0,0,0,0.3)', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', color: 'white', cursor: 'pointer', backdropFilter: 'blur(8px)' }}
      >
        ⚙️
      </button>

      {/* 背景装饰 */}
      <div className={styles.backgroundDecor}>
        <div className={styles.neonCircle}></div>
        <div className={styles.neonCircle2}></div>
      </div>

      {/* 输入阶段 */}
      {viewState === 'input' && (
        <div className={styles.inputSection}>
          <h1 className={styles.title}>
            <span className={styles.neonText}>AI 调酒师</span>
            <span className={styles.subtitle}>为您专属调制</span>
          </h1>

          {/* 用户个性信息 */}
          <div className={styles.personalityCard}>
            <div className={styles.personalityInfo}>
              <span>MBTI: {userProfile?.mbti || '未设置'}</span>
              <span>星座: {userProfile?.zodiac || '未设置'}</span>
            </div>
            <button 
              className={styles.editButton}
              onClick={handleUpdatePersonality}
            >
              编辑
            </button>
          </div>

          {/* 编辑个性信息弹窗 */}
          {isEditingPersonality && (
            <div className={styles.modal}>
              <div className={styles.modalContent}>
                <h3 className={styles.modalTitle}>编辑个性信息</h3>
                
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

                <div className={styles.modalButtons}>
                  <button 
                    className={styles.cancelButton}
                    onClick={handleCancelEdit}
                  >
                    取消
                  </button>
                  <button 
                    className={styles.saveButton}
                    onClick={handleSavePersonality}
                  >
                    保存
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* LLM 配置弹窗 */}
          {isEditingLlm && (
            <div className={styles.modal}>
              <div className={styles.modalContent}>
                <h3 className={styles.modalTitle}>AI 调酒师配置 (LLM)</h3>
                
                <div className={styles.inputGroup}>
                  <label className={styles.label}>Base URL (接口地址)</label>
                  <input
                    type="text"
                    className={styles.input}
                    placeholder="例如: https://api.deepseek.com/v1"
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
                    placeholder="例如: deepseek-chat"
                    value={tempLlmModel}
                    onChange={(e) => setTempLlmModel(e.target.value)}
                  />
                </div>

                <div className={styles.modalButtons}>
                  <button 
                    className={styles.cancelButton}
                    onClick={handleCancelLlmEdit}
                  >
                    取消
                  </button>
                  <button 
                    className={styles.saveButton}
                    onClick={handleSaveLlmSettings}
                  >
                    保存配置
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 心情选择 */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>今天的心情</h2>
            <div className={styles.moodGrid}>
              {MOOD_OPTIONS.map(mood => (
                <button
                  key={mood.value}
                  className={`${styles.moodButton} ${
                    selectedMoods.includes(mood.value) ? styles.selected : ''
                  }`}
                  onClick={() => toggleMood(mood.value)}
                >
                  <span className={styles.emoji}>{mood.emoji}</span>
                  <span className={styles.label}>{mood.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 天气选择 */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>当前天气</h2>
            <div className={styles.weatherGrid}>
              {WEATHER_OPTIONS.map(weather => (
                <button
                  key={weather.value}
                  className={`${styles.weatherButton} ${
                    selectedWeather === weather.value ? styles.selected : ''
                  }`}
                  onClick={() => setSelectedWeather(weather.value)}
                >
                  <span className={styles.emoji}>{weather.emoji}</span>
                  <span className={styles.label}>{weather.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 开始按钮 */}
          <button
            className={styles.startButton}
            onClick={handleStartRecommendation}
            disabled={selectedMoods.length === 0}
          >
            <span>召唤调酒师</span>
            <span className={styles.buttonIcon}>🍸</span>
          </button>
        </div>
      )}

      {/* 加载阶段 */}
      {viewState === 'loading' && (
        <div className={styles.loadingSection}>
          <div className={styles.shakerAnimation}>
            <div className={styles.shaker}>🍹</div>
          </div>
          <p className={styles.loadingText}>正在分析您的心情...</p>
          <p className={styles.loadingText}>调制专属特调...</p>
        </div>
      )}

      {/* 结果阶段 */}
      {viewState === 'result' && recommendation && (
        <div className={styles.resultSection}>
          <h2 className={styles.resultTitle}>为您特调</h2>

          {/* 酒款卡片 */}
          <div className={styles.recipeCard}>
            {recommendation.recipe.image_url && (
              <div 
                className={styles.recipeImage}
                style={{ backgroundImage: `url(${recommendation.recipe.image_url})` }}
              />
            )}
            
            <div className={styles.recipeInfo}>
              <h3 className={styles.recipeName}>{recommendation.recipe.name_zh}</h3>
              {recommendation.recipe.name_en && (
                <p className={styles.recipeNameEn}>{recommendation.recipe.name_en}</p>
              )}
              
              <div className={styles.recipeDetails}>
                <span>🥃 {recommendation.recipe.glass_type || '未知杯型'}</span>
                <span>⭐ 难度 {recommendation.recipe.difficulty}</span>
                <span>🎯 匹配度 {Math.round(recommendation.score)}%</span>
              </div>
            </div>
          </div>

          {/* 推介词 (打字机效果) */}
          <div className={styles.reasonCard}>
            <p className={styles.reasonText}>
              {displayedText}
              {isTyping && <span className={styles.cursor}>|</span>}
            </p>
          </div>

          {/* 记忆上下文 */}
          {recommendation.memoryContext && (
            <div className={styles.memoryCard}>
              <p className={styles.memoryText}>
                💭 {recommendation.memoryContext.preferenceSummary}
              </p>
            </div>
          )}

          {/* 操作按钮 */}
          <div className={styles.actionButtons}>
            <button
              className={`${styles.actionButton} ${styles.primary}`}
              onClick={handleAddToTodo}
            >
              🎯 加入待做清单
            </button>
            <button
              className={styles.actionButton}
              onClick={handleViewRecipe}
            >
              📖 查看完整配方
            </button>
          </div>

          {/* 反馈按钮 */}
          <div className={styles.feedbackButtons}>
            <button
              className={styles.feedbackButton}
              onClick={() => handleFeedback(1)}
            >
              👍 喜欢
            </button>
            <button
              className={styles.feedbackButton}
              onClick={() => handleFeedback(0)}
            >
              👎 不喜欢
            </button>
          </div>

          {/* 重新推荐 */}
          <button
            className={styles.restartButton}
            onClick={handleRestart}
          >
            🔄 重新推荐
          </button>
        </div>
      )}
    </div>
  );
}
