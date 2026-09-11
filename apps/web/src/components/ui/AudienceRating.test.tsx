import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AudienceRating } from './Media.js';

describe('AudienceRating', () => {
  it('renders the average and a compact vote count with an accessible label', () => {
    render(<AudienceRating rating={{ average: 8.4, count: 12345 }} />);
    const badge = screen.getByRole('img', {
      name: "People's rating 8.4 out of 10 from 12345 votes",
    });
    expect(badge).toHaveTextContent('8.4');
    // The count is locale-formatted (12K, 12,3 mil, …); only assert it is present.
    expect(badge.textContent?.replace('8.4', '').trim().length).toBeGreaterThan(1);
  });

  it('renders nothing when nobody has voted', () => {
    const { container } = render(<AudienceRating rating={{ average: null, count: 0 }} />);
    expect(container).toBeEmptyDOMElement();
  });
});
