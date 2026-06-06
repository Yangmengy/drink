import { useEffect, useState, useMemo } from 'react';
import { Bookmark, Sparkles, CheckCircle2 } from 'lucide-react';
import { Navbar } from '@/components';
import { useTodoStore } from '@/stores/todoStore';
import { useLogStore } from '@/stores/logStore';
import { useNavigate } from 'react-router-dom';
import styles from './ListPage.module.css';

export function ListPage() {
  const [activeTab, setActiveTab] = useState<'todo' | 'made'>('todo');
  const { todos, fetchTodos, loading: todoLoading } = useTodoStore();
  const { logs, fetchLogs, loading: logLoading } = useLogStore();
  const navigate = useNavigate();

  useEffect(() => {
    fetchTodos();
    // fetchLogs without date string to get all logs
    fetchLogs();
  }, [fetchTodos, fetchLogs]);

  // Derive "Made" recipes from logs (unique recipes)
  const madeRecipes = useMemo(() => {
    const map = new Map();
    for (const log of logs) {
      if (log.recipe && !map.has(log.recipe_id)) {
        map.set(log.recipe_id, log.recipe);
      }
    }
    return Array.from(map.values());
  }, [logs]);

  const canMakeCount = todos.filter(t => t.owned_ingredients >= t.total_ingredients && t.total_ingredients > 0).length;

  return (
    <div className={styles.page}>
      <Navbar title="清单" subtitle="LISTS" showNotifications={false} />

      <div className={styles.tabs}>
        <button 
          className={`${styles.tab} ${activeTab === 'todo' ? styles.active : ''}`}
          onClick={() => setActiveTab('todo')}
        >
          <Bookmark size={18} />
          待做清单
          <span className={styles.badge}>{todos.length}</span>
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'made' ? styles.active : ''}`}
          onClick={() => setActiveTab('made')}
        >
          <CheckCircle2 size={18} />
          已制作
          <span className={styles.badge}>{madeRecipes.length}</span>
        </button>
      </div>

      <div className={styles.content}>
        {activeTab === 'todo' && (
          <div className={styles.section}>
            {todos.length > 0 && (
              <div className={styles.statsCard}>
                <div className={styles.statsIcon}><Sparkles size={24} /></div>
                <div>
                  <div className={styles.statsTitle}>可以调配 {canMakeCount} 款</div>
                  <div className={styles.statsSub}>您的原料已准备就绪</div>
                </div>
              </div>
            )}

            {todoLoading ? (
              <div className={styles.empty}>加载中...</div>
            ) : todos.length > 0 ? (
              <div className={styles.list}>
                {todos.map((todo) => {
                  const progress = todo.total_ingredients > 0 ? (todo.owned_ingredients / todo.total_ingredients) * 100 : 0;
                  const isReady = todo.owned_ingredients >= todo.total_ingredients && todo.total_ingredients > 0;
                  
                  return (
                    <div key={todo.id} className={styles.recipeCard} onClick={() => navigate(`/recipe/${todo.recipe_id}`)}>
                      {todo.recipe.image_url ? (
                        <img src={todo.recipe.image_url} alt={todo.recipe.name_zh} className={styles.recipeImg} />
                      ) : (
                        <div className={styles.recipePlaceholder}>🍸</div>
                      )}
                      <div className={styles.recipeInfo}>
                        <div className={styles.recipeName}>{todo.recipe.name_zh}</div>
                        <div className={styles.recipeCategory}>{todo.recipe.category}</div>
                        <div className={styles.progressContainer}>
                          <div className={styles.progressText}>
                            原料: {todo.owned_ingredients}/{todo.total_ingredients}
                            {isReady && <span className={styles.readyText}>可调制!</span>}
                          </div>
                          <div className={styles.progressBar}>
                            <div className={`${styles.progressFill} ${isReady ? styles.ready : ''}`} style={{ width: `${progress}%` }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className={styles.empty}>
                <span className={styles.emptyIcon}>📝</span>
                <div className={styles.emptyTitle}>暂无待做</div>
                <div className={styles.emptySub}>在配方详情页点击收藏，加入待做清单</div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'made' && (
          <div className={styles.section}>
            {logLoading ? (
              <div className={styles.empty}>加载中...</div>
            ) : madeRecipes.length > 0 ? (
              <div className={styles.grid}>
                {madeRecipes.map((recipe) => (
                  <div key={recipe.id} className={styles.madeCard} onClick={() => navigate(`/recipe/${recipe.id}`)}>
                    {recipe.image_url ? (
                      <img src={recipe.image_url} alt={recipe.name_zh} className={styles.madeImg} />
                    ) : (
                      <div className={styles.madePlaceholder}>🍸</div>
                    )}
                    <div className={styles.madeOverlay}>
                      <div className={styles.madeName}>{recipe.name_zh}</div>
                      <div className={styles.madeCategory}>{recipe.category}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.empty}>
                <span className={styles.emptyIcon}>🏆</span>
                <div className={styles.emptyTitle}>空空如也</div>
                <div className={styles.emptySub}>去记录页面打卡您做过的酒吧</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
