import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { SegmentedControl } from './SegmentedControl.js';

type Filter = 'all' | 'movie' | 'tv';
const segments = [
  { value: 'all' as const, label: 'All' },
  { value: 'movie' as const, label: 'Movies' },
  { value: 'tv' as const, label: 'TV' },
];

function Harness({ onChange }: { onChange: (v: Filter) => void }) {
  const [value, setValue] = useState<Filter>('all');
  return (
    <SegmentedControl<Filter>
      ariaLabel="Filter by type"
      value={value}
      onChange={(v) => {
        setValue(v);
        onChange(v);
      }}
      segments={segments}
    />
  );
}

describe('SegmentedControl', () => {
  it('exposes segments as radios and reports selection', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    expect(screen.getByRole('radiogroup', { name: 'Filter by type' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'All' })).toHaveAttribute('aria-checked', 'true');
    await user.click(screen.getByRole('radio', { name: 'TV' }));
    expect(onChange).toHaveBeenCalledWith('tv');
    expect(screen.getByRole('radio', { name: 'TV' })).toHaveAttribute('aria-checked', 'true');
  });

  it('reflects the controlled value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await user.click(screen.getByRole('radio', { name: 'Movies' }));
    expect(screen.getByRole('radio', { name: 'Movies' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'All' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getAllByRole('radio')).toHaveLength(3);
  });
});
