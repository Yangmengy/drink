// 配方类型定义

export type RecipeCategory = 
  | 'classic' 
  | 'contemporary' 
  | 'tropical' 
  | 'short' 
  | 'long' 
  | 'mocktail';

export type MakeMethod = 'shake' | 'stir' | 'build' | 'blend';

export interface RecipeStep {
  order: number;
  text: string;
  duration_sec: number;
}

export interface RecipeIngredient {
  ingredient_id: string;
  name_zh: string;
  amount: number;
  unit: string;
  is_optional: boolean;
  note: string | null;
}

export interface Recipe {
  id: string;
  name_zh: string;
  name_en: string | null;
  category: RecipeCategory;
  glass_type: string;
  method: MakeMethod;
  difficulty: number;
  abv: number | null;
  description: string;
  story: string | null;
  image_url: string | null;
  steps: RecipeStep[];
  ingredients: RecipeIngredient[];
  created_at: string;
  updated_at: string;
}

// 原料类型定义

export type IngredientCategory = 
  | 'spirit' 
  | 'liqueur' 
  | 'mixer' 
  | 'syrup' 
  | 'garnish' 
  | 'ice';

export interface Ingredient {
  id: string;
  name_zh: string;
  name_en: string | null;
  category: IngredientCategory;
  abv: number;
  unit: string;
  color: string | null;
  description: string | null;
}

export interface InventoryItem {
  ingredient_id: string;
  ingredient: Ingredient;
  owned: boolean;
  amount_ml: number | null;
  added_at: string;
  updated_at: string;
}

// 搜索相关

export interface SearchRecipesArgs {
  query?: string;
  filters?: RecipeFilters;
  limit?: number;
  offset?: number;
}

export interface RecipeFilters {
  categories?: RecipeCategory[];
  methods?: MakeMethod[];
  difficulty_max?: number;
  abv_range?: [number, number];
  owned_only?: boolean;
}

// 类型别名，用于 API 层
export type RecipeFilter = RecipeFilters;

// 推荐相关

export interface RecommendedRecipe {
  recipe: Recipe;
  match_score: number;
  missing_ingredients: string[];
  reason: string;
}
