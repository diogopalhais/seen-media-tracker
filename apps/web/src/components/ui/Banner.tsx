import { ArrowClockwise, Info, WarningCircle, WifiSlash, X } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn.js';
import { Button } from './Button.js';

type Tone = 'error' | 'offline' | 'info';

export interface BannerProps {
  tone?: Tone;
  children: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  onDismiss?: () => void;
  className?: string;
}

const icons: Record<Tone, ReactNode> = {
  error: (
    <WarningCircle weight="fill" className="size-5 shrink-0 text-destructive" aria-hidden="true" />
  ),
  offline: (
    <WifiSlash weight="bold" className="size-5 shrink-0 text-label-secondary" aria-hidden="true" />
  ),
  info: <Info weight="fill" className="size-5 shrink-0 text-tint" aria-hidden="true" />,
};

/** Non-blocking status strip: keeps existing content visible and offers a retry. */
export function Banner({
  tone = 'info',
  children,
  onRetry,
  retryLabel = 'Retry',
  onDismiss,
  className,
}: BannerProps) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'fade-enter glass mx-margin my-1 flex items-center gap-2 rounded-2xl px-3 py-2 text-subheadline',
        className,
      )}
    >
      {icons[tone]}
      <div className="flex-1 min-w-0">{children}</div>
      {onRetry && (
        <Button
          variant="plain"
          onClick={onRetry}
          icon={<ArrowClockwise weight="bold" className="size-4" aria-hidden="true" />}
        >
          {retryLabel}
        </Button>
      )}
      {onDismiss && (
        <Button
          variant="plain"
          aria-label="Dismiss"
          onClick={onDismiss}
          className="text-label-secondary"
        >
          <X weight="bold" className="size-4" aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}
