import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { Button } from '../components/ui/Button.js';
import { ApiError, api } from '../lib/api.js';
import { useIsAuthenticated } from '../lib/auth.js';
import { tokenStore } from '../lib/token-store.js';

export function LoginScreen() {
  const authenticated = useIsAuthenticated();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const reason = tokenStore.consumeClearReason();
    if (reason === 'expired') setNotice('Your session has ended. Please log in again.');
    else if (reason === 'logout') setNotice('You have been logged out.');
  }, []);

  if (authenticated) return <Navigate to={from && from !== '/login' ? from : '/library'} replace />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!password || pending) return;
    setPending(true);
    setError(null);
    try {
      const res = await api.login(password);
      tokenStore.set(res.token);
      navigate(from && from !== '/login' ? from : '/library', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'invalid_credentials') setError('That password is not correct.');
        else if (err.code === 'rate_limited')
          setError('Too many attempts. Please wait a few minutes and try again.');
        else if (err.isOffline) setError("You're offline. Connect to the internet to log in.");
        else setError(err.message);
      } else setError('Something went wrong. Please try again.');
      // Keep the typed value and focus so the owner can correct a typo quickly.
      requestAnimationFrame(() => inputRef.current?.focus());
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="fade-enter safe-top safe-bottom relative flex min-h-full flex-col items-center justify-center overflow-hidden bg-bg-grouped px-margin">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-70 [background:radial-gradient(60%_50%_at_20%_15%,color-mix(in_srgb,var(--tint)_28%,transparent),transparent_70%),radial-gradient(50%_40%_at_85%_85%,color-mix(in_srgb,#0a84ff_22%,transparent),transparent_70%)]"
      />
      <form
        onSubmit={onSubmit}
        className="flex w-full max-w-xs flex-col items-stretch gap-2"
        noValidate
      >
        <div className="flex flex-col items-center gap-1 pb-2">
          <img
            src="/icons/icon-192.png"
            alt=""
            width={72}
            height={72}
            className="rounded-[1.25rem] shadow-[var(--shadow-poster)]"
          />
          <h1 className="display m-0 text-large-title">Seen</h1>
          <p className="m-0 text-center text-subheadline text-label-secondary">
            Your movies and TV series, remembered.
          </p>
        </div>

        {notice && (
          <p
            role="status"
            className="m-0 rounded-card bg-bg-grouped-secondary px-2 py-1.5 text-center text-footnote text-label-secondary"
          >
            {notice}
          </p>
        )}

        <div className="flex flex-col gap-0.5">
          <label htmlFor="password" className="visually-hidden">
            Password
          </label>
          <input
            ref={inputRef}
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'password-error' : undefined}
            className="h-12 w-full rounded-full border border-card-border bg-bg-grouped-secondary px-5 text-body text-label shadow-[var(--shadow-card)] placeholder:text-label-tertiary focus:outline-none focus:ring-2 focus:ring-tint/50 aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-destructive/60"
          />
          {error && (
            <p id="password-error" role="alert" className="m-0 px-1 text-footnote text-destructive">
              {error}
            </p>
          )}
        </div>

        <Button
          type="submit"
          variant="filled"
          size="large"
          block
          loading={pending}
          disabled={!password}
        >
          Log In
        </Button>
      </form>
    </main>
  );
}
