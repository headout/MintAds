import type { ReactNode } from 'react';
import styles from './Tag.module.css';

export type TagTone = 'neutral' | 'primary' | 'success' | 'candy';

export interface TagProps {
  children: ReactNode;
  tone?: TagTone;
  icon?: ReactNode;
  className?: string;
}

export function Tag({ children, tone = 'neutral', icon, className }: TagProps) {
  return (
    <span className={`${styles.tag} ${styles[tone]} ${className ?? ''}`}>
      {icon}
      {children}
    </span>
  );
}
