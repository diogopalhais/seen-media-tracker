import { RATING_MAX, RATING_MIN } from '@seen/shared';
import { type KeyboardEvent, useId, useRef, useState } from 'react';
import { cn } from '../../lib/cn.js';

export interface RatingPickerProps {
  value: number | null;
  onChange: (value: number | null) => void;
  label?: string;
  error?: string | undefined;
  disabled?: boolean;
}

const VALUES = Array.from({ length: RATING_MAX - RATING_MIN + 1 }, (_, i) => RATING_MIN + i);

/**
 * Ten numbered buttons (1–10), highlighted up to the selection, each ≥44pt and wrapping on narrow
 * screens. Radiogroup semantics with roving focus: arrows step by one, tapping the selected value or
 * Clear unsets it, and a live region announces "N out of 10".
 */
export function RatingPicker({
  value,
  onChange,
  label = 'Rating',
  error,
  disabled,
}: RatingPickerProps) {
  const id = useId();
  const groupRef = useRef<HTMLDivElement>(null);
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState('');

  const announce = (v: number | null) =>
    setAnnouncement(v === null ? 'No rating' : `${v} out of ${RATING_MAX}`);

  const select = (v: number | null) => {
    onChange(v);
    announce(v);
  };

  const focusValue = (v: number) => {
    const el = groupRef.current?.querySelector<HTMLButtonElement>(`[data-value="${v}"]`);
    el?.focus();
    setFocusIndex(v);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, current: number) => {
    let next: number | null = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp')
      next = Math.min(RATING_MAX, (value ?? current) + 1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown')
      next = Math.max(RATING_MIN, (value ?? current) - 1);
    else if (e.key === 'Home') next = RATING_MIN;
    else if (e.key === 'End') next = RATING_MAX;
    else if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      select(null);
      return;
    } else return;
    e.preventDefault();
    select(next);
    focusValue(next);
  };

  // Roving tabindex: only the selected (or first) button is in the tab order.
  const tabbable = value ?? focusIndex ?? RATING_MIN;

  return (
    <div className="flex flex-col gap-0.5 py-1.5">
      <div className="flex items-baseline justify-between">
        <span
          id={`${id}-label`}
          className="text-footnote font-semibold uppercase tracking-[0.05em] text-label-secondary"
        >
          {label}
        </span>
        <span className="flex items-center gap-1 text-subheadline font-semibold tabular-nums text-label">
          <span aria-hidden="true">
            {value === null ? (
              <span className="font-normal text-label-tertiary">Not rated</span>
            ) : (
              `${value}/${RATING_MAX}`
            )}
          </span>
          <button
            type="button"
            onClick={() => select(null)}
            disabled={disabled || value === null}
            className={cn(
              'hit-target pressable -mr-2 px-2 text-subheadline font-medium text-tint',
              value === null && 'invisible',
            )}
          >
            Clear
          </button>
        </span>
      </div>
      <div>
        <div
          ref={groupRef}
          role="radiogroup"
          aria-labelledby={`${id}-label`}
          aria-describedby={error ? `${id}-error` : undefined}
          className="grid flex-1 grid-cols-5 gap-1 min-[400px]:grid-cols-10"
        >
          {VALUES.map((v) => {
            const checked = value === v;
            const highlighted = value !== null && v <= value;
            return (
              // biome-ignore lint/a11y/useSemanticElements: custom radios need roving focus, highlight-up-to and tap-to-clear that native inputs cannot express
              <button
                key={v}
                type="button"
                role="radio"
                data-value={v}
                aria-checked={checked}
                aria-label={`${v} out of ${RATING_MAX}`}
                tabIndex={v === tabbable ? 0 : -1}
                disabled={disabled}
                onFocus={() => setFocusIndex(v)}
                onKeyDown={(e) => onKeyDown(e, v)}
                onClick={() => select(checked ? null : v)}
                className={cn(
                  'hit-target pressable rounded-xl border text-body font-semibold tabular-nums transition-colors duration-150',
                  highlighted
                    ? 'bg-tint border-tint text-tint-contrast'
                    : 'bg-bg-grouped-secondary border-card-border text-label',
                  checked && 'ring-2 ring-tint/40 ring-offset-2 ring-offset-bg-grouped',
                  disabled && 'opacity-40',
                )}
              >
                {v}
              </button>
            );
          })}
        </div>
      </div>
      <output aria-live="polite" className="visually-hidden">
        {announcement}
      </output>
      {error && (
        <p id={`${id}-error`} role="alert" className="m-0 text-footnote text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
