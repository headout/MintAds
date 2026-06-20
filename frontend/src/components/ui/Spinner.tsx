import styles from './Spinner.module.css';

export interface SpinnerProps {
  size?: number;
  label?: string;
  className?: string;
}

export function Spinner({ size = 18, label = 'Loading', className }: SpinnerProps) {
  return (
    <span
      className={`${styles.spinner} ${className ?? ''}`}
      style={{ width: size, height: size }}
      role="status"
      aria-label={label}
    />
  );
}
