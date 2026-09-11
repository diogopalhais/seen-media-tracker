import * as RadioGroup from '@radix-ui/react-radio-group';
import { cn } from '../../lib/cn.js';

export interface Segment<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  segments: Segment<T>[];
  ariaLabel: string;
  className?: string;
}

/** iOS segmented control on a Radix RadioGroup (arrow keys move, roving focus). */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  segments,
  ariaLabel,
  className,
}: SegmentedControlProps<T>) {
  return (
    <RadioGroup.Root
      value={value}
      onValueChange={(v) => onChange(v as T)}
      aria-label={ariaLabel}
      orientation="horizontal"
      className={cn('grid h-9 w-full rounded-full bg-fill p-[3px]', className)}
      style={{ gridTemplateColumns: `repeat(${segments.length}, minmax(0, 1fr))` }}
    >
      {segments.map((seg) => (
        <RadioGroup.Item
          key={seg.value}
          value={seg.value}
          className={cn(
            'relative truncate rounded-full px-2 text-[0.875rem] font-medium transition-colors duration-150',
            'data-[state=checked]:bg-bg-elevated data-[state=checked]:text-label data-[state=checked]:font-semibold data-[state=checked]:shadow-[0_1px_3px_rgba(0,0,0,0.1),0_0_0_1px_var(--card-border)]',
            'data-[state=unchecked]:text-label-secondary',
          )}
        >
          {seg.label}
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  );
}
