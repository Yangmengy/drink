import { Search, X } from 'lucide-react';
import { useState } from 'react';
import styles from './SearchBar.module.css';

interface SearchBarProps {
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  onFocus?: () => void;
  onClear?: () => void;
  readonly?: boolean;
  className?: string;
}

export function SearchBar({
  placeholder = '搜索鸡尾酒、原料...',
  value = '',
  onChange,
  onFocus,
  onClear,
  readonly = false,
  className = '',
}: SearchBarProps) {
  const [isFocused, setIsFocused] = useState(false);

  const handleClear = () => {
    onChange?.('');
    onClear?.();
  };

  return (
    <div className={`${styles.searchBar} ${isFocused ? styles.focused : ''} ${className}`}>
      <Search size={18} strokeWidth={1.5} className={styles.icon} />
      <input
        type={readonly ? 'button' : 'text'}
        className={styles.input}
        placeholder={placeholder}
        value={value}
        readOnly={readonly}
        onChange={(e) => onChange?.(e.target.value)}
        onFocus={() => {
          setIsFocused(true);
          onFocus?.();
        }}
        onBlur={() => setIsFocused(false)}
      />
      {value && (
        <button className={styles.clearBtn} onClick={handleClear} type="button">
          <X size={12} strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}
