import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RequireAuth } from '../app/RootLayout.js';
import { tokenStore } from '../lib/token-store.js';
import { LoginScreen } from './LoginScreen.js';

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<LoginScreen />} />
        <Route
          path="/library"
          element={
            <RequireAuth>
              <h1>Library screen</h1>
            </RequireAuth>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('login flow', () => {
  beforeEach(() => {
    localStorage.clear();
    tokenStore.clear('logout');
    tokenStore.consumeClearReason();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('shows the login screen on first launch and requests no private data', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    renderAt('/library');
    expect(screen.getByRole('heading', { name: 'Seen' })).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('skips login when a stored token exists', () => {
    tokenStore.set('stored-token');
    renderAt('/library');
    expect(screen.getByRole('heading', { name: 'Library screen' })).toBeInTheDocument();
  });

  it('keeps the value and focus on a wrong password', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse(401, {
          error: { code: 'invalid_credentials', message: 'Incorrect password' },
        }),
      ),
    );
    renderAt('/login');
    const input = screen.getByLabelText('Password');
    await user.type(input, 'wrong-pass{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent('That password is not correct.');
    expect(input).toHaveValue('wrong-pass');
    await waitFor(() => expect(input).toHaveFocus());
    expect(tokenStore.get()).toBeNull();
  });

  it('stores the token and lands on Library after a correct password', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async () =>
      jsonResponse(200, { token: 'abc'.repeat(15), expiresAt: '2026-10-11T00:00:00.000Z' }),
    );
    vi.stubGlobal('fetch', fetchMock);
    renderAt('/login');
    await user.type(screen.getByLabelText('Password'), 'correct horse{Enter}');
    expect(await screen.findByRole('heading', { name: 'Library screen' })).toBeInTheDocument();
    expect(tokenStore.get()).toBe('abc'.repeat(15));
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/api\/v1\/auth\/login$/);
    expect(JSON.parse(init.body as string)).toEqual({ password: 'correct horse' });
  });

  it('explains when the session was ended by the server', () => {
    tokenStore.set('old');
    tokenStore.clear('expired');
    renderAt('/login');
    expect(screen.getByRole('status')).toHaveTextContent('Your session has ended');
  });
});
