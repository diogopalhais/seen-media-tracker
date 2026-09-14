import { User } from '@phosphor-icons/react';
import type { PersonCredit } from '@seen/shared';
import { useState } from 'react';

function Headshot({ person }: { person: PersonCredit }) {
  const [failed, setFailed] = useState(false);
  const show = person.profileUrl && !failed;
  return (
    <span className="flex size-[4.5rem] shrink-0 items-center justify-center overflow-hidden rounded-full bg-fill text-label-tertiary ring-1 ring-black/5 dark:ring-white/5">
      {show ? (
        <img
          src={person.profileUrl ?? undefined}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <User weight="fill" className="size-7" aria-hidden="true" />
      )}
    </span>
  );
}

/** Horizontal shelf of top billed cast: round headshot, name, character. Display only. */
export function CastRow({ cast }: { cast: PersonCredit[] }) {
  if (cast.length === 0) return null;
  return (
    <section className="mt-5" aria-label="Cast">
      <h3 className="safe-x m-0 mb-2 px-2 text-footnote font-normal uppercase tracking-wide text-label-secondary">
        Cast
      </h3>
      <ul className="no-scrollbar m-0 flex list-none gap-3 overflow-x-auto px-margin py-1 md:px-[var(--spacing-margin-wide)]">
        {cast.map((p) => (
          <li
            key={p.tmdbId}
            className="flex w-[4.75rem] shrink-0 flex-col items-center text-center"
          >
            <Headshot person={p} />
            <span className="mt-1.5 line-clamp-2 text-caption1 font-medium leading-tight text-label">
              {p.name}
            </span>
            {p.role && (
              <span className="line-clamp-2 text-caption2 leading-tight text-label-secondary">
                {p.role}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
