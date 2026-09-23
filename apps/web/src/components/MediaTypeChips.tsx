import { SquaresFour } from '@phosphor-icons/react';
import * as RadioGroup from '@radix-ui/react-radio-group';
import type { MediaTypeFilter } from '@seen/shared';
import { cn } from '../lib/cn.js';
import { availableKinds, type MediaKind } from '../lib/mediaKinds.js';

export interface MediaTypeChipsProps {
  value: MediaTypeFilter;
  onChange: (value: MediaTypeFilter) => void;
  features: { games: boolean };
  className?: string;
}

/**
 * Scrollable filter chips, one per media kind plus "All". Each chip pairs the kind's glyph with its
 * name and, when selected, its accent colour, so a kind is recognisable by shape, word and colour
 * rather than colour alone. New kinds appear automatically from the registry.
 */
export function MediaTypeChips({ value, onChange, features, className }: MediaTypeChipsProps) {
  const kinds = availableKinds(features);
  return (
    <RadioGroup.Root
      value={value}
      onValueChange={(v) => onChange(v as MediaTypeFilter)}
      aria-label="Show"
      orientation="horizontal"
      className={cn(
        'no-scrollbar flex snap-x gap-2 overflow-x-auto px-margin py-1 md:px-[var(--spacing-margin-wide)]',
        className,
      )}
    >
      <Chip
        value="all"
        label="All"
        icon={SquaresFour}
        selectedClass="data-[state=checked]:bg-label data-[state=checked]:text-bg"
      />
      {kinds.map((k) => (
        <Chip
          key={k.type}
          value={k.type}
          label={k.short}
          icon={k.icon}
          selectedClass={k.selectedChipClass}
        />
      ))}
    </RadioGroup.Root>
  );
}

function Chip({
  value,
  label,
  icon: Icon,
  selectedClass,
}: {
  value: MediaTypeFilter;
  label: string;
  icon: MediaKind['icon'];
  /** Static Tailwind classes applied while checked (they must be literal for the compiler to see them). */
  selectedClass: string;
}) {
  return (
    <RadioGroup.Item
      value={value}
      data-kind={value}
      className={cn(
        'pressable inline-flex h-9 shrink-0 snap-start items-center gap-1.5 rounded-full border-0 px-3.5 text-subheadline font-semibold transition-colors duration-150',
        'bg-fill text-label-secondary data-[state=checked]:shadow-[0_1px_2px_rgba(0,0,0,0.12)]',
        selectedClass,
      )}
    >
      <Icon weight="fill" className="size-4" aria-hidden="true" />
      {label}
    </RadioGroup.Item>
  );
}
