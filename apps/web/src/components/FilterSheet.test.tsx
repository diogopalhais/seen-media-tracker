import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_FILTERS, FilterSheet, isDefaultFilters } from './FilterSheet.js';

describe('FilterSheet', () => {
  it('changes the sort without closing and offers a reset when non-default', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <FilterSheet
        open
        onOpenChange={onOpenChange}
        filters={DEFAULT_FILTERS}
        onChange={onChange}
      />,
    );
    expect(screen.getByRole('dialog', { name: 'Sort' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reset to defaults' })).toBeNull();
    // The media type moved to the chips above the grid.
    expect(screen.queryByRole('radio', { name: 'TV' })).toBeNull();

    await user.click(screen.getByRole('radio', { name: 'Rating' }));
    expect(onChange).toHaveBeenLastCalledWith({ type: 'all', sort: 'rating' });
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('shows Reset when filters differ from the defaults', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <FilterSheet
        open
        onOpenChange={() => {}}
        filters={{ type: 'movie', sort: 'title' }}
        onChange={onChange}
      />,
    );
    expect(isDefaultFilters({ type: 'movie', sort: 'title' })).toBe(false);
    await user.click(screen.getByRole('button', { name: 'Reset to defaults' }));
    expect(onChange).toHaveBeenLastCalledWith(DEFAULT_FILTERS);
  });
});
