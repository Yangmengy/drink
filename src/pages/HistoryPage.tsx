import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { convertFileSrc } from '@tauri-apps/api/core';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { recipeApi } from '@/api/client';
import type { DBRecipe } from '@/types';
import styles from './CollectionPage.module.css';

export function HistoryPage() {
  const navigate = useNavigate();
  const [recipes, setRecipes] = useState<DBRecipe[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const data = await recipeApi.getHistory(100);
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
      console.error('Failed to load history:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (ts: number | null) => {
    if (!ts) return '';
    const d = new Date(ts * 1000);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diffDays === 0) return '今天';
    if (diffDays === 1) return '昨天';
    if (diffDays < 7) return `${diffDays} 天前`;
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  };

  return (
    <div className={styles.page}>
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
          <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-text-primary)' }}>浏览历史</div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', letterSpacing: '0.08em' }}>HISTORY</div>
        </div>
      </div>

      <div className={styles.content}>
        {loading ? (
          <div className={styles.loading}>加载中...</div>
        ) : recipes.length > 0 ? (
          <>
            <div className={styles.countBadge}>最近浏览了 {recipes.length} 款</div>
            <div className={styles.list}>
              {recipes.map((recipe) => (
                <div
                  key={recipe.id}
                  className={styles.historyCard}
                  onClick={() => navigate(`/recipe/${recipe.id}`)}
                >
                  {recipe.image_url ? (
                    <img src={recipe.image_url} alt={recipe.name_zh} className={styles.historyImg} />
                  ) : (
                    <div className={styles.historyPlaceholder}>🍸</div>
                  )}
                  <div className={styles.historyInfo}>
                    <div className={styles.historyName}>{recipe.name_zh}</div>
                    <div className={styles.historyMeta}>
                      {recipe.category}
                      {recipe.abv != null ? `  ·  ${recipe.abv}%` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>
                      {formatTime(recipe.last_viewed_at)}
                    </span>
                    <ChevronRight size={16} className={styles.historyArrow} />
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className={styles.empty}>
            <span className={styles.emptyEmoji}>🕐</span>
            <div className={styles.emptyTitle}>还没有浏览记录</div>
            <div className={styles.emptySub}>去发现页探索鸡尾酒吧</div>
          </div>
        )}
      </div>
    </div>
  );
}
