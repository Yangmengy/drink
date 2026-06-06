import styles from './Tag.module.css';

interface TagProps {
  selected?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}

export function Tag({ selected = false, onClick, children, className = '' }: TagProps) {
  return (
    <button
      className={`${styles.tag} ${selected ? styles.selected : ''} ${className}`}
      onClick={onClick}
      role="radio"
      aria-checked={selected}
    >
      {children}
    </button>
  );
}
