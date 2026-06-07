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

export interface CustomRecipeIngredientInput {
  ingredientId: string;
  amount: number;
  unit: string;
  note?: string;
}

export interface CustomRecipeDetails {
  nameEn?: string;
  description?: string;
  method?: string;
  glassType?: string;
  difficulty?: number;
  prepTime?: number;
  baseSpirit?: string;
  tags?: string[];
  occasion?: string[];
  season?: string[];
  mood?: string[];
  flavorProfile?: {
    sweet: number;
    sour: number;
    bitter: number;
    strong: number;
  };
  ingredients?: CustomRecipeIngredientInput[];
  steps?: string[];
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
  bio?: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface UserStats {
  favoriteCount: number;
  historyCount: number;
  ratingCount: number;
  // 后端返回 snake_case，兼容两种格式
  favorite_count?: number;
  history_count?: number;
  rating_count?: number;
}

export interface UpdateProfileArgs {
  username?: string;
  avatar?: string;
  bio?: string;
}

// ===== AI Bartender Chat =====

export interface ChatMessagePayload {
  id: string;
  role: string;
  text: string;
  recipes: DBRecipe[];
}

export type MBTIType = 
  | 'INTJ' | 'INTP' | 'ENTJ' | 'ENTP'
  | 'INFJ' | 'INFP' | 'ENFJ' | 'ENFP'
  | 'ISTJ' | 'ISFJ' | 'ESTJ' | 'ESFJ'
  | 'ISTP' | 'ISFP' | 'ESTP' | 'ESFP';

export type ZodiacType = 
  | 'Aries' | 'Taurus' | 'Gemini' | 'Cancer'
  | 'Leo' | 'Virgo' | 'Libra' | 'Scorpio'
  | 'Sagittarius' | 'Capricorn' | 'Aquarius' | 'Pisces';

export type WeatherType = 'sunny' | 'rainy' | 'cloudy' | 'snowy';

export type MoodTag = 
  | 'happy' | 'sad' | 'tired' | 'stressed' 
  | 'relaxed' | 'excited' | 'romantic' | 'celebrate'
  | 'lonely' | 'anxious' | 'bored' | 'creative';

export interface UserProfileExtended extends UserProfile {
  mbti: MBTIType | null;
  zodiac: ZodiacType | null;
  current_mood: string | null;
  current_weather: string | null;
  llm_api_key: string | null;
  llm_model: string | null;
  llm_base_url: string | null;
}

export interface RecommendationRequest {
  moodTags: MoodTag[];
  weather?: WeatherType;
  temperature?: number;
  useLlm: boolean;
}

export interface ScoreBreakdown {
  inventory: number;
  mood: number;
  weather: number;
  mbti: number;
  zodiac: number;
  memory: number;
  total: number;
}

export interface MemoryContext {
  totalRecommendations: number;
  recentFavorites: string[];
  preferenceSummary: string;
}

export interface RecommendationResponse {
  recipe: DBRecipe;
  score: number;
  scoreBreakdown: ScoreBreakdown;
  reason: string;
  memoryContext: MemoryContext | null;
  recommendationId: string;
}

export interface RecommendationFeedback {
  recommendationId: string;
  feedback: 1 | 0; // 1=喜欢, 0=不喜欢
}

export interface RecommendationHistory {
  id: string;
  userId: number;
  recipeId: string;
  moodTags: string; // JSON array
  weather: string | null;
  temperature: number | null;
  mbti: string | null;
  zodiac: string | null;
  algorithmScore: number;
  scoreBreakdown: string | null; // JSON object
  llmReason: string | null;
  llmModel: string | null;
  userFeedback: number | null;
  feedbackAt: number | null;
  createdAt: number;
}

export interface TodoItemExtended {
  id: string;
  recipeId: string;
  source: 'ai_bartender' | 'manual' | 'random' | 'discover';
  moodContext: string | null; // JSON array
  priority: number; // 0-5
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  createdAt: number;
  completedAt: number | null;
  notes: string | null;
}

export interface DailyRecommendationStats {
  id: string;
  userId: number;
  dateStr: string;
  totalRecommendations: number;
  likes: number;
  dislikes: number;
  createdAt: number;
  updatedAt: number;
}
