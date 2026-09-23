import {
  ArrowSquareOut,
  DownloadSimple,
  FileArrowUp,
  PlusSquare,
  ShareNetwork,
  SignOut,
} from '@phosphor-icons/react';
import { TMDB_ATTRIBUTION, TMDB_SITE_BASE } from '@seen/shared';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ImportTraktSheet } from '../components/ImportTraktSheet.js';
import { NotificationsSettings } from '../components/NotificationsSettings.js';
import { SteamSettings } from '../components/SteamSettings.js';
import { AlertDialog } from '../components/ui/AlertDialog.js';
import { InsetGroupedList, Row } from '../components/ui/InsetGroupedList.js';
import { Screen } from '../components/ui/NavBar.js';
import { SegmentedControl } from '../components/ui/SegmentedControl.js';
import { promptInstall, useInstallState } from '../lib/pwa.js';
import { useLogoutMutation } from '../lib/queries.js';
import { type ThemePreference, useThemePreference } from '../lib/theme.js';
import { tokenStore } from '../lib/token-store.js';

const APP_VERSION = __APP_VERSION__;

export function SettingsScreen() {
  const [theme, setTheme] = useThemePreference();
  const install = useInstallState();
  const logout = useLogoutMutation();
  const navigate = useNavigate();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const doLogout = async () => {
    try {
      await logout.mutateAsync();
    } catch {
      // The session is discarded locally either way.
    }
    tokenStore.clear('logout');
    setConfirmLogout(false);
    navigate('/login', { replace: true });
  };

  return (
    <Screen title="Settings" large>
      <InsetGroupedList
        header="Appearance"
        footer="System follows your device's light or dark mode."
      >
        <li>
          <div className="flex min-h-[2.75rem] items-center gap-2 px-4 py-2">
            <SegmentedControl<ThemePreference>
              ariaLabel="Appearance"
              value={theme}
              onChange={setTheme}
              segments={[
                { value: 'system', label: 'System' },
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
              ]}
            />
          </div>
        </li>
      </InsetGroupedList>

      {install.kind === 'prompt' && (
        <InsetGroupedList
          header="Install"
          footer="Adds Seen to your home screen or dock and opens it in its own window."
        >
          <Row
            label="Install Seen"
            icon={<DownloadSimple className="size-5" aria-hidden="true" />}
            onPress={() => void promptInstall()}
            chevron={false}
          />
        </InsetGroupedList>
      )}
      {install.kind === 'ios' && (
        <InsetGroupedList
          header="Install"
          footer="Once installed, Seen opens full screen from your home screen and stays logged in."
        >
          <li>
            <ol className="m-0 flex flex-col gap-2 px-4 py-3 text-subheadline text-label">
              <li className="flex items-center gap-1">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-fill text-caption1 font-semibold">
                  1
                </span>
                Tap <ShareNetwork className="size-5 text-tint" aria-label="Share" />{' '}
                <span className="font-medium">Share</span> in Safari's toolbar
              </li>
              <li className="flex items-center gap-1">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-fill text-caption1 font-semibold">
                  2
                </span>
                Choose <PlusSquare className="size-5 text-label" aria-hidden="true" />{' '}
                <span className="font-medium">Add to Home Screen</span>
              </li>
              <li className="flex items-center gap-1">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-fill text-caption1 font-semibold">
                  3
                </span>
                Tap <span className="font-medium">Add</span>
              </li>
            </ol>
          </li>
        </InsetGroupedList>
      )}

      <NotificationsSettings />

      <SteamSettings />

      <InsetGroupedList
        header="Your data"
        footer="Bring your history and ratings over from Trakt. Running it again never duplicates."
      >
        <Row
          label="Import from Trakt"
          detail="From the Trakt data export (zip or JSON)"
          icon={<FileArrowUp className="size-5" aria-hidden="true" />}
          onPress={() => setImportOpen(true)}
        />
      </InsetGroupedList>

      <InsetGroupedList header="About" footer={TMDB_ATTRIBUTION}>
        <Row label="Version" value={APP_VERSION} />
        <Row
          label={
            <span className="flex items-center gap-1">
              <span className="rounded-[3px] bg-[#01b4e4] px-[5px] py-[1px] text-caption2 font-bold tracking-wide text-[#0d253f]">
                TMDB
              </span>
              Metadata from TMDB
            </span>
          }
          href={TMDB_SITE_BASE}
          external
          icon={<ArrowSquareOut className="size-5" aria-hidden="true" />}
        />
      </InsetGroupedList>

      <InsetGroupedList header="Account">
        <Row
          label="Log Out"
          destructive
          icon={<SignOut className="size-5 text-destructive" aria-hidden="true" />}
          onPress={() => setConfirmLogout(true)}
        />
      </InsetGroupedList>

      <ImportTraktSheet open={importOpen} onOpenChange={setImportOpen} />

      <AlertDialog
        open={confirmLogout}
        onOpenChange={setConfirmLogout}
        title="Log out of Seen?"
        description="You'll need your password to log back in."
        confirmLabel="Log Out"
        destructive
        loading={logout.isPending}
        onConfirm={() => void doLogout()}
      />
    </Screen>
  );
}
