CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE CHECK (email <> '' AND email = lower(email)),
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE recipes (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name_zh TEXT NOT NULL CHECK (name_zh <> ''),
    name_en TEXT,
    name_key TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL CHECK (category <> ''),
    description TEXT,
    method TEXT,
    flavor_profile JSONB,
    image_url TEXT,
    source TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT recipes_builtin_is_shared CHECK (user_id IS NOT NULL OR source <> 'custom'),
    CONSTRAINT recipes_custom_has_owner CHECK (user_id IS NULL OR source = 'custom')
);

CREATE TABLE ingredients (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name_zh TEXT NOT NULL CHECK (name_zh <> ''),
    name_key TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL CHECK (category <> ''),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE recipe_ingredients (
    id TEXT PRIMARY KEY,
    recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    ingredient_id TEXT NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    amount DOUBLE PRECISION CHECK (amount IS NULL OR amount >= 0),
    unit TEXT,
    is_optional BOOLEAN NOT NULL DEFAULT false,
    display_order INTEGER NOT NULL CHECK (display_order > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (recipe_id, ingredient_id)
);

CREATE TABLE recipe_steps (
    id TEXT PRIMARY KEY,
    recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL CHECK (step_number > 0),
    instruction TEXT NOT NULL CHECK (instruction <> ''),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (recipe_id, step_number)
);

CREATE TABLE user_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ingredient_id TEXT NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, ingredient_id)
);

CREATE TABLE companion_settings (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT '',
    preferences TEXT NOT NULL DEFAULT '',
    model TEXT NOT NULL DEFAULT 'qwen-plus',
    base_url TEXT NOT NULL DEFAULT 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    text TEXT NOT NULL CHECK (text <> ''),
    recipes JSONB NOT NULL DEFAULT '[]'::jsonb,
    trace_id TEXT,
    mode TEXT CHECK (mode IN ('agent', 'local')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE agent_traces (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ NOT NULL,
    duration_ms INTEGER NOT NULL CHECK (duration_ms >= 0),
    status TEXT NOT NULL,
    events JSONB NOT NULL DEFAULT '[]'::jsonb,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Private recipes must not duplicate a name. Builtin rows may contain repeated
-- names because they preserve multiple canonical source entries.
CREATE UNIQUE INDEX uq_recipes_owner_name_key
    ON recipes (COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid), name_key)
    WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX uq_ingredients_owner_name_key
    ON ingredients (COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid), name_key)
    WHERE name_key <> '';

CREATE INDEX idx_recipes_user_updated_at ON recipes (user_id, updated_at DESC);
CREATE INDEX idx_ingredients_user_name_zh ON ingredients (user_id, name_zh);
CREATE INDEX idx_user_inventory_user_ingredient ON user_inventory (user_id, ingredient_id);
CREATE INDEX idx_recipe_ingredients_recipe_id ON recipe_ingredients (recipe_id);
CREATE INDEX idx_recipe_ingredients_ingredient_id ON recipe_ingredients (ingredient_id);
CREATE INDEX idx_recipe_steps_recipe_step ON recipe_steps (recipe_id, step_number);
CREATE INDEX idx_chat_messages_user_created_at ON chat_messages (user_id, created_at);
CREATE INDEX idx_agent_traces_user_started_at ON agent_traces (user_id, started_at DESC);
