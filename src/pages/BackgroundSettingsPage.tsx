import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, RotateCcw, Check } from 'lucide-react';
import { useBackgroundStore, PRESET_BACKGROUNDS } from '@/stores/backgroundStore';
import styles from './BackgroundSettingsPage.module.css';

export function BackgroundSettingsPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { type, preset, customImage, setPresetBackground, setCustomBackground, resetBackground } = useBackgroundStore();

  const handlePresetClick = (presetId: string) => {
    setPresetBackground(presetId);
  };

  const handleCustomUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 检查文件类型
    if (!file.type.startsWith('image/')) {
      alert('请选择图片文件');
      return;
    }

    // 检查文件大小 (最大5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('图片文件不能超过5MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Data = reader.result as string;
      setCustomBackground(base64Data);
    };
    reader.readAsDataURL(file);
  };

  const handleReset = () => {
    if (confirm('确定要恢复默认背景吗？')) {
      resetBackground();
    }
  };

  return (
    <div className={styles.page}>
      {/* 顶部导航 */}
      <div className={styles.header}>
        <button className={styles.backButton} onClick={() => navigate(-1)}>
          <ArrowLeft size={22} strokeWidth={1.75} />
        </button>
        <div className={styles.headerContent}>
          <h1 className={styles.title}>背景设置</h1>
          <p className={styles.subtitle}>BACKGROUND</p>
        </div>
        <button className={styles.resetButton} onClick={handleReset}>
          <RotateCcw size={18} strokeWidth={1.75} />
        </button>
      </div>

      <div className={styles.content}>
        {/* 预设背景 */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>纯色预设</h2>
          <div className={styles.presetsGrid}>
            {PRESET_BACKGROUNDS.map((bg) => (
              <button
                key={bg.id}
                className={`${styles.presetItem} ${type === 'preset' && preset === bg.id ? styles.active : ''}`}
                onClick={() => handlePresetClick(bg.id)}
              >
                <div 
                  className={styles.presetPreview}
                  style={{ 
                    background: bg.value === 'default' 
                      ? 'linear-gradient(165deg, #F5F2EF 0%, #F0EEEB 30%, #F3F0ED 60%, #F6F3F0 100%)'
                      : bg.value 
                  }}
                >
                  {type === 'preset' && preset === bg.id && (
                    <div className={styles.checkmark}>
                      <Check size={16} strokeWidth={2.5} />
                    </div>
                  )}
                </div>
                <span className={styles.presetName}>{bg.name}</span>
              </button>
            ))}
          </div>
        </section>

        {/* 自定义背景 */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>自定义图片</h2>
          <div className={styles.customSection}>
            {type === 'custom' && customImage ? (
              <div className={styles.customPreview}>
                <img src={customImage} alt="自定义背景" className={styles.customImage} />
                <div className={styles.customOverlay}>
                  <button className={styles.reuploadButton} onClick={handleCustomUpload}>
                    <Upload size={18} />
                    <span>重新上传</span>
                  </button>
                </div>
              </div>
            ) : (
              <button className={styles.uploadButton} onClick={handleCustomUpload}>
                <Upload size={24} className={styles.uploadIcon} />
                <span className={styles.uploadText}>上传图片</span>
                <span className={styles.uploadHint}>支持 JPG, PNG，最大5MB</span>
              </button>
            )}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/jpeg,image/png,image/jpg"
              style={{ display: 'none' }}
            />
          </div>
        </section>

        {/* 提示信息 */}
        <div className={styles.hint}>
          <p>💡 背景将应用到整个应用界面</p>
          <p>建议选择浅色或低饱和度背景以保证内容清晰可读</p>
        </div>
      </div>
    </div>
  );
}
