import { invoke } from '@tauri-apps/api/core';
import type { Ingredient, Recipe, RecipeInput, Settings, SettingsInput, ChatMessage, AgentTrace, LocalRecommendationInput, LocalRecommendationResult } from '../types';
export const isNative = () => '__TAURI_INTERNALS__' in window;
async function call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (!isNative()) throw new Error('当前为界面预览。请运行 npm run tauri:dev，使用本地酒柜和 Agent。');
  return invoke<T>(command, args);
}
export const api = {
  ingredients: () => call<Ingredient[]>('list_ingredients'),
  setOwned: (id: string, owned: boolean) => call<void>('set_ingredient_owned', { id, owned }),
  menu: (query = '') => call<Recipe[]>('search_menu', { query: { query } }),
  saveRecipe: (input: RecipeInput) => call<string>('save_custom_recipe', { input }),
  deleteRecipe: (id: string) => call<void>('delete_custom_recipe', { id }),
  settings: () => call<Settings>('get_settings'),
  saveSettings: (input: SettingsInput) => call<Settings>('save_settings', { input }),
  history: () => call<ChatMessage[]>('get_chat_history'),
  send: (message: string) => call<ChatMessage>('send_chat_message', { message }),
  recommendLocal: (input: LocalRecommendationInput) => call<LocalRecommendationResult>('recommend_local', { input }),
  clear: () => call<void>('clear_chat_history'),
  traces: () => call<AgentTrace[]>('list_agent_traces'),
};
export const errorText = (error: unknown) => error instanceof Error ? error.message : String(error);
export const errorTraceId = (error: string) => error.match(/（链路 ([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})）/i)?.[1] ?? null;
