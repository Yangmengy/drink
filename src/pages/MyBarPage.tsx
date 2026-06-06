import { useEffect, useState, useMemo } from 'react';
import { Package, Search, Plus, Check } from 'lucide-react';
import { Navbar } from '@/components';
import { useInventoryStore } from '@/stores/inventoryStore';
import styles from './MyBarPage.module.css';

export function MyBarPage() {
  const { items, allIngredients, fetchInventory, fetchAllIngredients, addItem, removeItem, loading } = useInventoryStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    fetchInventory();
    fetchAllIngredients();
  }, [fetchInventory, fetchAllIngredients]);

  const ownedIds = useMemo(() => new Set(items.map(i => i.ingredient_id)), [items]);

  const categories = useMemo(() => {
    const cats = new Set(allIngredients.map(i => i.category));
    return ['all', ...Array.from(cats)];
  }, [allIngredients]);

  const categoryNames: Record<string, string> = {
    all: '全部',
    spirit: '基酒',
    spirits: '基酒',
    liqueur: '利口酒',
    mixer: '软饮',
    syrup: '糖浆',
    garnish: '装饰',
    ice: '冰块',
    juice: '果汁',
    herb: '香草',
    dairy: '乳制品',
    other: '其他'
  };

  const filteredIngredients = useMemo(() => {
    return allIngredients.filter(i => {
      const matchSearch = i.name_zh.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (i.name_en && i.name_en.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchCategory = selectedCategory === 'all' || i.category === selectedCategory;
      return matchSearch && matchCategory;
    });
  }, [allIngredients, searchQuery, selectedCategory]);

  const handleToggleOwned = async (ingredientId: string, isOwned: boolean) => {
    if (isOwned) {
      await removeItem(ingredientId);
    } else {
      await addItem(ingredientId);
    }
  };

  return (
    <div className={styles.page}>
      <Navbar title="原料库" subtitle="INGREDIENTS" showNotifications={false} />

      <div className={styles.searchContainer}>
        <div className={styles.searchBar}>
          <Search size={18} className={styles.searchIcon} />
          <input
            type="text"
            placeholder="搜索原料..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
        </div>
      </div>

      <div className={styles.layout}>
        {/* 左侧分类导航 */}
        <div className={styles.sidebar}>
          {categories.map(cat => (
            <button
              key={cat}
              className={`${styles.catButton} ${selectedCategory === cat ? styles.active : ''}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {categoryNames[cat] || cat}
            </button>
          ))}
        </div>

        {/* 右侧列表 */}
        <div className={styles.listContainer}>
          {loading ? (
            <div className={styles.loading}>加载中...</div>
          ) : filteredIngredients.length > 0 ? (
            <div className={styles.grid}>
              {filteredIngredients.map((ingredient) => {
                const isOwned = ownedIds.has(ingredient.id);
                return (
                  <div 
                    key={ingredient.id} 
                    className={`${styles.ingredientCard} ${isOwned ? styles.owned : ''}`}
                    onClick={() => handleToggleOwned(ingredient.id, isOwned)}
                  >
                    <div className={styles.iconContainer}>
                      <span className={styles.icon}>🥃</span>
                      {isOwned && (
                        <div className={styles.checkBadge}>
                          <Check size={12} strokeWidth={3} />
                        </div>
                      )}
                    </div>
                    <div className={styles.info}>
                      <div className={styles.name}>{ingredient.name_zh}</div>
                      <div className={styles.category}>{categoryNames[ingredient.category] || ingredient.category}</div>
                    </div>
                    <button className={`${styles.actionBtn} ${isOwned ? styles.actionRemove : styles.actionAdd}`}>
                      {isOwned ? '移除' : <Plus size={16} />}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={styles.empty}>
              <Package size={40} className={styles.emptyIcon} />
              <div className={styles.emptyText}>未找到相关原料</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
