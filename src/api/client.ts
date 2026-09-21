import { Channel, invoke } from '@tauri-apps/api/core';
import type { Ingredient, NewIngredientInput, AddIngredientResult, Recipe, RecipeInput, Settings, SettingsInput, ChatMessage, AgentTrace, LocalRecommendationInput, LocalRecommendationResult, ChatStreamEvent } from '../types';
export const isNative = () => '__TAURI_INTERNALS__' in window;

const TOKEN_KEY = 'drink_token';
export const getToken = () => isNative() ? null : localStorage.getItem(TOKEN_KEY);
export const setToken = (token: string) => { if (!isNative()) localStorage.setItem(TOKEN_KEY, token); };
export const clearToken = () => { if (!isNative()) localStorage.removeItem(TOKEN_KEY); };
export const isLoggedIn = () => isNative() || !!getToken();

interface AuthUser { id: string; email: string; createdAt: string }
interface AuthResponse { token: string; tokenType: string; expiresAt: string; user: AuthUser }

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const response = await fetch(path, { ...init, headers });
  // 登录和注册的 401 表示账号输入无效，必须把错误留给表单展示；
  // 只有已登录请求的 401 才代表令牌失效。
  const isAuthAttempt = path === '/auth/login' || path === '/auth/register';
  if (response.status === 401 && !isAuthAttempt) {
    clearToken();
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
  if (!isNative()) throw new Error('Web 版暂未开放智能聊天，酒柜和酒单可正常使用。');
  const channel = onEvent ? new Channel<ChatStreamEvent>(onEvent) : undefined;
  try { return await call<T>(command, { ...args, onEvent: channel ?? null }); }
  finally { if (channel) channel.onmessage = () => {}; }
}

const webSettings: Settings = {
  name: '',
  preferences: '',
  model: '',
  baseUrl: '',
  apiKeyConfigured: false,
  dataDirectory: 'Web 版',
};

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
  settings: () => webOrNative<Settings>('get_settings', () => Promise.resolve(webSettings)),
  saveSettings: (input: SettingsInput) => webOrNative<Settings>(
    'save_settings',
    () => Promise.reject(new Error('Web 版暂未开放模型设置，请先使用桌面版。')),
    { input },
  ),
  history: () => webOrNative<ChatMessage[]>('get_chat_history', () => Promise.resolve([])),
  send: (message: string, onEvent?: (event: ChatStreamEvent) => void) => streamCall<ChatMessage>('send_chat_message', { message }, onEvent),
  recommendLocal: (input: LocalRecommendationInput, onEvent?: (event: ChatStreamEvent) => void) => isNative()
    ? streamCall<LocalRecommendationResult>('recommend_local', { input }, onEvent)
    : http<LocalRecommendationResult>('/recommendations/local', { method: 'POST', body: JSON.stringify(input) }),
  clear: () => webOrNative<void>('clear_chat_history', () => Promise.resolve()),
  traces: () => webOrNative<AgentTrace[]>('list_agent_traces', () => Promise.resolve([])),
};
export const errorText = (error: unknown) => error instanceof Error ? error.message : String(error);
export const errorTraceId = (error: string) => error.match(/（链路 ([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})）/i)?.[1] ?? null;
