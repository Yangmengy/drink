import styles from './SectionTitle.module.css';

interface SectionTitleProps {
  children: React.ReactNode;
  action?: string;
  onAction?: () => void;
}

export function SectionTitle({ children, action, onAction }: SectionTitleProps) {
  return (
    <div className={styles.wrapper}>
      <h3 className={styles.title}>{children}</h3>
      {action && (
        <button className={styles.action} onClick={onAction}>
          {action}
        </button>
      )}
    </div>
  );
}
