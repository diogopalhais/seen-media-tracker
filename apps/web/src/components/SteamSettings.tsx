import { ArrowsClockwise, ClockCounterClockwise, GameController } from '@phosphor-icons/react';
import type { SteamSyncResult } from '@seen/shared';
import { useState } from 'react';
import { ApiError } from '../lib/api.js';
import { formatRelativeDate } from '../lib/format.js';
import { useSteamEnabled, useSteamStatusQuery, useSteamSyncMutation } from '../lib/queries.js';
import { AlertDialog } from './ui/AlertDialog.js';
import { InsetGroupedList, Row } from './ui/InsetGroupedList.js';

function describe(kind: 'sync' | 'import', r: SteamSyncResult): string {
  const parts = [
    r.sessions > 0
      ? `${r.sessions} ${r.sessions === 1 ? 'session' : 'sessions'} ${kind === 'import' ? 'imported' : 'recorded'}`
      : kind === 'import'
        ? 'Nothing left to import'
        : 'No new play time',
    r.linked > 0 ? `${r.linked} ${r.linked === 1 ? 'game' : 'games'} added to your library` : null,
    r.unmatched > 0 ? `${r.unmatched} not on IGDB` : null,
  ];
  return `${parts.filter(Boolean).join(' · ')}.`;
}

/** Settings section for the owner's Steam account. Hidden when the server has no Steam credentials. */
export function SteamSettings() {
  const enabled = useSteamEnabled();
  const status = useSteamStatusQuery(enabled);
  const run = useSteamSyncMutation();
  const [result, setResult] = useState<string | null>(null);
  const [confirmImport, setConfirmImport] = useState(false);
  if (!enabled) return null;
  const s = status.data;

  const go = async (kind: 'sync' | 'import') => {
    setResult(null);
    try {
      setResult(describe(kind, await run.mutateAsync(kind)));
    } catch (err) {
      setResult(err instanceof ApiError ? err.message : 'Could not reach Steam.');
    }
  };

  const today = new Date().toISOString().slice(0, 10);
  const account = s?.personaName ?? s?.steamId ?? 'Steam';
  const detail = s
    ? s.nowPlaying
      ? `Now playing ${s.nowPlaying.name}`
      : s.lastSyncAt
        ? `Synced ${formatRelativeDate(s.lastSyncAt.slice(0, 10), today)} · ${s.gamesLinked} of ${s.gamesPlayed} played games in your library`
        : 'Not synced yet'
    : status.isError
      ? 'Steam status unavailable'
      : 'Checking…';
  const pending = s && s.gamesPlayed > s.gamesLinked ? s.gamesPlayed - s.gamesLinked : 0;

  return (
    <InsetGroupedList
      header="Steam"
      footer={
        result ??
        'Every hour, new play time becomes a play session on the game. The first sync brought in every game you have played with its total hours, dated on the last day you played it.'
      }
    >
      <Row
        label={account}
        detail={detail}
        icon={<GameController className="size-5" aria-hidden="true" />}
      />
      <Row
        label="Sync now"
        icon={<ArrowsClockwise className="size-5" aria-hidden="true" />}
        onPress={() => void go('sync')}
        disabled={run.isPending}
        chevron={false}
      />
      <Row
        label="Look for missing games"
        detail={
          pending > 0
            ? `${pending} played ${pending === 1 ? 'game' : 'games'} not found on IGDB yet`
            : 'Every played game is in your library'
        }
        icon={<ClockCounterClockwise className="size-5" aria-hidden="true" />}
        onPress={() => setConfirmImport(true)}
        disabled={run.isPending}
        chevron={false}
      />
      <AlertDialog
        open={confirmImport}
        onOpenChange={setConfirmImport}
        title="Look for missing games?"
        description="Asks IGDB again about the played games it did not know last time, and records their hours if it does now. Running it again never duplicates."
        confirmLabel="Look again"
        loading={run.isPending}
        onConfirm={() => {
          setConfirmImport(false);
          void go('import');
        }}
      />
    </InsetGroupedList>
  );
}
