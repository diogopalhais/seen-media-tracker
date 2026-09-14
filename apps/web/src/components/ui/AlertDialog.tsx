import * as RadixAlert from '@radix-ui/react-alert-dialog';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn.js';

export interface AlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  loading?: boolean;
}

/**
 * HIG alert: centred, two stacked-or-side-by-side actions, Cancel is the safe default (Radix
 * focuses Cancel on open and Escape cancels). Destructive confirmations render in red.
 */
export function AlertDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  destructive,
  onConfirm,
  loading,
}: AlertDialogProps) {
  return (
    <RadixAlert.Root open={open} onOpenChange={onOpenChange}>
      <RadixAlert.Portal>
        <RadixAlert.Overlay className="fade-enter absolute inset-0 z-[60] bg-overlay" />
        <RadixAlert.Content
          className={cn(
            'absolute left-1/2 top-1/2 z-[70] w-[min(17rem,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[1.25rem] border border-card-border bg-bg-elevated text-center shadow-[var(--shadow)]',
            'motion-safe:animate-[alert-in_var(--duration-screen)_var(--ease-ios)_both]',
          )}
        >
          <div className="px-2 pt-2.5 pb-2">
            <RadixAlert.Title className="m-0 text-headline">{title}</RadixAlert.Title>
            {description && (
              <RadixAlert.Description className="m-0 mt-0.5 text-footnote text-label-secondary">
                {description}
              </RadixAlert.Description>
            )}
          </div>
          <div className="grid grid-cols-2 hairline-t">
            <RadixAlert.Cancel asChild>
              <button
                type="button"
                className="pressable hit-target text-body text-tint border-r-[0.5px] border-separator"
                disabled={loading}
              >
                {cancelLabel}
              </button>
            </RadixAlert.Cancel>
            <RadixAlert.Action asChild>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  onConfirm();
                }}
                disabled={loading}
                className={cn(
                  'pressable hit-target text-body font-semibold',
                  destructive ? 'text-destructive' : 'text-tint',
                )}
              >
                {confirmLabel}
              </button>
            </RadixAlert.Action>
          </div>
        </RadixAlert.Content>
      </RadixAlert.Portal>
      <style>{`@keyframes alert-in{from{opacity:0;transform:translate(-50%,-50%) scale(1.1)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}`}</style>
    </RadixAlert.Root>
  );
}
