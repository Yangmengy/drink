-- AI 调酒师对话记录表
CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    recipe_ids TEXT, -- JSON array of recipe IDs
    mood TEXT,
    weather TEXT,
    created_at INTEGER NOT NULL,
    UNIQUE(id)
);

CREATE INDEX IF NOT EXISTS idx_chat_created_at ON chat_messages(created_at DESC);
