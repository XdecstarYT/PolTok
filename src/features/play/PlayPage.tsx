import { useCallback, useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import type { Action, ApplyResult, EraDef, ElectionResult, GameState, LogEntry, NewGameOptions, PartyId } from './engine/types';
import { api, CONTENT, lawById, partyColor } from './ui/adapter';
import { clearSave, hasSave, loadMeta, loadPrefs, loadSave, resetAll, writeMeta, writePrefs, writeSave, type Meta, type Prefs } from './ui/storage';
import { Confetti, Dialog } from './ui/visuals';
import { CourtPanel, Dashboard, LawLibrary, LobbyPanel, RegionPanel, TopBar, type Sheet } from './ui/game';
import { VoteScreen } from './ui/vote';
import { CoalitionBuilder, ElectionNight } from './ui/election';
import { Coach, EraInterstitial, EventCard, PauseMenu, TurnSummary, TUTORIAL } from './ui/overlays';
import { EndScreen, HowToPlay, SetupScreen, TitleScreen } from './ui/screens';
import { setAudio, sfx } from './audio';
import './play.css';

type Overlay =
  | { kind: 'summary'; prev: GameState; log: LogEntry[] }
  | { kind: 'election'; result: ElectionResult }
  | { kind: 'era'; era: EraDef };

const SHEET_TITLE: Record<string, string> = { map: 'Regions · Campaign', court: 'Court a group', laws: 'Law library', lobby: 'Lobby a rival' };

export default function PlayPage() {
  const sysRm = useReducedMotion();
  const [prefs, setPrefsState] = useState<Prefs>(loadPrefs);
  const [meta, setMeta] = useState<Meta>(loadMeta);
  const rm = !!sysRm || prefs.reduceMotion;
  const [screen, setScreen] = useState<'title' | 'setup' | 'game'>('title');
  const [gs, setGs] = useState<GameState | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [voteId, setVoteId] = useState<string | null>(null);
  const [overlays, setOverlays] = useState<Overlay[]>([]);
  const [paused, setPaused] = useState(false);
  const [how, setHow] = useState(false);
  const [toast, setToast] = useState<{ id: number; text: string; bad?: boolean } | null>(null);
  const [confetti, setConfetti] = useState<{ n: number; colors: string[] }>({ n: 0, colors: [] });
  const [coach, setCoach] = useState<number | null>(null);
  const [canContinue, setCanContinue] = useState(hasSave);
  const gsRef = useRef(gs); gsRef.current = gs;

  useEffect(() => { setAudio({ muted: prefs.muted, volume: prefs.volume }); }, [prefs.muted, prefs.volume]);
  useEffect(() => { document.title = 'QUORUM: The Calderra Ledger · PolTok'; }, []);
  const setPrefs = (p: Prefs) => { setPrefsState(p); writePrefs(p); };
  const say = (text: string, bad?: boolean) => setToast({ id: Date.now(), text, bad });
  useEffect(() => { if (!toast) return; const t = window.setTimeout(() => setToast(null), 2600); return () => window.clearTimeout(t); }, [toast]);

  const commit = useCallback((s: GameState) => { setGs(s); writeSave(s); }, []);

  const finishGame = useCallback((s: GameState) => {
    try {
      const sc = api.score(s);
      const m2: Meta = { ...loadMeta(), bestScore: Math.max(loadMeta().bestScore, sc.total), achievements: Array.from(new Set([...loadMeta().achievements, ...sc.achievements])), games: loadMeta().games + 1 };
      writeMeta(m2); setMeta(m2);
    } catch { /* ignore */ }
    clearSave(); setCanContinue(false);
  }, []);

  const act = useCallback((a: Action): ApplyResult | null => {
    const s = gsRef.current; if (!s) return null;
    let r: ApplyResult;
    try { r = api.apply(s, a); } catch (e) { say(String((e as Error).message ?? e), true); return null; }
    const err = r.log.find((l) => l.kind === 'error');
    if (err) { say(err.text, true); return null; }
    gsRef.current = r.state;
    commit(r.state);
    const nice: Partial<Record<Action['type'], () => void>> = {
      campaign: () => { sfx.ballot(); say(r.log[0]?.text ?? 'Campaign launched'); setSheet(null); },
      court: () => { sfx.click(); say(r.log[0]?.text ?? 'Group courted'); setSheet(null); },
      draft: () => { sfx.ballot(); say(`Drafted: ${lawById((a as { lawId: string }).lawId)?.name}`); setSheet(null); if (coach === 1) setCoach(2); },
      repeal: () => { sfx.ballot(); say('Repeal placed on the docket'); setSheet(null); },
      lobby: () => { sfx.coin(); say(r.log[0]?.text ?? 'Lobbied'); setSheet(null); },
      resolveEvent: () => { sfx.click(); },
      formCoalition: () => { sfx.gavel(); say(r.log.find((l) => l.kind === 'coalition')?.text ?? 'Government formed'); },
      answerOffer: () => { sfx.gavel(); },
    };
    nice[a.type]?.();
    if (r.state.era !== s.era) { const e = CONTENT.eras.find((x) => x.id === r.state.era); if (e) { sfx.era(); setOverlays((q) => [...q, { kind: 'era', era: e }]); } }
    if (r.state.phase === 'over' && s.phase !== 'over') finishGame(r.state);
    return r;
  }, [commit, coach, finishGame]);

  const endTurn = useCallback(() => {
    const s = gsRef.current; if (!s || s.phase !== 'actions') return;
    let r: ApplyResult;
    try { r = api.endTurn(s); } catch (e) { say(String((e as Error).message ?? e), true); return; }
    const err = r.log.find((l) => l.kind === 'error');
    if (err && r.state === s) { say(err.text, true); return; }
    const q: Overlay[] = [{ kind: 'summary', prev: s, log: r.log }];
    if (r.state.elections.length > s.elections.length) q.push({ kind: 'election', result: r.state.elections[r.state.elections.length - 1] });
    if (r.state.era !== s.era) { const e = CONTENT.eras.find((x) => x.id === r.state.era); if (e) q.push({ kind: 'era', era: e }); }
    if (r.state.treasury > s.treasury) sfx.coin(); else sfx.gavel();
    setSheet(null); setVoteId(null);
    if (coach !== null) { setCoach(null); const m2 = { ...meta, tutorialDone: true }; writeMeta(m2); setMeta(m2); }
    gsRef.current = r.state; commit(r.state);
    setOverlays(q);
    if (r.state.phase === 'over') finishGame(r.state);
  }, [commit, coach, meta, finishGame]);

  const start = (o: NewGameOptions) => {
    sfx.gavel();
    const s = api.newGame({ ...o, seed: (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0 });
    commit(s); setScreen('game'); setCanContinue(true);
    setOverlays(s.elections.length ? [{ kind: 'election', result: s.elections[s.elections.length - 1] }] : []);
    setCoach(meta.tutorialDone ? null : 0);
  };
  const cont = () => { const s = loadSave(); if (!s) { say('Save could not be read. Starting fresh.', true); setScreen('setup'); return; } setGs(s); setScreen('game'); sfx.click(); };
  const toTitle = () => { setScreen('title'); setPaused(false); setSheet(null); setVoteId(null); setOverlays([]); setCoach(null); setCanContinue(hasSave()); };

  const popOverlay = () => { setOverlays((q) => { const [first, ...rest] = q; if (rest[0]?.kind === 'era') sfx.era(); void first; return rest; }); };
  const onPassed = (proposer: PartyId) => { if (!rm) setConfetti((c) => ({ n: c.n + 1, colors: [partyColor(gsRef.current, proposer), '#ffffff', '#c6ff3d'] })); sfx.cheer(); };

  // ------------------------------------------------ keyboard
  const s = gs;
  const ov = overlays[0];
  const eventDef = s?.phase === 'event' && s.pendingEvent ? CONTENT.events.find((e) => e.id === s.pendingEvent) : undefined;
  const blocking = !!(ov || paused || how || voteId || sheet || (s && (s.phase === 'coalition' || s.phase === 'over')) || eventDef);
  useEffect(() => {
    if (screen !== 'game' || !s) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t?.closest('input, select, textarea') || e.metaKey || e.ctrlKey || e.altKey) return;
      if (eventDef && !ov && !paused && (e.key === '1' || e.key === '2')) { e.preventDefault(); act({ type: 'resolveEvent', choice: e.key === '1' ? 0 : 1 }); return; }
      if (blocking) return;
      if (e.key === 'Escape') { setPaused(true); return; }
      if (s.phase !== 'actions') return;
      const k = e.key.toLowerCase();
      const map: Record<string, () => void> = {
        '1': () => setSheet({ kind: 'map' }), m: () => setSheet({ kind: 'map' }), '2': () => setSheet({ kind: 'court' }),
        '3': () => setSheet({ kind: 'laws', tab: 'draft' }), '4': () => setSheet({ kind: 'lobby' }), '5': () => setSheet({ kind: 'laws', tab: 'repeal' }),
        e: endTurn,
      };
      if (map[k] && (k === 'e' || k === 'm' || s.ap > 0)) { e.preventDefault(); sfx.click(); map[k](); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [screen, s, blocking, eventDef, ov, paused, act, endTurn]);

  // ------------------------------------------------ render
  const pauseDlg = (paused || how) && (
    <Dialog label={how ? 'How to play' : 'Pause menu'} rm={rm} variant="center" onClose={() => { setPaused(false); setHow(false); }}>
      {how ? <><HowToPlay /><button className="btn btn--accent q-btn-lg q-wide" onClick={() => setHow(false)} data-autofocus>Got it</button></> : (
        <PauseMenu prefs={prefs} setPrefs={setPrefs} inGame={screen === 'game'} onResume={() => setPaused(false)} onHow={() => setHow(true)}
          onSaveQuit={() => { if (gs) writeSave(gs); toTitle(); }}
          onReset={() => { resetAll(); setMeta(loadMeta()); setPaused(false); toTitle(); say('Save and records erased'); }} />
      )}
    </Dialog>
  );

  let body: JSX.Element;
  if (screen === 'title' || !s) {
    body = screen === 'setup'
      ? <SetupScreen onStart={start} onBack={() => setScreen('title')} />
      : <TitleScreen canContinue={canContinue} best={meta.bestScore} muted={prefs.muted} rm={rm} onContinue={cont} onNew={() => { sfx.click(); setScreen('setup'); }}
          onHow={() => setHow(true)} onToggleMute={() => setPrefs({ ...prefs, muted: !prefs.muted })} onSettings={() => setPaused(true)} />;
  } else if (screen === 'setup') {
    body = <SetupScreen onStart={start} onBack={() => setScreen('title')} />;
  } else if (s.phase === 'over' && !ov) {
    body = <EndScreen s={s} best={meta.bestScore} onNew={() => setScreen('setup')} onTitle={toTitle} />;
  } else {
    body = (
      <>
        <TopBar s={s} rm={rm} muted={prefs.muted} onPause={() => setPaused(true)} onMute={() => setPrefs({ ...prefs, muted: !prefs.muted })} />
        <Dashboard s={s} rm={rm} log={s.history ?? []} act={act} onSheet={(x) => { sfx.click(); setSheet(x); }} onOpenVote={(id) => { sfx.click(); setVoteId(id); if (coach === 2) setCoach(3); }} onEndTurn={endTurn} />
        {ov?.kind === 'summary' && <Dialog label="End of turn summary" rm={rm} variant="center" onClose={popOverlay}><TurnSummary prev={ov.prev} s={s} log={ov.log} onClose={popOverlay} /></Dialog>}
        {ov?.kind === 'election' && <Dialog label="Election night" rm={rm} variant="full" className="q-dlg--elec"><ElectionNight s={s} result={ov.result} rm={rm} onDone={popOverlay} onMajority={(c) => !rm && setConfetti((x) => ({ n: x.n + 1, colors: [c, '#ffffff', c] }))} /></Dialog>}
        {ov?.kind === 'era' && <Dialog label={`New era: ${ov.era.name}`} rm={rm} variant="full"><EraInterstitial era={ov.era} s={s} rm={rm} onClose={popOverlay} /></Dialog>}
        {!ov && s.phase === 'coalition' && <Dialog label="Government formation" rm={rm} variant="center"><CoalitionBuilder s={s} act={act} /></Dialog>}
        {!ov && eventDef && <Dialog label={`Event: ${eventDef.title}`} rm={rm} variant="center" className="q-dlg--event"><EventCard ev={eventDef} s={s} rm={rm} onChoose={(c) => act({ type: 'resolveEvent', choice: c })} /></Dialog>}
        {!ov && !eventDef && voteId && <Dialog label="Assembly roll call" rm={rm} variant="full" onClose={() => setVoteId(null)}><VoteScreen s={s} itemId={voteId} rm={rm} act={act} onClose={() => setVoteId(null)} onPassed={onPassed} /></Dialog>}
        {!ov && !eventDef && !voteId && sheet && (
          <Dialog label={SHEET_TITLE[sheet.kind]} rm={rm} onClose={() => setSheet(null)}>
            <div className="q-sheet__head"><h2>{SHEET_TITLE[sheet.kind]}</h2><span className="q-muted q-small">{s.ap} AP left</span><button className="q-iconbtn" onClick={() => setSheet(null)} aria-label="Close">✕</button></div>
            {sheet.kind === 'map' && <RegionPanel s={s} initial={sheet.region} act={act} />}
            {sheet.kind === 'court' && <CourtPanel s={s} act={act} />}
            {sheet.kind === 'lobby' && <LobbyPanel s={s} act={act} />}
            {sheet.kind === 'laws' && <LawLibrary s={s} initialTab={sheet.tab} act={act} tutorialSuggest={coach !== null && sheet.tab === 'draft'} />}
          </Dialog>
        )}
        {coach !== null && !blocking && s.phase === 'actions' && s.turn === 1 && (
          <Coach step={coach} onSkip={() => { setCoach(null); const m2 = { ...meta, tutorialDone: true }; writeMeta(m2); setMeta(m2); }}
            onNext={() => {
              if (coach === 1) { setSheet({ kind: 'laws', tab: 'draft' }); return; }
              if (coach === 2 && s.docket[0]) { setVoteId(s.docket[0].id); setCoach(3); return; }
              if (coach >= TUTORIAL.length - 1) { setCoach(null); const m2 = { ...meta, tutorialDone: true }; writeMeta(m2); setMeta(m2); return; }
              setCoach(coach + 1);
            }} />
        )}
      </>
    );
  }

  return (
    <div className="q-root" data-rm={rm ? '1' : undefined}>
      {body}
      {pauseDlg}
      <Confetti fire={confetti.n} colors={confetti.colors.length ? confetti.colors : ['#fff']} />
      <div className="q-toast-wrap" aria-live="polite" role="status">{toast && <div key={toast.id} className={`q-toast${toast.bad ? ' is-bad' : ''}`}>{toast.text}</div>}</div>
    </div>
  );
}
