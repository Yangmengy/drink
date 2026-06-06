import { Search } from 'lucide-react';
import styles from './SearchBar.module.css';

interface SearchBarProps {
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  readonly?: boolean;
  onClick?: () => void;
  className?: string;
}

export function SearchBar({
  placeholder = '搜索鸡尾酒、原料...',
  value = '',
  onChange,
  readonly = false,
  onClick,
  className = '',
}: SearchBarProps) {
  return (
    <div className={`${styles.wrapper} ${className}`}>
      <div className={styles.inputGroup}>
        <Search size={15} strokeWidth={1.75} className={styles.icon} />
        <input
          type="search"
          className={styles.input}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          readOnly={readonly}
          onClick={readonly ? onClick : undefined}
          enterKeyHint="search"
        />
      </div>
    </div>
  );
}
