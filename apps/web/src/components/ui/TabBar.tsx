import type { Icon } from '@phosphor-icons/react';
import { cn } from '../../lib/cn.js';

export interface TabDefinition {
  id: string;
  label: string;
  icon: Icon;
  rootPath: string;
}

export interface TabBarProps {
  tabs: TabDefinition[];
  activeId: string;
  onSelect: (tab: TabDefinition, reselect: boolean) => void;
}

/**
 * Bottom tab bar on compact widths (background extends into the home-indicator inset),
 * leading sidebar from 768px. Active tab: tint colour + filled icon. Reselecting pops to root.
 */
export function TabBar({ tabs, activeId, onSelect }: TabBarProps) {
  return (
    <nav
      aria-label="Main"
      className={cn(
        'glass fixed inset-x-4 z-40 rounded-[1.75rem]',
        'bottom-[calc(env(safe-area-inset-bottom,0px)+0.75rem)]',
        'md:static md:inset-auto md:h-full md:w-64 md:shrink-0 md:rounded-none md:border-0 md:border-r md:border-separator md:bg-bg-grouped md:shadow-none md:[backdrop-filter:none] md:safe-top',
      )}
    >
      <ul className="m-0 flex list-none p-1 md:flex-col md:gap-1 md:p-3 md:pt-6">
        {tabs.map((tab) => {
          const active = tab.id === activeId;
          const IconCmp = tab.icon;
          return (
            <li key={tab.id} className="flex-1 md:flex-none">
              <button
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => onSelect(tab, active)}
                className={cn(
                  'pressable flex h-[3.0625rem] w-full flex-col items-center justify-center gap-0.5 md:h-11 md:flex-row md:justify-start md:gap-1.5 md:rounded-control md:px-1.5',
                  active ? 'text-tint md:bg-fill-secondary' : 'text-gray md:text-label',
                )}
              >
                <IconCmp
                  weight={active ? 'fill' : 'regular'}
                  className="size-7 md:size-6"
                  aria-hidden="true"
                />
                <span className="text-caption2 font-medium md:text-body md:font-normal">
                  {tab.label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
