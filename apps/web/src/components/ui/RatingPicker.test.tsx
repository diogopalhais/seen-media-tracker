import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { RatingPicker } from './RatingPicker.js';

function Harness({
  initial = null,
  onChange,
}: {
  initial?: number | null;
  onChange?: (v: number | null) => void;
}) {
  const [value, setValue] = useState<number | null>(initial);
  return (
    <RatingPicker
      value={value}
      onChange={(v) => {
        setValue(v);
        onChange?.(v);
      }}
    />
  );
}

const radio = (n: number) => screen.getByRole('radio', { name: `${n} out of 10` });

describe('RatingPicker', () => {
  it('renders ten whole-number options as a radiogroup', () => {
    render(<Harness />);
    expect(screen.getByRole('radiogroup', { name: 'Rating' })).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(10);
    expect(radio(1)).toBeInTheDocument();
    expect(radio(10)).toBeInTheDocument();
  });

  it('selects 7, highlights 1–7 and announces "7 out of 10"', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await user.click(radio(7));
    expect(onChange).toHaveBeenLastCalledWith(7);
    expect(radio(7)).toHaveAttribute('aria-checked', 'true');
    for (let n = 1; n <= 7; n++) expect(radio(n).className).toContain('bg-tint');
    for (let n = 8; n <= 10; n++) expect(radio(n).className).not.toContain('bg-tint');
    expect(screen.getByRole('status')).toHaveTextContent('7 out of 10');
  });

  it('steps by one with arrow keys and announces the new value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial={7} onChange={onChange} />);
    radio(7).focus();
    await user.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenLastCalledWith(8);
    expect(radio(8)).toHaveAttribute('aria-checked', 'true');
    expect(radio(8)).toHaveFocus();
    expect(screen.getByRole('status')).toHaveTextContent('8 out of 10');
    await user.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(onChange).toHaveBeenLastCalledWith(6);
  });

  it('clamps at the ends of the scale', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial={10} onChange={onChange} />);
    radio(10).focus();
    await user.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenLastCalledWith(10);
  });

  it('clears by tapping the selected value or the Clear button', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial={4} onChange={onChange} />);
    await user.click(radio(4));
    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(screen.getByRole('status')).toHaveTextContent('No rating');
    await user.click(radio(9));
    expect(onChange).toHaveBeenLastCalledWith(9);
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(screen.queryByRole('radio', { checked: true })).toBeNull();
  });

  it('shows a field error linked to the group', () => {
    render(
      <RatingPicker value={null} onChange={() => {}} error="Rating must be between 1 and 10" />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Rating must be between 1 and 10');
    expect(screen.getByRole('radiogroup')).toHaveAttribute('aria-describedby');
  });
});
