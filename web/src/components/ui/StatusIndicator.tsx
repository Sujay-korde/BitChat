import styles from './StatusIndicator.module.css';

export type StatusVariant = 'secure' | 'warning' | 'danger' | 'info' | 'neutral';

interface StatusIndicatorProps {
  variant: StatusVariant;
  pulsing?: boolean;
}

export function StatusIndicator({ variant, pulsing = false }: StatusIndicatorProps) {
  return (
    <span 
      className={`
        ${styles.indicator} 
        ${styles[variant]} 
        ${pulsing ? styles.pulsing : ''}
      `} 
      aria-hidden="true"
    />
  );
}
