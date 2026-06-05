import { invoke } from "@tauri-apps/api/core";
import type { Recipe, RecipeFilter, InventoryItem } from "../types";

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
    apiInvoke<Recipe[]>("get_recipes", { filter }),
  getById: (id: string) =>
    apiInvoke<Recipe | null>("get_recipe_by_id", { id }),
  search: (query: string) =>
    apiInvoke<Recipe[]>("search_recipes", { query }),
};

export const inventoryApi = {
  list: () =>
    apiInvoke<InventoryItem[]>("get_inventory"),
  add: (ingredientId: string) =>
    apiInvoke<void>("add_to_inventory", { ingredientId }),
  remove: (ingredientId: string) =>
    apiInvoke<void>("remove_from_inventory", { ingredientId }),
};
