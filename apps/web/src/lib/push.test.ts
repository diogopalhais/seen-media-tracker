import { describe, expect, it } from 'vitest';
import { pushSupport, urlBase64ToUint8Array } from './push.js';

const full = {
  hasServiceWorker: true,
  hasPushManager: true,
  hasNotification: true,
  iosSafari: false,
  standalone: false,
};

describe('pushSupport', () => {
  it('is supported when the browser exposes the push APIs', () => {
    expect(pushSupport(full)).toBe('supported');
  });

  it('asks iOS Safari to install the app first', () => {
    expect(pushSupport({ ...full, hasPushManager: false, iosSafari: true })).toBe('needs_install');
  });

  it('is supported in the installed iOS app and unsupported elsewhere without the APIs', () => {
    expect(pushSupport({ ...full, iosSafari: true, standalone: true })).toBe('supported');
    expect(pushSupport({ ...full, hasNotification: false })).toBe('unsupported');
  });
});

describe('urlBase64ToUint8Array', () => {
  it('decodes URL-safe base64 without padding', () => {
    // "hello?>" in standard base64 is aGVsbG8/Pg== ; URL-safe drops padding and swaps / for _.
    expect(Array.from(urlBase64ToUint8Array('aGVsbG8_Pg'))).toEqual([
      104, 101, 108, 108, 111, 63, 62,
    ]);
  });
});
