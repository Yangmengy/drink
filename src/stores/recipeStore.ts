import { create } from "zustand";
import type { Recipe, DBRecipe, RecipeFilter, RecipeDetail } from "../types";
import { recipeApi } from "../api/client";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";

// 映射函数：将后端的 DBRecipe 映射为前端的 Recipe
async function adaptDBRecipeToRecipe(dbRecipe: DBRecipe): Promise<Recipe> {
  let imageUrl = null;
  if (dbRecipe.image_url) {
    try {
      const absolutePath = await invoke<string>("get_image_url", { imageName: dbRecipe.image_url });
      imageUrl = convertFileSrc(absolutePath);
    } catch (e) {
      console.warn("Failed to get local image url:", e);
    }
  }

  return {
    id: dbRecipe.id,
    nameZh: dbRecipe.name_zh,
    nameEn: dbRecipe.name_en || "",
    image: imageUrl,
    difficulty: dbRecipe.difficulty <= 2 ? "Easy" : dbRecipe.difficulty <= 4 ? "Medium" : "Hard",
    abv: dbRecipe.abv,
    glass: dbRecipe.glass_type || "highball",
    glassIcon: "🍸", // 可以根据 glass_type 做映射
    category: dbRecipe.category,
    tags: dbRecipe.tags || [],
    ingredients: [], // 如果需要在卡片展示 ingredients，后端 get_recipes 目前不直接包含原料信息，可显示 description
    instructions: dbRecipe.description || "",
    story: dbRecipe.story || "",
    rating: dbRecipe.view_count > 0 ? 4.5 : 0,
  };
}

interface RecipeState {
  recipes: Recipe[];
  currentRecipe: RecipeDetail | null;
  loading: boolean;
  error: string | null;
  fetchRecipes: (filter?: RecipeFilter) => Promise<void>;
  searchRecipes: (query: string) => Promise<void>;
  fetchRecipeDetail: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  clearCurrentRecipe: () => void;
}

export const useRecipeStore = create<RecipeState>((set) => ({
  recipes: [],
  currentRecipe: null,
  loading: false,
  error: null,

  fetchRecipes: async (filter?: RecipeFilter) => {
    set({ loading: true, error: null });
    try {
      const dbRecipes = await recipeApi.list(filter);
      const recipes = await Promise.all(dbRecipes.map(adaptDBRecipeToRecipe));
      set({ recipes, loading: false });
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },

  searchRecipes: async (query: string) => {
    set({ loading: true, error: null });
    try {
      const dbRecipes = await recipeApi.search(query);
      const recipes = await Promise.all(dbRecipes.map(adaptDBRecipeToRecipe));
      set({ recipes, loading: false });
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },

  fetchRecipeDetail: async (id: string) => {
    set({ loading: true, error: null });
    try {
      // 调用后端 get_recipe_by_id 接口
      const result = await invoke<any>("get_recipe_by_id", { id });
      
      if (!result) {
        set({ error: "配方不存在", loading: false, currentRecipe: null });
        return;
      }

      // 处理图片URL
      let imageUrl = null;
      if (result.recipe.image_url) {
        try {
          const absolutePath = await invoke<string>("get_image_url", { 
            imageName: result.recipe.image_url 
          });
          imageUrl = convertFileSrc(absolutePath);
        } catch (e) {
          console.warn("Failed to get local image url:", e);
        }
      }

      // 解析 JSON 字段
      const parseTags = (tags: string | null): string[] => {
        if (!tags) return [];
        try {
          return JSON.parse(tags);
        } catch {
          return [];
        }
      };

      const parseOccasion = (occasion: string | null): string[] => {
        if (!occasion) return [];
        try {
          return JSON.parse(occasion);
        } catch {
          return [];
        }
      };

      const parseSeason = (season: string | null): string[] => {
        if (!season) return [];
        try {
          return JSON.parse(season);
        } catch {
          return [];
        }
      };

      const parseFlavorProfile = (flavor: string | null) => {
        if (!flavor) return null;
        try {
          return JSON.parse(flavor);
        } catch {
          return null;
        }
      };

      // 转换为前端 RecipeDetail 类型
      const detail: RecipeDetail = {
        id: result.recipe.id,
        nameZh: result.recipe.name_zh,
        nameEn: result.recipe.name_en || "",
        image: imageUrl,
        difficulty: result.recipe.difficulty <= 2 ? "Easy" : result.recipe.difficulty <= 4 ? "Medium" : "Hard",
        abv: result.recipe.abv,
        glass: result.recipe.glass_type || "highball",
        glassIcon: "🍸",
        category: result.recipe.category,
        tags: parseTags(result.recipe.tags),
        description: result.recipe.description || "",
        story: result.recipe.story || "",
        method: result.recipe.method,
        garnish: result.recipe.garnish,
        iceType: result.recipe.ice_type,
        flavorProfile: parseFlavorProfile(result.recipe.flavor_profile),
        occasion: parseOccasion(result.recipe.occasion),
        season: parseSeason(result.recipe.season),
        origin: result.recipe.origin,
        yearCreated: result.recipe.year_created,
        prepTime: result.recipe.prep_time,
        ingredients: result.ingredients.map((item: any) => ({
          name: item.ingredient.name_zh,
          amount: item.recipe_ingredient.amount,
          unit: item.recipe_ingredient.unit,
          isOptional: item.recipe_ingredient.is_optional,
          inUserInventory: false, // TODO: 后续根据用户库存判断
        })),
        steps: result.steps.map((step: any) => ({
          stepNumber: step.step_number,
          title: step.title,
          instruction: step.instruction,
          duration: step.duration,
        })),
        isFavorite: result.recipe.is_favorite,
        viewCount: result.recipe.view_count,
      };

      // 添加到历史记录
      await invoke("add_to_history", { recipeId: id });

      set({ currentRecipe: detail, loading: false });
    } catch (err) {
      set({ error: String(err), loading: false, currentRecipe: null });
    }
  },

  toggleFavorite: async (id: string) => {
    try {
      const newState = await invoke<boolean>("toggle_favorite", { recipeId: id });
      
      // 更新当前详情页的收藏状态
      set((state) => {
        if (state.currentRecipe && state.currentRecipe.id === id) {
          return {
            currentRecipe: {
              ...state.currentRecipe,
              isFavorite: newState,
            },
          };
        }
        return state;
      });
    } catch (err) {
      console.error("Failed to toggle favorite:", err);
    }
  },

  clearCurrentRecipe: () => {
    set({ currentRecipe: null });
  },
}));
