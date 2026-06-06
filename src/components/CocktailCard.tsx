import { Heart } from 'lucide-react';
import type { Recipe } from '@/types';
import styles from './CocktailCard.module.css';

const DIFFICULTY_DOTS: Record<string, number> = {
  Easy: 1,
  Medium: 3,
  Hard: 5,
};

interface CocktailCardProps {
  recipe: Recipe;
  variant?: 'grid' | 'recommend';
  isFavorite?: boolean;
  onFavoriteToggle?: () => void;
  onClick?: () => void;
  style?: React.CSSProperties;
}

export function CocktailCard({
  recipe,
  variant = 'grid',
  isFavorite = false,
  onFavoriteToggle,
  onClick,
  style,
}: CocktailCardProps) {
  const dotCount = DIFFICULTY_DOTS[recipe.difficulty] ?? 3;

  const handleImgError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.style.display = 'none';
    const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
    if (fallback) fallback.style.display = 'flex';
  };

  if (variant === 'recommend') {
    return (
      <div className={styles.recommendCard} onClick={onClick} style={style}>
        <div className={styles.recommendImage}>
          {recipe.image ? (
            <img
              src={recipe.image}
              alt={recipe.nameEn}
              className={styles.recipeImg}
              loading="lazy"
              onError={handleImgError}
            />
          ) : null}
          <div
            className={styles.imagePlaceholder}
            style={{ display: recipe.image ? 'none' : 'flex' }}
          >
            🍸
          </div>
          <div className={styles.imageOverlay}>
            <span className={styles.recommendAbv}>
              {recipe.abv != null ? `${recipe.abv}%` : ''}
            </span>
          </div>
        </div>
        <div className={styles.recommendInfo}>
          <span className={styles.recommendName}>{recipe.nameZh}</span>
          <span className={styles.recommendSub}>{recipe.glass}</span>
        </div>
      </div>
    );
  }

  // grid variant
  return (
    <div className={styles.gridCard} onClick={onClick} style={style}>
      <div className={styles.gridImage}>
        {recipe.image ? (
          <img
            src={recipe.image}
            alt={recipe.nameEn}
            className={styles.recipeImg}
            loading="lazy"
            onError={handleImgError}
          />
        ) : null}
        <div
          className={styles.gridImagePlaceholder}
          style={{ display: recipe.image ? 'none' : 'flex' }}
        >
          {recipe.glassIcon || '🍸'}
        </div>
        <div className={styles.gridOverlay} />
        <button
          className={`${styles.favBtn} ${isFavorite ? styles.favBtnActive : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            onFavoriteToggle?.();
          }}
        >
          <Heart
            size={14}
            fill={isFavorite ? 'currentColor' : 'none'}
            strokeWidth={2}
          />
        </button>
      </div>
      <div className={styles.gridInfo}>
        <span className={styles.gridName}>{recipe.nameZh || recipe.nameEn}</span>
        <div className={styles.gridMeta}>
          {recipe.abv != null && (
            <span className={styles.gridAbv}>{recipe.abv}%</span>
          )}
          <span className={styles.gridDifficulty}>
            {'●'.repeat(dotCount)}{'○'.repeat(5 - dotCount)}
          </span>
        </div>
        <p className={styles.gridDesc}>
          {recipe.ingredients.slice(0, 3).map((i) => i.name).join(' · ') || recipe.instructions.slice(0, 50)}
        </p>
      </div>
    </div>
  );
}
