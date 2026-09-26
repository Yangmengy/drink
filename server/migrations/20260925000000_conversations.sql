-- Real conversation containers. Existing messages become one legacy
-- conversation per user so history is preserved.
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT '新的对话'
        CHECK (char_length(title) BETWEEN 1 AND 120),
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'archived')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_message_at TIMESTAMPTZ
);

CREATE INDEX idx_conversations_user_time
    ON conversations (user_id, status, COALESCE(last_message_at, created_at) DESC);

WITH legacy AS (
    SELECT
        u.id AS user_id,
        MAX(m.created_at) AS last_message_at
    FROM users u
    LEFT JOIN chat_messages m ON m.user_id = u.id
    GROUP BY u.id
)
INSERT INTO conversations (user_id, title, last_message_at)
SELECT user_id, '历史对话', last_message_at
FROM legacy;

CREATE TABLE user_conversation_state (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    active_conversation_id UUID NOT NULL
        REFERENCES conversations(id) ON DELETE CASCADE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO user_conversation_state (user_id, active_conversation_id)
SELECT c.user_id, c.id
FROM conversations c
ON CONFLICT (user_id) DO NOTHING;

ALTER TABLE chat_messages
    ADD COLUMN conversation_id UUID
    REFERENCES conversations(id) ON DELETE CASCADE;

UPDATE chat_messages m
SET conversation_id = c.id
FROM conversations c
WHERE c.user_id = m.user_id;

ALTER TABLE chat_messages
    ALTER COLUMN conversation_id SET NOT NULL;

CREATE INDEX idx_chat_messages_conversation_time
    ON chat_messages (conversation_id, created_at, id);

ALTER TABLE agent_traces
    ADD COLUMN conversation_id UUID
    REFERENCES conversations(id) ON DELETE CASCADE;

UPDATE agent_traces t
SET conversation_id = m.conversation_id
FROM chat_messages m
WHERE m.trace_id = t.id;

UPDATE agent_traces t
SET conversation_id = c.id
FROM conversations c
WHERE t.conversation_id IS NULL
  AND t.user_id = c.user_id;

ALTER TABLE chat_context_summaries
    ADD COLUMN conversation_id UUID
    REFERENCES conversations(id) ON DELETE CASCADE;

UPDATE chat_context_summaries s
SET conversation_id = c.id
FROM conversations c
WHERE c.user_id = s.user_id;

ALTER TABLE chat_context_summaries
    ALTER COLUMN conversation_id SET NOT NULL;

CREATE INDEX idx_chat_context_summaries_conversation_active
    ON chat_context_summaries (conversation_id, created_at DESC)
    WHERE status = 'active';

ALTER TABLE chat_context_state
    ADD COLUMN conversation_id UUID
    REFERENCES conversations(id) ON DELETE CASCADE;

UPDATE chat_context_state s
SET conversation_id = c.id
FROM conversations c
WHERE c.user_id = s.user_id;

ALTER TABLE chat_context_state
    ALTER COLUMN conversation_id SET NOT NULL;

CREATE UNIQUE INDEX uq_chat_context_state_conversation
    ON chat_context_state (conversation_id);
