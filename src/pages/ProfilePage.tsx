import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, Bookmark, Clock, Star, Share2, HelpCircle, ChevronRight, Camera } from 'lucide-react';
import { Navbar } from '@/components';
import { userApi, imageApi } from '@/api/client';
import type { UserProfile, UserStats } from '@/types';
import styles from './ProfilePage.module.css';

export function ProfilePage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);

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

  const handleNameClick = async () => {
    const newName = window.prompt('修改昵称', profile?.username || '喵星人');
    if (newName && newName.trim() && newName !== profile?.username) {
      try {
        await userApi.updateProfile({ username: newName.trim() });
        await loadData(); // 重新加载数据
      } catch (error) {
        console.error('Failed to update username:', error);
        alert('昵称修改失败，请重试');
      }
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
  const avatar = profile?.avatar;

  return (
    <div className={styles.page}>
      <Navbar title="我的" subtitle="PROFILE" showNotifications={false} />
      
      <div className={styles.content}>
        {/* 用户信息卡片 */}
        <button className={styles.userCard} onClick={handleNameClick}>
          <div className={styles.avatarContainer}>
            <div className={styles.avatar} onClick={(e) => {
              e.stopPropagation();
              handleAvatarClick();
            }}>
              {avatar ? (
                <img src={avatar} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
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
            <h2 className={styles.username}>
              {username}
            </h2>
            <p className={styles.userHint}>点击可修改昵称与头像</p>
          </div>
          <ChevronRight size={16} className={styles.userArrow} />
        </button>

        {/* 数据统计卡片 */}
        <div className={styles.statsGrid}>
          <button className={styles.statCard} onClick={() => navigate('/favorites')}>
            <Bookmark className={styles.statIcon} size={22} color="#FFA726" strokeWidth={1.75} />
            <div className={styles.statNumber}>{stats?.favoriteCount || 0}</div>
            <div className={styles.statLabel}>我的收藏</div>
          </button>

          <button className={styles.statCard} onClick={() => navigate('/history')}>
            <Clock className={styles.statIcon} size={22} color="#5FC3E4" strokeWidth={1.75} />
            <div className={styles.statNumber}>{stats?.historyCount || 0}</div>
            <div className={styles.statLabel}>浏览历史</div>
          </button>

          <button className={styles.statCard} onClick={() => navigate('/ratings')}>
            <Star className={styles.statIcon} size={22} color="#F57F7E" strokeWidth={1.75} />
            <div className={styles.statNumber}>{stats?.ratingCount || 0}</div>
            <div className={styles.statLabel}>我的评分</div>
          </button>
        </div>

        {/* 设置列表 */}
        <div className={styles.settingsSection}>
          <h3 className={styles.sectionTitle}>设置</h3>
          <div className={styles.settingsList}>
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
    </div>
  );
}
