import { Home, Search, Package, User } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import styles from './TabBar.module.css';

interface Tab {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  path: string;
}

const tabs: Tab[] = [
  { id: 'discover', label: '发现', icon: Home, path: '/' },
  { id: 'search', label: '搜索', icon: Search, path: '/search' },
  { id: 'bar', label: '酒柜', icon: Package, path: '/bar' },
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
            <Icon size={28} className={styles.icon} />
            <span className={styles.label}>{tab.label}</span>
            {isActive && <span className={styles.indicator} />}
          </button>
        );
      })}
    </nav>
  );
}
