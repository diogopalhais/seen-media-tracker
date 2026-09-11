import { FilmStrip, Gear, MagnifyingGlass } from '@phosphor-icons/react';
import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { type Location, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router';
import { Banner } from '../components/ui/Banner.js';
import { TabBar, type TabDefinition } from '../components/ui/TabBar.js';
import { useIsAuthenticated } from '../lib/auth.js';
import { useOnline } from '../lib/online.js';
import { LibraryItemScreen } from '../screens/LibraryItemScreen.js';
import { LibraryScreen } from '../screens/LibraryScreen.js';
import { NotFoundScreen } from '../screens/NotFoundScreen.js';
import { SearchScreen } from '../screens/SearchScreen.js';
import { SeasonScreen } from '../screens/SeasonScreen.js';
import { SettingsScreen } from '../screens/SettingsScreen.js';
import { TitleScreen } from '../screens/TitleScreen.js';

const TABS: TabDefinition[] = [
  { id: 'library', label: 'Library', icon: FilmStrip, rootPath: '/library' },
  { id: 'search', label: 'Search', icon: MagnifyingGlass, rootPath: '/search' },
  { id: 'settings', label: 'Settings', icon: Gear, rootPath: '/settings' },
];

function tabFor(pathname: string): TabDefinition | undefined {
  return TABS.find((t) => pathname === t.rootPath || pathname.startsWith(`${t.rootPath}/`));
}

const TAB_ROUTES: Record<string, ReactNode> = {
  library: (
    <>
      <Route path="/library" element={<LibraryScreen />} />
      <Route path="/library/:itemId" element={<LibraryItemScreen />} />
      <Route path="/library/:itemId/season/:seasonNumber" element={<SeasonScreen />} />
    </>
  ),
  search: (
    <>
      <Route path="/search" element={<SearchScreen />} />
      <Route path="/search/:mediaType/:tmdbId" element={<TitleScreen />} />
      <Route path="/search/tv/:tmdbId/season/:seasonNumber" element={<SeasonScreen />} />
    </>
  ),
  settings: <Route path="/settings" element={<SettingsScreen />} />,
};

export function RequireAuth({ children }: { children: ReactNode }) {
  const authenticated = useIsAuthenticated();
  const location = useLocation();
  if (!authenticated)
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <>{children}</>;
}

/**
 * Every tab keeps its own route tree mounted at the last location it showed, so switching tabs and
 * back restores the screen and its scroll position. Inactive panes are hidden with visibility (not
 * display:none, which would reset scroll) and made inert for keyboard and assistive tech.
 */
function TabPane({
  tab,
  active,
  location,
}: {
  tab: TabDefinition;
  active: boolean;
  location: Location | { pathname: string };
}) {
  const paneRef = useRef<HTMLDivElement>(null);
  const positions = useRef(new Map<string, number>());
  const lastKey = useRef<string>('');
  const key = 'key' in location ? location.key : location.pathname;

  useLayoutEffect(() => {
    const el = paneRef.current;
    if (!el) return;
    if (lastKey.current && lastKey.current !== key)
      positions.current.set(lastKey.current, el.scrollTop);
    if (lastKey.current !== key) {
      el.scrollTop = positions.current.get(key) ?? 0;
      lastKey.current = key;
    }
  }, [key]);

  return (
    <div
      ref={paneRef}
      data-pane={tab.id}
      role="tabpanel"
      aria-label={tab.label}
      aria-hidden={!active}
      inert={!active}
      className="absolute inset-0 overflow-y-auto overscroll-contain no-scrollbar bg-bg-grouped"
      style={active ? undefined : { visibility: 'hidden', pointerEvents: 'none' }}
    >
      <Routes location={location}>{TAB_ROUTES[tab.id]}</Routes>
    </div>
  );
}

export function RootLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const online = useOnline();
  const activeTab = tabFor(location.pathname);
  const [lastLocations, setLastLocations] = useState<Record<string, Location>>({});

  useEffect(() => {
    if (activeTab)
      setLastLocations((prev) =>
        prev[activeTab.id] === location ? prev : { ...prev, [activeTab.id]: location },
      );
  }, [activeTab, location]);

  const onSelect = (tab: TabDefinition, reselect: boolean) => {
    if (reselect) {
      if (location.pathname !== tab.rootPath) navigate(tab.rootPath);
      return;
    }
    const remembered = lastLocations[tab.id];
    navigate(remembered ? remembered.pathname + remembered.search : tab.rootPath);
  };

  if (!activeTab) {
    return (
      <div className="flex h-full md:flex-row">
        <TabBar tabs={TABS} activeId="" onSelect={onSelect} />
        <main className="relative min-w-0 flex-1 overflow-y-auto">
          <NotFoundScreen />
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-full md:flex-row">
      <TabBar tabs={TABS} activeId={activeTab.id} onSelect={onSelect} />
      <main className="relative min-w-0 flex-1">
        {!online && (
          <div className="pointer-events-none fixed inset-x-0 top-[env(safe-area-inset-top,0px)] z-50 md:left-64">
            <Banner tone="offline" className="pointer-events-auto mx-auto max-w-md">
              You're offline. Showing what was saved on this device.
            </Banner>
          </div>
        )}
        {TABS.map((tab) => (
          <TabPane
            key={tab.id}
            tab={tab}
            active={tab.id === activeTab.id}
            location={
              tab.id === activeTab.id
                ? location
                : (lastLocations[tab.id] ?? { pathname: tab.rootPath })
            }
          />
        ))}
      </main>
    </div>
  );
}
