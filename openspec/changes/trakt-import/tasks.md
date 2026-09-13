## 1. Contracts and API
- [x] 1.1 Shared `TraktImportRecordSchema` (discriminated union), request and result schemas
- [x] 1.2 `POST /api/v1/import/trakt`: grouping by title, TMDB lookup via cached provider, idempotent inserts for entries, episode watches and ratings, per-record failure reporting
- [x] 1.3 Integration tests for plays, episodes, ratings, duplicates, unknown ids, validation

## 2. Web
- [x] 2.1 `lib/trakt.ts`: zip/JSON reading with fflate, record detection and normalisation, local-date conversion; unit tests with sample records
- [x] 2.2 Import sheet in Settings: instructions, file picker, preview, batched import with progress, summary; invalidate library queries on completion

## 3. Verification
- [x] 3.1 Lint, typecheck, tests, build; manual run with a synthetic export zip; commit and push with CI green
