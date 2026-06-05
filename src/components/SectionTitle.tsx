import styles from './SectionTitle.module.css';

interface SectionTitleProps {
  children: string;
  action?: string;
  onAction?: () => void;
}

export function SectionTitle({ children, action, onAction }: SectionTitleProps) {
  return (
    <div className={styles.sectionHeader}>
      <h2 className={styles.title}>{children}</h2>
      {action && (
        <button className={styles.action} onClick={onAction} type="button">
          {action}
        </button>
      )}
    </div>
  );
}
