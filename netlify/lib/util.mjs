// Shared helpers for PolTok Netlify Functions (stateless; caches live per warm instance only).
export const json = (body, status = 200, maxAge = 0) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'cache-control': maxAge ? `public, max-age=0, s-maxage=${maxAge}, stale-while-revalidate=${maxAge * 2}` : 'no-store',
    },
  });

/** Memoize an async producer for `ttl` ms; concurrent callers share one in-flight promise; keeps stale value on error. */
export function cached(ttl, fn) {
  let value, at = 0, inflight = null;
  return async () => {
    if (value !== undefined && Date.now() - at < ttl) return value;
    if (!inflight)
      inflight = fn()
        .then((v) => ((value = v), (at = Date.now()), v))
        .catch((e) => {
          if (value !== undefined) return value;
          throw e;
        })
        .finally(() => (inflight = null));
    return inflight;
  };
}

export const quiet = () => {};
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
