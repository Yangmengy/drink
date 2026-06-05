import { Heart, Flame, Clock } from 'lucide-react';
import { Recipe } from '@/types';
import { getDifficultyText } from '@/utils/format';
import styles from './CocktailCard.module.css';

interface CocktailCardProps {
  recipe: Recipe;
  isFavorite?: boolean;
  onFavoriteToggle?: () => void;
  onClick?: () => void;
  style?: React.CSSProperties;
}

export function CocktailCard({
  recipe,
  isFavorite = false,
  onFavoriteToggle,
  onClick,
  style,
}: CocktailCardProps) {
  const totalTime = recipe.steps.reduce((sum, s) => sum + s.duration_sec, 0);
  const timeText = totalTime > 0 ? `${Math.ceil(totalTime / 60)}min` : null;

  return (
    <div className={styles.card} onClick={onClick} style={style}>
      <div className={styles.imageSection}>
        {recipe.image_url ? (
          <img src={recipe.image_url} alt={recipe.name_zh} className={styles.image} loading="lazy" />
        ) : (
          <div className={styles.imagePlaceholder}>🍸</div>
        )}
        <div className={styles.gradientOverlay} />
        <div className={styles.imageLabel}>
          <span className={styles.imageNameZh}>{recipe.name_zh}</span>
          {recipe.name_en && (
            <span className={styles.imageNameEn}>{recipe.name_en}</span>
          )}
        </div>

        <button
          className={`${styles.favBtn} ${isFavorite ? styles.favBtnFavorited : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            onFavoriteToggle?.();
          }}
          type="button"
        >
          <Heart size={16} fill={isFavorite ? 'currentColor' : 'none'} strokeWidth={2} />
        </button>
      </div>

      <div className={styles.infoRow}>
        {recipe.abv != null && (
          <>
            <span className={styles.infoTag}>
              <Flame size={13} strokeWidth={1.5} />
              {recipe.abv}%
            </span>
            <span className={styles.divider} />
          </>
        )}
        <span className={styles.infoTag}>
          {getDifficultyText(recipe.difficulty)}
        </span>
        {timeText && (
          <>
            <span className={styles.divider} />
            <span className={styles.infoTag}>
              <Clock size={13} strokeWidth={1.5} />
              {timeText}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
