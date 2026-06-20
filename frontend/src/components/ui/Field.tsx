import type { ReactNode } from 'react';
import styles from './form.module.css';

export interface FieldShellProps {
  label: string;
  htmlFor: string;
  required?: boolean;
  hint?: string;
  error?: string | null;
  children: ReactNode;
  footer?: ReactNode;
}

/** Label + hint + error scaffold shared by every form control. */
export function FieldShell({
  label,
  htmlFor,
  required,
  hint,
  error,
  children,
  footer,
}: FieldShellProps) {
  const describedBy = error ? `${htmlFor}-error` : hint ? `${htmlFor}-hint` : undefined;
  return (
    <div className={styles.field}>
      <label id={`${htmlFor}-label`} className={`${styles.label} t-cta-sm`} htmlFor={htmlFor}>
        {label}
        {required && (
          <span className={styles.required} aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      <div aria-live="polite">
        {error ? (
          <span id={describedBy} className={`${styles.error} t-para-sm`}>
            {error}
          </span>
        ) : hint ? (
          <span id={describedBy} className={`${styles.hint} t-para-sm`}>
            {hint}
          </span>
        ) : null}
      </div>
      {footer}
    </div>
  );
}
