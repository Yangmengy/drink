-- Personal companion core. Only fields used by the current application are created.
-- Existing databases keep their extra columns and historical tables (see docs/local-data.md).
CREATE TABLE IF NOT EXISTS recipes (
    id TEXT PRIMARY KEY,
    name_zh TEXT NOT NULL,
    name_en TEXT,
    category TEXT NOT NULL,
    description TEXT,
    method TEXT,
    flavor_profile TEXT,
    image_url TEXT,
    source TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS ingredients (
    id TEXT PRIMARY KEY,
    name_zh TEXT NOT NULL,
    category TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

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

CREATE TABLE IF NOT EXISTS recipe_steps (
    id TEXT PRIMARY KEY,
    recipe_id TEXT NOT NULL,
    step_number INTEGER NOT NULL,
    instruction TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_inventory (
    id TEXT PRIMARY KEY,
    ingredient_id TEXT NOT NULL,
    added_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (ingredient_id) REFERENCES ingredients(id)
);

CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe_id ON recipe_ingredients(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_steps_recipe_id ON recipe_steps(recipe_id);
CREATE INDEX IF NOT EXISTS idx_user_inventory_ingredient_id ON user_inventory(ingredient_id);

CREATE TABLE IF NOT EXISTS core_migrations (
    version INTEGER PRIMARY KEY,
    applied_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS companion_settings (
    id INTEGER PRIMARY KEY CHECK(id = 1),
    name TEXT NOT NULL DEFAULT '',
    preferences TEXT NOT NULL DEFAULT '',
    model TEXT NOT NULL DEFAULT 'qwen-plus',
    base_url TEXT NOT NULL DEFAULT 'https://dashscope.aliyuncs.com/compatible-mode/v1'
);
CREATE TABLE IF NOT EXISTS agent_traces (
    id TEXT PRIMARY KEY,
    started_at INTEGER NOT NULL,
    duration_ms INTEGER NOT NULL,
    status TEXT NOT NULL,
    events TEXT NOT NULL,
    error TEXT
);
