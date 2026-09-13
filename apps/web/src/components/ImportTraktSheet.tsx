import { ArrowSquareOut, CheckCircle, FileArrowUp, WarningCircle } from '@phosphor-icons/react';
import {
  emptyImportResult,
  mergeImportResults,
  TRAKT_IMPORT_BATCH_MAX,
  type TraktImportResult,
} from '@seen/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { ApiError, api } from '../lib/api.js';
import { queryKeys } from '../lib/queries.js';
import { parseTraktFiles, type TraktParseSummary } from '../lib/trakt.js';
import { ProgressBar } from './Progress.js';
import { Button } from './ui/Button.js';
import { Sheet } from './ui/Sheet.js';

type Phase =
  | { step: 'pick'; error?: string }
  | { step: 'preview'; summary: TraktParseSummary }
  | { step: 'importing'; summary: TraktParseSummary; done: number; result: TraktImportResult }
  | { step: 'done'; summary: TraktParseSummary; result: TraktImportResult; error?: string };

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Trakt export → preview → batched import with progress → summary. Re-running is safe. */
export function ImportTraktSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [phase, setPhase] = useState<Phase>({ step: 'pick' });
  const inputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const onFiles = async (list: FileList | null) => {
    const files = Array.from(list ?? []);
    if (files.length === 0) return;
    try {
      const summary = await parseTraktFiles(files);
      setPhase({ step: 'preview', summary });
    } catch (err) {
      setPhase({
        step: 'pick',
        error: err instanceof Error ? err.message : 'Could not read those files.',
      });
    }
  };

  const runImport = async (summary: TraktParseSummary) => {
    let result = emptyImportResult();
    setPhase({ step: 'importing', summary, done: 0, result });
    try {
      for (let i = 0; i < summary.records.length; i += TRAKT_IMPORT_BATCH_MAX) {
        const batch = summary.records.slice(i, i + TRAKT_IMPORT_BATCH_MAX);
        const res = await api.importTrakt(batch);
        result = mergeImportResults(result, res);
        setPhase({
          step: 'importing',
          summary,
          done: Math.min(summary.records.length, i + batch.length),
          result,
        });
      }
      setPhase({ step: 'done', summary, result });
    } catch (err) {
      setPhase({
        step: 'done',
        summary,
        result,
        error:
          err instanceof ApiError
            ? `${err.message} — run the import again to resume; nothing is duplicated.`
            : 'Import interrupted — run it again to resume.',
      });
    } finally {
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.libraryAll }),
        qc.invalidateQueries({ queryKey: queryKeys.searchAll }),
        qc.invalidateQueries({ queryKey: queryKeys.discover }),
        qc.invalidateQueries({ queryKey: ['library-item'] }),
        qc.invalidateQueries({ queryKey: ['title'] }),
      ]);
    }
  };

  const reset = () => setPhase({ step: 'pick' });
  const busy = phase.step === 'importing';

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (busy) return;
        if (!o) reset();
        onOpenChange(o);
      }}
      title="Import from Trakt"
      cancelLabel={phase.step === 'done' ? 'Done' : 'Cancel'}
    >
      <div className="safe-x flex flex-col gap-3 pb-6 pt-1">
        {phase.step === 'pick' && (
          <>
            <div className="card flex flex-col gap-2 px-4 py-4 text-subheadline text-label-secondary">
              <p className="m-0 text-body font-semibold text-label">Get your export from Trakt</p>
              <ol className="m-0 flex list-decimal flex-col gap-1 pl-5">
                <li>
                  Open{' '}
                  <a
                    href="https://trakt.tv/settings/data"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-tint"
                  >
                    trakt.tv/settings/data{' '}
                    <ArrowSquareOut className="size-3.5" aria-hidden="true" />
                  </a>
                </li>
                <li>Request the data export and download the zip when it is ready.</li>
                <li>Pick the zip here (or the JSON files inside it).</li>
              </ol>
              <p className="m-0 text-footnote text-label-tertiary">
                Movie plays become watches, episode plays become ticked episodes, and your movie,
                show and season ratings carry over. Watchlist and episode ratings are not imported
                yet.
              </p>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".zip,.json,application/zip,application/json"
              multiple
              className="visually-hidden"
              onChange={(e) => void onFiles(e.target.files)}
            />
            <Button
              variant="filled"
              size="large"
              block
              className="pill"
              icon={<FileArrowUp weight="bold" className="size-5" aria-hidden="true" />}
              onClick={() => inputRef.current?.click()}
            >
              Choose export files
            </Button>
            {phase.error && (
              <p role="alert" className="m-0 flex items-start gap-2 text-footnote text-destructive">
                <WarningCircle
                  weight="fill"
                  className="mt-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
                {phase.error}
              </p>
            )}
          </>
        )}

        {(phase.step === 'preview' || phase.step === 'importing' || phase.step === 'done') && (
          <div className="card flex flex-col gap-3 px-4 py-4">
            <p className="m-0 text-footnote font-semibold uppercase tracking-[0.05em] text-label-secondary">
              {phase.step === 'preview'
                ? 'Ready to import'
                : phase.step === 'importing'
                  ? 'Importing…'
                  : 'Import complete'}
            </p>
            <Counts
              summary={phase.summary}
              result={phase.step === 'preview' ? null : phase.result}
            />
            {phase.step === 'importing' && (
              <div className="flex flex-col gap-1">
                <ProgressBar value={phase.done} max={phase.summary.records.length} />
                <span className="text-caption1 tabular-nums text-label-secondary">
                  {phase.done} of {phase.summary.records.length} records
                </span>
              </div>
            )}
            {phase.step === 'done' && phase.error && (
              <p role="alert" className="m-0 text-footnote text-destructive">
                {phase.error}
              </p>
            )}
            {phase.step === 'done' && phase.result.failures.length > 0 && (
              <details className="text-footnote text-label-secondary">
                <summary className="cursor-pointer font-medium text-label">
                  {plural(phase.result.failures.length, 'title')} could not be imported
                </summary>
                <ul className="m-0 mt-2 flex list-none flex-col gap-1 p-0">
                  {phase.result.failures.slice(0, 50).map((f) => (
                    <li key={`${f.title}-${f.reason}`}>
                      <span className="text-label">{f.title}</span> · {f.reason}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}

        {phase.step === 'preview' && (
          <div className="flex gap-2">
            <Button variant="glass" size="large" className="pill" onClick={reset}>
              Choose again
            </Button>
            <Button
              variant="filled"
              size="large"
              className="pill flex-1"
              disabled={phase.summary.records.length === 0}
              onClick={() => void runImport(phase.summary)}
            >
              Import {plural(phase.summary.records.length, 'record')}
            </Button>
          </div>
        )}
        {phase.step === 'done' && (
          <Button
            variant="filled"
            size="large"
            block
            className="pill"
            icon={<CheckCircle weight="fill" className="size-5" aria-hidden="true" />}
            onClick={() => {
              reset();
              onOpenChange(false);
            }}
          >
            Done
          </Button>
        )}
      </div>
    </Sheet>
  );
}

function Counts({
  summary,
  result,
}: {
  summary: TraktParseSummary;
  result: TraktImportResult | null;
}) {
  const c = (kind: string) => summary.records.filter((r) => r.kind === kind).length;
  const rows: { label: string; value: string }[] = result
    ? [
        { label: 'Titles added', value: String(result.created.items) },
        { label: 'Watches added', value: String(result.created.entries) },
        { label: 'Episodes ticked', value: String(result.created.episodeWatches) },
        { label: 'Ratings applied', value: String(result.created.ratings) },
        { label: 'Already there', value: String(result.duplicates) },
      ]
    : [
        { label: 'Movie plays', value: String(c('movie_play')) },
        { label: 'Episode plays', value: String(c('episode_play')) },
        {
          label: 'Ratings',
          value: String(c('movie_rating') + c('show_rating') + c('season_rating')),
        },
      ];
  return (
    <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-2">
      {rows.map((r) => (
        <div key={r.label} className="flex flex-col">
          <dt className="text-caption1 text-label-tertiary">{r.label}</dt>
          <dd className="display m-0 text-title3 tabular-nums text-label">{r.value}</dd>
        </div>
      ))}
      {(summary.unsupported > 0 || summary.unmatched > 0) && (
        <div className="col-span-2 mt-1 text-footnote text-label-secondary">
          Skipped:{' '}
          {summary.unsupported > 0
            ? `${plural(summary.unsupported, 'unsupported record')} (watchlist, collection, episode ratings)`
            : ''}
          {summary.unsupported > 0 && summary.unmatched > 0 ? ' · ' : ''}
          {summary.unmatched > 0 ? `${plural(summary.unmatched, 'record')} without a TMDB id` : ''}
        </div>
      )}
    </dl>
  );
}
