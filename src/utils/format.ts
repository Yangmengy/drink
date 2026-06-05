import { 
  DIFFICULTY_LABELS, 
  CATEGORY_LABELS, 
  METHOD_LABELS,
  DIFFICULTY_STAR 
} from '@/constants/display';
import type { RecipeCategory, MakeMethod } from '@/types';

/**
 * 格式化酒精度
 */
export function formatABV(abv: number): string {
  return `${abv.toFixed(1)}%`;
}

/**
 * 格式化用量
 */
export function formatAmount(amount: number, unit: string): string {
  if (unit === 'ml') return `${amount}ml`;
  if (unit === 'dash') return `${amount} dash`;
  if (unit === 'slice') return `${amount} 片`;
  return `${amount} ${unit}`;
}

/**
 * 获取难度文本
 */
export function getDifficultyText(level: number): string {
  return DIFFICULTY_LABELS[level] || '中等';
}

/**
 * 获取难度星星
 */
export function getDifficultyStars(level: number): string {
  return DIFFICULTY_STAR.repeat(Math.min(Math.max(level, 1), 5));
}

/**
 * 获取分类文本
 */
export function getCategoryText(category: RecipeCategory): string {
  return CATEGORY_LABELS[category] || category;
}

/**
 * 获取制作方法文本
 */
export function getMethodText(method: MakeMethod): string {
  return METHOD_LABELS[method] || method;
}

/**
 * 格式化时间戳
 */
export function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  
  if (diff < minute) return '刚刚';
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`;
  if (diff < 7 * day) return `${Math.floor(diff / day)} 天前`;
  
  return date.toLocaleDateString('zh-CN');
}
