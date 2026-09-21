import { BrowserRouter, NavLink, Route, Routes, Navigate } from 'react-router-dom';
import { MessageCircle, Wine, NotebookPen, Settings } from 'lucide-react';
import { ChatPage } from './pages/ChatPage';
import { BarPage } from './pages/BarPage';
import { CustomPage } from './pages/CustomPage';
import { SettingsPage } from './pages/SettingsPage';
import { ChatProvider } from './components/ChatContext';
import { BarProvider } from './components/BarContext';
import { AuthProvider, useAuth } from './components/AuthContext';
import { AccountCard } from './components/AccountCard';
import { ThemeProvider, useTheme } from './components/ThemeContext';
import { LoginPage } from './pages/LoginPage';
import { isNative } from './api/client';
import { themes } from './theme';

const tabs = [
  { path: '/', label: '聊天', icon: MessageCircle },
  { path: '/bar', label: '酒柜', icon: Wine },
  { path: '/custom', label: '自定义', icon: NotebookPen },
  { path: '/settings', label: '设置', icon: Settings },
];

function ThemeCycle() {
  const { theme, setTheme } = useTheme();
  const index = Math.max(0, themes.findIndex(t => t.id === theme));
  const current = themes[index];
  const next = themes[(index + 1) % themes.length];
  const Icon = current.icon;
  return (
    <button type="button" className="theme-cycle" onClick={() => setTheme(next.id)} aria-label={`切换主题，当前为${current.name}`} title={`换个心情：${next.name}`}>
      <Icon size={17} strokeWidth={1.6} />
      <span>{current.name}</span>
    </button>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AuthGate />
      </AuthProvider>
    </BrowserRouter>
  );
}

function AuthGate() {
  const { ready, loggedIn } = useAuth();
  if (!isNative() && !ready) {
    return <ThemeProvider><div className="auth-loading" aria-live="polite">正在确认登录状态…</div></ThemeProvider>;
  }
  if (!isNative() && !loggedIn) {
    return (
      <ThemeProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </ThemeProvider>
    );
  }
  return (
    <ThemeProvider>
      <BarProvider>
      <ChatProvider>
        <div className="app-shell">
          <aside className="sidebar">
            <NavLink className="wordmark" to="/">bartender<span>一起，慢一点。</span></NavLink>
            <nav aria-label="主导航">
              {tabs.map(({ path, label, icon: Icon }) => (
                <NavLink end={path === '/'} key={path} to={path} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                  <Icon size={21} strokeWidth={1.6} />
                  <span>{label}</span>
                </NavLink>
              ))}
            </nav>
            <div className="sidebar-foot">
              <AccountCard />
              <ThemeCycle />
              <p className="sidebar-note">一点陪伴<br />一杯刚刚好</p>
            </div>
          </aside>
          <main>
            <Routes>
              <Route path="/" element={<ChatPage />} />
              <Route path="/bar" element={<BarPage />} />
              <Route path="/custom" element={<CustomPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </ChatProvider>
      </BarProvider>
    </ThemeProvider>
  );
}
