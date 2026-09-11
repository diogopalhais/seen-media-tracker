import { type ReactNode, useState } from 'react';
import { Drawer } from 'vaul';
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

/**
 * HIG sheet: rises from the bottom, grabber, swipe-to-dismiss (vaul), Escape and Cancel.
 * Dismissal is intercepted while the form has unsaved changes.
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

  const requestClose = () => {
    if (dirty) setConfirmDiscard(true);
    else onOpenChange(false);
  };

  return (
    <>
      <Drawer.Root
        open={open}
        onOpenChange={(next) => {
          if (next) onOpenChange(true);
          else requestClose();
        }}
        repositionInputs={false}
      >
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-40 bg-overlay" />
          <Drawer.Content
            aria-describedby={undefined}
            className={cn(
              'fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[94dvh] w-full max-w-[40rem] flex-col rounded-t-sheet bg-bg-grouped outline-none shadow-[var(--shadow)]',
              'md:bottom-auto md:top-[6vh] md:rounded-sheet',
            )}
          >
            <Drawer.Handle className="mt-2.5 mb-1 !h-[5px] !w-10 !bg-label-quaternary" />
            <div className="safe-x grid h-11 shrink-0 grid-cols-[1fr_auto_1fr] items-center">
              <div className="flex justify-start">
                <Button variant="plain" onClick={requestClose} className="-ml-2">
                  {cancelLabel}
                </Button>
              </div>
              <Drawer.Title className="m-0 truncate text-headline">{title}</Drawer.Title>
              <div className="flex justify-end">{trailing}</div>
            </div>
            <div className="flex-1 overflow-y-auto safe-bottom">{children}</div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
      <AlertDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title="Discard changes?"
        description="Your edits to this watch have not been saved."
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
