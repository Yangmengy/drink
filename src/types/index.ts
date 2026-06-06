// ===== Display Recipe (from API / frontend view) =====

export interface DisplayIngredient {
  name: string;
  amount: string;
}

export interface FlavorProfile {
  sweet: number;
  sour: number;
  bitter: number;
  strong: number;
}

export interface Pairing {
  food: string[];
  music: string[];
}

export interface Recipe {
  id: string;
  nameZh: string;
  nameEn: string;
  image: string | null;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  abv: number | null;
  glass: string;
  glassIcon: string;
  category: string;
  tags: string[];
  ingredients: DisplayIngredient[];
  instructions: string;
  story: string;
  rating: number;
  flavorProfile?: FlavorProfile | null;
}

// 详情页专用类型
export interface RecipeDetailIngredient {
  id: string;
  name: string;
  amount: number;
  unit: string;
  isOptional: boolean;
  inUserInventory?: boolean; // 用户是否拥有该原料
}

export interface RecipeDetailStep {
  stepNumber: number;
  title: string | null;
  instruction: string;
  duration: number | null;
}

export interface RecipeDetail {
  id: string;
  nameZh: string;
  nameEn: string;
  image: string | null;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  abv: number | null;
  glass: string;
  glassIcon: string;
  category: string;
  tags: string[];
  description: string;
  story: string;
  method: string | null;
  garnish: string | null;
  iceType: string | null;
  flavorProfile: FlavorProfile | null;
  occasion: string[];
  season: string[];
  mood: string[];
  pairing: Pairing | null;
  origin: string | null;
  yearCreated: number | null;
  creator: string | null;
  variations: string[];
  prepTime: number | null;
  ingredients: RecipeDetailIngredient[];
  steps: RecipeDetailStep[];
  isFavorite: boolean;
  isIba: boolean;
  viewCount: number;
  source: string | null; // 'custom' 表示用户自定义，null 或其他表示内置
}

// ===== Database Recipe (SQLite schema, for later) =====

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

export interface DBRecipe {
  id: string;
  name_zh: string;
  name_en: string | null;
  category: RecipeCategory;
  description: string | null;
  story: string | null;
  method: string | null;
  color: string | null;
  tags: string[] | null;
  flavor_profile: FlavorProfile | null;
  occasion: string[] | null;
  season: string[] | null;
  mood: string[] | null;
  origin: string | null;
  year_created: number | null;
  creator: string | null;
  variations: string[] | null;
  pairing: Pairing | null;
  image_url: string | null;
  glass_type: string | null;
  ice_type: string | null;
  garnish: string | null;
  abv: number | null;
  difficulty: number;
  prep_time: number | null;
  source: string | null;
  is_iba: boolean;
  is_favorite: boolean;
  view_count: number;
  last_viewed_at: number | null;
  created_at: number;
  updated_at: number;
  synced_at: number | null;
}

export interface DBRecipeDetail {
  recipe: DBRecipe;
  ingredients: DBRecipeIngredientDetail[];
  steps: RecipeStep[];
}

export interface DBRecipeIngredientDetail {
  recipe_ingredient: RecipeIngredient;
  ingredient: Ingredient;
}

// ===== Ingredient =====

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

// ===== Search =====

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

export type RecipeFilter = RecipeFilters;

// ===== Recommendations =====

export interface RecommendedRecipe {
  recipe: Recipe;
  match_score: number;
  missing_ingredients: string[];
  reason: string;
}

// ===== Todo & DrinkLog =====
export interface TodoItem {
  id: string;
  recipe_id: string;
  created_at: number;
  recipe: DBRecipe;
  owned_ingredients: number;
  total_ingredients: number;
}

export interface DrinkLog {
  id: string;
  recipe_id: string;
  date_str: string;
  rating: number | null;
  notes: string | null;
  images?: string | null; // JSON array string
  created_at: number;
  recipe: DBRecipe | null;
}

// ===== User Profile =====

export interface UserProfile {
  id: number;
  username: string;
  avatar: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface UserStats {
  favoriteCount: number;
  historyCount: number;
  ratingCount: number;
}

export interface UpdateProfileArgs {
  username?: string;
  avatar?: string;
}
