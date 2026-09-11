import { cn } from '../../lib/cn.js';

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('skeleton', className)} />;
}

export function PosterGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="poster-grid" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder list
        <div key={i} className="flex flex-col gap-1">
          <Skeleton className="aspect-[2/3] w-full rounded-card" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-3 w-2/5" />
        </div>
      ))}
    </div>
  );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3 p-margin" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder list
        <div key={i} className="flex items-center gap-2">
          <Skeleton className="h-[4.5rem] w-12 rounded-control" />
          <div className="flex flex-1 flex-col gap-1">
            <Skeleton className="h-4 w-3/5" />
            <Skeleton className="h-3 w-2/5" />
          </div>
        </div>
      ))}
    </div>
  );
}
