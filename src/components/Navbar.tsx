import { Bell } from 'lucide-react';
import styles from './Navbar.module.css';

interface NavbarProps {
  title?: string;
  subtitle?: string;
  showNotifications?: boolean;
  hasNotification?: boolean;
  compact?: boolean;
}

export function Navbar({
  title = 'Mixology',
  subtitle = 'APP',
  showNotifications = true,
  hasNotification = false,
  compact = false,
}: NavbarProps) {
  return (
    <header className={`${styles.navbar} ${compact ? styles.compact : ''}`}>
      <div className={styles.navbarContent}>
        <div className={styles.titleGroup}>
          <h1 className={styles.appName}>{title}</h1>
          {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
        </div>
        {showNotifications && (
          <div className={styles.actions}>
            <button className={styles.iconBtn} aria-label="通知">
              <Bell size={15} strokeWidth={1.75} />
              {hasNotification && <span className={styles.notificationDot} />}
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
