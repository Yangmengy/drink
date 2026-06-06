-- 鸡尾酒配方管理数据库 Schema
-- SQLite + FTS5 全文搜索

-- ============================================
-- 1. 配方表 (recipes)
-- ============================================
CREATE TABLE IF NOT EXISTS recipes (
    id TEXT PRIMARY KEY,
    name_zh TEXT NOT NULL,
    name_en TEXT,
    category TEXT NOT NULL,
    description TEXT,
    story TEXT,
    method TEXT,
    color TEXT,
    tags TEXT,
    flavor_profile TEXT,
    occasion TEXT,
    season TEXT,
    mood TEXT,
    origin TEXT,
    year_created INTEGER,
    creator TEXT,
    variations TEXT,
    pairing TEXT,
    image_url TEXT,
    glass_type TEXT,
    ice_type TEXT,
    garnish TEXT,
    abv REAL,
    difficulty INTEGER CHECK(difficulty BETWEEN 1 AND 5),
    prep_time INTEGER,
    source TEXT,
    is_iba BOOLEAN DEFAULT 0,
    is_favorite BOOLEAN DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    last_viewed_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    synced_at INTEGER
);

-- ============================================
-- 2. 原料表 (ingredients)
-- ============================================
CREATE TABLE IF NOT EXISTS ingredients (
    id TEXT PRIMARY KEY,
    name_zh TEXT NOT NULL,
    name_en TEXT,
    category TEXT NOT NULL,
    subcategory TEXT,
    abv REAL,
    description TEXT,
    emoji TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    synced_at INTEGER
);

-- ============================================
-- 3. 配方-原料关联表 (recipe_ingredients)
-- ============================================
CREATE TABLE IF NOT EXISTS recipe_ingredients (
    id TEXT PRIMARY KEY,
    recipe_id TEXT NOT NULL,
    ingredient_id TEXT NOT NULL,
    amount REAL,
    unit TEXT,
    is_optional BOOLEAN DEFAULT 0,
    display_order INTEGER,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
    FOREIGN KEY (ingredient_id) REFERENCES ingredients(id)
);

-- ============================================
-- 4. 制作步骤表 (recipe_steps)
-- ============================================
CREATE TABLE IF NOT EXISTS recipe_steps (
    id TEXT PRIMARY KEY,
    recipe_id TEXT NOT NULL,
    step_number INTEGER NOT NULL,
    title TEXT,
    instruction TEXT NOT NULL,
    duration INTEGER,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
);

-- ============================================
-- 5. 用户库存表 (user_inventory)
-- ============================================
CREATE TABLE IF NOT EXISTS user_inventory (
    id TEXT PRIMARY KEY,
    ingredient_id TEXT NOT NULL,
    amount REAL,
    unit TEXT,
    added_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (ingredient_id) REFERENCES ingredients(id)
);

-- ============================================
-- 6. 用户偏好表 (user_preferences)
-- ============================================
CREATE TABLE IF NOT EXISTS user_preferences (
    id TEXT PRIMARY KEY DEFAULT 'default',
    preferred_language TEXT DEFAULT 'zh',
    theme TEXT DEFAULT 'system',
    unit_system TEXT DEFAULT 'metric',
    difficulty_preference INTEGER,
    abv_preference TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- ============================================
-- 7. 收藏表 (favorites)
-- ============================================
CREATE TABLE IF NOT EXISTS favorites (
    id TEXT PRIMARY KEY,
    recipe_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
);

-- ============================================
-- 8. 历史记录表 (history)
-- ============================================
CREATE TABLE IF NOT EXISTS history (
    id TEXT PRIMARY KEY,
    recipe_id TEXT NOT NULL,
    viewed_at INTEGER NOT NULL,
    FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
);

-- ============================================
-- 9. 待做清单表 (todo_list)
-- ============================================
CREATE TABLE IF NOT EXISTS todo_list (
    id TEXT PRIMARY KEY,
    recipe_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
);

-- ============================================
-- 10. 饮酒记录表 (drink_logs)
-- ============================================
CREATE TABLE IF NOT EXISTS drink_logs (
    id TEXT PRIMARY KEY,
    recipe_id TEXT NOT NULL,
    date_str TEXT NOT NULL,
    rating INTEGER,
    notes TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
);

-- ============================================
-- 索引 (Indexes)
-- ============================================

-- 配方表索引
CREATE INDEX IF NOT EXISTS idx_recipes_category ON recipes(category);
CREATE INDEX IF NOT EXISTS idx_recipes_difficulty ON recipes(difficulty);
CREATE INDEX IF NOT EXISTS idx_recipes_is_favorite ON recipes(is_favorite);
CREATE INDEX IF NOT EXISTS idx_recipes_is_iba ON recipes(is_iba);
CREATE INDEX IF NOT EXISTS idx_recipes_updated_at ON recipes(updated_at);

-- 关联表索引
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe_id ON recipe_ingredients(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_ingredient_id ON recipe_ingredients(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_recipe_steps_recipe_id ON recipe_steps(recipe_id);

-- 库存表索引
CREATE INDEX IF NOT EXISTS idx_user_inventory_ingredient_id ON user_inventory(ingredient_id);

-- 收藏表索引
CREATE INDEX IF NOT EXISTS idx_favorites_recipe_id ON favorites(recipe_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_favorites_unique ON favorites(recipe_id);

-- 历史记录索引
CREATE INDEX IF NOT EXISTS idx_history_recipe_id ON history(recipe_id);
CREATE INDEX IF NOT EXISTS idx_history_viewed_at ON history(viewed_at DESC);

-- 待做与记录索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_todo_list_recipe_id ON todo_list(recipe_id);
CREATE INDEX IF NOT EXISTS idx_drink_logs_date_str ON drink_logs(date_str);
CREATE INDEX IF NOT EXISTS idx_drink_logs_recipe_id ON drink_logs(recipe_id);

-- ============================================
-- FTS5 全文搜索 (Full-Text Search)
-- ============================================

-- 配方全文搜索虚拟表
CREATE VIRTUAL TABLE IF NOT EXISTS recipes_fts USING fts5(
    recipe_id UNINDEXED,
    name_zh,
    name_en,
    category,
    description,
    story,
    ingredients,
    tokenize = 'porter unicode61'
);

-- 触发器：插入时同步到 FTS
CREATE TRIGGER IF NOT EXISTS recipes_fts_insert AFTER INSERT ON recipes
BEGIN
    INSERT INTO recipes_fts(recipe_id, name_zh, name_en, category, description, story)
    VALUES (NEW.id, NEW.name_zh, NEW.name_en, NEW.category, NEW.description, NEW.story);
END;

-- 触发器：更新时同步到 FTS
CREATE TRIGGER IF NOT EXISTS recipes_fts_update AFTER UPDATE ON recipes
BEGIN
    UPDATE recipes_fts 
    SET name_zh = NEW.name_zh,
        name_en = NEW.name_en,
        category = NEW.category,
        description = NEW.description,
        story = NEW.story
    WHERE recipe_id = NEW.id;
END;

-- 触发器：删除时从 FTS 删除
CREATE TRIGGER IF NOT EXISTS recipes_fts_delete AFTER DELETE ON recipes
BEGIN
    DELETE FROM recipes_fts WHERE recipe_id = OLD.id;
END;
