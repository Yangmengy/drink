export interface Flavor { sweet: number; sour: number; bitter: number; strong: number }
export interface Ingredient { id: string; name: string; category: string; owned: boolean }
export interface NewIngredientInput { name: string; category: string; owned: boolean }
export interface AddIngredientResult { ingredient: Ingredient; created: boolean }
export interface RecipeIngredient { id: string; name: string; amount: number | null; unit: string | null; optional: boolean }
export interface Recipe {
  id: string; name: string; nameEn: string; description: string; category: string;
  source: 'builtin' | 'custom'; image: string | null; method: string; flavor: Flavor | null;
  ingredients: RecipeIngredient[]; steps: string[]; missing: string[]; canMake: boolean;
}
export interface IngredientInput { name: string; amount: number; unit: string; optional: boolean }
export interface RecipeInput { id: string | null; name: string; description: string; method: string; flavor: Flavor; ingredients: IngredientInput[]; steps: string[] }
export type ProfileEventType =
  | 'quiz_answer' | 'constraint_set' | 'view' | 'favorite' | 'make'
  | 'like' | 'dislike' | 'feedback' | 'skip';

export interface ProfileEventInput {
  eventType: ProfileEventType;
  recipeId?: string | null;
  payload?: Record<string, unknown>;
  idempotencyKey: string;
  traceId?: string | null;
}

export interface ProfileEvent {
  id: string; seq: number; eventType: ProfileEventType; source: string;
  recipeId: string | null; payload: Record<string, unknown>; idempotencyKey: string;
  traceId: string | null; occurredAt: string; processedAt: string | null;
}

export interface ProfileConstraints { noAlcohol:boolean; allergies:string[]; avoidIngredients:string[]; maxAbvLevel:number | null }
export interface FlavorPreference { sweet:number; sour:number; bitter:number; strong:number }
export interface ProfilePreferences { flavor:FlavorPreference; baseSpirit:Record<string, number>; tagAffinity:Record<string, number> }
export interface ProfileConfidence { flavor: FlavorPreference }
export interface UserProfile {
  schemaVersion:number; constraints:ProfileConstraints; preferences:ProfilePreferences;
  confidence:ProfileConfidence; profileRevision:number; lastEventSeq:number | null;
  computedAt:string | null; updatedAt:string;
}
export interface MemoryStatement {
  id:string; kind:'preference'|'constraint'|'context'|'goal'; content:string; source:string;
  retentionPolicy:'explicit'|'auto_low_risk'|'temporary_context'; confidence:number;
  status:'active'|'superseded'|'revoked'|'expired'; expiresAt:string | null;
  lastSeenAt:string; createdAt:string;
}
export interface MemoryStatementInput {
  kind:MemoryStatement['kind']; content:string; source:'structured_ui'|'chat_confirmed'|'summary_confirmed';
  retentionPolicy:MemoryStatement['retentionPolicy']; confidence?:number; expiresAt?:string | null;
  constraintPayload?: { constraints: Partial<ProfileConstraints> };
}
export interface MemorySettings {
  allowAutoLowRisk:boolean; lowRiskTtlDays:number; allowTemporaryContext:boolean;
  temporaryContextTtlDays:number; updatedAt:string;
}
export interface ObservabilityContext {
  activeSummaries:number; archivedSummaries:number; messagesTotal:number; usersWithMessages:number;
  latestCoveredMessages:number; latestTokenEstimate:number; latestModel:string;
  latestPromptVersion:string; latestCreatedAt:string | null; status:'has_summary'|'no_summary'|'no_messages';
}
export interface Settings { name: string; preferences: string; model: string; baseUrl: string; apiKeyConfigured: boolean; dataDirectory: string }
export interface SettingsInput { name: string; preferences: string; model: string; baseUrl: string; apiKey: string | null }
export interface Conversation {
  id: string; title: string; status: 'active' | 'archived';
  messageCount: number; lastMessagePreview: string | null;
  lastMessageAt: string | null; createdAt: string; isActive: boolean;
}
export interface CreateConversationInput { title?: string; idempotencyKey?: string }
export interface ChatMessage { id: string; role: 'user' | 'assistant'; text: string; recipes: Recipe[]; traceId?: string | null; mode?: 'agent' | 'local' }
export interface LocalRecommendationInput {
  availability: 'ready' | 'missingOne' | 'any';
  query: { query: string; maxSweet?: number; minSour?: number; maxStrong?: number };
  afterTraceId?: string | null;
}
export interface LocalRecommendationResult { request: string; message: ChatMessage }
export interface TraceEvent { phase: string; elapsedMs: number; detail: string }
export type ChatStreamEvent =
  | { type: 'text'; traceId: string; text: string }
  | { type: 'trace'; traceId: string; event: TraceEvent };
export interface LiveReply { traceId: string | null; text: string; events: TraceEvent[] }
export interface AgentTrace { id: string; startedAt: number; durationMs: number; status: string; events: TraceEvent[]; error: string | null }
export interface ContextMaintainResult {
  maintained: boolean; reason: string | null; summaryId: string | null;
  coveredMessages: number; tokenEstimate: number;
}
export interface ObservabilityTotals { traces: number; successful: number; local: number; failed: number; successRate: number; modelCalls: number; toolCalls: number }
export interface ObservabilityLatency { averageMs: number; p95Ms: number }
export interface ObservabilityTimelinePoint { bucket: string; total: number; successful: number; local: number; failed: number; averageMs: number }
export interface ObservabilityPhase { phase: string; total: number; averageMs: number }
export interface ObservabilitySnapshot {
  source: 'desktop' | 'server'; generatedAt: number; windowHours: number; retention: number; database: string;
  totals: ObservabilityTotals; latency: ObservabilityLatency; timeline: ObservabilityTimelinePoint[];
  phases: ObservabilityPhase[]; traces: AgentTrace[]; context: ObservabilityContext;
}
