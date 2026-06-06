import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { Navbar, SearchBar, Tag, SectionTitle, CocktailCard } from '@/components';
import { useRecipeStore } from '@/stores/recipeStore';
import type { Recipe } from '@/types';
import styles from './DiscoverPage.module.css';

// 动态计算分类
function useCategories(recipes: Recipe[]) {
  return useMemo(() => {
    const seen = new Set<string>();
    const cats: { key: string | null; label: string }[] = [{ key: null, label: '全部' }];
    for (const r of recipes) {
      const cat = r.category;
      if (cat && !seen.has(cat)) {
        seen.add(cat);
        cats.push({ key: cat, label: cat });
      }
    }
    return cats;
  }, [recipes]);
}

export function DiscoverPage() {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  const { recipes, fetchRecipes } = useRecipeStore();

  useEffect(() => {
    // 页面加载时获取全部数据（受后端默认 LIMIT 控制）
    fetchRecipes();
  }, [fetchRecipes]);

  const categories = useCategories(recipes);

  const filteredRecipes = useMemo(() => {
    let result = recipes;
    if (selectedCategory) {
      result = result.filter((r) => r.category === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.nameZh.toLowerCase().includes(q) ||
          r.nameEn.toLowerCase().includes(q)
      );
    }
    return result;
  }, [recipes, selectedCategory, searchQuery]);

  const featuredRecipes = useMemo(() => recipes.slice(0, 8), [recipes]);

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
      {/* 顶部：大标题 + 通知 */}
      <Navbar
        title="Mixology"
        subtitle=""
        showNotifications
        hasNotification
      />

      <div className={styles.content}>
        {/* 搜索栏 */}
        <SearchBar
          placeholder="搜索鸡尾酒、原料、配方..."
          value={searchQuery}
          onChange={setSearchQuery}
          className={styles.searchBar}
        />

        {/* “今日灵感”卡片 */}
        <div
          className={styles.inspirationCard}
          onClick={() => console.log('Navigate to recommendations')}
        >
          <div className={styles.inspirationBody}>
            <div className={styles.iconArea}>
              <span className={styles.iconEmoji}>🍸</span>
            </div>
            <div className={styles.inspirationText}>
              <h2 className={styles.inspirationTitle}>今日灵感</h2>
              <p className={styles.inspirationDesc}>
                基于你的酒柜，发现 3 款可即刻调制的鸡尾酒
              </p>
              <span className={styles.inspirationLink}>
                查看推荐 <ChevronRight size={14} strokeWidth={2.5} />
              </span>
            </div>
          </div>
        </div>

        {/* 热门推荐 */}
        <div className={styles.section}>
          <SectionTitle>热门推荐</SectionTitle>
          <div className={styles.recommendScroll}>
            {featuredRecipes.map((recipe) => (
              <CocktailCard
                key={recipe.id}
                recipe={recipe}
                variant="recommend"
                onClick={() => navigate(`/recipe/${recipe.id}`)}
              />
            ))}
          </div>
        </div>

        {/* 分类浏览 */}
        <div className={styles.section}>
          <SectionTitle>分类浏览</SectionTitle>
          <div className={styles.categoryScroll}>
            {categories.map((cat) => (
              <Tag
                key={cat.label}
                selected={selectedCategory === cat.key}
                onClick={() =>
                  setSelectedCategory(
                    selectedCategory === cat.key ? null : cat.key
                  )
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
                variant="grid"
                isFavorite={favorites.has(recipe.id)}
                onFavoriteToggle={() => toggleFavorite(recipe.id)}
                onClick={() => navigate(`/recipe/${recipe.id}`)}
                style={{
                  animationDelay: `${index * 60}ms`,
                  animation: `fadeIn var(--duration-normal) var(--ease-out) forwards`,
                  opacity: 0,
                }}
              />
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <span className={styles.emptyEmoji}>🍸</span>
            <span className={styles.emptyTitle}>暂无匹配配方</span>
            <span className={styles.emptyText}>试试其他分类或关键词</span>
          </div>
        )}
      </div>
    </div>
  );
}
