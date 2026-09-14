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
    const target: HTMLElement | Window = pane ?? window;
    const BAR = 52;
    // Collapse once the large title has scrolled under the bar (root screens), or after a short scroll (hero screens).
    const read = () => {
      const y = pane ? pane.scrollTop : window.scrollY;
      const threshold = large ? Math.max(8, el.offsetTop + el.offsetHeight - BAR) : 72;
      setCollapsed(y > threshold);
    };
    read();
    target.addEventListener('scroll', read, { passive: true });
    return () => target.removeEventListener('scroll', read);
  }, [large, transparent]);

  const showTitle = collapsed || (!large && !transparent);

  return (
    <div className={cn('flex min-h-full flex-col', animate && 'screen-enter', className)}>
      <header
        className={cn(
          'sticky top-0 z-30 safe-top transition-[box-shadow,background-color] duration-200',
          // Root and hero screens: the bar overlays the content (no reserved row) and only shows once collapsed.
          (large || transparent) &&
            'h-[calc(3.25rem+env(safe-area-inset-top,0px))] -mb-[calc(3.25rem+env(safe-area-inset-top,0px))]',
          collapsed
            ? 'bar-material hairline-b'
            : large || transparent
              ? 'pointer-events-none bg-transparent'
              : 'bg-bg-grouped',
        )}
      >
        <div className="safe-x grid h-[3.25rem] grid-cols-[1fr_auto_1fr] items-center">
          {/* The bar itself is pointer-events-none on hero screens; its controls must stay tappable. */}
          <div className="pointer-events-auto flex justify-start">
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
          <div className="pointer-events-auto flex justify-end gap-2">
            {large && !collapsed ? null : trailing}
          </div>
        </div>
        {accessory && !large && <div className="safe-x pb-2">{accessory}</div>}
      </header>

      {large && (
        <div
          ref={sentinelRef}
          className="safe-x safe-top flex items-center justify-between gap-3 pb-3 [padding-top:calc(env(safe-area-inset-top,0px)+0.75rem)]"
        >
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
          false,
        )}
      >
        {children}
      </div>
    </div>
  );
}
