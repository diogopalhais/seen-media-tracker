import { CaretRight } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn.js';

export interface ListProps {
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** HIG inset grouped list: rounded container, hairline separators aligned to the text, ≥44pt rows. */
export function InsetGroupedList({ header, footer, children, className }: ListProps) {
  return (
    <section className={cn('safe-x my-2', className)}>
      {header && (
        <h3 className="m-0 mb-1 px-2 text-footnote font-normal uppercase tracking-wide text-label-secondary">
          {header}
        </h3>
      )}
      <div className="card overflow-hidden">
        <ul className="m-0 list-none p-0 [&>li]:relative [&>li+li]:before:absolute [&>li+li]:before:left-4 [&>li+li]:before:right-0 [&>li+li]:before:top-0 [&>li+li]:before:h-px [&>li+li]:before:bg-separator [&>li+li]:before:content-['']">
          {children}
        </ul>
      </div>
      {footer && (
        <p className="m-0 mt-2 px-1 text-footnote leading-relaxed text-label-secondary">{footer}</p>
      )}
    </section>
  );
}

export interface RowProps {
  label: ReactNode;
  detail?: ReactNode;
  icon?: ReactNode;
  /** Trailing value or control. */
  value?: ReactNode;
  onPress?: () => void;
  href?: string;
  external?: boolean;
  destructive?: boolean;
  chevron?: boolean;
  disabled?: boolean;
  as?: 'button' | 'div';
  className?: string;
}

export function Row({
  label,
  detail,
  icon,
  value,
  onPress,
  href,
  external,
  destructive,
  chevron,
  disabled,
  className,
}: RowProps) {
  const interactive = Boolean(onPress || href);
  const content = (
    <>
      {icon && (
        <span className="flex size-7 shrink-0 items-center justify-center text-tint">{icon}</span>
      )}
      <span className="flex min-w-0 flex-1 flex-col py-1.5">
        <span className={cn('truncate text-body', destructive ? 'text-destructive' : 'text-label')}>
          {label}
        </span>
        {detail && <span className="text-footnote text-label-secondary">{detail}</span>}
      </span>
      {value !== undefined && (
        <span className="shrink-0 text-body text-label-secondary">{value}</span>
      )}
      {(chevron ?? interactive) && !destructive && (
        <CaretRight
          weight="bold"
          className="size-4 shrink-0 text-label-tertiary"
          aria-hidden="true"
        />
      )}
    </>
  );
  const base = cn(
    'flex min-h-[3rem] w-full items-center gap-3 px-4 text-left',
    interactive && 'pressable',
    disabled && 'opacity-40 pointer-events-none',
    className,
  );
  if (href) {
    return (
      <li>
        <a
          href={href}
          className={base}
          {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        >
          {content}
        </a>
      </li>
    );
  }
  if (onPress) {
    return (
      <li>
        <button type="button" onClick={onPress} disabled={disabled} className={base}>
          {content}
        </button>
      </li>
    );
  }
  return (
    <li>
      <div className={base}>{content}</div>
    </li>
  );
}
