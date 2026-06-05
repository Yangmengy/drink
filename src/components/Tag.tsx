import { ReactNode } from 'react';
import styles from './Tag.module.css';

interface TagProps {
  children: ReactNode;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'error';
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}

export function Tag({
  children,
  variant = 'default',
  selected = false,
  onClick,
  className = '',
}: TagProps) {
  return (
    <button
      className={`${styles.tag} ${styles[variant]} ${selected ? styles.selected : ''} ${className}`}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}
