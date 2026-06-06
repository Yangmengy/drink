import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { convertFileSrc } from '@tauri-apps/api/core';
import { Settings, Clock, Star, Share2, HelpCircle, ChevronRight, Camera, Palette, Heart } from 'lucide-react';
import { Navbar } from '@/components';
import { userApi, imageApi } from '@/api/client';
import { useUserStore } from '@/stores/userStore';
import type { UserProfile, UserStats } from '@/types';
import styles from './ProfilePage.module.css';

export function ProfilePage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { loadFromProfile } = useUserStore();
  
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [profileData, statsData] = await Promise.all([
        userApi.getProfile(),
        userApi.getStats(),
      ]);
      setProfile(profileData);
      setStats(statsData);

      // 将头像文件名转换为可访问的 URL，同时同步到 userStore
      if (profileData.avatar) {
        try {
          const absolutePath = await invoke<string>('get_image_url', { imageName: profileData.avatar });
          setAvatarUrl(convertFileSrc(absolutePath));
        } catch {
          setAvatarUrl(null);
        }
      } else {
        setAvatarUrl(null);
      }

      // 同步用户名和头像到 store（供 RecordPage 等使用）
      await loadFromProfile(profileData.username, profileData.avatar ?? null);
    } catch (error) {
      console.error('Failed to load profile data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Data = (reader.result as string).split(',')[1];
        try {
          const filename = await imageApi.upload(base64Data);
          await userApi.updateProfile({ avatar: filename });
          await loadData(); // 重新加载数据
        } catch (error) {
          console.error('Failed to upload avatar:', error);
          alert('头像上传失败，请重试');
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Failed to read file:', error);
    }
  };

  const handleNameClick = () => {
    setEditName(profile?.username || '喵星人');
    setIsEditingName(true);
  };

  const handleBioClick = () => {
    setEditBio(profile?.bio || '');
    setIsEditingBio(true);
  };

  const handleNameSave = async () => {
    if (editName && editName.trim() && editName !== profile?.username) {
      try {
        await userApi.updateProfile({ username: editName.trim() });
        await loadData();
        setIsEditingName(false);
      } catch (error) {
        console.error('Failed to update username:', error);
        alert('昵称修改失败，请重试');
      }
    } else {
      setIsEditingName(false);
    }
  };

  const handleBioSave = async () => {
    if (editBio.trim() !== (profile?.bio || '')) {
      try {
        await userApi.updateProfile({ bio: editBio.trim() });
        await loadData();
        setIsEditingBio(false);
      } catch (error) {
        console.error('Failed to update bio:', error);
        alert('签名修改失败，请重试');
      }
    } else {
      setIsEditingBio(false);
    }
  };

  const handleShare = () => {
    alert('分享功能开发中...');
  };

  if (loading) {
    return (
      <div className={styles.page}>
        <Navbar title="我的" subtitle="PROFILE" showNotifications={false} />
        <div className={styles.loading}>加载中...</div>
      </div>
    );
  }

  const username = profile?.username || '喵星人';

  return (
    <div className={styles.page}>
      <Navbar title="我的" subtitle="PROFILE" showNotifications={false} />
      
      <div className={styles.content}>
        {/* 用户信息卡片 */}
        <div className={styles.userCard}>
          <div className={styles.avatarContainer}>
            <div className={styles.avatar} onClick={handleAvatarClick}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
              ) : (
                username.charAt(0).toUpperCase()
              )}
              <div className={styles.avatarOverlay}>
                <Camera size={12} color="white" />
              </div>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleAvatarChange}
              accept="image/*"
              style={{ display: 'none' }}
            />
          </div>
          <div className={styles.userInfo}>
            <h2 className={styles.username} onClick={handleNameClick}>
              {username}
            </h2>
            <p className={styles.userBio} onClick={handleBioClick}>
              {profile?.bio || '点击添加个性签名'}
            </p>
          </div>
          <ChevronRight size={16} className={styles.userArrow} />
        </div>

        {/* 数据统计卡片 */}
        <div className={styles.statsGrid}>
          <button className={styles.statCard} onClick={() => navigate('/favorites')}>
            <Heart className={styles.statIcon} size={22} color="#FFA726" strokeWidth={1.75} />
            <div className={styles.statNumber}>{stats?.favoriteCount ?? stats?.favorite_count ?? 0}</div>
            <div className={styles.statLabel}>我的喜欢</div>
          </button>

          <button className={styles.statCard} onClick={() => navigate('/history')}>
            <Clock className={styles.statIcon} size={22} color="#5FC3E4" strokeWidth={1.75} />
            <div className={styles.statNumber}>{stats?.historyCount ?? stats?.history_count ?? 0}</div>
            <div className={styles.statLabel}>浏览历史</div>
          </button>

          <button className={styles.statCard} onClick={() => navigate('/ratings')}>
            <Star className={styles.statIcon} size={22} color="#F57F7E" strokeWidth={1.75} />
            <div className={styles.statNumber}>{stats?.ratingCount ?? stats?.rating_count ?? 0}</div>
            <div className={styles.statLabel}>我的评分</div>
          </button>
        </div>

        {/* 设置列表 */}
        <div className={styles.settingsSection}>
          <h3 className={styles.sectionTitle}>设置</h3>
          <div className={styles.settingsList}>
            <button className={styles.settingsItem} onClick={() => navigate('/background-settings')}>
              <Palette className={styles.settingsIcon} size={20} strokeWidth={1.75} />
              <span className={styles.settingsLabel}>背景设置</span>
              <ChevronRight className={styles.settingsArrow} size={16} strokeWidth={1.75} />
            </button>

            <button className={styles.settingsItem} onClick={() => navigate('/settings')}>
              <Settings className={styles.settingsIcon} size={20} strokeWidth={1.75} />
              <span className={styles.settingsLabel}>偏好设置</span>
              <ChevronRight className={styles.settingsArrow} size={16} strokeWidth={1.75} />
            </button>

            <button className={styles.settingsItem} onClick={handleShare}>
              <Share2 className={styles.settingsIcon} size={20} strokeWidth={1.75} />
              <span className={styles.settingsLabel}>分享给朋友</span>
              <ChevronRight className={styles.settingsArrow} size={16} strokeWidth={1.75} />
            </button>

            <button className={styles.settingsItem} onClick={() => navigate('/help')}>
              <HelpCircle className={styles.settingsIcon} size={20} strokeWidth={1.75} />
              <span className={styles.settingsLabel}>帮助与反馈</span>
              <ChevronRight className={styles.settingsArrow} size={16} strokeWidth={1.75} />
            </button>
          </div>
        </div>

        {/* 版本号 */}
        <div className={styles.versionText}>
          Mixology v1.0.0
        </div>
      </div>

      {/* 编辑昵称模态框 */}
      {isEditingName && (
        <div className={styles.modalOverlay} onClick={() => setIsEditingName(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>修改昵称</h3>
            <input
              type="text"
              className={styles.modalInput}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="输入新昵称"
              autoFocus
              maxLength={20}
            />
            <div className={styles.modalActions}>
              <button 
                className={styles.modalButton} 
                onClick={() => setIsEditingName(false)}
              >
                取消
              </button>
              <button 
                className={`${styles.modalButton} ${styles.modalButtonPrimary}`}
                onClick={handleNameSave}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 编辑个性签名模态框 */}
      {isEditingBio && (
        <div className={styles.modalOverlay} onClick={() => setIsEditingBio(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>个性签名</h3>
            <textarea
              className={styles.modalTextarea}
              value={editBio}
              onChange={(e) => setEditBio(e.target.value)}
              placeholder="分享你的想法..."
              autoFocus
              maxLength={50}
              rows={3}
            />
            <div className={styles.modalActions}>
              <button 
                className={styles.modalButton} 
                onClick={() => setIsEditingBio(false)}
              >
                取消
              </button>
              <button 
                className={`${styles.modalButton} ${styles.modalButtonPrimary}`}
                onClick={handleBioSave}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
