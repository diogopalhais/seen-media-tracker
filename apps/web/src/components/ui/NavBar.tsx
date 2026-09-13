import { CaretLeft } from '@phosphor-icons/react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
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
  children: ReactNode;
  className?: string;
  animate?: boolean;
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
  children,
  className,
  animate,
}: ScreenProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(!large);

  useEffect(() => {
    if (!large) return;
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const root = el.closest<HTMLElement>('[data-pane]');
    const observer = new IntersectionObserver(
      ([entry]) => setCollapsed(entry ? entry.intersectionRatio < 0.35 : false),
      { root, threshold: [0, 0.35, 1], rootMargin: '-44px 0px 0px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [large]);

  const shortBack = backLabel.length > 14 ? 'Back' : backLabel;

  return (
    <div className={cn('flex min-h-full flex-col', animate && 'screen-enter', className)}>
      <header
        className={cn(
          'sticky top-0 z-30 safe-top transition-[box-shadow,background-color] duration-200',
          collapsed ? 'bar-material hairline-b' : 'bg-bg-grouped',
        )}
      >
        <div className="safe-x grid h-11 grid-cols-[1fr_auto_1fr] items-center">
          <div className="flex justify-start">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="pressable hit-target -ml-2 inline-flex items-center pr-2 text-tint text-body"
              >
                <CaretLeft weight="bold" className="size-6" aria-hidden="true" />
                <span className="truncate max-w-[40vw]">{shortBack}</span>
              </button>
            )}
          </div>
          <h1
            className={cn(
              'm-0 truncate text-center text-headline transition-opacity duration-200',
              large && !collapsed ? 'opacity-0' : 'opacity-100',
            )}
          >
            {title}
          </h1>
          <div className="flex justify-end gap-0.5">{trailing}</div>
        </div>
        {accessory && !large && <div className="safe-x pb-2">{accessory}</div>}
      </header>

      {large && (
        <div ref={sentinelRef} className="safe-x pt-1 pb-2">
          <p className="display m-0 text-large-title" aria-hidden="true">
            {title}
          </p>
        </div>
      )}
      {accessory && large && (
        <div
          className={cn(
            'sticky z-20 safe-x pb-3 pt-1 transition-[background-color] duration-200',
            collapsed ? 'bar-material hairline-b' : 'bg-bg-grouped',
          )}
          style={{ top: 'calc(2.75rem + env(safe-area-inset-top, 0px))' }}
        >
          {accessory}
        </div>
      )}

      <div className="flex-1 pb-[calc(3.0625rem+env(safe-area-inset-bottom,0px)+1rem)] md:pb-4">
        {children}
      </div>
    </div>
  );
}
