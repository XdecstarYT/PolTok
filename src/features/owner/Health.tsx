import { useCallback, useEffect, useState } from 'react';
import { Button } from '../../components';
import { useLive } from '../../lib/live';

type J = Record<string, unknown> | null;
async function get(url: string): Promise<{ status: number; ms: number; body: J }> {
  const t = performance.now();
  try {
    const r = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(15000) });
    const body = (await r.json().catch(() => null)) as J;
    return { status: r.status, ms: Math.round(performance.now() - t), body };
  } catch {
    return { status: 0, ms: Math.round(performance.now() - t), body: null };
  }
}

function Row({ k, v, ok }: { k: string; v: React.ReactNode; ok?: boolean }) {
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
    const [health, ai, news, parl] = await Promise.all([get('/api/health'), get('/api/ai'), get('/api/news?limit=200'), get('/api/parliament/status')]);
    setD({ health, ai, news, parl });
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
    if (k === 'key' && typeof v === 'string') missing.push(v);
    return v;
  });
  return (
    <section>
      <div className="ow-actions"><Button size="sm" variant="ghost" onClick={load}>Refresh</Button></div>
      {!d ? <p className="ow-muted">Checking…</p> : (
        <div className="ow-health">
          <Row k="API /api/health" ok={d.health.status === 200} v={`${d.health.status || 'down'} · ${d.health.ms}ms · ${String(d.health.body?.platform ?? 'node')} · mode ${String(d.health.body?.mode ?? '?')}${d.health.body?.uptime != null ? ` · uptime ${String(d.health.body.uptime)}s` : ''}`} />
          <Row k="Live results" ok={live.connected || live.mode.startsWith('browser')} v={`${live.mode} · source ${live.source} · ${Object.keys(live.results).length} races · ${age == null ? 'no update yet' : `last update ${age}s ago`}`} />
          <Row k="AI (Ask PolTok)" ok={!!d.ai.body?.configured} v={d.ai.body ? `${d.ai.body.configured ? 'configured' : 'NOT configured (GROQ env)'} · model ${String(d.ai.body.model)}` : 'unreachable'} />
          <Row k="News feed" ok={!!news?.items?.length} v={news ? `${news.items?.length ?? 0} items · ${news.sources?.filter((s) => s.ok).length ?? 0}/${news.sources?.length ?? 0} sources ok${news.fetchedAt ? ` · fetched ${new Date(news.fetchedAt).toLocaleTimeString()}` : ''}` : 'unreachable'} />
          {news?.sources?.some((s) => !s.ok) && <Row k="News sources failing" ok={false} v={news.sources.filter((s) => !s.ok).map((s) => s.name).join(', ')} />}
          <Row k="Parliament sources" ok={d.parl.status === 200 && !missing.length} v={d.parl.status === 200 ? (missing.length ? `missing keys: ${[...new Set(missing)].join(', ')}` : 'all configured') : `status ${d.parl.status || 'down'}`} />
          {parl && <details><summary>Parliament status JSON</summary><pre className="ow-pre">{JSON.stringify(parl, null, 2)}</pre></details>}
          <Row k="Last deploy (index.html)" v={deploy ? new Date(deploy).toLocaleString() : 'unknown'} />
          <Row k="Market feeds" ok={live.markets.length > 0} v={`${live.markets.length} markets`} />
        </div>
      )}
    </section>
  );
}
