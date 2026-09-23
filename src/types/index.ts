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
export interface Settings { name: string; preferences: string; model: string; baseUrl: string; apiKeyConfigured: boolean; dataDirectory: string }
export interface SettingsInput { name: string; preferences: string; model: string; baseUrl: string; apiKey: string | null }
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
export interface ObservabilityTotals { traces: number; successful: number; local: number; failed: number; successRate: number; modelCalls: number; toolCalls: number }
export interface ObservabilityLatency { averageMs: number; p95Ms: number }
export interface ObservabilityTimelinePoint { bucket: string; total: number; successful: number; local: number; failed: number; averageMs: number }
export interface ObservabilityPhase { phase: string; total: number; averageMs: number }
export interface ObservabilitySnapshot {
  source: 'desktop' | 'server'; generatedAt: number; windowHours: number; retention: number; database: string;
  totals: ObservabilityTotals; latency: ObservabilityLatency; timeline: ObservabilityTimelinePoint[];
  phases: ObservabilityPhase[]; traces: AgentTrace[];
}
