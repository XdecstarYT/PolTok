/** /au/victoria/build — "Build your own result": drag each party's vote; the PolTok model re-runs in the browser and the
 *  parliament of faces redraws. The scenario lives in the URL so it can be shared. */
import { useDeferredValue, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Card, PageHeader } from '../../../components';
import { useSeo } from '../../../lib/seo';
import '../../../lib/liquidGlass';
import PRIM from '../../../../shared/au/vic-2022-primaries.json';
import CANDS from '../../../../shared/au/vic-candidates-2026.json';
import { createModel } from '../../../../shared/au/vic-model-core.js';
import { AuNav } from '../AuNav';
import { VIC_NAME, useVicLive, vicColor, type VicModel } from '../vicLive';
import { Hemicycle, ModelSummary, SeatProfile } from './components';
import { seatById } from './people';
import { renderShareCard, shareOrDownload } from './shareCard';
import '../au.css';

const engine = createModel(PRIM as never, CANDS as never) as { runModel: (now: Record<string, number>, o?: { sims?: number; seed?: number }) => VicModel };
const KEYS = ['LNP', 'ALP', 'ONP', 'GRN'] as const;
type K = (typeof KEYS)[number];
type Mix = Record<K, number>;
const PRESETS: { id: string; label: string; mix?: Mix }[] = [
  { id: 'polls', label: '📊 Latest polls' },
  { id: '2022', label: '⏪ 2022 result', mix: { LNP: 34.9, ALP: 36.7, ONP: 0.3, GRN: 11.5 } },
  { id: 'onp', label: '🟠 One Nation surge', mix: { LNP: 28, ALP: 19.5, ONP: 29, GRN: 14 } },
  { id: 'alp', label: '🔴 Labor comeback', mix: { LNP: 30, ALP: 28, ONP: 19, GRN: 14 } },
  { id: 'lnp', label: '🔵 Coalition landslide', mix: { LNP: 38, ALP: 20, ONP: 18, GRN: 13 } },
];
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const pct = (x: number) => (x >= 0.995 ? '>99%' : x <= 0.005 ? '<1%' : `${Math.round(x * 100)}%`);

export default function PlaygroundPage() {
  useSeo({ title: 'Build your own Victorian election result', description: 'Drag each party\'s vote and watch the PolTok model redraw all 88 seats and the parliament, live. Share your prediction.' });
  const { data } = useVicLive();
  const [params, setParams] = useSearchParams();
  const fromUrl = useMemo(() => { const o: Partial<Mix> = {}; for (const k of KEYS) { const v = Number(params.get(k.toLowerCase())); if (Number.isFinite(v) && params.has(k.toLowerCase())) o[k] = clamp(v, 0, 60); } return Object.keys(o).length === 4 ? (o as Mix) : null; }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [mix, setMix] = useState<Mix | null>(fromUrl);
  const [seat, setSeat] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [card, setCard] = useState<string | null>(null);
  const [cardBlob, setCardBlob] = useState<Blob | null>(null);
  const polls = data?.polls?.average;
  useEffect(() => { if (!mix && polls) setMix({ LNP: polls.LNP, ALP: polls.ALP, ONP: polls.ONP, GRN: polls.GRN }); }, [polls, mix]);
  const dmix = useDeferredValue(mix);
  const others = mix ? +(100 - KEYS.reduce((a, k) => a + mix[k], 0)).toFixed(1) : 0;
  const model = useMemo(() => (dmix ? engine.runModel(dmix, { sims: 400, seed: 7 }) : null), [dmix]);
  const base = data?.model ?? null;
  const changes = useMemo(() => !model || !base ? [] : Object.entries(model.seats).filter(([id, s]) => base.seats[id] && base.seats[id].fav !== s.fav).map(([id, s]) => ({ id, from: base.seats[id].fav, to: s.fav, p: s.prob[s.fav] ?? 0 })).sort((a, b) => b.p - a.p), [model, base]);

  const set = (k: K, v: number) => setMix((m) => {
    if (!m) return m;
    const next = { ...m, [k]: clamp(+v.toFixed(1), 0, 60) };
    const sum = KEYS.reduce((a, x) => a + next[x], 0);
    if (sum > 97) { // keep at least 3% for others: take the excess from the other parties proportionally
      const over = sum - 97, rest = KEYS.filter((x) => x !== k), rs = rest.reduce((a, x) => a + next[x], 0) || 1;
      for (const x of rest) next[x] = +Math.max(0, next[x] - (over * next[x]) / rs).toFixed(1);
    }
    return next;
  });
  const share = () => {
    if (!mix) return;
    const p = new URLSearchParams(); for (const k of KEYS) p.set(k.toLowerCase(), String(mix[k]));
    setParams(p, { replace: true });
    const url = `${location.origin}/au/victoria/build?${p}`;
    navigator.clipboard?.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }).catch(() => {});
  };
  const makeCard = async () => {
    if (!model || !mix) return;
    const b = await renderShareCard(model, mix, location.href);
    setCardBlob(b); setCard(URL.createObjectURL(b));
  };
  const winner = model ? (model.majority.LNP > 0.5 ? 'Coalition majority' : model.majority.ALP > 0.5 ? 'Labor majority' : 'Hung parliament') : '';

  return (
    <div className="page au-page">
      <PageHeader className="au-pagehead" kicker="Victorian state election · interactive" title="Build your own result" crumbLabel="Build your own"
        sub={<>Drag each party's statewide vote. The PolTok model re-runs across all 88 seats in your browser.</>}>
        <AuNav />
      </PageHeader>
      <div className="vp-grid">
        <Card title="Your scenario" kicker="First-preference vote, statewide">
          <div className="pg-sliders">
            {mix && KEYS.map((k) => (
              <label key={k} className="pg-slider" style={{ ['--c' as string]: vicColor(k) } as CSSProperties}>
                <span className="pg-slider__top"><b>{VIC_NAME[k]}</b><span className="num">{mix[k].toFixed(1)}%{polls ? <small className="faint"> · polls {polls[k]}</small> : null}</span></span>
                <input type="range" min={0} max={50} step={0.5} value={mix[k]} onChange={(e) => set(k, +e.target.value)} aria-label={`${VIC_NAME[k]} first-preference vote`} />
              </label>
            ))}
            <p className="faint" style={{ margin: 0, fontSize: 13 }}>Independents & others: <b className="num">{others.toFixed(1)}%</b></p>
          </div>
          <div className="pg-presets">{PRESETS.map((p) => <button key={p.id} type="button" className="lg lg--pill lg-btn" onClick={() => setMix(p.mix ?? (polls ? { LNP: polls.LNP, ALP: polls.ALP, ONP: polls.ONP, GRN: polls.GRN } : null))}>{p.label}</button>)}</div>
          <div className="row row-wrap" style={{ gap: 10, marginTop: 14 }}>
            <button type="button" className="lg lg--pill lg-btn" onClick={makeCard}>📸 Make my share card</button>
            <button type="button" className="lg-immersive" onClick={share}><span className="lg-immersive__icon" aria-hidden="true">🔗</span><span><small>Share</small>{copied ? 'Link copied!' : 'Copy my prediction link'}</span></button>
          </div>
        </Card>
        {model && (
          <Card title={winner} kicker={`Your scenario · ${model.sims} simulations`} live>
            <ModelSummary m={model} />
          </Card>
        )}
        {model && (
          <Card className="vp-wide" title="Your parliament" kicker="Projected winner in every seat under your scenario">
            <Hemicycle data={data} view="model" model={model} onPick={setSeat} />
          </Card>
        )}
        {model && base && (
          <Card className="vp-wide" title={`${changes.length} seats change vs the polls`} kicker="Compared with the PolTok model on the latest polls">
            {changes.length ? (
              <ul className="pg-changes">{changes.map((c) => (
                <li key={c.id}><button type="button" onClick={() => setSeat(c.id)}><b>{seatById.get(c.id)?.name ?? c.id}</b> <span style={{ color: vicColor(c.from) }}>{VIC_NAME[c.from] ?? c.from}</span> → <span style={{ color: vicColor(c.to) }}>{VIC_NAME[c.to] ?? c.to}</span> <small className="faint">{pct(c.p)}</small></button></li>
              ))}</ul>
            ) : <p className="faint">Same projected winners as the latest-polls model.</p>}
          </Card>
        )}
      </div>
      <p className="vp-method">This is a what-if tool using the <Link to="/au/victoria/parliament">PolTok seat model</Link>. It isn't a forecast. 400 simulations per change; the main model uses 2,000.</p>
      {card && (
        <div className="sp-back" onClick={() => setCard(null)} role="presentation">
          <div className="sp lg pg-card" role="dialog" aria-modal="true" aria-label="Your share card" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="sp__x" onClick={() => setCard(null)} aria-label="Close">✕</button>
            <img src={card} alt="Your Victoria 2026 prediction card" />
            <div className="row row-wrap" style={{ gap: 10 }}>
              <button type="button" className="lg-immersive" onClick={() => cardBlob && shareOrDownload(cardBlob, 'my-victoria-2026-prediction.png', 'My Victoria 2026 prediction on PolTok')}><span className="lg-immersive__icon" aria-hidden="true">📤</span><span><small>Instagram · TikTok · X</small>Share or download</span></button>
            </div>
          </div>
        </div>
      )}
      {seat && <SeatProfile id={seat} data={model ? { ...(data ?? ({} as never)), model } : data} onClose={() => setSeat(null)} />}
    </div>
  );
}
