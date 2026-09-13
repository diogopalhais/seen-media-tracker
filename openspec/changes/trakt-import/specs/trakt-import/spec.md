## Purpose

Brings the owner's Trakt history and ratings into Seen from Trakt's data export, mapped onto library items, watch entries, episode watches and ratings, without duplicates.

## ADDED Requirements

### Requirement: Client-side parsing of the Trakt export
The web app SHALL accept the Trakt data export as a zip file or as one or more JSON files. It SHALL recognise Trakt records by shape regardless of file name: history plays (`watched_at` with a `movie`, or an `episode` plus `show`), ratings (`rating` and `rated_at` with a `movie`, `show`, `season` or `episode`), and other lists (watchlist, collection). Dates SHALL be converted to calendar dates in the device's timezone. Records SHALL be normalised into: movie plays, episode plays, movie ratings, show ratings, season ratings; everything else SHALL be classified as unsupported, and records without a TMDB id as unmatched.

#### Scenario: Zip export parsed
- **WHEN** the owner picks the Trakt export zip
- **THEN** every JSON file inside is read and the preview shows counts of movie plays, episode plays, ratings, unsupported records and records without a TMDB id

#### Scenario: Loose JSON files
- **WHEN** the owner picks `history.json` and `ratings.json` directly
- **THEN** they are parsed the same way as the zip contents

#### Scenario: Unreadable file
- **WHEN** a file is neither a zip nor JSON containing Trakt records
- **THEN** the sheet shows an inline error and nothing is sent to the API

### Requirement: Import endpoint
The API SHALL expose a private `POST /api/v1/import/trakt` accepting 1 to 200 normalised records. For each record it SHALL create the library item from TMDB if needed and then: for a movie play, insert a watch entry on that date unless one already exists for the item and date; for an episode play, insert an episode watch unless present; for a movie rating, set the rating on the item's most recent entry when that entry has no rating, creating an entry dated the rating date if the movie has no entries; for a show or season rating, do the same on the series-level or season-level entry. Records whose TMDB id is unknown to TMDB SHALL be reported as failed without aborting the batch. The response SHALL report counts of items, entries, episode watches and ratings created, records skipped as duplicates, and a list of failures with title and reason.

#### Scenario: Movie plays
- **WHEN** two plays of the same movie on different dates are imported
- **THEN** one library item and two entries exist

#### Scenario: Idempotent re-import
- **WHEN** the same batch is imported twice
- **THEN** the second response reports everything as duplicates and nothing new is stored

#### Scenario: Episode plays create the series
- **WHEN** plays of S1 E1 and S1 E2 of a series not in the library are imported
- **THEN** the series item is created with two episode watches and no watch entry

#### Scenario: Rating without history
- **WHEN** a movie rating of 8 arrives for a movie with no plays
- **THEN** an entry dated the rating date is created with rating 8

#### Scenario: Rating does not overwrite
- **WHEN** a show rating arrives for a series whose series-level entry already carries a rating
- **THEN** the existing rating is kept and the record counts as a duplicate

#### Scenario: Unknown TMDB id
- **WHEN** a record's TMDB id is not found at TMDB
- **THEN** it appears in the failures list with its title and the rest of the batch is imported

#### Scenario: Validation
- **WHEN** the request has no records or more than 200
- **THEN** the API responds `400` with error code `validation_error`

### Requirement: Import flow in Settings
Settings SHALL offer "Import from Trakt", opening a sheet with brief instructions on getting the export from Trakt, a file picker, a preview of counts, an Import action, a progress indicator while batches are sent sequentially, and a final summary listing what was created, what was skipped and any failures. Import SHALL be resumable by simply running it again.

#### Scenario: Preview before import
- **WHEN** files are parsed
- **THEN** the sheet shows counts and the Import button, and nothing is imported until it is tapped

#### Scenario: Progress and summary
- **WHEN** the owner taps Import
- **THEN** batches are sent one after another with a progress bar and the summary appears when the last batch completes

#### Scenario: Library refreshed
- **WHEN** the import completes
- **THEN** the Library tab shows the imported titles without a reload
