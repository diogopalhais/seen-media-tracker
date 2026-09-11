import { z } from 'zod';

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Returns true when `value` is a real calendar date in `YYYY-MM-DD` form. */
export function isValidDateString(value: string): boolean {
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

/**
 * The latest calendar date that is "today" anywhere on Earth (UTC+14).
 * Used to reject future dates without knowing the client's timezone.
 */
export function latestTodayOnEarth(now: Date = new Date()): string {
  const shifted = new Date(now.getTime() + 14 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}

/** Today's date in the device's local timezone, as `YYYY-MM-DD`. */
export function todayLocalDateString(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export const DateStringSchema = z
  .string()
  .refine(isValidDateString, 'Date must be a valid YYYY-MM-DD calendar date');

/** A calendar date that is not later than today (anywhere on Earth). */
export const PastOrTodayDateSchema = DateStringSchema.refine(
  (value) => value <= latestTodayOnEarth(),
  'Date cannot be in the future',
);
