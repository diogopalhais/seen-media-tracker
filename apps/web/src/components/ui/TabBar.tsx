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
 * Floating glass pill on compact widths, with the active tab highlighted as an inner pill;
 * a leading sidebar from 768px. Reselecting the active tab pops it to its root.
 */
export function TabBar({ tabs, activeId, onSelect }: TabBarProps) {
  return (
    <nav
      aria-label="Main"
      className={cn(
        'glass absolute inset-x-5 z-40 rounded-full',
        'bottom-[calc(env(safe-area-inset-bottom,0px)+0.75rem)]',
        'md:static md:inset-auto md:h-full md:w-64 md:shrink-0 md:rounded-none md:border-0 md:border-r md:border-separator md:bg-bg-grouped md:shadow-none md:[backdrop-filter:none] md:safe-top',
      )}
    >
      <ul className="m-0 flex list-none p-1.5 md:flex-col md:gap-1 md:p-3 md:pt-6">
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
                  'pressable flex h-12 w-full flex-col items-center justify-center gap-0.5 rounded-full transition-colors duration-200 md:h-11 md:flex-row md:justify-start md:gap-3 md:rounded-xl md:px-3',
                  active ? 'bg-fill text-label' : 'text-label-secondary hover:text-label',
                )}
              >
                <IconCmp
                  weight={active ? 'fill' : 'regular'}
                  className="size-6"
                  aria-hidden="true"
                />
                <span
                  className={cn(
                    'text-[0.6875rem] md:text-body',
                    active ? 'font-semibold' : 'font-medium md:font-normal',
                  )}
                >
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
