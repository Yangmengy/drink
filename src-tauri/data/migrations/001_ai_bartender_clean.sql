-- AI 调酒师功能数据库扩展
-- 直接在现有数据库上添加新表和字段

-- ============================================
-- 1. 扩展用户个人资料表 (MBTI + 星座)
-- ============================================
ALTER TABLE user_profile ADD COLUMN mbti TEXT;
ALTER TABLE user_profile ADD COLUMN zodiac TEXT;

-- ============================================
-- 2. 扩展酒款表 (风味和标签数据)
-- ============================================
ALTER TABLE recipes ADD COLUMN flavor_sweet INTEGER DEFAULT 3;
ALTER TABLE recipes ADD COLUMN flavor_sour INTEGER DEFAULT 3;
ALTER TABLE recipes ADD COLUMN flavor_bitter INTEGER DEFAULT 3;
ALTER TABLE recipes ADD COLUMN flavor_strong INTEGER DEFAULT 3;
ALTER TABLE recipes ADD COLUMN base_spirit TEXT;
ALTER TABLE recipes ADD COLUMN has_ice INTEGER DEFAULT 1;
ALTER TABLE recipes ADD COLUMN has_sparkling INTEGER DEFAULT 0;

-- ============================================
-- 3. 推荐历史表 (记忆系统核心)
-- ============================================
CREATE TABLE IF NOT EXISTS recommendation_history (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL DEFAULT 1,
  recipe_id TEXT NOT NULL,
  
  -- 推荐上下文
  mood_tags TEXT NOT NULL,
  weather TEXT,
  temperature REAL,
  mbti TEXT,
  zodiac TEXT,
  
  -- 推荐结果
  algorithm_score REAL NOT NULL,
  score_breakdown TEXT,
  llm_reason TEXT,
  llm_model TEXT,
  
  -- 用户反馈
  user_feedback INTEGER,
  feedback_at INTEGER,
  
  -- 时间戳
  created_at INTEGER NOT NULL,
  
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_recommendation_history_user_id ON recommendation_history(user_id);
CREATE INDEX IF NOT EXISTS idx_recommendation_history_recipe_id ON recommendation_history(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recommendation_history_created_at ON recommendation_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recommendation_history_feedback ON recommendation_history(user_feedback);

-- ============================================
-- 4. 扩展待做清单表
-- ============================================
ALTER TABLE todo_list ADD COLUMN source TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE todo_list ADD COLUMN mood_context TEXT;
ALTER TABLE todo_list ADD COLUMN priority INTEGER DEFAULT 0;
ALTER TABLE todo_list ADD COLUMN status TEXT DEFAULT 'pending';
ALTER TABLE todo_list ADD COLUMN completed_at INTEGER;
ALTER TABLE todo_list ADD COLUMN notes TEXT;

CREATE INDEX IF NOT EXISTS idx_todo_list_status ON todo_list(status);
CREATE INDEX IF NOT EXISTS idx_todo_list_priority ON todo_list(priority DESC);
CREATE INDEX IF NOT EXISTS idx_todo_list_source ON todo_list(source);

-- ============================================
-- 5. 记忆系统汇总表 (每日推荐统计)
-- ============================================
CREATE TABLE IF NOT EXISTS daily_recommendation_stats (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL DEFAULT 1,
  date_str TEXT NOT NULL,
  total_recommendations INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  dislikes INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  
  UNIQUE(user_id, date_str)
);

CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON daily_recommendation_stats(date_str DESC);

-- ============================================
-- 6. 示例数据：为现有酒款添加风味数据
-- ============================================
UPDATE recipes SET 
    flavor_sweet = 4,
    flavor_sour = 3,
    flavor_bitter = 1,
    flavor_strong = 2,
    base_spirit = 'Rum',
    has_ice = 1,
    has_sparkling = 1
WHERE name_en = 'Mojito';

UPDATE recipes SET 
    flavor_sweet = 2,
    flavor_sour = 1,
    flavor_bitter = 3,
    flavor_strong = 5,
    base_spirit = 'Whiskey',
    has_ice = 1,
    has_sparkling = 0
WHERE name_en = 'Old Fashioned';

UPDATE recipes SET 
    flavor_sweet = 3,
    flavor_sour = 5,
    flavor_bitter = 1,
    flavor_strong = 3,
    base_spirit = 'Tequila',
    has_ice = 1,
    has_sparkling = 0
WHERE name_en = 'Margarita';

UPDATE recipes SET 
    flavor_sweet = 2,
    flavor_sour = 1,
    flavor_bitter = 5,
    flavor_strong = 4,
    base_spirit = 'Gin',
    has_ice = 1,
    has_sparkling = 0
WHERE name_en = 'Negroni';

UPDATE recipes SET 
    flavor_sweet = 1,
    flavor_sour = 1,
    flavor_bitter = 2,
    flavor_strong = 5,
    base_spirit = 'Gin',
    has_ice = 0,
    has_sparkling = 0
WHERE name_en = 'Martini';

UPDATE recipes SET 
    flavor_sweet = 4,
    flavor_sour = 4,
    flavor_bitter = 1,
    flavor_strong = 3,
    base_spirit = 'Rum',
    has_ice = 1,
    has_sparkling = 0
WHERE name_en = 'Mai Tai';

UPDATE recipes SET 
    flavor_sweet = 3,
    flavor_sour = 4,
    flavor_bitter = 1,
    flavor_strong = 3,
    base_spirit = 'Vodka',
    has_ice = 1,
    has_sparkling = 0
WHERE name_en LIKE '%Cosmopolitan%';

UPDATE recipes SET 
    flavor_sweet = 2,
    flavor_sour = 4,
    flavor_bitter = 1,
    flavor_strong = 3,
    base_spirit = 'Tequila',
    has_ice = 1,
    has_sparkling = 0
WHERE name_en LIKE '%Paloma%';

-- 为所有没有设置风味的酒款设置默认值
UPDATE recipes SET 
    flavor_sweet = 3,
    flavor_sour = 3,
    flavor_bitter = 3,
    flavor_strong = 3,
    base_spirit = CASE 
        WHEN category = 'Gin' THEN 'Gin'
        WHEN category = 'Rum' THEN 'Rum'
        WHEN category = 'Whisky' THEN 'Whiskey'
        WHEN category = 'Tequila' THEN 'Tequila'
        WHEN category = 'Vodka' THEN 'Vodka'
        WHEN category = 'Brandy' THEN 'Brandy'
        ELSE 'Mixed'
    END,
    has_ice = 1,
    has_sparkling = 0
WHERE flavor_sweet IS NULL;
