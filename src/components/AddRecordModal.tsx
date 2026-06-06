import { useState, useRef, useMemo, useEffect } from 'react';
import { X, Camera, Star } from 'lucide-react';
import { useTodoStore } from '@/stores/todoStore';
import { useLogStore } from '@/stores/logStore';
import { recipeApi, imageApi, logApi } from '@/api/client';
import styles from './AddRecordModal.module.css';

interface AddRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  selectedDateStr: string;
}

export function AddRecordModal({ isOpen, onClose, onSuccess, selectedDateStr }: AddRecordModalProps) {
  const [tab, setTab] = useState<'select' | 'custom'>('select');
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Common State
  const [rating, setRating] = useState<number>(0);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchTodos();
      fetchLogs(); // without date to get all unique made recipes
      
      // Reset state
      setSelectedRecipeId(null);
      setImagesPreview([]);
      setCustomName('');
      setCustomCategory('other');
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
        finalRecipeId = await recipeApi.createCustom(customName, customCategory, coverImage);
      }

      if (!finalRecipeId) {
        alert('请选择要打卡的酒款');
        setLoading(false);
        return;
      }

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
          <h3 className={styles.title}>打卡记录 ({selectedDateStr})</h3>
          <button 
            className={styles.postBtn} 
            onClick={handleSubmit} 
            disabled={loading}
          >
            发表
          </button>
        </div>

        <div className={styles.tabs}>
          <button className={`${styles.tab} ${tab === 'select' ? styles.activeTab : ''}`} onClick={() => setTab('select')}>
            从库中选择
          </button>
          <button className={`${styles.tab} ${tab === 'custom' ? styles.activeTab : ''}`} onClick={() => setTab('custom')}>
            自定义新建
          </button>
        </div>

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
            </div>
          )}

          <div className={styles.divider} />

          <div className={styles.section}>
            <textarea 
              className={styles.textarea} 
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="这杯酒的味道如何？"
            />
            
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

          <div className={styles.section}>
            <label className={styles.label}>评分</label>
            <div className={styles.ratingStars}>
              {[1, 2, 3, 4, 5].map(star => (
                <Star 
                  key={star} 
                  size={24} 
                  fill={rating >= star ? '#F5A623' : 'transparent'} 
                  color={rating >= star ? '#F5A623' : '#ccc'}
                  onClick={() => setRating(star)}
                  className={styles.starIcon}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
