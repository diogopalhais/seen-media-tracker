## Why

Season and series logs record that I watched something, but not where I am in a series. I want to tick off individual episodes so the app knows exactly where I stopped and tells me what to watch next.

## What Changes

- Add **episode watches**: each episode of a TV series can be marked watched or unwatched, individually or in bulk ("watched up to here", "mark season watched"), with the date.
- A TV series enters the library as soon as one episode is marked, even without a season or series log; it leaves the library only when it has neither logs nor episode watches.
- Title and library item screens show a **Continue watching** card with the next unwatched episode and overall progress; the season screen shows per-season progress and the checkmarks.
- Library cards show how many episodes have been watched for series tracked by episode.
- The public feed treats episode watches as watch events and gains an additive `episode` field.

## Capabilities

### New Capabilities

- `episode-progress`: Marking episodes watched, computing progress and the next episode to watch.

### Modified Capabilities

- `media-library`: Library membership, listing recency and item detail account for episode watches.
- `tv-seasons`: The season screen gains episode checkmarks, bulk marking and progress.
- `public-recent-api`: Episode watches count as recent activity and the item gains an `episode` field.
- `api-foundation`: The private CORS policy allows the `PUT` method used by the new endpoint.

## Impact

- API: new table `episode_watches` (migration), new endpoint `PUT /api/v1/watches/episodes`, additive fields on library item detail, library summaries and the public feed; library listing and deletion rules updated.
- Shared: episode watch schemas and a pure `computeProgress` helper used by the web app.
- Web: season screen checkmarks and bulk actions, Continue watching card on title and item screens, episode counts on library cards.
