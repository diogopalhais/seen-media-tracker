import { CaretLeft } from '@phosphor-icons/react';
import { type ButtonHTMLAttributes, type ReactNode, useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/cn.js';

export interface ScreenProps {
  title: string;
  /** Large title that collapses into the bar on scroll (root screens). */
  large?: boolean;
  onBack?: (() => void) | undefined;
  backLabel?: string;
  trailing?: ReactNode;
  /** Rendered under the title inside the bar area (e.g. a search field). */
  accessory?: ReactNode;
  /** Let the content run under a transparent bar (hero screens). The bar turns to glass once scrolled. */
  transparent?: boolean;
  children: ReactNode;
  className?: string;
  animate?: boolean;
}

/** Circular glass icon button for navigation bars. */
export function IconCircleButton({
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={cn('icon-circle pressable hit-target', className)} {...rest}>
      {children}
    </button>
  );
}

/**
 * Screen = navigation bar + content. The bar is sticky and translucent; on root screens the
 * large title sits in the content and the compact title fades in once it scrolls under the bar.
 */
export function Screen({
  title,
  large = false,
  onBack,
  backLabel = 'Back',
  trailing,
  accessory,
  transparent = false,
  children,
  className,
  animate,
}: ScreenProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(!large && !transparent);

  useEffect(() => {
    if (!large && !transparent) return;
    const el = sentinelRef.current;
    if (!el) return;
    const pane = el.closest<HTMLElement>('[data-pane]');
    if (transparent && !large) {
      // Hero screens: the bar turns to glass once the content has scrolled a little.
      const target: HTMLElement | Window = pane ?? window;
      const read = () => setCollapsed((pane ? pane.scrollTop : window.scrollY) > 72);
      read();
      target.addEventListener('scroll', read, { passive: true });
      return () => target.removeEventListener('scroll', read);
    }
    if (typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => setCollapsed(entry ? entry.intersectionRatio < 0.35 : false),
      { root: pane, threshold: [0, 0.35, 1], rootMargin: '-44px 0px 0px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [large, transparent]);

  const showTitle = collapsed || (!large && !transparent);

  return (
    <div className={cn('flex min-h-full flex-col', animate && 'screen-enter', className)}>
      <header
        className={cn(
          'sticky top-0 z-30 safe-top transition-[box-shadow,background-color] duration-200',
          collapsed ? 'bar-material hairline-b' : transparent ? 'bg-transparent' : 'bg-bg-grouped',
        )}
      >
        <div className="safe-x grid h-[3.25rem] grid-cols-[1fr_auto_1fr] items-center">
          <div className="flex justify-start">
            {onBack && (
              <IconCircleButton onClick={onBack} aria-label={`Back to ${backLabel}`}>
                <CaretLeft weight="bold" className="size-5" aria-hidden="true" />
              </IconCircleButton>
            )}
          </div>
          <h1
            className={cn(
              'm-0 truncate text-center text-headline transition-opacity duration-200',
              showTitle ? 'opacity-100' : 'opacity-0',
            )}
          >
            {title}
          </h1>
          <div className="flex justify-end gap-2">{large && !collapsed ? null : trailing}</div>
        </div>
        {accessory && !large && <div className="safe-x pb-2">{accessory}</div>}
      </header>

      {large && (
        <div ref={sentinelRef} className="safe-x flex items-center justify-between gap-3 pt-1 pb-3">
          <p className="display m-0 min-w-0 truncate text-large-title" aria-hidden="true">
            {title}
          </p>
          {trailing && (
            <div
              className={cn(
                'flex shrink-0 items-center gap-2 transition-opacity duration-150',
                collapsed && 'pointer-events-none opacity-0',
              )}
            >
              {trailing}
            </div>
          )}
        </div>
      )}
      {transparent && !large && (
        <div ref={sentinelRef} className="-mt-[3.25rem] h-[3.25rem]" aria-hidden="true" />
      )}
      {accessory && large && (
        <div
          className={cn(
            'sticky z-20 safe-x pb-3 pt-1 transition-[background-color] duration-200',
            collapsed ? 'bar-material hairline-b' : 'bg-bg-grouped',
          )}
          style={{ top: 'calc(3.25rem + env(safe-area-inset-top, 0px))' }}
        >
          {accessory}
        </div>
      )}

      <div
        className={cn(
          'flex-1 pb-[calc(3.75rem+env(safe-area-inset-bottom,0px)+1.5rem)] md:pb-6',
          transparent && !large && '-mt-[3.25rem]',
        )}
      >
        {children}
      </div>
    </div>
  );
}
