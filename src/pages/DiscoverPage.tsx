import { useState, useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import { Navbar, SearchBar, Tag, SectionTitle, CocktailCard } from '@/components';
import { mockRecipes } from '@/data/mockRecipes';
import styles from './DiscoverPage.module.css';

const categories = [
  { key: null, label: '全部' },
  { key: 'classic', label: '经典' },
  { key: 'contemporary', label: '当代' },
  { key: 'tropical', label: '热带' },
  { key: 'short', label: '短饮' },
  { key: 'long', label: '长饮' },
  { key: 'mocktail', label: '无酒精' },
] as const;

export function DiscoverPage() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  const filteredRecipes = useMemo(() => {
    if (!selectedCategory) return mockRecipes;
    return mockRecipes.filter((r) => r.category === selectedCategory);
  }, [selectedCategory]);

  const featuredRecipes = mockRecipes.slice(0, 6);

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className={styles.page}>
      <Navbar title="Mixology" size="large" showBell showTheme />

      <div className={styles.content}>
        {/* 搜索栏 — 点击跳转搜索页 */}
        <SearchBar
          placeholder="搜索鸡尾酒、原料..."
          readonly
          className={styles.searchBar}
        />

        {/* Hero 推荐卡片 */}
        <div className={styles.heroCard}>
          <div className={styles.heroEmoji}>🍸</div>
          <h2 className={styles.heroTitle}>今日灵感</h2>
          <p className={styles.heroSubtitle}>
            基于你的酒柜，发现 3 款可即刻调制的鸡尾酒
          </p>
          <span className={styles.heroAction}>
            查看推荐 <ChevronRight size={16} strokeWidth={2} />
          </span>
        </div>

        {/* 热门推荐 */}
        <div className={styles.section}>
          <SectionTitle action="全部">热门推荐</SectionTitle>
          <div className={styles.recommendScroll}>
            {featuredRecipes.map((recipe) => (
              <div
                key={recipe.id}
                className={styles.recommendCard}
                onClick={() => console.log('View:', recipe.id)}
              >
                <span className={styles.recEmoji}>🍸</span>
                <div className={styles.recInfo}>
                  <span className={styles.recName}>{recipe.name_zh}</span>
                  <span className={styles.recMeta}>
                    {recipe.abv != null ? `${recipe.abv}%` : ''}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 分类标签 */}
        <div className={styles.section}>
          <SectionTitle>分类浏览</SectionTitle>
          <div className={styles.categoryRow}>
            {categories.map((cat) => (
              <Tag
                key={cat.label}
                selected={selectedCategory === cat.key}
                onClick={() =>
                  setSelectedCategory(selectedCategory === cat.key ? null : cat.key)
                }
              >
                {cat.label}
              </Tag>
            ))}
          </div>
        </div>

        {/* 配方网格 */}
        {filteredRecipes.length > 0 ? (
          <div className={styles.recipeGrid}>
            {filteredRecipes.map((recipe, index) => (
              <CocktailCard
                key={recipe.id}
                recipe={recipe}
                isFavorite={favorites.has(recipe.id)}
                onFavoriteToggle={() => toggleFavorite(recipe.id)}
                onClick={() => console.log('View recipe:', recipe.id)}
                style={{ animationDelay: `${index * 50}ms` }}
              />
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <span className={styles.emptyEmoji}>🔍</span>
            <span className={styles.emptyText}>该分类暂无配方</span>
          </div>
        )}
      </div>
    </div>
  );
}
