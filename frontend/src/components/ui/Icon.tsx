// Inline Onix-style icon set: 24×24 grid, 1.5px stroke, round caps/joins,
// currentColor — so any icon takes the color of its surrounding text.

export type IconName =
  | 'check'
  | 'cross'
  | 'clock'
  | 'chevron-down'
  | 'arrow-left'
  | 'download'
  | 'play'
  | 'alert'
  | 'sparkle'
  | 'refresh'
  | 'film';

const PATHS: Record<IconName, React.ReactNode> = {
  check: <path d="M4 12.5 9 17.5 20 6.5" />,
  cross: <path d="M6 6 18 18 M18 6 6 18" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.25" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  'chevron-down': <path d="M6 9.5 12 15.5 18 9.5" />,
  'arrow-left': <path d="M19 12H5 M11 6 5 12 11 18" />,
  download: <path d="M12 4v11 M7.5 11 12 15.5 16.5 11 M5 19.5h14" />,
  play: <path d="M8 5.5 19 12 8 18.5Z" />,
  alert: (
    <>
      <path d="M12 3.5 22 20H2L12 3.5Z" />
      <path d="M12 9.5v5 M12 17.5h.01" />
    </>
  ),
  sparkle: <path d="M12 3.5 13.8 9.2 19.5 11 13.8 12.8 12 18.5 10.2 12.8 4.5 11 10.2 9.2Z" />,
  refresh: <path d="M5 9a7 7 0 0 1 12-2.5L19.5 9 M19 15a7 7 0 0 1-12 2.5L4.5 15 M19.5 4.5V9H15 M4.5 19.5V15H9" />,
  film: (
    <>
      <rect x="3.5" y="5" width="17" height="14" rx="2" />
      <path d="M8 5v14 M16 5v14 M3.5 12h17" />
    </>
  ),
};

export interface IconProps {
  name: IconName;
  size?: number;
  /** Decorative by default; pass a label to expose it to assistive tech. */
  label?: string;
  className?: string;
}

export function Icon({ name, size = 20, label, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
