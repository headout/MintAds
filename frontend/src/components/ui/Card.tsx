import type { ReactNode } from 'react';
import styles from './Card.module.css';

export interface CardProps {
  children: ReactNode;
  pad?: 16 | 24;
  className?: string;
}

export function Card({ children, pad = 24, className }: CardProps) {
  return (
    <section className={`${styles.card} ${pad === 16 ? styles.pad16 : ''} ${className ?? ''}`}>
      {children}
    </section>
  );
}

export interface CardHeaderProps {
  title: string;
  action?: ReactNode;
}

export function CardHeader({ title, action }: CardHeaderProps) {
  return (
    <div className={styles.header}>
      <h2 className={`${styles.title} t-heading-md`}>{title}</h2>
      {action}
    </div>
  );
}
