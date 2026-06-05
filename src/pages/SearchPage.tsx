import { useState } from 'react';
import { Clock, TrendingUp, Flame } from 'lucide-react';
import { Navbar, SearchBar, Tag } from '@/components';

const hotSearches = ['莫吉托', '马天尼', '金汤力', '龙舌兰日出', '长岛冰茶', '尼格罗尼'];
const searchCategories = ['基酒类', '果味', '奶香', '气泡', '草本', '烟熏'];

export function SearchPage() {
  const [query, setQuery] = useState('');

  return (
    <div style={pageStyle}>
      <Navbar title="搜索" size="compact" />
      <div style={contentStyle}>
        <SearchBar
          placeholder="搜索鸡尾酒、原料、基酒..."
          value={query}
          onChange={setQuery}
        />

        {!query && (
          <>
            <SectionStyle title="🔥 热门搜索" />
            <div style={tagRowStyle}>
              {hotSearches.map((t) => (
                <Tag key={t} variant="default" onClick={() => setQuery(t)}>
                  {t}
                </Tag>
              ))}
            </div>

            <SectionStyle title="按分类查找" />
            <div style={tagRowStyle}>
              {searchCategories.map((c) => (
                <Tag key={c} variant="default">{c}</Tag>
              ))}
            </div>

            <SectionStyle title="最近浏览" />
            <div style={emptyRowStyle}>
              <Clock size={16} strokeWidth={1.5} style={{ color: 'var(--text-quaternary)' }} />
              <span style={emptyTextStyle}>暂无浏览记录</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SectionStyle({ title }: { title: string }) {
  return (
    <h3 style={{
      fontSize: 'var(--font-size-headline)',
      fontWeight: 600,
      color: 'var(--text-primary)',
      marginBottom: 12,
      marginTop: 22,
      letterSpacing: '-0.022em',
    }}>
      {title}
    </h3>
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

const tagRowStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
};

const emptyRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '20px 0',
};

const emptyTextStyle: React.CSSProperties = {
  fontSize: 'var(--font-size-subhead)',
  color: 'var(--text-tertiary)',
};
