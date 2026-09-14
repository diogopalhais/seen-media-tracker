import { cn } from '../../lib/cn.js';

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  busy?: boolean;
  'aria-label': string;
}

/** iOS-style toggle. Rendered as a real switch for assistive tech; the thumb slides with a transform. */
export function Switch({ checked, onChange, disabled, busy, ...rest }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-busy={busy || undefined}
      aria-label={rest['aria-label']}
      disabled={disabled || busy}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-[31px] w-[51px] shrink-0 cursor-pointer items-center rounded-full border-0 p-0 transition-colors duration-200',
        checked ? 'bg-success' : 'bg-fill',
        (disabled || busy) && 'cursor-default opacity-50',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'absolute left-[2px] top-[2px] size-[27px] rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,0.15),0_1px_1px_rgba(0,0,0,0.16)] transition-transform duration-200',
          checked && 'translate-x-5',
        )}
      />
    </button>
  );
}
