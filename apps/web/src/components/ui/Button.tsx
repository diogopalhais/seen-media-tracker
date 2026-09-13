import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn.js';

type Variant = 'filled' | 'tinted' | 'glass' | 'plain' | 'destructive';
type Size = 'regular' | 'large';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  block?: boolean;
}

const variants: Record<Variant, string> = {
  filled:
    'bg-tint text-tint-contrast font-semibold shadow-[0_6px_16px_color-mix(in_srgb,var(--tint)_30%,transparent)]',
  tinted: 'bg-[color-mix(in_srgb,var(--tint)_12%,transparent)] text-tint font-semibold',
  glass: 'glass text-label font-semibold shadow-none',
  plain: 'text-tint',
  destructive: 'text-destructive',
};

export function Button({
  variant = 'plain',
  size = 'regular',
  loading = false,
  icon,
  block = false,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'hit-target pressable inline-flex items-center justify-center gap-1.5 rounded-xl px-4 text-body',
        size === 'large' && 'h-12 rounded-2xl text-headline px-5',
        variants[variant],
        block && 'w-full',
        (disabled || loading) && 'opacity-40 pointer-events-none',
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn(
        'inline-block size-5 animate-spin rounded-full border-2 border-current border-r-transparent opacity-70',
        className,
      )}
    />
  );
}
