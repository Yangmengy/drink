import { useRef } from 'react';
import { Search } from 'lucide-react';
import styles from './SearchBar.module.css';

interface SearchBarProps {
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  readonly?: boolean;
  onClick?: () => void;
  onFocus?: () => void;
  className?: string;
  autoFocus?: boolean;
}

export function SearchBar({
  placeholder = '搜索鸡尾酒、原料...',
  value = '',
  onChange,
  readonly = false,
  onClick,
  onFocus,
  className = '',
  autoFocus = false,
}: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className={`${styles.wrapper} ${className}`}>
      <div className={styles.inputGroup}>
        <Search size={15} strokeWidth={1.75} className={styles.icon} />
        <input
          ref={inputRef}
          type="search"
          className={styles.input}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          readOnly={readonly}
          onClick={readonly ? onClick : undefined}
          onFocus={onFocus}
          autoFocus={autoFocus}
          enterKeyHint="search"
        />
      </div>
    </div>
  );
}
