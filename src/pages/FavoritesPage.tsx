import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { convertFileSrc } from '@tauri-apps/api/core';
import { ArrowLeft } from 'lucide-react';
import { recipeApi } from '@/api/client';
import type { DBRecipe } from '@/types';
import styles from './CollectionPage.module.css';

export function FavoritesPage() {
  const navigate = useNavigate();
  const [recipes, setRecipes] = useState<DBRecipe[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFavorites();
  }, []);

  const loadFavorites = async () => {
    try {
      setLoading(true);
      const data = await recipeApi.getFavorites();
      // 转换图片 URL
      const converted = await Promise.all(
        data.map(async (r) => {
          if (r.image_url && !r.image_url.startsWith('http') && !r.image_url.startsWith('asset://')) {
            try {
              const abs = await invoke<string>('get_image_url', { imageName: r.image_url });
              return { ...r, image_url: convertFileSrc(abs) };
            } catch {
              return r;
            }
          }
          return r;
        })
      );
      setRecipes(converted);
    } catch (err) {
      console.error('Failed to load favorites:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      {/* 顶部导航 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '16px 20px 8px',
        background: 'var(--color-bg-primary)',
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '8px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            color: 'var(--color-text-primary)',
          }}
        >
          <ArrowLeft size={22} />
        </button>
        <div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-text-primary)' }}>我的喜欢</div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', letterSpacing: '0.08em' }}>FAVORITES</div>
        </div>
      </div>

      <div className={styles.content}>
        {loading ? (
          <div className={styles.loading}>加载中...</div>
        ) : recipes.length > 0 ? (
          <>
            <div className={styles.countBadge}>{recipes.length} 款喜欢</div>
            <div className={styles.grid}>
              {recipes.map((recipe) => (
                <div
                  key={recipe.id}
                  className={styles.recipeCard}
                  onClick={() => navigate(`/recipe/${recipe.id}`)}
                >
                  {recipe.image_url ? (
                    <img src={recipe.image_url} alt={recipe.name_zh} className={styles.recipeImg} />
                  ) : (
                    <div className={styles.recipePlaceholder}>🍸</div>
                  )}
                  <div className={styles.recipeInfo}>
                    <div className={styles.recipeName}>{recipe.name_zh}</div>
                    <div className={styles.recipeMeta}>
                      <span className={styles.recipeCategory}>{recipe.category}</span>
                      {recipe.abv != null && (
                        <span className={styles.recipeAbv}>{recipe.abv}%</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className={styles.empty}>
            <span className={styles.emptyEmoji}>🔖</span>
            <div className={styles.emptyTitle}>还没有喜欢的酒</div>
            <div className={styles.emptySub}>在配方详情页点击喜欢，{'\n'}好酒值得留住</div>
          </div>
        )}
      </div>
    </div>
  );
}
