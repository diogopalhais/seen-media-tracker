## Why

The personal website shows "latest movies watched" and "latest shows watched" as two lists, like Trakt. The public feed mixes both and can only be split client-side by over-fetching.

## What Changes

- The public recent feed accepts `type=movie|tv` (default `all`) and returns only that media type, with `limit` applying after the filter.

## Capabilities

### Modified Capabilities

- `public-recent-api`: optional media type filter.

## Impact

- Shared query schema, repository where-clause, README. Additive to the v1 contract; caching and ETag behaviour unchanged per URL.
