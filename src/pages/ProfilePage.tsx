import { User, Settings, Bookmark, Star, Share2, Info, ChevronRight } from 'lucide-react';
import { Navbar } from '@/components';

interface ProfileMenuItem {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }>;
  label: string;
  color?: string;
}

const menuItems: ProfileMenuItem[] = [
  { icon: Bookmark, label: '收藏配方' },
  { icon: Star, label: '我的评分' },
  { icon: Share2, label: '分享给朋友' },
  { icon: Settings, label: '设置' },
  { icon: Info, label: '关于' },
];

export function ProfilePage() {
  return (
    <div style={pageStyle}>
      <Navbar title="我的" size="compact" showBell />
      <div style={contentStyle}>
        {/* 用户卡片 */}
        <div style={userCard}>
          <div style={avatar}>
            <User size={28} strokeWidth={1.5} color="var(--text-quaternary)" />
          </div>
          <div style={userInfo}>
            <h3 style={userName}>调酒爱好者</h3>
            <span style={userMeta}>0 款收藏 · 0 次调制</span>
          </div>
          <ChevronRight size={18} strokeWidth={1.5} color="var(--text-quaternary)" />
        </div>

        {/* 菜单 */}
        <div style={menuCard}>
          {menuItems.map((item) => (
            <button key={item.label} style={menuRow} type="button">
              <item.icon size={20} strokeWidth={1.5} color={item.color || 'var(--text-secondary)'} />
              <span style={menuLabel}>{item.label}</span>
              <ChevronRight size={16} strokeWidth={1.5} color="var(--text-quaternary)" />
            </button>
          ))}
        </div>

        {/* 底部 */}
        <div style={footerStyle}>
          <span style={footerText}>Mixology v1.0.0</span>
        </div>
      </div>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: 'var(--bg-primary)',
  paddingBottom: 'calc(50px + var(--safe-area-bottom) + 24px)',
};

const contentStyle: React.CSSProperties = {
  padding: '0 16px',
};

const userCard: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  padding: '20px',
  background: 'var(--bg-secondary)',
  borderRadius: 'var(--radius-lg)',
  boxShadow: 'var(--shadow-xs)',
  cursor: 'pointer',
  marginBottom: 24,
};

const avatar: React.CSSProperties = {
  width: 56,
  height: 56,
  borderRadius: 'var(--radius-full)',
  background: 'var(--bg-search)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const userInfo: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
};

const userName: React.CSSProperties = {
  fontSize: 'var(--font-size-headline)',
  fontWeight: 600,
  color: 'var(--text-primary)',
};

const userMeta: React.CSSProperties = {
  fontSize: 'var(--font-size-footnote)',
  color: 'var(--text-tertiary)',
};

const menuCard: React.CSSProperties = {
  background: 'var(--bg-secondary)',
  borderRadius: 'var(--radius-lg)',
  overflow: 'hidden',
  boxShadow: 'var(--shadow-xs)',
};

const menuRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  width: '100%',
  padding: '16px 18px',
  background: 'transparent',
  border: 'none',
  borderBottom: '0.33px solid var(--divider)',
  cursor: 'pointer',
  fontFamily: 'inherit',
  textAlign: 'left',
};

const menuLabel: React.CSSProperties = {
  flex: 1,
  fontSize: 'var(--font-size-body)',
  color: 'var(--text-primary)',
};

const footerStyle: React.CSSProperties = {
  textAlign: 'center',
  padding: '40px 0',
};

const footerText: React.CSSProperties = {
  fontSize: 'var(--font-size-footnote)',
  color: 'var(--text-quaternary)',
};
