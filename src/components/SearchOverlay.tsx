import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, ChevronRight, Clock } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { convertFileSrc } from '@tauri-apps/api/core';
import type { DBRecipe } from '@/types';
import styles from './SearchOverlay.module.css';

const STORAGE_KEY = 'search_recent';
const MAX_RECENT = 5;

const CATEGORY_MAP: Record<string, string> = {
  classic: '经典', contemporary: '现代', tropical: '热带',
  short: '短饮', long: '长饮', mocktail: '无酒精',
};

function translateCategory(cat: string) {
  return CATEGORY_MAP[cat] || cat;
}

function loadRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveRecent(list: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function addRecent(query: string) {
  const list = loadRecent().filter((q) => q !== query);
  list.unshift(query);
  saveRecent(list.slice(0, MAX_RECENT));
}

// 高亮匹配关键词
function Highlight({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <span className={styles.highlight}>{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </>
  );
}

interface Props {
  onClose: () => void;
}

export function SearchOverlay({ onClose }: Props) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DBRecipe[]>([]);
  const [searching, setSearching] = useState(false);
  const [recent, setRecent] = useState<string[]>(loadRecent);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 聚焦输入框
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 80);
  }, []);

  // 防抖搜索
  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    try {
      const data = await invoke<DBRecipe[]>('search_recipes', { args: { query: q, limit: 30 } });
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
      setResults(converted);
    } catch (err) {
      console.error('Search error:', err);
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleChange = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 300);
  };

  const handleSelectResult = (recipe: DBRecipe) => {
    if (query.trim()) addRecent(query.trim());
    setRecent(loadRecent());
    onClose();
    navigate(`/recipe/${recipe.id}`);
  };

  const handleSelectRecent = (q: string) => {
    setQuery(q);
    doSearch(q);
  };

  const handleDeleteRecent = (q: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = recent.filter((r) => r !== q);
    setRecent(next);
    saveRecent(next);
  };

  const handleClearAll = () => {
    setRecent([]);
    saveRecent([]);
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    inputRef.current?.focus();
  };

  const showRecent = !query.trim() && recent.length > 0;
  const showResults = query.trim().length > 0;

  return (
    <>
      {/* 顶部搜索栏 */}
      <div className={styles.searchHeader}>
        <div className={styles.searchInputWrap}>
          <Search size={15} strokeWidth={1.75} className={styles.searchIcon} />
          <input
            ref={inputRef}
            type="search"
            className={styles.searchInput}
            placeholder="搜索鸡尾酒、原料、配方..."
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            enterKeyHint="search"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && query.trim()) {
                addRecent(query.trim());
                setRecent(loadRecent());
              }
            }}
          />
          {query && (
            <button className={styles.clearBtn} onClick={handleClear}>
              <X size={11} strokeWidth={2.5} />
            </button>
          )}
        </div>
        <button className={styles.cancelBtn} onClick={onClose}>
          取消
        </button>
      </div>

      {/* 遮罩内容 */}
      <div className={styles.overlay}>
        <div className={styles.overlayContent}>

          {/* 最近搜索 */}
          {showRecent && (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionTitle}>最近搜索</span>
                <button className={styles.clearAll} onClick={handleClearAll}>清空</button>
              </div>
              <div className={styles.recentTags}>
                {recent.map((q) => (
                  <button
                    key={q}
                    className={styles.recentTag}
                    onClick={() => handleSelectRecent(q)}
                  >
                    <Clock size={13} color="var(--color-text-tertiary)" />
                    {q}
                    <span
                      className={styles.recentTagDel}
                      onClick={(e) => handleDeleteRecent(q, e)}
                    >
                      ×
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 无最近搜索的空提示 */}
          {!showRecent && !showResults && (
            <div className={styles.searching} style={{ paddingTop: 64 }}>
              输入关键词搜索鸡尾酒
            </div>
          )}

          {/* 搜索中 */}
          {showResults && searching && (
            <div className={styles.searching}>搜索中...</div>
          )}

          {/* 搜索结果 */}
          {showResults && !searching && results.length > 0 && (
            <div className={styles.resultList}>
              {results.map((recipe, idx) => (
                <div key={recipe.id}>
                  <button
                    className={styles.resultItem}
                    onClick={() => handleSelectResult(recipe)}
                  >
                    {recipe.image_url ? (
                      <img src={recipe.image_url} alt={recipe.name_zh} className={styles.resultImg} />
                    ) : (
                      <div className={styles.resultImgPlaceholder}>🍸</div>
                    )}
                    <div className={styles.resultInfo}>
                      <div className={styles.resultName}>
                        <Highlight text={recipe.name_zh} query={query} />
                      </div>
                      {recipe.name_en && (
                        <div className={styles.resultNameEn}>
                          <Highlight text={recipe.name_en} query={query} />
                        </div>
                      )}
                      <div className={styles.resultMeta}>
                        <span className={styles.resultCategory}>
                          {translateCategory(recipe.category)}
                        </span>
                        {recipe.abv != null && (
                          <span className={styles.resultAbv}>{recipe.abv}%</span>
                        )}
                      </div>
                    </div>
                    <ChevronRight size={16} className={styles.resultArrow} />
                  </button>
                  {idx < results.length - 1 && <div className={styles.divider} />}
                </div>
              ))}
            </div>
          )}

          {/* 无结果 */}
          {showResults && !searching && results.length === 0 && (
            <div className={styles.emptyState}>
              <span className={styles.emptyEmoji}>🔍</span>
              <div className={styles.emptyTitle}>没找到「{query}」</div>
              <div className={styles.emptySub}>换个关键词试试？</div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
