import type { LibrarySort, MediaTypeFilter } from '@seen/shared';
import { SegmentedControl } from './ui/SegmentedControl.js';
import { Sheet } from './ui/Sheet.js';

export interface LibraryFilters {
  type: MediaTypeFilter;
  sort: LibrarySort;
}

export const DEFAULT_FILTERS: LibraryFilters = { type: 'all', sort: 'recent' };

export function isDefaultFilters(f: LibraryFilters): boolean {
  return f.type === DEFAULT_FILTERS.type && f.sort === DEFAULT_FILTERS.sort;
}

export interface FilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: LibraryFilters;
  onChange: (filters: LibraryFilters) => void;
}

/** Compact sheet for the rarely-touched library controls. Choosing a type applies and closes; sort stays open. */
export function FilterSheet({ open, onOpenChange, filters, onChange }: FilterSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Filter & Sort" cancelLabel="Done">
      <div className="safe-x flex flex-col gap-5 pb-6 pt-2">
        <div className="flex flex-col gap-2">
          <span
            id="filter-type-label"
            className="text-footnote font-semibold uppercase tracking-[0.05em] text-label-secondary"
          >
            Show
          </span>
          <SegmentedControl<MediaTypeFilter>
            ariaLabel="Filter by type"
            value={filters.type}
            onChange={(type) => {
              onChange({ ...filters, type });
              onOpenChange(false);
            }}
            segments={[
              { value: 'all', label: 'All' },
              { value: 'movie', label: 'Movies' },
              { value: 'tv', label: 'TV' },
            ]}
          />
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-footnote font-semibold uppercase tracking-[0.05em] text-label-secondary">
            Sort by
          </span>
          <SegmentedControl<LibrarySort>
            ariaLabel="Sort by"
            value={filters.sort}
            onChange={(sort) => onChange({ ...filters, sort })}
            segments={[
              { value: 'recent', label: 'Recent' },
              { value: 'title', label: 'Title' },
              { value: 'rating', label: 'Rating' },
            ]}
          />
        </div>
        {!isDefaultFilters(filters) && (
          <button
            type="button"
            onClick={() => onChange(DEFAULT_FILTERS)}
            className="hit-target pressable self-start text-subheadline font-medium text-tint"
          >
            Reset to defaults
          </button>
        )}
      </div>
    </Sheet>
  );
}
