import { MagnifyingGlass, XCircle } from '@phosphor-icons/react';
import type { InputHTMLAttributes } from 'react';
import { cn } from '../../lib/cn.js';

export interface SearchFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
}

/** Rounded search field with leading glass and a clear button; type=search yields a Search key on iOS. */
export function SearchField({
  value,
  onChange,
  onClear,
  className,
  placeholder = 'Search',
  ...rest
}: SearchFieldProps) {
  return (
    <div
      className={cn(
        'relative flex h-11 items-center rounded-2xl border border-card-border bg-bg-grouped-secondary shadow-[var(--shadow-card)] focus-within:ring-2 focus-within:ring-tint/40',
        className,
      )}
    >
      <MagnifyingGlass
        weight="bold"
        className="pointer-events-none absolute left-3 size-[1.125rem] text-label-tertiary"
        aria-hidden="true"
      />
      <input
        type="search"
        inputMode="search"
        enterKeyHint="search"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-full w-full appearance-none bg-transparent pl-10 pr-10 text-body text-label placeholder:text-label-secondary focus:outline-none [&::-webkit-search-cancel-button]:hidden"
        {...rest}
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            onChange('');
            onClear?.();
          }}
          className="hit-target pressable absolute right-0 flex items-center justify-center text-label-tertiary"
        >
          <XCircle weight="fill" className="size-5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
