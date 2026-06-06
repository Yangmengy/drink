import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Heart, Clock, Bookmark, BookmarkCheck } from 'lucide-react';
import { useRecipeStore } from '@/stores/recipeStore';
import { todoApi } from '@/api/client';
import styles from './RecipeDetailPage.module.css';

const DIFFICULTY_DOTS: Record<string, number> = {
  Easy: 1,
  Medium: 3,
  Hard: 5,
};

export function RecipeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentRecipe, loading, error, fetchRecipeDetail, toggleFavorite, clearCurrentRecipe } = useRecipeStore();
  const [isTodo, setIsTodo] = useState(false);

  useEffect(() => {
    if (id) {
      fetchRecipeDetail(id);
      todoApi.isTodo(id).then(setIsTodo).catch(console.error);
    }
    return () => {
      clearCurrentRecipe();
    };
  }, [id, fetchRecipeDetail, clearCurrentRecipe]);

  const toggleTodo = async () => {
    if (!id) return;
    try {
      if (isTodo) {
        await todoApi.remove(id);
      } else {
        await todoApi.add(id);
      }
      setIsTodo(!isTodo);
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>加载中...</div>
      </div>
    );
  }

  if (error || !currentRecipe) {
    return (
      <div className={styles.page}>
        <div className={styles.error}>
          <span className={styles.errorEmoji}>😕</span>
          <p>{error || '配方不存在'}</p>
          <button onClick={() => navigate(-1)} className={styles.backButton}>返回</button>
        </div>
      </div>
    );
  }

  const dotCount = DIFFICULTY_DOTS[currentRecipe.difficulty] ?? 3;
  const hasIngredients = currentRecipe.ingredients.length > 0;
  const hasSteps = currentRecipe.steps.length > 0;
  const ownedCount = currentRecipe.ingredients.filter(i => i.inUserInventory).length;
  const totalCount = currentRecipe.ingredients.length;

  return (
    <div className={styles.page}>
      {/* 沉浸式顶部导航 */}
      <header className={styles.header}>
        <button className={styles.navButton} onClick={() => navigate(-1)}>
          <ArrowLeft size={20} />
        </button>
        <div className={styles.navActions}>
          <button 
            className={`${styles.navButton} ${isTodo ? styles.todoActive : ''}`} 
            onClick={toggleTodo}
          >
            {isTodo ? <BookmarkCheck size={20} /> : <Bookmark size={20} />}
          </button>
          <button
            className={`${styles.navButton} ${currentRecipe.isFavorite ? styles.favorited : ''}`}
            onClick={() => toggleFavorite(currentRecipe.id)}
          >
            <Heart size={20} fill={currentRecipe.isFavorite ? 'currentColor' : 'none'} />
          </button>
        </div>
      </header>

      {/* 沉浸式 Hero 区域 */}
      <div className={styles.hero}>
        {currentRecipe.image ? (
          <img src={currentRecipe.image} alt={currentRecipe.nameEn} className={styles.heroImage} />
        ) : (
          <div className={styles.heroPlaceholder}>🍸</div>
        )}
        <div className={styles.heroOverlay}>
          <div className={styles.heroTitles}>
            <h1 className={styles.heroNameZh}>{currentRecipe.nameZh}</h1>
            <span className={styles.heroNameEn}>{currentRecipe.nameEn}</span>
          </div>
          {currentRecipe.category && (
            <span className={styles.heroCategory}>{currentRecipe.category}</span>
          )}
        </div>
      </div>

      {/* 内容区域 */}
      <div className={styles.content}>
        {/* 拟物毛玻璃信息卡片 */}
        <div className={styles.infoCard}>
          <div className={styles.infoItem}>
            <span className={styles.infoIcon}>💧</span>
            <span className={styles.infoLabel}>酒精度</span>
            <span className={styles.infoValue}>
              {currentRecipe.abv != null ? `${currentRecipe.abv}%` : 'N/A'}
            </span>
          </div>
          <div className={styles.infoDivider} />
          <div className={styles.infoItem}>
            <span className={styles.infoIcon}>⭐️</span>
            <span className={styles.infoLabel}>难度</span>
            <span className={styles.infoDots}>
              {'●'.repeat(dotCount)}{'○'.repeat(5 - dotCount)}
            </span>
          </div>
          <div className={styles.infoDivider} />
          <div className={styles.infoItem}>
            <span className={styles.infoIcon}>🍸</span>
            <span className={styles.infoLabel}>杯型</span>
            <span className={styles.infoValue}>{currentRecipe.glass}</span>
          </div>
          {currentRecipe.prepTime && (
            <>
              <div className={styles.infoDivider} />
              <div className={styles.infoItem}>
                <Clock size={16} className={styles.infoIconText} />
                <span className={styles.infoLabel}>时长</span>
                <span className={styles.infoValue}>{currentRecipe.prepTime}m</span>
              </div>
            </>
          )}
        </div>

        {/* 故事区块 - 杂志风排版 */}
        {currentRecipe.story && (
          <div className={styles.storyBlock}>
            <div className={styles.storyQuoteIcon}>"</div>
            <p className={styles.storyText}>{currentRecipe.story}</p>
          </div>
        )}

        {/* 风味雷达 / 进度条 */}
        {currentRecipe.flavorProfile && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>风味档案</h2>
            <div className={styles.flavorBars}>
              <div className={styles.flavorRow}>
                <span className={styles.flavorLabel}>甜 (Sweet)</span>
                <div className={styles.flavorTrack}>
                  <div className={styles.flavorFill} style={{ width: `${(currentRecipe.flavorProfile.sweet / 5) * 100}%`, background: '#FF9A9E' }} />
                </div>
              </div>
              <div className={styles.flavorRow}>
                <span className={styles.flavorLabel}>酸 (Sour)</span>
                <div className={styles.flavorTrack}>
                  <div className={styles.flavorFill} style={{ width: `${(currentRecipe.flavorProfile.sour / 5) * 100}%`, background: '#FAD0C4' }} />
                </div>
              </div>
              <div className={styles.flavorRow}>
                <span className={styles.flavorLabel}>苦 (Bitter)</span>
                <div className={styles.flavorTrack}>
                  <div className={styles.flavorFill} style={{ width: `${(currentRecipe.flavorProfile.bitter / 5) * 100}%`, background: '#A18CD1' }} />
                </div>
              </div>
              <div className={styles.flavorRow}>
                <span className={styles.flavorLabel}>烈 (Strong)</span>
                <div className={styles.flavorTrack}>
                  <div className={styles.flavorFill} style={{ width: `${(currentRecipe.flavorProfile.strong / 5) * 100}%`, background: '#FBC2EB' }} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 描述与标签 */}
        {currentRecipe.description && (
          <p className={styles.description}>{currentRecipe.description}</p>
        )}
        {currentRecipe.tags.length > 0 && (
          <div className={styles.tags}>
            {currentRecipe.tags.map((tag, index) => (
              <span key={index} className={styles.tag}>{tag}</span>
            ))}
          </div>
        )}

        {/* 原料清单 - Checklist */}
        {hasIngredients && (
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>原料清单</h2>
              {totalCount > 0 && (
                <span className={styles.ingredientCount}>
                  已拥有 {ownedCount}/{totalCount}
                </span>
              )}
            </div>
            <div className={styles.ingredientList}>
              {currentRecipe.ingredients.map((ingredient, index) => (
                <div key={index} className={`${styles.ingredientCard} ${ingredient.isOptional ? styles.optional : ''}`}>
                  <div className={`${styles.ingredientCheck} ${ingredient.inUserInventory ? styles.checked : ''}`}>
                    {ingredient.inUserInventory ? '✓' : ''}
                  </div>
                  <div className={styles.ingredientInfo}>
                    <span className={styles.ingredientName}>
                      {ingredient.name}
                      {ingredient.isOptional && <span className={styles.optionalLabel}>可选</span>}
                    </span>
                    <span className={styles.ingredientAmount}>
                      {ingredient.amount} {ingredient.unit}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 制作步骤 - 垂直时间轴 */}
        {hasSteps && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>制作步骤</h2>
            <div className={styles.timeline}>
              {currentRecipe.steps.map((step, index) => (
                <div key={index} className={styles.timelineItem}>
                  <div className={styles.timelineDot}>{step.stepNumber}</div>
                  <div className={styles.timelineContent}>
                    {step.title && <h3 className={styles.stepTitle}>{step.title}</h3>}
                    <p className={styles.stepInstruction}>{step.instruction}</p>
                    {step.duration && (
                      <span className={styles.stepDuration}>
                        <Clock size={12} /> {step.duration}秒
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 其他信息 */}
        {(currentRecipe.garnish || currentRecipe.iceType || currentRecipe.method || currentRecipe.origin) && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>更多信息</h2>
            <div className={styles.metaGrid}>
              {currentRecipe.method && (
                <div className={styles.metaCard}>
                  <span className={styles.metaLabel}>调制法</span>
                  <span className={styles.metaValue}>{currentRecipe.method}</span>
                </div>
              )}
              {currentRecipe.garnish && (
                <div className={styles.metaCard}>
                  <span className={styles.metaLabel}>装饰</span>
                  <span className={styles.metaValue}>{currentRecipe.garnish}</span>
                </div>
              )}
              {currentRecipe.iceType && (
                <div className={styles.metaCard}>
                  <span className={styles.metaLabel}>冰块</span>
                  <span className={styles.metaValue}>{currentRecipe.iceType}</span>
                </div>
              )}
              {currentRecipe.origin && (
                <div className={styles.metaCard}>
                  <span className={styles.metaLabel}>起源地</span>
                  <span className={styles.metaValue}>{currentRecipe.origin}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
