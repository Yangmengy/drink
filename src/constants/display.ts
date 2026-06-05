/**
 * UI 展示相关常量
 * 用于统一管理前端展示的文本映射和配置
 */

import type { RecipeCategory, MakeMethod, IngredientCategory } from '@/types';

/**
 * 配方分类中文标签
 */
export const CATEGORY_LABELS: Record<RecipeCategory, string> = {
  classic: '经典',
  contemporary: '当代',
  tropical: '热带',
  short: '短饮',
  long: '长饮',
  mocktail: '无酒精',
} as const;

/**
 * 制作方法中文标签
 */
export const METHOD_LABELS: Record<MakeMethod, string> = {
  shake: '摇和',
  stir: '搅拌',
  build: '直调',
  blend: '搅拌机',
} as const;

/**
 * 难度等级中文标签
 */
export const DIFFICULTY_LABELS: Record<number, string> = {
  1: '简单',
  2: '中等',
  3: '进阶',
  4: '困难',
  5: '大师',
} as const;

/**
 * 原料分类中文标签
 */
export const INGREDIENT_CATEGORY_LABELS: Record<IngredientCategory, string> = {
  spirit: '基酒',
  liqueur: '利口酒',
  mixer: '调和物',
  syrup: '糖浆',
  garnish: '装饰物',
  ice: '冰块',
} as const;

/**
 * UI 筛选用的分类列表
 * 用于发现页等筛选功能
 */
export const UI_FILTER_CATEGORIES = [
  '经典',
  '热带',
  '清爽',
  '烈酒',
  '甜酒',
  '无酒精',
] as const;

/**
 * 难度星级符号
 */
export const DIFFICULTY_STAR = '🌟';

/**
 * 默认占位图片
 */
export const DEFAULT_RECIPE_IMAGE_PLACEHOLDER = '🍸';
export const DEFAULT_INGREDIENT_IMAGE_PLACEHOLDER = '🧊';
