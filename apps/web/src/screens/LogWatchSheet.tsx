import type {
  LogWatchRequest,
  MediaType,
  Season,
  UpdateWatchRequest,
  WatchEntry,
  WatchMutationResponse,
} from '@seen/shared';
import { NOTE_MAX_LENGTH, todayLocalDateString, watchVerb } from '@seen/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Banner } from '../components/ui/Banner.js';
import { Button } from '../components/ui/Button.js';
import { DateField, SelectField, TextArea } from '../components/ui/Fields.js';
import { MediaTypeBadge } from '../components/ui/Media.js';
import { RatingPicker } from '../components/ui/RatingPicker.js';
import { Sheet } from '../components/ui/Sheet.js';
import { ApiError } from '../lib/api.js';
import { seasonLabel } from '../lib/format.js';
import { useLogWatchMutation, useUpdateWatchMutation } from '../lib/queries.js';

export interface WatchTarget {
  mediaType: MediaType;
  tmdbId: number;
  title: string;
  releaseYear: number | null;
  seasons: Season[] | null;
  numberOfSeasons: number | null;
}

export type SheetMode =
  | { kind: 'create'; initialSeason?: number }
  | { kind: 'edit'; entry: WatchEntry };

export interface LogWatchSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: WatchTarget;
  mode: SheetMode;
  onSaved?: ((res: WatchMutationResponse) => void) | undefined;
}

interface FormState {
  watchedOn: string;
  rating: number | null;
  season: string; // '' = whole series
  note: string;
}

function initialState(mode: SheetMode): FormState {
  if (mode.kind === 'edit') {
    return {
      watchedOn: mode.entry.watchedOn,
      rating: mode.entry.rating,
      season: mode.entry.season === null ? '' : String(mode.entry.season),
      note: mode.entry.note ?? '',
    };
  }
  return {
    watchedOn: todayLocalDateString(),
    rating: null,
    season: mode.initialSeason === undefined ? '' : String(mode.initialSeason),
    note: '',
  };
}

export function LogWatchSheet({ open, onOpenChange, target, mode, onSaved }: LogWatchSheetProps) {
  const verb = watchVerb(target.mediaType);
  const [form, setForm] = useState<FormState>(() => initialState(mode));
  const [initial, setInitial] = useState<FormState>(form);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<{ tone: 'error' | 'offline'; message: string } | null>(
    null,
  );
  const logWatch = useLogWatchMutation();
  const updateWatch = useUpdateWatchMutation();
  const pending = logWatch.isPending || updateWatch.isPending;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const resetKey =
    mode.kind === 'edit' ? `edit:${mode.entry.id}` : `create:${target.mediaType}:${target.tmdbId}`;

  // Reset when the sheet opens for a (possibly different) entry.
  // biome-ignore lint/correctness/useExhaustiveDependencies: resetKey deliberately re-runs the reset when the target or entry changes
  useEffect(() => {
    if (open) {
      const next = initialState(modeRef.current);
      setForm(next);
      setInitial(next);
      setFieldErrors({});
      setFormError(null);
    }
  }, [open, resetKey]);

  const dirty = useMemo(
    () =>
      form.watchedOn !== initial.watchedOn ||
      form.rating !== initial.rating ||
      form.season !== initial.season ||
      form.note !== initial.note,
    [form, initial],
  );

  const seasonOptions = useMemo(() => {
    if (target.mediaType !== 'tv') return [];
    const opts: { value: string; label: string }[] = [{ value: '', label: 'Whole series' }];
    if (target.seasons && target.seasons.length > 0) {
      for (const s of target.seasons) {
        opts.push({
          value: String(s.seasonNumber),
          label: `${s.isSpecials ? 'Specials' : s.name || `Season ${s.seasonNumber}`}${s.episodeCount ? ` · ${s.episodeCount} ep` : ''}`,
        });
      }
    } else if (target.numberOfSeasons) {
      for (let n = 1; n <= target.numberOfSeasons; n++)
        opts.push({ value: String(n), label: `Season ${n}` });
    }
    if (form.season && !opts.some((o) => o.value === form.season)) {
      opts.push({ value: form.season, label: seasonLabel(Number(form.season)) });
    }
    return opts;
  }, [target, form.season]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setFieldErrors((e) => {
      const { [key]: _drop, ...rest } = e;
      return rest;
    });
    setFormError(null);
  };

  const handleError = (err: unknown) => {
    if (err instanceof ApiError) {
      if (err.code === 'validation_error') {
        const errors = err.fieldErrors();
        setFieldErrors(errors);
        if (Object.keys(errors).length === 0) setFormError({ tone: 'error', message: err.message });
        return;
      }
      if (err.isOffline) {
        setFormError({
          tone: 'offline',
          message:
            "You're offline. Your watch hasn't been saved — try again when you're back online.",
        });
        return;
      }
      if (err.status === 401) return; // the auth guard takes over
      setFormError({ tone: 'error', message: err.message });
      return;
    }
    setFormError({ tone: 'error', message: 'Something went wrong. Please try again.' });
  };

  const save = async () => {
    if (pending) return;
    setFormError(null);
    const rating = form.rating;
    const season = target.mediaType === 'tv' && form.season !== '' ? Number(form.season) : null;
    const note = form.note.trim() === '' ? null : form.note.trim();
    try {
      let res: WatchMutationResponse;
      if (mode.kind === 'create') {
        const body: LogWatchRequest = {
          mediaType: target.mediaType,
          tmdbId: target.tmdbId,
          watchedOn: form.watchedOn,
          rating,
          ...(target.mediaType === 'tv' ? { season } : {}),
          note,
        };
        res = await logWatch.mutateAsync(body);
      } else {
        const body: UpdateWatchRequest = {
          watchedOn: form.watchedOn,
          rating,
          note,
          ...(target.mediaType === 'tv' ? { season } : {}),
        };
        res = await updateWatch.mutateAsync({ id: mode.entry.id, body });
      }
      setInitial(form);
      onOpenChange(false);
      onSaved?.(res);
    } catch (err) {
      handleError(err);
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={
        mode.kind === 'create'
          ? `Log ${verb.past === 'Played' ? 'Play' : 'Watch'}`
          : `Edit ${verb.past === 'Played' ? 'Play' : 'Watch'}`
      }
      dirty={dirty && !pending}
      trailing={
        <Button
          variant="filled"
          className="pill -mr-1 h-9 px-4 text-subheadline"
          onClick={save}
          loading={pending}
          disabled={!form.watchedOn}
        >
          Save
        </Button>
      }
    >
      <form
        className="safe-x flex flex-col gap-3 pb-6 pt-1"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="flex items-center gap-3 px-1 py-1">
          <div className="min-w-0 flex-1">
            <p className="display m-0 truncate text-title3">{target.title}</p>
            <p className="m-0 flex items-center gap-2 text-footnote text-label-secondary">
              {target.releaseYear && <span>{target.releaseYear}</span>}
              <MediaTypeBadge mediaType={target.mediaType} />
            </p>
          </div>
        </div>

        {formError && (
          <Banner tone={formError.tone} className="mx-0">
            {formError.message}
          </Banner>
        )}

        <div className="card flex flex-col px-4 py-1">
          <DateField
            id="watchedOn"
            label={`Date ${verb.past.toLowerCase()}`}
            value={form.watchedOn}
            max={todayLocalDateString()}
            onChange={(v) => update('watchedOn', v)}
            error={fieldErrors.watchedOn}
            required
          />
        </div>

        <div className="card flex flex-col px-4 py-1">
          <RatingPicker
            value={form.rating}
            onChange={(v) => update('rating', v)}
            error={fieldErrors.rating}
            disabled={pending}
          />
        </div>

        <div className="card flex flex-col px-4 py-1">
          {target.mediaType === 'tv' && (
            <SelectField
              id="season"
              label="Season"
              value={form.season}
              onChange={(v) => update('season', v)}
              options={seasonOptions}
              error={fieldErrors.season}
            />
          )}

          <TextArea
            id="note"
            label="Note"
            placeholder="Anything worth remembering?"
            value={form.note}
            onChange={(v) => update('note', v)}
            maxLength={NOTE_MAX_LENGTH}
            error={fieldErrors.note}
          />
        </div>

        <Button
          type="submit"
          variant="filled"
          size="large"
          block
          loading={pending}
          disabled={!form.watchedOn}
          className="pill mt-1"
        >
          {mode.kind === 'create' ? 'Save Watch' : 'Save Changes'}
        </Button>
      </form>
    </Sheet>
  );
}
