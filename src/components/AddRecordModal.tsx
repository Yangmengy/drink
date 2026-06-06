import { useState, useRef, useMemo, useEffect } from 'react';
import { X, Camera, Star, Plus, Trash2 } from 'lucide-react';
import { useTodoStore } from '@/stores/todoStore';
import { useLogStore } from '@/stores/logStore';
import { recipeApi, imageApi, logApi, inventoryApi } from '@/api/client';
import type { Ingredient } from '@/types';
import styles from './AddRecordModal.module.css';

interface AddRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  selectedDateStr: string;
  mode?: 'log' | 'recipe_only';
}

export function AddRecordModal({ isOpen, onClose, onSuccess, selectedDateStr, mode = 'log' }: AddRecordModalProps) {
  const [tab, setTab] = useState<'select' | 'custom'>(mode === 'recipe_only' ? 'custom' : 'select');
  const [loading, setLoading] = useState(false);
  
  // Select Tab State
  const { todos, fetchTodos } = useTodoStore();
  const { logs, fetchLogs } = useLogStore();
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);

  // Image Upload State (Multi)
  const [imagesPreview, setImagesPreview] = useState<string[]>([]);
  
  // Custom Tab State
  const [customName, setCustomName] = useState('');
  const [customCategory, setCustomCategory] = useState('other');
  
  // Custom Detail Optional Fields
  const [showDetails, setShowDetails] = useState(false);
  const [customDesc, setCustomDesc] = useState('');
  const [customMethod, setCustomMethod] = useState('');
  const [customDifficulty, setCustomDifficulty] = useState(1);
  const [customGlass, setCustomGlass] = useState('');
  const [customSweet, setCustomSweet] = useState(0);
  const [customSour, setCustomSour] = useState(0);
  const [customBitter, setCustomBitter] = useState(0);
  const [customStrong, setCustomStrong] = useState(0);

  // Ingredients and Steps State
  const [allIngredients, setAllIngredients] = useState<Ingredient[]>([]);
  const [customIngredients, setCustomIngredients] = useState<Array<{ id: string; ingredientId: string; rawName: string; amount: number; unit: string; note: string }>>([]);
  const [customSteps, setCustomSteps] = useState<Array<{ id: string; text: string }>>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Common State
  const [rating, setRating] = useState<number>(0);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (mode === 'log') {
        fetchTodos();
        fetchLogs(); // without date to get all unique made recipes
      }
      inventoryApi.getAllIngredients().then(setAllIngredients).catch(console.error);
      
      // Reset state
      setTab(mode === 'recipe_only' ? 'custom' : 'select');
      setSelectedRecipeId(null);
      setImagesPreview([]);
      setCustomName('');
      setCustomCategory('other');
      setShowDetails(false);
      setCustomDesc('');
      setCustomMethod('');
      setCustomDifficulty(1);
      setCustomGlass('');
      setCustomSweet(0);
      setCustomSour(0);
      setCustomBitter(0);
      setCustomStrong(0);
      setCustomIngredients([]);
      setCustomSteps([]);
      setRating(0);
      setNotes('');
    }
  }, [isOpen, fetchTodos, fetchLogs]);

  const existingRecipes = useMemo(() => {
    const map = new Map();
    todos.forEach(t => map.set(t.recipe_id, t.recipe));
    logs.forEach(l => {
      if (l.recipe) map.set(l.recipe_id, l.recipe);
    });
    return Array.from(map.values());
  }, [todos, logs]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const remainingSlots = 9 - imagesPreview.length;
    const filesToProcess = files.slice(0, remainingSlots);

    filesToProcess.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagesPreview(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
    
    // Reset input
    if (e.target) {
      e.target.value = '';
    }
  };

  const removeImage = (indexToRemove: number) => {
    setImagesPreview(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      let finalRecipeId = selectedRecipeId;

      if (tab === 'custom') {
        if (!customName.trim()) {
          alert('请输入酒款名称');
          setLoading(false);
          return;
        }

        // Custom recipe doesn't necessarily have a cover image now unless we pick the first one
        let coverImage = null;
        if (imagesPreview.length > 0) {
          coverImage = await imageApi.upload(imagesPreview[0]);
        }

        // Create custom recipe
        const details = showDetails ? {
          description: customDesc.trim() || undefined,
          method: customMethod.trim() || undefined,
          glassType: customGlass.trim() || undefined,
          difficulty: customDifficulty,
          flavorProfile: {
            sweet: customSweet,
            sour: customSour,
            bitter: customBitter,
            strong: customStrong,
          },
          ingredients: undefined as Array<{ ingredientId: string; amount: number; unit: string; note?: string }> | undefined, // Will be populated below
          steps: customSteps.length > 0 ? customSteps.map(s => s.text).filter(t => t.trim()) : undefined
        } : undefined;

        // Handle custom ingredients creation
        if (details && customIngredients.length > 0) {
          const finalIngredients = [];
          for (const ing of customIngredients) {
            if (!ing.rawName.trim()) continue;
            
            let ingredientId = ing.ingredientId;
            if (!ingredientId) {
              const match = allIngredients.find(i => i.name_zh === ing.rawName.trim());
              if (match) {
                ingredientId = match.id;
              } else {
                ingredientId = await inventoryApi.addCustomIngredient(ing.rawName.trim());
              }
            }
            
            finalIngredients.push({
              ingredientId: ingredientId,
              amount: ing.amount,
              unit: ing.unit,
              note: ing.note.trim() || undefined
            });
          }
          if (finalIngredients.length > 0) {
            details.ingredients = finalIngredients;
          }
        }

        finalRecipeId = await recipeApi.createCustom(customName, customCategory, coverImage, details);
      }

      if (!finalRecipeId) {
        alert('请选择要打卡的酒款');
        setLoading(false);
        return;
      }

      if (mode === 'log') {
        // Upload all images for the log
        const uploadedImageNames = [];
        for (const base64 of imagesPreview) {
          const name = await imageApi.upload(base64);
          uploadedImageNames.push(name);
        }

        // Add to drink logs
        await logApi.add(
          finalRecipeId, 
          selectedDateStr, 
          rating > 0 ? rating : null, 
          notes.trim() || null,
          uploadedImageNames.length > 0 ? uploadedImageNames : null
        );
      }
      
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Failed to submit record:', error);
      alert('打卡失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <button className={styles.headerBtn} onClick={onClose}>取消</button>
          <h3 className={styles.title}>{mode === 'recipe_only' ? '新建配方' : `打卡记录 (${selectedDateStr})`}</h3>
          <button 
            className={styles.postBtn} 
            onClick={handleSubmit} 
            disabled={loading}
          >
            {mode === 'recipe_only' ? '保存' : '发表'}
          </button>
        </div>

        {mode === 'log' && (
          <div className={styles.tabs}>
            <button className={`${styles.tab} ${tab === 'select' ? styles.activeTab : ''}`} onClick={() => setTab('select')}>
              从库中选择
            </button>
            <button className={`${styles.tab} ${tab === 'custom' ? styles.activeTab : ''}`} onClick={() => setTab('custom')}>
              自定义新建
            </button>
          </div>
        )}

        <div className={styles.body}>
          {tab === 'select' ? (
            <div className={styles.section}>
              <label className={styles.label}>选择已有酒款 (待做或已制作)</label>
              <div className={styles.recipeGrid}>
                {existingRecipes.map(recipe => (
                  <div 
                    key={recipe.id} 
                    className={`${styles.recipeCard} ${selectedRecipeId === recipe.id ? styles.selectedCard : ''}`}
                    onClick={() => setSelectedRecipeId(recipe.id)}
                  >
                    {recipe.image_url ? (
                      <img src={recipe.image_url} alt={recipe.name_zh} className={styles.recipeImg} />
                    ) : (
                      <div className={styles.recipePlaceholder}>🍸</div>
                    )}
                    <span className={styles.recipeName}>{recipe.name_zh}</span>
                  </div>
                ))}
                {existingRecipes.length === 0 && (
                  <div className={styles.emptyText}>您的清单和记录中暂无酒款，请先去添加或使用自定义。</div>
                )}
              </div>
            </div>
          ) : (
            <div className={styles.section}>
              <label className={styles.label}>酒名 *</label>
              <input 
                className={styles.input} 
                value={customName}
                onChange={e => setCustomName(e.target.value)}
                placeholder="例如: 桂花乌龙特调"
              />

              <label className={styles.label}>
                分类 <span className={styles.labelHint}>(为您的特调定个性)</span>
              </label>
              <select 
                className={styles.select} 
                value={customCategory} 
                onChange={e => setCustomCategory(e.target.value)}
              >
                <option value="spirit">烈酒基底</option>
                <option value="liqueur">利口风味</option>
                <option value="mixer">无醇软饮</option>
                <option value="other">创意特调</option>
              </select>

              {/* 折叠面板：详细配方（可选） */}
              <div className={styles.accordionContainer}>
                <button 
                  className={styles.accordionToggle} 
                  onClick={() => setShowDetails(!showDetails)}
                >
                  <span>{showDetails ? '收起详细配方' : '填写详细配方 (可选)'}</span>
                  <span className={styles.accordionArrow}>{showDetails ? '▲' : '▼'}</span>
                </button>
                
                {showDetails && (
                  <div className={styles.accordionContent}>
                    <div className={styles.inputGroup}>
                      <label className={styles.label}>描述 / 灵感</label>
                      <textarea 
                        className={styles.textareaSmall} 
                        value={customDesc}
                        onChange={e => setCustomDesc(e.target.value)}
                        placeholder="记录这杯酒的灵感来源或口感特色..."
                      />
                    </div>
                    
                    <div className={styles.inputRow}>
                      <div className={styles.inputGroup}>
                        <label className={styles.label}>制作方法</label>
                        <select className={styles.select} value={customMethod} onChange={e => setCustomMethod(e.target.value)}>
                          <option value="">(可选)</option>
                          <option value="摇和法 (Shake)">摇和 (Shake)</option>
                          <option value="调和法 (Stir)">调和 (Stir)</option>
                          <option value="直调法 (Build)">直调 (Build)</option>
                          <option value="搅打法 (Blend)">搅打 (Blend)</option>
                          <option value="捣和法 (Muddle)">捣和 (Muddle)</option>
                        </select>
                      </div>
                      <div className={styles.inputGroup}>
                        <label className={styles.label}>杯型</label>
                        <select className={styles.select} value={customGlass} onChange={e => setCustomGlass(e.target.value)}>
                          <option value="">(可选)</option>
                          <option value="martini">马天尼杯</option>
                          <option value="highball">高球杯</option>
                          <option value="old-fashioned">古典杯</option>
                          <option value="coupe">碟形杯</option>
                          <option value="flute">香槟杯</option>
                        </select>
                      </div>
                    </div>

                    <div className={styles.inputGroup}>
                      <label className={styles.label}>难度 (1-5)</label>
                      <input 
                        type="range" min="1" max="5" 
                        value={customDifficulty} 
                        onChange={e => setCustomDifficulty(parseInt(e.target.value))}
                        className={styles.rangeInput}
                      />
                      <div className={styles.rangeValue}>{customDifficulty}星</div>
                    </div>

                    {/* Flavor Profile */}
                    <div className={styles.flavorSection}>
                      <label className={styles.label}>风味雷达</label>
                      <div className={styles.flavorGrid}>
                        <div className={styles.flavorItem}>
                          <span>甜度 ({customSweet})</span>
                          <input type="range" min="0" max="5" value={customSweet} onChange={e => setCustomSweet(Number(e.target.value))} />
                        </div>
                        <div className={styles.flavorItem}>
                          <span>酸度 ({customSour})</span>
                          <input type="range" min="0" max="5" value={customSour} onChange={e => setCustomSour(Number(e.target.value))} />
                        </div>
                        <div className={styles.flavorItem}>
                          <span>苦度 ({customBitter})</span>
                          <input type="range" min="0" max="5" value={customBitter} onChange={e => setCustomBitter(Number(e.target.value))} />
                        </div>
                        <div className={styles.flavorItem}>
                          <span>烈度 ({customStrong})</span>
                          <input type="range" min="0" max="5" value={customStrong} onChange={e => setCustomStrong(Number(e.target.value))} />
                        </div>
                      </div>
                    </div>

                    {/* Ingredients List */}
                    <div className={styles.dynamicListSection}>
                      <div className={styles.dynamicListHeader}>
                        <label className={styles.label}>配料表</label>
                        <button className={styles.addListBtn} onClick={() => {
                          setCustomIngredients([...customIngredients, { id: Math.random().toString(), ingredientId: '', rawName: '', amount: 0, unit: 'ml', note: '' }]);
                        }}>
                          <Plus size={14} /> 添加配料
                        </button>
                      </div>
                      <datalist id="ingredient-list">
                        {allIngredients.map(ing => (
                          <option key={ing.id} value={ing.name_zh} />
                        ))}
                      </datalist>
                      {customIngredients.map((item, index) => (
                        <div key={item.id} className={styles.dynamicListItemRow}>
                          <input 
                            type="text" 
                            list="ingredient-list"
                            className={`${styles.inputSmall} ${styles.inputName}`} 
                            placeholder="输入配料名称"
                            value={item.rawName}
                            onChange={e => {
                              const newIngs = [...customIngredients];
                              newIngs[index].rawName = e.target.value;
                              
                              // Check if matches existing
                              const match = allIngredients.find(i => i.name_zh === e.target.value);
                              if (match) {
                                newIngs[index].ingredientId = match.id;
                              } else {
                                newIngs[index].ingredientId = '';
                              }
                              
                              setCustomIngredients(newIngs);
                            }}
                          />
                          <input 
                            type="number" 
                            className={`${styles.inputSmall} ${styles.inputAmount}`} 
                            placeholder="数量"  
                            value={item.amount || ''}
                            onChange={e => {
                              const newIngs = [...customIngredients];
                              newIngs[index].amount = Number(e.target.value);
                              setCustomIngredients(newIngs);
                            }}
                          />
                          <input 
                            type="text" 
                            className={`${styles.inputSmall} ${styles.inputUnit}`} 
                            placeholder="单位 (如: ml)" 
                            value={item.unit}
                            onChange={e => {
                              const newIngs = [...customIngredients];
                              newIngs[index].unit = e.target.value;
                              setCustomIngredients(newIngs);
                            }}
                          />
                          <button className={styles.deleteListBtn} onClick={() => {
                            setCustomIngredients(customIngredients.filter(i => i.id !== item.id));
                          }}>
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Steps List */}
                    <div className={styles.dynamicListSection}>
                      <div className={styles.dynamicListHeader}>
                        <label className={styles.label}>制作步骤</label>
                        <button className={styles.addListBtn} onClick={() => {
                          setCustomSteps([...customSteps, { id: Math.random().toString(), text: '' }]);
                        }}>
                          <Plus size={14} /> 添加步骤
                        </button>
                      </div>
                      {customSteps.map((step, index) => (
                        <div key={step.id} className={styles.dynamicListItemRow}>
                          <span className={styles.stepNum}>{index + 1}.</span>
                          <input 
                            type="text" 
                            className={styles.inputSmall} 
                            placeholder="描述步骤..." 
                            value={step.text}
                            onChange={e => {
                              const newSteps = [...customSteps];
                              newSteps[index].text = e.target.value;
                              setCustomSteps(newSteps);
                            }}
                            style={{ flex: 1 }}
                          />
                          <button className={styles.deleteListBtn} onClick={() => {
                            setCustomSteps(customSteps.filter(s => s.id !== step.id));
                          }}>
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className={styles.divider} />

          <div className={styles.section}>
            {mode === 'log' && (
              <textarea 
                className={styles.textarea} 
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="这杯酒的味道如何？"
              />
            )}
            
            <div className={styles.multiImageGrid}>
              {imagesPreview.map((src, idx) => (
                <div key={idx} className={styles.imageBox}>
                  <img src={src} alt="preview" className={styles.previewBoxImg} />
                  <button className={styles.removeImageBtn} onClick={() => removeImage(idx)}>
                    <X size={12} color="white" />
                  </button>
                </div>
              ))}
              
              {imagesPreview.length < 9 && (
                <div className={styles.addBox} onClick={() => fileInputRef.current?.click()}>
                  <Camera size={28} color="#ccc" />
                </div>
              )}
            </div>
            <input 
              type="file" 
              accept="image/*" 
              multiple 
              ref={fileInputRef} 
              onChange={handleImageSelect} 
              style={{ display: 'none' }} 
            />
          </div>

          {mode === 'log' && (
            <div className={styles.section}>
              <label className={styles.label}>评分</label>
              <div className={styles.rating}>
                {[1, 2, 3, 4, 5].map(star => (
                  <button 
                    key={star} 
                    className={styles.starBtn}
                    onClick={() => setRating(star)}
                  >
                    <Star 
                      size={28} 
                      fill={star <= rating ? '#F5A623' : 'transparent'} 
                      color={star <= rating ? '#F5A623' : 'rgba(0,0,0,0.15)'} 
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
