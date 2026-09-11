import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';
import { cn } from '../../lib/cn.js';

interface FieldShellProps {
  label: string;
  htmlFor: string;
  error?: string | undefined;
  hint?: ReactNode;
  children: ReactNode;
}

export function FieldShell({ label, htmlFor, error, hint, children }: FieldShellProps) {
  return (
    <div className="flex flex-col gap-0.5 py-1.5">
      <label
        htmlFor={htmlFor}
        className="text-footnote font-semibold uppercase tracking-[0.05em] text-label-secondary"
      >
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="m-0 text-footnote text-destructive">
          {error}
        </p>
      ) : (
        hint && <p className="m-0 text-footnote text-label-tertiary">{hint}</p>
      )}
    </div>
  );
}

const fieldClass =
  'min-h-[3rem] w-full rounded-xl border border-card-border bg-bg-grouped-secondary px-3 text-body text-label shadow-[var(--shadow-card)] placeholder:text-label-tertiary focus:outline-none focus-visible:outline-none focus:ring-2 focus:ring-tint/50 aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-destructive/60';

export interface DateFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | undefined;
  max?: string;
}

export function DateField({
  id,
  label,
  value,
  onChange,
  error,
  max,
  className,
  ...rest
}: DateFieldProps) {
  return (
    <FieldShell label={label} htmlFor={id} error={error}>
      <input
        id={id}
        type="date"
        value={value}
        max={max}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(
          fieldClass,
          'appearance-none [&::-webkit-date-and-time-value]:text-left',
          className,
        )}
        {...rest}
      />
    </FieldShell>
  );
}

export interface TextAreaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | undefined;
  maxLength?: number;
}

export function TextArea({
  id,
  label,
  value,
  onChange,
  error,
  maxLength,
  className,
  ...rest
}: TextAreaProps) {
  const remaining = maxLength !== undefined ? maxLength - value.length : undefined;
  return (
    <FieldShell
      label={label}
      htmlFor={id}
      error={error}
      hint={remaining !== undefined && remaining < 200 ? `${remaining} characters left` : undefined}
    >
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength}
        rows={3}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(fieldClass, 'resize-y py-1.5 leading-[1.3]', className)}
        {...rest}
      />
    </FieldShell>
  );
}

export interface SelectFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  error?: string | undefined;
}

export function SelectField({ id, label, value, onChange, options, error }: SelectFieldProps) {
  return (
    <FieldShell label={label} htmlFor={id} error={error}>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        className={cn(
          fieldClass,
          'appearance-none pr-8 bg-[url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 20 20%27 fill=%27%238e8e93%27%3E%3Cpath d=%27M6 8l4 4 4-4%27 stroke=%27%238e8e93%27 stroke-width=%272%27 fill=%27none%27/%3E%3C/svg%3E")] bg-[length:1.25rem] bg-[right_0.5rem_center] bg-no-repeat',
        )}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}
