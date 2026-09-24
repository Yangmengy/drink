import { Channel, invoke } from '@tauri-apps/api/core';
import type { Ingredient, NewIngredientInput, AddIngredientResult, Recipe, RecipeInput, Settings, SettingsInput, ChatMessage, AgentTrace, LocalRecommendationInput, LocalRecommendationResult, ChatStreamEvent, ObservabilitySnapshot, ContextMaintainResult, ProfileEvent, ProfileEventInput, UserProfile, MemoryStatement, MemoryStatementInput, MemorySettings } from '../types';
import { desktopSnapshot } from '../lib/observability';
export const isNative = () => '__TAURI_INTERNALS__' in window;

const TOKEN_KEY = 'drink_token';
const MODEL_KEY = 'drink_model_key';
export const getToken = () => isNative() ? null : localStorage.getItem(TOKEN_KEY);
export const setToken = (token: string) => { if (!isNative()) localStorage.setItem(TOKEN_KEY, token); };
export const clearToken = () => { if (!isNative()) localStorage.removeItem(TOKEN_KEY); };
export const isLoggedIn = () => isNative() || !!getToken();
export const getModelKey = () => isNative() ? null : localStorage.getItem(MODEL_KEY);
const setModelKey = (key: string) => {
  if (!isNative()) {
    if (key) localStorage.setItem(MODEL_KEY, key);
    else localStorage.removeItem(MODEL_KEY);
  }
};
export const clearModelKey = () => setModelKey('');

interface AuthUser { id: string; email: string; createdAt: string }
interface AuthResponse { token: string; tokenType: string; expiresAt: string; user: AuthUser }

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  // The /api prefix keeps HTTP endpoints away from SPA routes such as /settings.
  const response = await fetch(`/api${path}`, { ...init, headers });
  // 登录和注册的 401 表示账号输入无效，必须把错误留给表单展示；
  // 只有已登录请求的 401 才代表令牌失效。
  const isAuthAttempt = path === '/auth/login' || path === '/auth/register';
  if (response.status === 401 && !isAuthAttempt) {
    clearToken();
    setModelKey('');
    window.location.href = '/login';
    throw new Error('登录已过期，请重新登录');
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message ?? `请求失败（${response.status}）`);
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}

async function call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (!isNative()) throw new Error('当前为界面预览。请运行 npm run tauri:dev，使用本地酒柜和 Agent。');
  return invoke<T>(command, args);
}

function webOrNative<T>(command: string, webFn: () => Promise<T>, args?: Record<string, unknown>): Promise<T> {
  if (isNative()) return invoke<T>(command, args);
  return webFn();
}

async function streamCall<T>(command: string, args: Record<string, unknown>, onEvent?: (event: ChatStreamEvent) => void): Promise<T> {
  if (!isNative()) throw new Error('Web Agent 需要服务端聊天接口。');
  const channel = onEvent ? new Channel<ChatStreamEvent>(onEvent) : undefined;
  try { return await call<T>(command, { ...args, onEvent: channel ?? null }); }
  finally { if (channel) channel.onmessage = () => {}; }
}

function localChatReply(message: string): Promise<ChatMessage> {
  const text = message.trim();
  if (!text || Array.from(text).length > 4000) throw new Error('请输入 1–4000 字的消息');
  // 服务器约定不保存 Web 密钥；没有浏览器密钥时保持和桌面一致的本地说明。
  return Promise.resolve({
    id: `web-local-${crypto.randomUUID()}`,
    role: 'assistant',
    text: '暂时还没有连接聊天模型，我现在无法理解这句话并自然陪聊。你可以点开顶部的“调整推荐条件”，按已有材料和明确的口味条件找酒；也可以在设置中配置模型后继续聊。',
    recipes: [],
    traceId: null,
    mode: 'local',
  });
}

export const api = {
  ingredients: () => webOrNative<Ingredient[]>('list_ingredients', () => http<Ingredient[]>('/ingredients')),
  addIngredient: (input: NewIngredientInput) => webOrNative<AddIngredientResult>('add_ingredient', () => http<AddIngredientResult>('/ingredients', { method: 'POST', body: JSON.stringify(input) }), { input }),
  setOwned: (id: string, owned: boolean) => webOrNative<void>('set_ingredient_owned', () => http<void>(`/ingredients/${encodeURIComponent(id)}/owned`, { method: 'PATCH', body: JSON.stringify({ owned }) }), { id, owned }),
  menu: (query = '') => webOrNative<Recipe[]>('search_menu', () => http<Recipe[]>(`/recipes?query=${encodeURIComponent(query)}`), { query: { query } }),
  saveRecipe: (input: RecipeInput) => webOrNative<string>('save_custom_recipe', async () => (await http<{ id: string }>('/recipes', { method: 'POST', body: JSON.stringify(input) })).id, { input }),
  deleteRecipe: (id: string) => webOrNative<void>('delete_custom_recipe', () => http<void>(`/recipes/${encodeURIComponent(id)}`, { method: 'DELETE' }), { id }),
  register: (email: string, password: string) => http<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify({ email, password }) }),
  login: (email: string, password: string) => http<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => http<AuthUser>('/auth/me'),
  settings: () => webOrNative<Settings>('get_settings', async () => {
    const settings = await http<Settings>('/settings');
    return {
      ...settings,
      apiKeyConfigured: !!getModelKey() && !!settings.model.trim() && !!settings.baseUrl.trim(),
      dataDirectory: '浏览器本机；服务器不保存 API Key',
    };
  }),
  saveSettings: (input: SettingsInput) => webOrNative<Settings>(
    'save_settings',
    async () => {
      await http<Settings>('/settings', { method: 'PUT', body: JSON.stringify({ name: input.name, preferences: input.preferences, model: input.model, baseUrl: input.baseUrl }) });
      if (input.apiKey != null) setModelKey(input.apiKey);
      return api.settings() as Promise<Settings>;
    },
    { input },
  ),
  history: () => webOrNative<ChatMessage[]>('get_chat_history', () => http<ChatMessage[]>('/chat')),
  send: (message: string, onEvent?: (event: ChatStreamEvent) => void) => {
    if (isNative()) return streamCall<ChatMessage>('send_chat_message', { message }, onEvent);
    const modelKey = getModelKey();
    if (!modelKey) return localChatReply(message);
    return http<ChatMessage>('/chat/send', { method: 'POST', body: JSON.stringify({ message, apiKey: modelKey }) });
  },
  recommendLocal: (input: LocalRecommendationInput, onEvent?: (event: ChatStreamEvent) => void) => isNative()
    ? streamCall<LocalRecommendationResult>('recommend_local', { input }, onEvent)
    : http<LocalRecommendationResult>('/recommendations/local', { method: 'POST', body: JSON.stringify(input) }),
  clear: () => webOrNative<void>('clear_chat_history', () => http<void>('/chat', { method: 'DELETE' })),
  maintainContext: async (): Promise<ContextMaintainResult> => {
    const modelKey = getModelKey();
    if (!modelKey) return { maintained: false, reason: 'missing_api_key', summaryId: null, coveredMessages: 0, tokenEstimate: 0 };
    return http<ContextMaintainResult>('/context/maintain', { method: 'POST', body: JSON.stringify({ apiKey: modelKey }) });
  },
  profile: async (): Promise<UserProfile | null> => {
    if (isNative()) return null;
    try { return await http<UserProfile>('/profile'); }
    catch (error) {
      if (error instanceof Error && error.message.includes('画像尚未生成')) return null;
      throw error;
    }
  },
  rebuildProfile: () => http<UserProfile>('/profile', { method: 'POST' }),
  memoryStatements: (includeInactive = false) => {
    if (isNative()) return Promise.resolve([]);
    return http<MemoryStatement[]>(`/memory/statements?includeInactive=${includeInactive}`);
  },
  createMemoryStatement: (input: MemoryStatementInput) => {
    if (isNative()) return Promise.reject(new Error('记忆管理目前支持 Web 登录账号。'));
    return http<MemoryStatement>('/memory/statements', { method: 'POST', body: JSON.stringify(input) });
  },
  deleteMemoryStatement: (id: string) => http<void>(`/memory/statements/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  revokeMemoryStatement: (id: string) => http<void>(`/memory/statements/${encodeURIComponent(id)}/revoke`, { method: 'POST' }),
  clearAutoMemory: async () => {
    if (isNative()) return { deleted: 0 };
    return await http<{ deleted: number }>('/memory/statements', { method: 'DELETE' });
  },
  memorySettings: () => {
    if (isNative()) return Promise.reject(new Error('记忆管理目前支持 Web 登录账号。'));
    return http<MemorySettings>('/memory/settings');
  },
  saveMemorySettings: (input: Omit<MemorySettings, 'updatedAt'>) => {
    if (isNative()) return Promise.reject(new Error('记忆管理目前支持 Web 登录账号。'));
    return http<MemorySettings>('/memory/settings', { method: 'PUT', body: JSON.stringify(input) });
  },
  recordProfileEvent: (input: ProfileEventInput) => {
    if (isNative()) return Promise.reject(new Error('画像反馈目前支持 Web 登录账号。'));
    return http<ProfileEvent>('/profile/events', { method: 'POST', body: JSON.stringify(input) });
  },
  traces: () => webOrNative<AgentTrace[]>('list_agent_traces', () => http<AgentTrace[]>('/traces')),
  observability: async (): Promise<ObservabilitySnapshot> => {
    if (isNative()) return desktopSnapshot(await api.traces());
    return http<ObservabilitySnapshot>('/observability/summary');
  },
};
export const errorText = (error: unknown) => error instanceof Error ? error.message : String(error);
export const errorTraceId = (error: string) => error.match(/（链路 ([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})）/i)?.[1] ?? null;
