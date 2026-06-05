import { ChevronLeft, Bell, Moon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import styles from './Navbar.module.css';

interface NavbarProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  showBell?: boolean;
  showTheme?: boolean;
  size?: 'large' | 'compact';
  onThemeToggle?: () => void;
}

export function Navbar({
  title,
  subtitle,
  showBack = false,
  showBell = false,
  showTheme = false,
  size = 'large',
  onThemeToggle,
}: NavbarProps) {
  const navigate = useNavigate();

  return (
    <nav className={styles.navbar}>
      <div className={styles.left}>
        {showBack && (
          <button className={styles.backBtn} onClick={() => navigate(-1)}>
            <ChevronLeft size={28} strokeWidth={2} />
          </button>
        )}
        <h1 className={`${styles.title} ${size === 'large' ? styles.largeTitle : styles.title1}`}>
          {title}
        </h1>
      </div>

      <div className={styles.right}>
        {showTheme && (
          <button className={styles.iconBtn} onClick={onThemeToggle}>
            <Moon size={20} strokeWidth={1.5} />
          </button>
        )}
        {showBell && (
          <button className={styles.iconBtn}>
            <Bell size={20} strokeWidth={1.5} />
            <span className={styles.badge}>2</span>
          </button>
        )}
      </div>
    </nav>
  );
}
