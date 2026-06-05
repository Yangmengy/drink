import { create } from "zustand";
import type { Recipe, RecipeFilter } from "../types";
import { recipeApi } from "../api/client";

interface RecipeState {
  recipes: Recipe[];
  loading: boolean;
  error: string | null;
  fetchRecipes: (filter?: RecipeFilter) => Promise<void>;
  searchRecipes: (query: string) => Promise<void>;
}

export const useRecipeStore = create<RecipeState>((set) => ({
  recipes: [],
  loading: false,
  error: null,

  fetchRecipes: async (filter?: RecipeFilter) => {
    set({ loading: true, error: null });
    try {
      const recipes = await recipeApi.list(filter);
      set({ recipes, loading: false });
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },

  searchRecipes: async (query: string) => {
    set({ loading: true, error: null });
    try {
      const recipes = await recipeApi.search(query);
      set({ recipes, loading: false });
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },
}));
