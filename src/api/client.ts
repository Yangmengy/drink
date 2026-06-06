import { invoke } from "@tauri-apps/api/core";
import type { DBRecipe, DBRecipeDetail, RecipeFilter, InventoryItem } from "../types";

let isTauri = false;
try {
  isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
} catch {
  isTauri = false;
}

export async function apiInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (isTauri) {
    return invoke<T>(cmd, args);
  }
  throw new Error(`Not in Tauri environment, cannot invoke: ${cmd}`);
}

export const recipeApi = {
  list: (filter?: RecipeFilter) =>
    apiInvoke<DBRecipe[]>("get_recipes", { filter }),
  getById: (id: string) =>
    apiInvoke<DBRecipeDetail | null>("get_recipe_by_id", { id }),
  search: (query: string) =>
    apiInvoke<DBRecipe[]>("search_recipes", { query }),
};

export const inventoryApi = {
  list: () =>
    apiInvoke<InventoryItem[]>("get_inventory"),
  getAllIngredients: () =>
    apiInvoke<import("../types").Ingredient[]>("get_all_ingredients"),
  add: (ingredientId: string) =>
    apiInvoke<void>("add_to_inventory", { ingredientId }),
  remove: (ingredientId: string) =>
    apiInvoke<void>("remove_from_inventory", { ingredientId }),
};

export const todoApi = {
  list: () => apiInvoke<import("../types").TodoItem[]>("get_todos"),
  add: (recipeId: string) => apiInvoke<boolean>("add_todo", { recipeId }),
  remove: (recipeId: string) => apiInvoke<boolean>("remove_todo", { recipeId }),
  isTodo: (recipeId: string) => apiInvoke<boolean>("is_todo", { recipeId }),
};

export const logApi = {
  list: (dateStr?: string) => apiInvoke<import("../types").DrinkLog[]>("get_drink_logs", { dateStr }),
  add: (recipeId: string, dateStr: string, rating: number | null, notes: string | null) => 
    apiInvoke<boolean>("add_drink_log", { recipeId, dateStr, rating, notes }),
};
