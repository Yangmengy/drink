import { Package, Plus, Sparkles } from 'lucide-react';
import { Navbar, Button } from '@/components';

export function MyBarPage() {
  return (
    <div style={pageStyle}>
      <Navbar title="酒柜" size="compact" />
      <div style={contentStyle}>
        {/* 状态卡片 */}
        <div style={statsCardStyle}>
          <div style={statItemStyle}>
            <span style={statValueStyle}>0</span>
            <span style={statLabelStyle}>原料</span>
          </div>
          <div style={statDividerStyle} />
          <div style={statItemStyle}>
            <span style={statValueStyle}>0</span>
            <span style={statLabelStyle}>可调</span>
          </div>
          <div style={statDividerStyle} />
          <div style={statItemStyle}>
            <span style={statValueStyle}>0</span>
            <span style={statLabelStyle}>收藏</span>
          </div>
        </div>

        {/* 空状态 */}
        <div style={emptyStyle}>
          <div style={emptyIconWrap}>
            <Package size={36} strokeWidth={1.2} color="var(--text-quaternary)" />
          </div>
          <h3 style={emptyTitle}>酒柜空空</h3>
          <p style={emptyDesc}>添加你拥有的原料，发现可以调制的鸡尾酒</p>
          <Button variant="primary" size="lg" onClick={() => {}}>
            <Plus size={18} strokeWidth={2} />
            <span style={{ marginLeft: 6 }}>添加原料</span>
          </Button>
        </div>

        {/* 灵感提示 */}
        <div style={tipCard}>
          <Sparkles size={18} strokeWidth={1.5} color="var(--color-primary)" />
          <span style={tipText}>
            只需 3 种原料就能调制经典莫吉托
          </span>
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

const statsCardStyle: React.CSSProperties = {
  display: 'flex',
  background: 'var(--bg-secondary)',
  borderRadius: 'var(--radius-lg)',
  padding: '20px 24px',
  marginBottom: 28,
  boxShadow: 'var(--shadow-xs)',
};

const statItemStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 2,
};

const statValueStyle: React.CSSProperties = {
  fontSize: 'var(--font-size-title2)',
  fontWeight: 700,
  color: 'var(--text-primary)',
  letterSpacing: '-0.024em',
};

const statLabelStyle: React.CSSProperties = {
  fontSize: 'var(--font-size-caption1)',
  color: 'var(--text-tertiary)',
};

const statDividerStyle: React.CSSProperties = {
  width: 1,
  background: 'var(--divider)',
  alignSelf: 'stretch',
};

const emptyStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '44px 20px',
  gap: 10,
};

const emptyIconWrap: React.CSSProperties = {
  width: 68,
  height: 68,
  borderRadius: 'var(--radius-full)',
  background: 'var(--bg-search)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: 4,
};

const emptyTitle: React.CSSProperties = {
  fontSize: 'var(--font-size-headline)',
  fontWeight: 600,
  color: 'var(--text-primary)',
};

const emptyDesc: React.CSSProperties = {
  fontSize: 'var(--font-size-subhead)',
  color: 'var(--text-secondary)',
  marginBottom: 8,
};

const tipCard: React.CSSProperties = {
  marginTop: 28,
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '16px 18px',
  background: 'var(--bg-elevated)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  borderRadius: 'var(--radius-md)',
};

const tipText: React.CSSProperties = {
  fontSize: 'var(--font-size-subhead)',
  color: 'var(--text-secondary)',
  flex: 1,
};
