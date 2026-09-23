import { MediaTypeSchema } from '@seen/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { availableKinds, libraryTitle, MEDIA_KINDS } from '../lib/mediaKinds.js';
import { MediaTypeChips } from './MediaTypeChips.js';
import { MediaTypeGlyph } from './ui/Media.js';

describe('media kinds registry', () => {
  it('describes every media type the API can return', () => {
    for (const type of MediaTypeSchema.options) {
      const kind = MEDIA_KINDS[type];
      expect(kind.type).toBe(type);
      expect(kind.label).not.toBe('');
      expect(kind.plural).not.toBe('');
      expect(kind.done).toMatch(/^[A-Z]/);
      expect(kind.selectedChipClass).toContain(`bg-kind-${type}`);
    }
  });

  it('hides games when the deployment has no IGDB credentials', () => {
    expect(availableKinds({ games: true }).map((k) => k.type)).toEqual(['movie', 'tv', 'game']);
    expect(availableKinds({ games: false }).map((k) => k.type)).toEqual(['movie', 'tv']);
  });

  it('titles the grid with the kind and its verb', () => {
    expect(libraryTitle('all')).toBe('Everything seen');
    expect(libraryTitle('movie')).toBe('Movies watched');
    expect(libraryTitle('game')).toBe('Games played');
  });
});

describe('MediaTypeChips', () => {
  it('offers All plus one chip per available kind and reports the choice', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<MediaTypeChips value="all" onChange={onChange} features={{ games: true }} />);
    expect(screen.getAllByRole('radio').map((r) => r.textContent)).toEqual([
      'All',
      'Movies',
      'TV',
      'Games',
    ]);
    expect(screen.getByRole('radio', { name: 'All' })).toBeChecked();
    await user.click(screen.getByRole('radio', { name: 'Games' }));
    expect(onChange).toHaveBeenCalledWith('game');
  });

  it('drops the Games chip when games are off', () => {
    render(<MediaTypeChips value="tv" onChange={() => {}} features={{ games: false }} />);
    expect(screen.queryByRole('radio', { name: 'Games' })).toBeNull();
    expect(screen.getByRole('radio', { name: 'TV' })).toBeChecked();
  });
});

describe('MediaTypeGlyph', () => {
  it('names the kind for assistive tech', () => {
    render(<MediaTypeGlyph mediaType="game" />);
    expect(screen.getByRole('img', { name: 'Game' })).toHaveAttribute('data-kind', 'game');
  });
});
