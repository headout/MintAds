import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { FieldShell } from './Field';
import { Icon } from './Icon';
import styles from './Select.module.css';

export interface SelectOption {
  value: string;
  label: string;
  /** Optional section heading; consecutive options sharing a group render under one header. */
  group?: string;
}

export interface SelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  required?: boolean;
  hint?: string;
  error?: string | null;
  disabled?: boolean;
  id?: string;
}

export function Select({
  label,
  value,
  onChange,
  options,
  placeholder = 'Select…',
  required,
  hint,
  error,
  disabled,
  id,
}: SelectProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const listId = `${fieldId}-listbox`;

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<(HTMLLIElement | null)[]>([]);
  const typeahead = useRef({ buffer: '', at: 0 });

  const selectedIndex = options.findIndex((o) => o.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  const openMenu = useCallback(() => {
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  }, [selectedIndex]);

  const closeMenu = useCallback((focusTrigger = true) => {
    setOpen(false);
    if (focusTrigger) triggerRef.current?.focus();
  }, []);

  const choose = useCallback(
    (index: number) => {
      const opt = options[index];
      if (opt) onChange(opt.value);
      closeMenu();
    },
    [options, onChange, closeMenu],
  );

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // Keep the active option scrolled into view.
  useEffect(() => {
    if (open) optionRefs.current[activeIndex]?.scrollIntoView?.({ block: 'nearest' });
  }, [open, activeIndex]);

  const typeaheadMatch = (key: string) => {
    const now = Date.now();
    typeahead.current.buffer = now - typeahead.current.at > 600 ? key : typeahead.current.buffer + key;
    typeahead.current.at = now;
    const q = typeahead.current.buffer.toLowerCase();
    const idx = options.findIndex((o) => o.label.toLowerCase().startsWith(q));
    if (idx >= 0) {
      setActiveIndex(idx);
      if (!open) openMenu();
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!open) openMenu();
        else setActiveIndex((i) => Math.min(i + 1, options.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (!open) openMenu();
        else setActiveIndex((i) => Math.max(i - 1, 0));
        break;
      case 'Home':
        if (open) {
          e.preventDefault();
          setActiveIndex(0);
        }
        break;
      case 'End':
        if (open) {
          e.preventDefault();
          setActiveIndex(options.length - 1);
        }
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (open) choose(activeIndex);
        else openMenu();
        break;
      case 'Escape':
        if (open) {
          e.preventDefault();
          closeMenu();
        }
        break;
      case 'Tab':
        if (open) setOpen(false);
        break;
      default:
        if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) typeaheadMatch(e.key);
    }
  };

  let lastGroup: string | undefined;

  return (
    <FieldShell label={label} htmlFor={fieldId} required={required} hint={hint} error={error}>
      <div className={styles.wrap} ref={wrapRef}>
        <button
          type="button"
          id={fieldId}
          ref={triggerRef}
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          aria-labelledby={`${fieldId}-label`}
          aria-activedescendant={open ? `${fieldId}-opt-${activeIndex}` : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
          disabled={disabled}
          className={`${styles.trigger} ${open ? styles.triggerOpen : ''} ${error ? styles.invalid : ''}`}
          onClick={() => (open ? setOpen(false) : openMenu())}
          onKeyDown={onKeyDown}
        >
          <span className={`${styles.value} ${selected ? '' : styles.placeholder}`}>
            {selected ? selected.label : placeholder}
          </span>
          <span className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}>
            <Icon name="chevron-down" size={18} />
          </span>
        </button>

        {open && (
          <ul className={styles.popup} id={listId} role="listbox" aria-labelledby={`${fieldId}-label`}>
            {options.map((opt, i) => {
              const header =
                opt.group && opt.group !== lastGroup ? (
                  <li key={`g-${opt.group}`} role="presentation" className={`${styles.groupHeader} t-label-xs`}>
                    {opt.group}
                  </li>
                ) : null;
              lastGroup = opt.group;
              const isSelected = opt.value === value;
              return (
                <span style={{ display: 'contents' }} key={opt.value}>
                  {header}
                  <li
                    id={`${fieldId}-opt-${i}`}
                    ref={(el) => {
                      optionRefs.current[i] = el;
                    }}
                    role="option"
                    aria-selected={isSelected}
                    className={`${styles.option} t-cta-rg ${i === activeIndex ? styles.optionActive : ''} ${
                      isSelected ? styles.optionSelected : ''
                    }`}
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => choose(i)}
                  >
                    <span>{opt.label}</span>
                    {isSelected && <Icon name="check" size={16} className={styles.check} />}
                  </li>
                </span>
              );
            })}
          </ul>
        )}
      </div>
    </FieldShell>
  );
}
