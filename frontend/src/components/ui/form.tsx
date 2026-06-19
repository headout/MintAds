import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { Icon } from './Icon';
import styles from './form.module.css';

interface FieldShellProps {
  label: string;
  htmlFor: string;
  required?: boolean;
  hint?: string;
  error?: string | null;
  children: ReactNode;
  footer?: ReactNode;
}

/** Label + hint + error scaffold shared by every form control. */
function FieldShell({ label, htmlFor, required, hint, error, children, footer }: FieldShellProps) {
  const describedBy = error ? `${htmlFor}-error` : hint ? `${htmlFor}-hint` : undefined;
  return (
    <div className={styles.field}>
      <label className={`${styles.label} t-cta-sm`} htmlFor={htmlFor}>
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

// --- Select ---

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string | null;
}

export function Select({ label, required, hint, error, id, className, children, ...rest }: SelectProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldShell label={label} htmlFor={fieldId} required={required} hint={hint} error={error}>
      <span className={styles.selectWrap}>
        <select
          id={fieldId}
          className={`${styles.control} ${styles.select} ${error ? styles.invalid : ''} ${className ?? ''}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
          {...rest}
        >
          {children}
        </select>
        <span className={styles.chevron}>
          <Icon name="chevron-down" size={18} />
        </span>
      </span>
    </FieldShell>
  );
}

// --- Text input ---

export interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string | null;
}

export function TextInput({ label, required, hint, error, id, className, ...rest }: TextInputProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldShell label={label} htmlFor={fieldId} required={required} hint={hint} error={error}>
      <input
        id={fieldId}
        className={`${styles.control} ${error ? styles.invalid : ''} ${className ?? ''}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
        {...rest}
      />
    </FieldShell>
  );
}

// --- Textarea (with optional character counter) ---

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string | null;
  maxLength?: number;
  value?: string;
}

export function TextArea({
  label,
  required,
  hint,
  error,
  id,
  className,
  maxLength,
  value,
  ...rest
}: TextAreaProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const counter =
    maxLength != null ? (
      <span className={`${styles.counter} t-para-sm`}>
        {(value?.length ?? 0)}/{maxLength}
      </span>
    ) : undefined;
  return (
    <FieldShell
      label={label}
      htmlFor={fieldId}
      required={required}
      hint={hint}
      error={error}
      footer={counter}
    >
      <textarea
        id={fieldId}
        maxLength={maxLength}
        value={value}
        className={`${styles.control} ${styles.textarea} ${error ? styles.invalid : ''} ${className ?? ''}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
        {...rest}
      />
    </FieldShell>
  );
}
