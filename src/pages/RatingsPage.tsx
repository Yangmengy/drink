import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { convertFileSrc } from '@tauri-apps/api/core';
import { ArrowLeft, Star } from 'lucide-react';
import { logApi } from '@/api/client';
import type { DrinkLog } from '@/types';
import styles from './CollectionPage.module.css';

export function RatingsPage() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<DrinkLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRatings();
  }, []);

  const loadRatings = async () => {
    try {
      setLoading(true);
      // 取全部记录，过滤有评分的，按评分降序排列
      const allLogs = await logApi.list();
      const rated = allLogs
        .filter((l) => l.rating != null && l.rating > 0)
        .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));

      // 转换配方图片
      const converted = await Promise.all(
        rated.map(async (log) => {
          if (
            log.recipe?.image_url &&
            !log.recipe.image_url.startsWith('http') &&
            !log.recipe.image_url.startsWith('asset://')
          ) {
            try {
              const abs = await invoke<string>('get_image_url', { imageName: log.recipe.image_url });
              return {
                ...log,
                recipe: { ...log.recipe, image_url: convertFileSrc(abs) },
              };
            } catch {
              return log;
            }
          }
          return log;
        })
      );
      setLogs(converted);
    } catch (err) {
      console.error('Failed to load ratings:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts * 1000);
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        size={13}
        fill={i < rating ? '#F5A623' : 'none'}
        color={i < rating ? '#F5A623' : '#DDD'}
        strokeWidth={1.5}
      />
    ));
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
          <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-text-primary)' }}>我的评分</div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', letterSpacing: '0.08em' }}>RATINGS</div>
        </div>
      </div>

      <div className={styles.content}>
        {loading ? (
          <div className={styles.loading}>加载中...</div>
        ) : logs.length > 0 ? (
          <>
            <div className={styles.countBadge}>评分了 {logs.length} 条记录</div>
            <div className={styles.list}>
              {logs.map((log) => (
                <div
                  key={log.id}
                  className={styles.ratingCard}
                  onClick={() => log.recipe_id && navigate(`/recipe/${log.recipe_id}`)}
                >
                  {log.recipe?.image_url ? (
                    <img src={log.recipe.image_url} alt={log.recipe.name_zh} className={styles.ratingImg} />
                  ) : (
                    <div className={styles.ratingPlaceholder}>🍸</div>
                  )}
                  <div className={styles.ratingInfo}>
                    <div className={styles.ratingName}>
                      {log.recipe?.name_zh || '未知酒款'}
                    </div>
                    <div className={styles.ratingStars}>
                      {renderStars(log.rating ?? 0)}
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#F5A623', marginLeft: '4px' }}>
                        {log.rating}
                      </span>
                    </div>
                    <div className={styles.ratingDate}>{formatDate(log.created_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className={styles.empty}>
            <span className={styles.emptyEmoji}>⭐</span>
            <div className={styles.emptyTitle}>还没有评分记录</div>
            <div className={styles.emptySub}>在添加饮酒记录时给喝过的酒打分吧</div>
          </div>
        )}
      </div>
    </div>
  );
}
