## Decisions

- **File import, not OAuth.** Trakt's export already contains TMDB ids on every record, so no matching is needed and no Trakt API app has to be registered. An API-based sync can be layered on later using the same normalised record format.
- **Parse in the browser.** `fflate` unzips the export client-side; records are normalised there (including timezone-correct dates) and sent in batches of 200 so each request stays under the API's 100 KB body limit. The API never sees the raw export.
- **Idempotency by natural keys**: watch entries dedupe on (item, date, season); episode watches use the unique index; ratings only fill entries that have none. This makes re-runs safe and lets the owner resume after an interruption.
- **Import bypasses the aired check**: Trakt history is factual; the season endpoint's unaired validation does not apply.
- **Unsupported records are counted, not dropped silently**: watchlist, collection and per-episode ratings are shown in the summary so the owner knows what did not carry over.
