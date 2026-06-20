import { useId, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { FieldShell } from './Field';
import styles from './form.module.css';

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
        {value?.length ?? 0}/{maxLength}
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
