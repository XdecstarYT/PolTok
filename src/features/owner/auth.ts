/** Owner-panel auth client. The password is never stored or checked client-side: the server
 *  (server/owner.js / netlify/functions/owner.mjs) validates and returns a signed 12h token. */
const KEY = 'poltok.owner.token';

export function getToken(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}
export function clearToken() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export async function login(user: string, pass: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const r = await fetch('/api/owner/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ user, pass }) });
    const d = (await r.json().catch(() => ({}))) as { token?: string; error?: string };
    if (!r.ok || !d.token) return { ok: false, error: d.error || `Login failed (${r.status})` };
    try {
      sessionStorage.setItem(KEY, d.token);
    } catch {
      /* private mode — token lives only in memory for this page */
      memToken = d.token;
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'Network error — is the API reachable?' };
  }
}
let memToken: string | null = null;

export async function me(): Promise<{ user: string; exp: number } | null> {
  const t = getToken() ?? memToken;
  if (!t) return null;
  try {
    const r = await fetch('/api/owner/me', { headers: { authorization: `Bearer ${t}` }, cache: 'no-store' });
    if (!r.ok) {
      clearToken();
      return null;
    }
    return (await r.json()) as { user: string; exp: number };
  } catch {
    return null;
  }
}
