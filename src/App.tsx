import { useLayoutEffect, useRef, useState } from 'react';
import { BrowserRouter, NavLink, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import { MessageCircle, Wine, NotebookPen, Brain, Settings } from 'lucide-react';
import { ChatPage } from './pages/ChatPage';
import { BarPage } from './pages/BarPage';
import { CustomPage } from './pages/CustomPage';
import { SettingsPage } from './pages/SettingsPage';
import { ProfilePage } from './pages/ProfilePage';
import { ChatProvider } from './components/ChatContext';
import { BarProvider } from './components/BarContext';
import { AuthProvider, useAuth } from './components/AuthContext';
import { AccountCard } from './components/AccountCard';
import { ConversationDirectory } from './components/ConversationDirectory';
import { ThemeProvider, useTheme } from './components/ThemeContext';
import { LoginPage } from './pages/LoginPage';
import { ObservabilityPage } from './pages/ObservabilityPage';
import { isNative } from './api/client';
import { themes } from './theme';

const tabs = [
  { path: '/', label: '聊天', icon: MessageCircle },
  { path: '/bar', label: '酒柜', icon: Wine },
  { path: '/custom', label: '自定义', icon: NotebookPen },
  { path: '/profile', label: '画像', icon: Brain },
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

function ThemeBackdrop() {
  return (
    <div className="theme-backdrops" aria-hidden="true">
      <div className="theme-backdrop rain" />
      <div className="theme-backdrop snow" />
      <div className="theme-backdrop cottage" />
    </div>
  );
}

function AppNav() {
  const { pathname } = useLocation();
  const nav = useRef<HTMLElement>(null);
  const [indicator, setIndicator] = useState({ x: 0, width: 0, ready: false });

  useLayoutEffect(() => {
    const element = nav.current;
    const activeItem = element?.querySelector<HTMLAnchorElement>('.nav-item.active');
    if (!element || !activeItem) return;

    const measure = () => {
      const navRect = element.getBoundingClientRect();
      const itemRect = activeItem.getBoundingClientRect();
      setIndicator({
        x: itemRect.left - navRect.left,
        width: itemRect.width,
        ready: itemRect.width > 0,
      });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    observer.observe(activeItem);
    document.fonts?.ready.then(measure).catch(() => {});
    return () => observer.disconnect();
  }, [pathname]);

  return (
    <header className="sidebar app-nav">
      <NavLink className="wordmark" to="/">bartender<span>一起，慢一点。</span></NavLink>
      <nav aria-label="主导航" ref={nav}>
        <span
          className="nav-indicator"
          aria-hidden="true"
          style={{
            opacity: indicator.ready ? 1 : 0,
            transform: `translate3d(${indicator.x}px, 0, 0)`,
            width: `${indicator.width}px`,
          }}
        />
        {tabs.map(({ path, label, icon: Icon }) => (
          <NavLink end={path === '/'} key={path} to={path} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Icon size={16} strokeWidth={1.8} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </header>
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
  const { pathname } = useLocation();
  if (pathname === '/ops') {
    return <ThemeProvider><ThemeBackdrop /><ObservabilityPage /></ThemeProvider>;
  }
  if (!isNative() && !ready) {
    return <ThemeProvider><ThemeBackdrop /><div className="auth-loading" aria-live="polite">正在确认登录状态…</div></ThemeProvider>;
  }
  if (!isNative() && !loggedIn) {
    return (
      <ThemeProvider>
        <>
          <ThemeBackdrop />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </>
      </ThemeProvider>
    );
  }
  return (
    <ThemeProvider>
      <BarProvider>
      <ChatProvider>
        <ThemeBackdrop />
        <div className="app-shell">
          <AppNav />
          <ConversationDirectory>
            <AccountCard />
            <ThemeCycle />
          </ConversationDirectory>
          <main>
            <Routes>
              <Route path="/" element={<ChatPage />} />
              <Route path="/bar" element={<BarPage />} />
              <Route path="/custom" element={<CustomPage />} />
              <Route path="/profile" element={<ProfilePage />} />
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
