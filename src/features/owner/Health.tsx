import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { Button } from '../../components';
import { useLive } from '../../lib/live';
import { getToken } from './auth';

type J = Record<string, unknown> | null;
async function get(url: string, auth = false): Promise<{ status: number; ms: number; body: J }> {
  const t = performance.now();
  try {
    const r = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(15000), headers: auth ? { authorization: `Bearer ${getToken() ?? ''}` } : {} });
    const body = (await r.json().catch(() => null)) as J;
    return { status: r.status, ms: Math.round(performance.now() - t), body };
  } catch {
    return { status: 0, ms: Math.round(performance.now() - t), body: null };
  }
}

function Row({ k, v, ok }: { k: string; v: ReactNode; ok?: boolean }) {
  return (
    <div className="ow-row">
      <span className={`ow-dot ${ok === undefined ? '' : ok ? 'is-ok' : 'is-bad'}`} aria-hidden="true" />
      <span className="ow-row__k">{k}</span>
      <span className="ow-row__v">{v}</span>
    </div>
  );
}

export function Health() {
  const live = useLive();
  const [d, setD] = useState<Record<string, { status: number; ms: number; body: J }> | null>(null);
  const [deploy, setDeploy] = useState('');
  const load = useCallback(async () => {
    setD(null);
    const [health, ai, news, parl, snap, nz, cal, xq, an] = await Promise.all([
      get('/api/health'), get('/api/ai'), get('/api/news?limit=200'), get('/api/parliament/status'),
      get('/api/snapshot'), get('/api/nz/results'), get('/api/calendar'), get('/api/xqueue', true), get('/api/analytics?days=1', true),
    ]);
    setD({ health, ai, news, parl, snap, nz, cal, xq, an });
    try {
      const r = await fetch('/index.html', { method: 'HEAD', cache: 'no-store' });
      setDeploy(r.headers.get('last-modified') || r.headers.get('date') || '');
    } catch {
      setDeploy('');
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  const age = live.lastUpdate ? Math.round((Date.now() - live.lastUpdate) / 1000) : null;
  const news = d?.news.body as { items?: unknown[]; sources?: { name: string; ok: boolean }[]; fetchedAt?: number } | null;
  const parl = d?.parl.body;
  const missing: string[] = [];
  JSON.stringify(parl ?? {}, (k, v) => {
    if (/key$/i.test(k) && v === false) missing.push(k.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase().replace('_API_KEY', '_API_KEY'));
    return v;
  });
  const ago = (ts?: number | null) => {
    if (!ts || !Number.isFinite(ts)) return 'unknown';
    const s = Math.round((Date.now() - ts) / 1000);
    return `${new Date(ts).toLocaleString()} (${s < 90 ? s + 's' : s < 5400 ? Math.round(s / 60) + 'm' : Math.round(s / 3600) + 'h'} ago)`;
  };
  const snapRes = (d?.snap.body?.results ?? []) as { updatedAt?: number }[] | Record<string, { updatedAt?: number }>;
  const snapAt = Math.max(0, ...Object.values(snapRes).map((r) => r?.updatedAt ?? 0)) || null;
  const clock = d?.health.body?.clock as { lastOk?: number; lastError?: string } | undefined;
  return (
    <section>
      <div className="ow-actions"><Button size="sm" variant="ghost" onClick={load}>Refresh</Button></div>
      {!d ? <p className="ow-muted">Checking…</p> : (
        <div className="ow-health">
          <Row k="API /api/health" ok={d.health.status === 200} v={`${d.health.status || 'down'} · ${d.health.ms}ms · ${String(d.health.body?.platform ?? 'node')} · mode ${String(d.health.body?.mode ?? '?')}${d.health.body?.uptime != null ? ` · uptime ${String(d.health.body.uptime)}s` : ''}`} />
          <Row k="Live results" ok={live.connected || live.mode.startsWith('browser')} v={`${live.mode} · ${Object.keys(live.results).length} races · ${age == null ? 'no update yet' : `last update ${age}s ago`}`} />
          <Row k="AI (Ask PolTok)" ok={!!d.ai.body?.configured} v={d.ai.body ? `${d.ai.body.configured ? 'configured' : 'NOT configured (GROQ env)'} · model ${String(d.ai.body.model)}` : 'unreachable'} />
          <Row k="News feed" ok={!!news?.items?.length} v={news ? `${news.items?.length ?? 0} items · ${news.sources?.filter((s) => s.ok).length ?? 0}/${news.sources?.length ?? 0} sources ok${news.fetchedAt ? ` · fetched ${new Date(news.fetchedAt).toLocaleTimeString()}` : ''}` : 'unreachable'} />
          {news?.sources?.some((s) => !s.ok) && <Row k="News sources failing" ok={false} v={news.sources.filter((s) => !s.ok).map((s) => s.name).join(', ')} />}
          <Row k="Parliament sources" ok={d.parl.status === 200 && !missing.length} v={d.parl.status === 200 ? (missing.length ? `missing keys: ${[...new Set(missing)].join(', ')}` : 'all configured') : `status ${d.parl.status || 'down'}`} />
          {parl && <details><summary>Parliament status JSON</summary><pre className="ow-pre">{JSON.stringify(parl, null, 2)}</pre></details>}
          <Row k="Results refreshed" ok={!!snapAt && Date.now() - snapAt < 6 * 3600e3} v={`/api/snapshot ${d.snap.status || 'down'} · newest result ${ago(snapAt)}${clock?.lastOk ? ` · feed last OK ${ago(clock.lastOk)}` : ''}${clock?.lastError ? ` · last error: ${clock.lastError}` : ''}`} />
          <Row k="NZ results" ok={d.nz.status === 200} v={`${d.nz.status || 'down'} · ${String(d.nz.body?.heading ?? '')} · updated ${ago(d.nz.body?.updatedAt as number)}`} />
          <Row k="Calendar data" ok={d.cal.status === 200} v={`${d.cal.status || 'down'} · ${(d.cal.body?.events as unknown[] | undefined)?.length ?? 0} events · reviewed ${String(d.cal.body?.updatedAt ?? '?')}`} />
          <Row k="Groq model" ok={!!d.ai.body?.configured} v={`${String(d.ai.body?.model ?? 'unknown')} (env GROQ_MODEL, auto-discovers if retired)`} />
          <Row k="X Studio queue" ok={d.xq.status === 200} v={d.xq.status === 200 ? `${(d.xq.body?.drafts as unknown[] | undefined)?.length ?? 0} drafts in storage` : `status ${d.xq.status || 'down'} — Studio falls back to this browser`} />
          <Row k="Analytics" ok={d.an.status === 200} v={d.an.status === 200 ? `today ${String((d.an.body?.totals as { today?: { pv: number } } | undefined)?.today?.pv ?? 0)} pageviews · ${String(d.an.body?.live ?? 0)} live` : `status ${d.an.status || 'down'}`} />
          <Row k="Last deploy (index.html)" v={deploy ? new Date(deploy).toLocaleString() : 'unknown'} />
          <Row k="Market feeds" ok={live.markets.length > 0} v={`${live.markets.length} markets`} />
        </div>
      )}
    </section>
  );
}
