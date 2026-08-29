import styles from './Divider.module.css';

interface DividerProps {
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}

export function Divider({ orientation = 'horizontal', className = '' }: DividerProps) {
  return (
    <div 
      className={`${styles.divider} ${styles[orientation]} ${className}`} 
      role="separator"
      aria-orientation={orientation}
    />
  );
}
