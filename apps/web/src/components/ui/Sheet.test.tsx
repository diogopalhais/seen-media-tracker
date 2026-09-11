import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Sheet } from './Sheet.js';

describe('Sheet', () => {
  it('closes on Cancel when there are no unsaved changes', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <Sheet open onOpenChange={onOpenChange} title="Log Watch">
        <p>content</p>
      </Sheet>,
    );
    expect(screen.getByRole('dialog', { name: 'Log Watch' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('asks before discarding unsaved changes and keeps the sheet open until confirmed', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <Sheet open onOpenChange={onOpenChange} title="Edit Watch" dirty>
        <p>content</p>
      </Sheet>,
    );
    await user.keyboard('{Escape}');
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    const alert = await screen.findByRole('alertdialog', { name: 'Discard changes?' });
    expect(alert).toBeInTheDocument();
    // Cancel is the safe default action and is focused first.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Keep Editing' })).toHaveFocus());
    await user.click(screen.getByRole('button', { name: 'Keep Editing' }));
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByRole('dialog', { name: 'Edit Watch' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(await screen.findByRole('button', { name: 'Discard' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
