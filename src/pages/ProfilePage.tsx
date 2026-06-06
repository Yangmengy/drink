import { Settings, Bookmark, Clock, Star, Share2, HelpCircle, ChevronRight } from 'lucide-react';
import { Navbar } from '@/components';

const menuItems = [
  { icon: Bookmark, label: '我的收藏', value: '12', color: '#FF9F0A' },
  { icon: Clock, label: '浏览历史', value: '36', color: '#5AC8FA' },
  { icon: Star, label: '我的评分', value: '8', color: '#FF6B6B' },
];

const settingsItems = [
  { icon: Settings, label: '偏好设置' },
  { icon: Share2, label: '分享给朋友' },
  { icon: HelpCircle, label: '帮助与反馈' },
];

export function ProfilePage() {
  return (
    <div style={{ minHeight: '100vh', paddingBottom: 'calc(56px + env(safe-area-inset-bottom) + 24px)' }}>
      <Navbar title="我的" subtitle="PROFILE" showNotifications={false} />

      <div style={{ padding: '0 20px' }}>
        {/* 用户卡片 */}
        <div style={{
          borderRadius: 24, padding: 28, marginBottom: 28,
          background: 'rgba(255,255,255,0.72)',
          backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.3)',
          boxShadow: '0 8px 28px rgba(0,0,0,0.06)',
          display: 'flex', alignItems: 'center', gap: 18,
        }}>
          <div style={{
            width: 68, height: 68, borderRadius: '50%',
            background: 'linear-gradient(145deg, #4ECDC4, #44B5AD)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, color: '#fff', fontWeight: 700, flexShrink: 0,
          }}>
            M
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#333', marginBottom: 4 }}>
              Mixology 爱好者
            </div>
            <div style={{ fontSize: 14, color: '#999' }}>
              探索鸡尾酒的无限可能
            </div>
          </div>
          <ChevronRight size={20} strokeWidth={1.75} color="#ccc" />
        </div>

        {/* 数据面板 */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 28,
        }}>
          {menuItems.map((item) => (
            <div key={item.label} style={{
              padding: '16px 12px', borderRadius: 20, textAlign: 'center',
              background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.3)',
              boxShadow: '0 4px 14px rgba(0,0,0,0.04)', cursor: 'pointer',
            }}>
              <item.icon size={22} strokeWidth={1.75} color={item.color} style={{ marginBottom: 8 }} />
              <div style={{ fontSize: 22, fontWeight: 700, color: '#333' }}>{item.value}</div>
              <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>{item.label}</div>
            </div>
          ))}
        </div>

        {/* 设置菜单 */}
        <h3 style={{ fontSize: 16, fontWeight: 600, color: '#999', marginBottom: 12, paddingLeft: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          设置
        </h3>
        <div style={{
          borderRadius: 20, overflow: 'hidden',
          background: 'rgba(255,255,255,0.64)', backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.3)',
          boxShadow: '0 4px 14px rgba(0,0,0,0.04)',
        }}>
          {settingsItems.map((item, idx) => (
            <div key={item.label} style={{
              display: 'flex', alignItems: 'center', gap: 14, padding: 16,
              borderBottom: idx < settingsItems.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none',
              cursor: 'pointer',
            }}>
              <item.icon size={20} strokeWidth={1.75} color="#999" />
              <span style={{ flex: 1, fontSize: 16, fontWeight: 500, color: '#333' }}>{item.label}</span>
              <ChevronRight size={16} strokeWidth={1.75} color="#ccc" />
            </div>
          ))}
        </div>

        {/* 版本信息 */}
        <div style={{ textAlign: 'center', padding: '32px 0', color: '#ccc', fontSize: 13 }}>
          Mixology v1.0.0
        </div>
      </div>
    </div>
  );
}
