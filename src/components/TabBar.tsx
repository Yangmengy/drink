import { Home, Package, User, Calendar, Bookmark, LucideProps } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import styles from './TabBar.module.css';

interface Tab {
  id: string;
  label: string;
  icon: React.ComponentType<LucideProps>;
  path: string;
}

const tabs: Tab[] = [
  { id: 'discover', label: '发现', icon: Home, path: '/' },
  { id: 'bar', label: '酒柜', icon: Package, path: '/bar' },
  { id: 'list', label: '清单', icon: Bookmark, path: '/list' },
  { id: 'record', label: '记录', icon: Calendar, path: '/record' },
  { id: 'profile', label: '我的', icon: User, path: '/profile' },
];

export function TabBar() {
  const location = useLocation();
  const navigate = useNavigate();

  const handleTabClick = (path: string) => {
    if (location.pathname === path) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      navigate(path);
    }
  };

  return (
    <nav className={styles.tabBar}>
      {tabs.map((tab) => {
        const isActive = location.pathname === tab.path;
        const Icon = tab.icon;

        return (
          <button
            key={tab.id}
            className={`${styles.tabItem} ${isActive ? styles.active : ''}`}
            onClick={() => handleTabClick(tab.path)}
          >
            <Icon size={20} className={styles.icon} strokeWidth={isActive ? 2.5 : 2} aria-hidden="true" />
            <span className={styles.label}>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
