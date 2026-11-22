/*
 * Passcode for the hosted demo. The server (server/src/passcode.ts) rejects /api calls
 * without the right x-cheshire-passcode header whenever CHESHIRE_PASSCODE is set.
 * This wraps fetch once: every /api request carries the stored passcode, and a 401
 * asks for it (once at a time) and retries. Locally, with no passcode set, nothing changes.
 */
const KEY = 'cheshire-passcode';
const HEADER = 'x-cheshire-passcode';

const originalFetch = window.fetch.bind(window);
let asking: Promise<string | null> | null = null;

function isApi(input: RequestInfo | URL): boolean {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  return new URL(url, window.location.href).pathname.startsWith('/api/');
}

function withPasscode(init: RequestInit | undefined, code: string | null): RequestInit | undefined {
  if (!code) return init;
  const headers = new Headers(init?.headers);
  headers.set(HEADER, code);
  return { ...init, headers };
}

function askForPasscode(): Promise<string | null> {
  asking ??= Promise.resolve().then(() => {
    const code = window.prompt('Enter the Cheshire demo passcode (ask the Cheshire team):')?.trim() || null;
    if (code) localStorage.setItem(KEY, code);
    asking = null;
    return code;
  });
  return asking;
}

window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  if (!isApi(input)) return originalFetch(input, init);
  const res = await originalFetch(input, withPasscode(init, localStorage.getItem(KEY)));
  if (res.status !== 401) return res;
  localStorage.removeItem(KEY);
  const code = await askForPasscode();
  return code ? originalFetch(input, withPasscode(init, code)) : res;
};
