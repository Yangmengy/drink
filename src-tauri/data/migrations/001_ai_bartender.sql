-- AI 调酒师功能数据库迁移
-- 版本: 001
-- 日期: 2026-06-06

-- ============================================
-- 1. 扩展用户个人资料表 (MBTI + 星座)
-- ============================================
ALTER TABLE user_profile ADD COLUMN mbti TEXT CHECK(mbti IN (
  'INTJ', 'INTP', 'ENTJ', 'ENTP',
  'INFJ', 'INFP', 'ENFJ', 'ENFP',
  'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ',
  'ISTP', 'ISFP', 'ESTP', 'ESFP',
  NULL
));

ALTER TABLE user_profile ADD COLUMN zodiac TEXT CHECK(zodiac IN (
  'Aries', 'Taurus', 'Gemini', 'Cancer',
  'Leo', 'Virgo', 'Libra', 'Scorpio',
  'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
  NULL
));

-- ============================================
-- 2. 扩展酒款表 (风味和标签数据)
-- ============================================
-- 添加详细风味评分 (1-5)
ALTER TABLE recipes ADD COLUMN flavor_sweet INTEGER DEFAULT 3 CHECK(flavor_sweet BETWEEN 1 AND 5);
ALTER TABLE recipes ADD COLUMN flavor_sour INTEGER DEFAULT 3 CHECK(flavor_sour BETWEEN 1 AND 5);
ALTER TABLE recipes ADD COLUMN flavor_bitter INTEGER DEFAULT 3 CHECK(flavor_bitter BETWEEN 1 AND 5);
ALTER TABLE recipes ADD COLUMN flavor_strong INTEGER DEFAULT 3 CHECK(flavor_strong BETWEEN 1 AND 5);

-- 添加基酒类型
ALTER TABLE recipes ADD COLUMN base_spirit TEXT;  -- "Vodka", "Gin", "Rum", "Whiskey", "Tequila", "Brandy", etc.

-- 添加特性标记
ALTER TABLE recipes ADD COLUMN has_ice INTEGER DEFAULT 1;          -- 是否含冰
ALTER TABLE recipes ADD COLUMN has_sparkling INTEGER DEFAULT 0;    -- 是否含气泡

-- mood 字段已存在，确保是 TEXT 类型用于存储 JSON 数组

-- ============================================
-- 3. 推荐历史表 (记忆系统核心)
-- ============================================
CREATE TABLE IF NOT EXISTS recommendation_history (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL DEFAULT 1,
  recipe_id TEXT NOT NULL,
  
  -- 推荐上下文
  mood_tags TEXT NOT NULL,              -- JSON array: ["happy", "tired"]
  weather TEXT,                         -- "sunny", "rainy", "cloudy", "snowy"
  temperature REAL,                     -- 摄氏度
  mbti TEXT,                            -- 当时的 MBTI
  zodiac TEXT,                          -- 当时的星座
  
  -- 推荐结果
  algorithm_score REAL NOT NULL,        -- 算法总分 (0-110)
  score_breakdown TEXT,                 -- JSON: {"inventory": 40, "mood": 18, ...}
  llm_reason TEXT,                      -- LLM 生成的推介词
  llm_model TEXT,                       -- 使用的 LLM 模型 ("gpt-4", "claude-3", "local", NULL)
  
  -- 用户反馈
  user_feedback INTEGER,                -- 1=喜欢(👍), 0=不喜欢(👎), NULL=未反馈
  feedback_at INTEGER,                  -- 反馈时间戳
  
  -- 时间戳
  created_at INTEGER NOT NULL,
  
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES user_profile(id)
);

-- 索引优化
CREATE INDEX IF NOT EXISTS idx_recommendation_history_user_id ON recommendation_history(user_id);
CREATE INDEX IF NOT EXISTS idx_recommendation_history_recipe_id ON recommendation_history(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recommendation_history_created_at ON recommendation_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recommendation_history_feedback ON recommendation_history(user_feedback);

-- ============================================
-- 4. 扩展待做清单表 (添加上下文和优先级)
-- ============================================
-- 先检查待做清单表的现有结构，然后添加新字段
ALTER TABLE todo_list ADD COLUMN source TEXT NOT NULL DEFAULT 'manual' CHECK(source IN ('ai_bartender', 'manual', 'random', 'discover'));
ALTER TABLE todo_list ADD COLUMN mood_context TEXT;           -- 添加时的心情标签 JSON array
ALTER TABLE todo_list ADD COLUMN priority INTEGER DEFAULT 0 CHECK(priority BETWEEN 0 AND 5);
ALTER TABLE todo_list ADD COLUMN status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'completed', 'skipped'));
ALTER TABLE todo_list ADD COLUMN completed_at INTEGER;        -- 完成时间戳
ALTER TABLE todo_list ADD COLUMN notes TEXT;                  -- 用户备注

-- 为新字段添加索引
CREATE INDEX IF NOT EXISTS idx_todo_list_status ON todo_list(status);
CREATE INDEX IF NOT EXISTS idx_todo_list_priority ON todo_list(priority DESC);
CREATE INDEX IF NOT EXISTS idx_todo_list_source ON todo_list(source);

-- ============================================
-- 5. 用户偏好趋势分析视图 (可选，用于记忆系统)
-- ============================================
CREATE VIEW IF NOT EXISTS user_preference_analysis AS
SELECT 
    r.base_spirit,
    r.category,
    AVG(r.flavor_sweet) as avg_sweet,
    AVG(r.flavor_sour) as avg_sour,
    AVG(r.flavor_bitter) as avg_bitter,
    AVG(r.flavor_strong) as avg_strong,
    COUNT(*) as recommendation_count,
    SUM(CASE WHEN rh.user_feedback = 1 THEN 1 ELSE 0 END) as like_count,
    CAST(SUM(CASE WHEN rh.user_feedback = 1 THEN 1 ELSE 0 END) AS REAL) / COUNT(*) as like_rate
FROM recommendation_history rh
JOIN recipes r ON rh.recipe_id = r.id
WHERE rh.user_feedback IS NOT NULL
GROUP BY r.base_spirit, r.category
HAVING COUNT(*) >= 2;  -- 至少有 2 次记录才纳入分析

-- ============================================
-- 6. 记忆系统汇总表 (每日推荐统计)
-- ============================================
CREATE TABLE IF NOT EXISTS daily_recommendation_stats (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL DEFAULT 1,
  date_str TEXT NOT NULL,               -- "2026-06-06"
  total_recommendations INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  dislikes INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  
  FOREIGN KEY (user_id) REFERENCES user_profile(id),
  UNIQUE(user_id, date_str)
);

CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON daily_recommendation_stats(date_str DESC);

-- ============================================
-- 7. 触发器：自动更新每日统计
-- ============================================
CREATE TRIGGER IF NOT EXISTS update_daily_stats_on_recommendation
AFTER INSERT ON recommendation_history
BEGIN
    INSERT INTO daily_recommendation_stats (
        id,
        user_id,
        date_str,
        total_recommendations,
        likes,
        dislikes,
        created_at,
        updated_at
    )
    VALUES (
        lower(hex(randomblob(16))),
        NEW.user_id,
        date('now', 'localtime'),
        1,
        0,
        0,
        strftime('%s', 'now'),
        strftime('%s', 'now')
    )
    ON CONFLICT(user_id, date_str) DO UPDATE SET
        total_recommendations = total_recommendations + 1,
        updated_at = strftime('%s', 'now');
END;

CREATE TRIGGER IF NOT EXISTS update_daily_stats_on_feedback
AFTER UPDATE OF user_feedback ON recommendation_history
WHEN NEW.user_feedback IS NOT NULL AND OLD.user_feedback IS NULL
BEGIN
    UPDATE daily_recommendation_stats
    SET 
        likes = likes + CASE WHEN NEW.user_feedback = 1 THEN 1 ELSE 0 END,
        dislikes = dislikes + CASE WHEN NEW.user_feedback = 0 THEN 1 ELSE 0 END,
        updated_at = strftime('%s', 'now')
    WHERE user_id = NEW.user_id 
      AND date_str = date(NEW.created_at, 'unixepoch', 'localtime');
END;

-- ============================================
-- 8. 示例数据：为现有酒款添加风味数据
-- ============================================
-- 这里仅提供几个经典酒款的示例，实际需要为所有酒款补充数据

-- Mojito: 清爽、甜、微酸
UPDATE recipes SET 
    flavor_sweet = 4,
    flavor_sour = 3,
    flavor_bitter = 1,
    flavor_strong = 2,
    base_spirit = 'Rum',
    has_ice = 1,
    has_sparkling = 1,
    season = 'Summer'
WHERE name_en = 'Mojito';

-- Old Fashioned: 烈、微甜、微苦
UPDATE recipes SET 
    flavor_sweet = 2,
    flavor_sour = 1,
    flavor_bitter = 3,
    flavor_strong = 5,
    base_spirit = 'Whiskey',
    has_ice = 1,
    has_sparkling = 0,
    season = 'All'
WHERE name_en = 'Old Fashioned';

-- Margarita: 酸、微甜、中等强度
UPDATE recipes SET 
    flavor_sweet = 3,
    flavor_sour = 5,
    flavor_bitter = 1,
    flavor_strong = 3,
    base_spirit = 'Tequila',
    has_ice = 1,
    has_sparkling = 0,
    season = 'Summer'
WHERE name_en = 'Margarita';

-- Negroni: 苦、烈、平衡
UPDATE recipes SET 
    flavor_sweet = 2,
    flavor_sour = 1,
    flavor_bitter = 5,
    flavor_strong = 4,
    base_spirit = 'Gin',
    has_ice = 1,
    has_sparkling = 0,
    season = 'All'
WHERE name_en = 'Negroni';

-- ============================================
-- 迁移完成
-- ============================================
-- 验证查询：检查新表和字段是否创建成功
-- SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%recommendation%';
-- PRAGMA table_info(user_profile);
-- PRAGMA table_info(recipes);
-- PRAGMA table_info(todo_list);
