import * as Dialog from '@radix-ui/react-dialog';
import { type ReactNode, type PointerEvent as ReactPointerEvent, useRef, useState } from 'react';
import { cn } from '../../lib/cn.js';
import { AlertDialog } from './AlertDialog.js';
import { Button } from './Button.js';

export interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** When true, dismissing (swipe, Escape, overlay, Cancel) asks for confirmation first. */
  dirty?: boolean;
  trailing?: ReactNode;
  children: ReactNode;
  cancelLabel?: string;
}

const DISMISS_DISTANCE = 110;
const DISMISS_VELOCITY = 0.6; // px per ms

/**
 * Bottom sheet built on Radix Dialog: focus trap, Escape and overlay dismissal for free, transform-only
 * enter/exit animations, and a light drag-to-dismiss from the grabber/header. No body scroll lock
 * tricks, which is what made the previous drawer stutter inside our scroll panes.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  dirty = false,
  trailing,
  children,
  cancelLabel = 'Cancel',
}: SheetProps) {
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [dragY, setDragY] = useState(0);
  const drag = useRef<{ startY: number; startT: number; active: boolean }>({
    startY: 0,
    startT: 0,
    active: false,
  });

  const requestClose = () => {
    if (dirty) setConfirmDiscard(true);
    else onOpenChange(false);
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // Buttons in the header must keep their own click; only the grabber and title start a drag.
    if ((e.target as HTMLElement).closest('button')) return;
    drag.current = { startY: e.clientY, startT: performance.now(), active: true };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current.active) return;
    setDragY(Math.max(0, e.clientY - drag.current.startY));
  };
  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current.active) return;
    drag.current.active = false;
    const dy = Math.max(0, e.clientY - drag.current.startY);
    const dt = Math.max(1, performance.now() - drag.current.startT);
    setDragY(0);
    if (dy > DISMISS_DISTANCE || dy / dt > DISMISS_VELOCITY) requestClose();
  };

  return (
    <>
      <Dialog.Root
        open={open}
        onOpenChange={(next) => {
          if (next) onOpenChange(true);
          else requestClose();
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="sheet-overlay fixed inset-0 z-40 bg-overlay" />
          <Dialog.Content
            aria-describedby={undefined}
            onOpenAutoFocus={(e) => e.preventDefault()}
            className={cn(
              'sheet-panel fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92dvh] w-full max-w-[40rem] flex-col rounded-t-sheet bg-glass-strong text-label outline-none',
              'border border-glass-border shadow-[var(--shadow)] [-webkit-backdrop-filter:saturate(180%)_blur(28px)] [backdrop-filter:saturate(180%)_blur(28px)]',
              'md:bottom-auto md:top-[8vh] md:max-h-[84vh] md:rounded-sheet',
            )}
            style={dragY ? { transform: `translateY(${dragY}px)`, transition: 'none' } : undefined}
          >
            <div
              className="touch-none select-none"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              <div
                className="mx-auto mt-2.5 h-[5px] w-10 rounded-full bg-label-quaternary"
                aria-hidden="true"
              />
              <div className="safe-x grid h-12 grid-cols-[1fr_auto_1fr] items-center">
                <div className="flex justify-start">
                  <Button variant="plain" onClick={requestClose} className="-ml-3">
                    {cancelLabel}
                  </Button>
                </div>
                <Dialog.Title className="m-0 truncate text-headline">{title}</Dialog.Title>
                <div className="flex justify-end">{trailing}</div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain safe-bottom">{children}</div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <AlertDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title="Discard changes?"
        description="Your edits have not been saved."
        confirmLabel="Discard"
        cancelLabel="Keep Editing"
        destructive
        onConfirm={() => {
          setConfirmDiscard(false);
          onOpenChange(false);
        }}
      />
    </>
  );
}
