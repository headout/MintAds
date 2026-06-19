import type { CSSProperties, ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import styles from './feedback.module.css';

// --- Skeleton ---

export interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  radius?: number;
  className?: string;
  style?: CSSProperties;
}

export function Skeleton({ width = '100%', height = 16, radius, className, style }: SkeletonProps) {
  return (
    <span
      className={`${styles.skeleton} ${className ?? ''}`}
      style={{ width, height, borderRadius: radius, display: 'block', ...style }}
      aria-hidden="true"
    />
  );
}

// --- Empty state ---

export interface EmptyStateProps {
  title: string;
  message?: string;
  icon?: IconName;
  action?: ReactNode;
}

export function EmptyState({ title, message, icon = 'sparkle', action }: EmptyStateProps) {
  return (
    <div className={styles.state} role="status">
      <span className={styles.iconWrap}>
        <Icon name={icon} size={24} />
      </span>
      <h2 className={`${styles.title} t-heading-md`}>{title}</h2>
      {message && <p className={`${styles.message} t-para-md`}>{message}</p>}
      {action && <div className={styles.actions}>{action}</div>}
    </div>
  );
}

// --- Error state ---

export interface ErrorStateProps {
  title?: string;
  message?: string;
  action?: ReactNode;
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  action,
}: ErrorStateProps) {
  return (
    <div className={styles.state} role="alert">
      <span className={`${styles.iconWrap} ${styles.iconWrapError}`}>
        <Icon name="alert" size={24} />
      </span>
      <h2 className={`${styles.title} t-heading-md`}>{title}</h2>
      {message && <p className={`${styles.message} t-para-md`}>{message}</p>}
      {action && <div className={styles.actions}>{action}</div>}
    </div>
  );
}
