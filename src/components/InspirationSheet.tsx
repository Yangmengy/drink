import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ChevronRight } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { convertFileSrc } from '@tauri-apps/api/core';
import { inventoryApi, recipeApi } from '@/api/client';
import type { DBRecipe } from '@/types';
import styles from './InspirationSheet.module.css';

const CATEGORY_MAP: Record<string, string> = {
  classic: '经典', contemporary: '现代', tropical: '热带',
  short: '短饮', long: '长饮', mocktail: '无酒精',
};

function translateCategory(cat: string) {
  return CATEGORY_MAP[cat] || cat;
}

async function convertImage(r: DBRecipe): Promise<DBRecipe> {
  if (r.image_url && !r.image_url.startsWith('http') && !r.image_url.startsWith('asset://')) {
    try {
      const abs = await invoke<string>('get_image_url', { imageName: r.image_url });
      return { ...r, image_url: convertFileSrc(abs) };
    } catch {
      return r;
    }
  }
  return r;
}

interface Props {
  onClose: () => void;
  /** 通知父组件实际可调制数量，用于更新卡片描述 */
  onCountReady?: (count: number, isFallback: boolean) => void;
}

export function InspirationSheet({ onClose, onCountReady }: Props) {
  const navigate = useNavigate();
  const [recipes, setRecipes] = useState<DBRecipe[]>([]);
  const [isFallback, setIsFallback] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      let data = await inventoryApi.getRecipesByInventory();
      let fallback = false;

      // 没有库存匹配结果 → 用热度推荐兜底
      if (data.length === 0) {
        const recommended = await recipeApi.list();
        // 按 view_count 排序取前3
        data = [...recommended]
          .sort((a, b) => (b.view_count ?? 0) - (a.view_count ?? 0))
          .slice(0, 3);
        fallback = true;
      } else {
        data = data.slice(0, 3);
      }

      // 转换图片
      const converted = await Promise.all(data.map(convertImage));
      setRecipes(converted);
      setIsFallback(fallback);
      onCountReady?.(converted.length, fallback);
    } catch (err) {
      console.error('InspirationSheet load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (recipe: DBRecipe) => {
    onClose();
    navigate(`/recipe/${recipe.id}`);
  };

  const handleGoBar = () => {
    onClose();
    navigate('/bar');
  };

  const hasNoInventory = !loading && recipes.length === 0;

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.sheet}>
        <div className={styles.handle} />

        <div className={styles.header}>
          <div className={styles.titleGroup}>
            <span className={styles.title}>今日灵感</span>
            <span className={styles.subtitle}>
              {loading
                ? '正在匹配...'
                : isFallback
                ? '热门推荐，先去酒柜添加原料吧'
                : `基于你的酒柜，${recipes.length} 款可即刻调制`}
            </span>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        {loading && (
          <div className={styles.center}>
            <div className={styles.emptyTitle} style={{ fontWeight: 400, color: '#999' }}>
              匹配中...
            </div>
          </div>
        )}

        {!loading && hasNoInventory && (
          <div className={styles.center}>
            <span className={styles.emptyEmoji}>🍾</span>
            <div className={styles.emptyTitle}>酒柜还是空的</div>
            <div className={styles.emptySub}>
              去酒柜添加你拥有的原料，{'\n'}就能发现可以调制的鸡尾酒
            </div>
            <button className={styles.goBarBtn} onClick={handleGoBar}>
              去添加原料 →
            </button>
          </div>
        )}

        {!loading && recipes.length > 0 && (
          <div className={styles.list}>
            {recipes.map((recipe) => (
              <button
                key={recipe.id}
                className={styles.card}
                onClick={() => handleSelect(recipe)}
              >
                {recipe.image_url ? (
                  <img src={recipe.image_url} alt={recipe.name_zh} className={styles.img} />
                ) : (
                  <div className={styles.imgPlaceholder}>🍸</div>
                )}
                <div className={styles.info}>
                  <div className={styles.name}>{recipe.name_zh}</div>
                  <div className={styles.meta}>
                    <span className={styles.category}>{translateCategory(recipe.category)}</span>
                    {isFallback && <span className={styles.fallbackTag}>热门</span>}
                    {recipe.abv != null && (
                      <span className={styles.abv}>{recipe.abv}%</span>
                    )}
                  </div>
                  {/* 难度条 */}
                  <div className={styles.progress}>
                    <div className={styles.progressBar}>
                      <div
                        className={isFallback ? styles.progressFillFallback : styles.progressFill}
                        style={{ width: `${Math.min(((recipe.difficulty ?? 1) / 5) * 100, 100)}%` }}
                      />
                    </div>
                    <span className={styles.progressText}>
                      难度 {recipe.difficulty ?? 1}/5
                    </span>
                  </div>
                </div>
                <ChevronRight size={16} className={styles.arrow} />
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
