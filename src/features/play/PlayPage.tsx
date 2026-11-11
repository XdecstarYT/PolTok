import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, m, useReducedMotion } from 'framer-motion';
import type { Action, ApplyResult, EraDef, ElectionResult, GameState, LogEntry, NewGameOptions, PartyId } from './engine/types';
import { api, approvalIndex, CONTENT, lawById, partyColor, projectSeats } from './ui/adapter';
import { clearSave, hasSave, saveIsOver, loadSeenElection, writeSeenElection, loadMeta, loadPrefs, loadSave, resetAll, writeMeta, writePrefs, writeSave, type Meta, type Prefs } from './ui/storage';
import { Confetti, Dialog } from './ui/visuals';
import { AdvisorCard, CourtPanel, Dashboard, EndBar, LawLibrary, LobbyPanel, RegionPanel, TopBar, ViewTabs, type Sheet, type View } from './ui/game';
import { advise } from './ui/advisor';
import { StatsView } from './ui/stats';
import { AmendPicker, AmendSlot, CabinetView, DailyButton, dailyChallenge, DebateBanner, DebateScene, FactionMeter, GoalsCard, PerksScreen, wingRebelNote } from './ui/v2';
import { consumesRng, currentEvent, headlines } from './engine';
import { TipLayer, hideTip } from './ui/fx';
import { VoteScreen } from './ui/vote';
import { CoalitionBuilder, ElectionNight } from './ui/election';
import { Coach, EraInterstitial, EventCard, fallbackHeadlines, FrontPage, PauseMenu, TUTORIAL, type Head } from './ui/overlays';
import { EndScreen, HowToPlay, SetupScreen, TitleScreen } from './ui/screens';
import { music, setAudio, sfx } from './audio';
import { Gfx3DContext, MapView, hasWebGL, preload3D } from './world';
import './play.css';

type Overlay =
  | { kind: 'summary'; prev: GameState; log: LogEntry[]; heads: Head[] }
  | { kind: 'election'; result: ElectionResult }
  | { kind: 'era'; era: EraDef };

function safeEvent(s: GameState) { try { return currentEvent(s) ?? undefined; } catch { return undefined; } }

/** Friendly names for undoable actions (which actions are undoable is decided by consumesRng). */
const UNDO_LABEL: Partial<Record<Action['type'], (a: Action) => string>> = {
  campaign: () => 'campaign', court: () => 'courting', draft: (a) => `draft of ${lawById((a as { lawId: string }).lawId)?.name ?? 'a law'}`,
  repeal: () => 'repeal motion', lobby: () => 'lobbying', setStance: () => 'stance change', whip: () => 'whip',
  appoint: () => 'appointment', dismiss: () => 'dismissal', amend: () => 'amendment',
};

/** Engine headlines (v2) when available. */
function engineHeadlines(s: GameState): Head[] | null {
  try { const h = headlines(s, 3); return h && h.length ? h : null; } catch { return null; }
}

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
  const [view, setView] = useState<View>('chamber');
  const [undo, setUndo] = useState<{ state: GameState; label: string }[]>([]);
  const [advisorOff, setAdvisorOff] = useState<number | null>(null);
  const [debate, setDebate] = useState(false);
  const [perksOpen, setPerksOpen] = useState(false);

  useEffect(() => { setAudio({ muted: prefs.muted, volume: prefs.volume }); }, [prefs.muted, prefs.volume]);
  useEffect(() => { music.set({ enabled: prefs.music, volume: prefs.musicVolume }); }, [prefs.music, prefs.musicVolume]);
  // music stays silent until the player interacts (autoplay policy + courtesy)
  useEffect(() => {
    const go = () => music.unlock();
    window.addEventListener('pointerdown', go, { once: true }); window.addEventListener('keydown', go, { once: true });
    return () => { window.removeEventListener('pointerdown', go); window.removeEventListener('keydown', go); music.set({ enabled: false }); };
  }, []);
  useEffect(() => { if (gs) music.setEra(gs.era); }, [gs?.era]); // eslint-disable-line react-hooks/exhaustive-deps
  // game display font (serif), loaded only on this page
  useEffect(() => {
    if (document.getElementById('quorum-fonts')) return;
    const l = document.createElement('link'); l.id = 'quorum-fonts'; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700;9..144,900&family=IM+Fell+English+SC&display=swap';
    document.head.appendChild(l);
  }, []);
  // undo is only valid within the same turn and phase
  useEffect(() => { setUndo((u) => (u.length && gs && (u[u.length - 1].state.turn !== gs.turn || u[u.length - 1].state.phase !== gs.phase) ? [] : u)); }, [gs?.turn, gs?.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { document.title = 'QUORUM: The Calderra Ledger · PolTok'; }, []);
  // fetch the 3D chunk once a game is on screen (it is only ever loaded on /play)
  useEffect(() => { if (screen === 'game' && prefs.map3d) preload3D(); }, [screen, prefs.map3d]);
  const setPrefs = (p: Prefs) => { setPrefsState(p); writePrefs(p); };
  const say = (text: string, bad?: boolean) => setToast({ id: Date.now(), text, bad });
  useEffect(() => { if (!toast) return; const t = window.setTimeout(() => setToast(null), 2600); return () => window.clearTimeout(t); }, [toast]);

  const commit = useCallback((s: GameState) => { setGs(s); writeSave(s); }, []);

  const finishGame = useCallback((s: GameState) => {
    try {
      const sc = api.score(s);
      const m0 = loadMeta();
      const m2: Meta = { ...m0, bestScore: Math.max(m0.bestScore, sc.total), achievements: Array.from(new Set([...m0.achievements, ...(sc.allAchievements ?? sc.achievements)])), games: m0.games + 1,
        daily: s.daily ? { date: s.daily, score: Math.max(sc.total, m0.daily?.date === s.daily ? m0.daily.score : 0) } : m0.daily ?? null };
      writeMeta(m2); setMeta(m2);
    } catch { /* ignore */ }
    // keep the finished save until the player leaves the end screen, so a reload still shows the results
  }, []);

  const act = useCallback((a: Action): ApplyResult | null => {
    const s = gsRef.current; if (!s) return null;
    // undo only actions that draw nothing from the seeded RNG (otherwise undo would let a player re-roll)
    let rolls = true; try { rolls = consumesRng(s, a); } catch { /* keep undo off */ }
    let r: ApplyResult;
    try { r = api.apply(s, a); } catch (e) { say(String((e as Error).message ?? e), true); return null; }
    const err = r.log.find((l) => l.kind === 'error');
    if (err) { say(err.text, true); return null; }
    const label = rolls ? null : UNDO_LABEL[a.type]?.(a) ?? a.type.replace(/([A-Z])/g, ' $1').toLowerCase();
    if (label && r.state.turn === s.turn && r.state.phase === s.phase) setUndo((u) => [...u.slice(-9), { state: s, label }]);
    else setUndo([]);
    gsRef.current = r.state;
    commit(r.state);
    const nice: Partial<Record<Action['type'], () => void>> = {
      campaign: () => { sfx.ballot(); say(r.log[0]?.text ?? 'Campaign launched'); setSheet(null); },
      court: () => { sfx.click(); say(r.log[0]?.text ?? 'Group courted'); setSheet(null); },
      draft: () => { sfx.ballot(); say(`Drafted: ${lawById((a as { lawId: string }).lawId)?.name}`); setSheet(null); if (coach === 1) setCoach(2); },
      repeal: () => { sfx.ballot(); say('Repeal placed on the docket'); setSheet(null); },
      lobby: () => { sfx.coin(); say(r.log[0]?.text ?? 'Lobbied'); setSheet(null); },
      resolveEvent: () => { sfx.click(); },
      formCoalition: () => { sfx.gavel(); if (!r.transitions.eraChanged && !r.transitions.gameOver) say(r.log.find((l) => l.kind === 'coalition')?.text ?? 'Government formed'); },
      answerOffer: () => { sfx.gavel(); },
    };
    nice[a.type]?.();
    if (r.transitions.eraChanged) { const e = CONTENT.eras.find((x) => x.id === r.state.era); if (e) { sfx.era(); setOverlays((q) => [...q, { kind: 'era', era: e }]); } }
    if (r.transitions.gameOver) finishGame(r.state);
    return r;
  }, [commit, coach, finishGame]);

  const endTurn = useCallback(() => {
    const s = gsRef.current; if (!s || s.phase !== 'actions') return;
    let r: ApplyResult;
    try { r = api.endTurn(s); } catch (e) { say(String((e as Error).message ?? e), true); return; }
    const err = r.log.find((l) => l.kind === 'error');
    if (err && r.state === s) { say(err.text, true); return; }
    const heads: Head[] = engineHeadlines(r.state) ?? fallbackHeadlines(r.state, r.log);
    const q: Overlay[] = [{ kind: 'summary', prev: s, log: r.log, heads }];
    if (r.transitions.electionHeld) q.push({ kind: 'election', result: r.state.elections[r.state.elections.length - 1] });
    if (r.transitions.eraChanged) { const e = CONTENT.eras.find((x) => x.id === r.state.era); if (e) q.push({ kind: 'era', era: e }); }
    if (r.state.treasury > s.treasury) sfx.coin(); else sfx.gavel();
    setSheet(null); setVoteId(null); setUndo([]); hideTip();
    if (coach !== null) { setCoach(null); const m2 = { ...meta, tutorialDone: true }; writeMeta(m2); setMeta(m2); }
    gsRef.current = r.state; commit(r.state);
    setOverlays(q);
    if (r.transitions.gameOver) finishGame(r.state);
  }, [commit, coach, meta, finishGame]);

  const start = (o: NewGameOptions) => {
    sfx.gavel();
    const s = api.newGame({ ...o, seed: o.daily ? o.seed : (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0 });
    writeSeenElection(-1);
    commit(s); setScreen('game'); setCanContinue(true); setView('chamber'); setUndo([]);
    setOverlays(s.elections.length ? [{ kind: 'election', result: s.elections[s.elections.length - 1] }] : []);
    setCoach(meta.tutorialDone ? null : 0);
  };
  const cont = () => {
    const s = loadSave();
    if (!s) { say('Save could not be read. Starting fresh.', true); setScreen('setup'); return; }
    // reloaded between an election and government formation: replay the count before the talks
    const last = s.elections[s.elections.length - 1];
    setOverlays(last && (s.phase === 'coalition' || last.turn > loadSeenElection()) ? [{ kind: 'election', result: last }] : []);
    setGs(s); setScreen('game'); setView('chamber'); setUndo([]); sfx.click();
  };
  const leaveEnd = (to: 'setup' | 'title') => { clearSave(); setCanContinue(false); if (to === 'setup') setScreen('setup'); else toTitle(); };
  const toTitle = () => { setScreen('title'); setPaused(false); setSheet(null); setVoteId(null); setOverlays([]); setCoach(null); setCanContinue(hasSave()); };

  const popOverlay = () => { setOverlays((q) => { const [first, ...rest] = q; if (first?.kind === 'election') writeSeenElection(first.result.turn); if (rest[0]?.kind === 'era') sfx.era(); void first; return rest; }); };
  const openVote = (id: string) => { sfx.click(); setToast(null); setVoteId(id); if (coach === 2) setCoach(3); };
  const onPassed = (proposer: PartyId) => { if (!rm) setConfetti((c) => ({ n: c.n + 1, colors: [partyColor(gsRef.current, proposer), '#ffffff', '#c6ff3d'] })); sfx.cheer(); };

  const doUndo = useCallback(() => {
    setUndo((u) => {
      const last = u[u.length - 1]; if (!last) return u;
      gsRef.current = last.state; commit(last.state); sfx.click(); say(`Undone: ${last.label}`);
      return u.slice(0, -1);
    });
  }, [commit]);
  const advice = useMemo(() => (gs && prefs.advisor && advisorOff !== gs.turn && screen === 'game' ? advise(gs) : null), [gs, prefs.advisor, advisorOff, screen]);

  // ------------------------------------------------ keyboard
  const s = gs;
  const ov = overlays[0];
  const eventDef = s?.phase === 'event' && s.pendingEvent ? (safeEvent(s) ?? CONTENT.events.find((e) => e.id === s.pendingEvent)) : undefined;
  const blocking = !!(ov || paused || how || voteId || sheet || debate || perksOpen || (s && (s.phase === 'coalition' || s.phase === 'over')) || eventDef);
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
      if (k === 'z' && undo.length) { e.preventDefault(); doUndo(); return; }
      const map: Record<string, () => void> = {
        '1': () => setSheet({ kind: 'map' }), m: () => setSheet({ kind: 'map' }), '2': () => setSheet({ kind: 'court' }),
        '3': () => setSheet({ kind: 'laws', tab: 'draft' }), '4': () => setSheet({ kind: 'lobby' }), '5': () => setSheet({ kind: 'laws', tab: 'repeal' }),
        e: endTurn,
      };
      if (map[k] && (k === 'e' || k === 'm' || s.ap > 0)) { e.preventDefault(); sfx.click(); map[k](); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [screen, s, blocking, eventDef, ov, paused, act, endTurn, undo.length, doUndo]);

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
      ? <SetupScreen onStart={start} onBack={() => setScreen('title')} achievements={meta.achievements} />
      : <TitleScreen canContinue={canContinue} continueLabel={canContinue && saveIsOver() ? 'See final results' : 'Continue'} best={meta.bestScore} muted={prefs.muted} rm={rm} onContinue={cont} onNew={() => { sfx.click(); setScreen('setup'); }}
          extra={<><DailyButton done={meta.daily ?? null} onStart={() => { const d = dailyChallenge(new Date()); start({ ...d.options, color: undefined }); }} /><button className="btn q-btn-ghost q-btn-lg" onClick={() => { sfx.click(); setPerksOpen(true); }}>Perks &amp; Records</button></>}
          onHow={() => setHow(true)} onToggleMute={() => setPrefs({ ...prefs, muted: !prefs.muted })} onSettings={() => setPaused(true)} />;
  } else if (screen === 'setup') {
    body = <SetupScreen onStart={start} onBack={() => setScreen('title')} achievements={meta.achievements} />;
  } else if (s.phase === 'over' && !ov) {
    body = <EndScreen s={s} best={meta.bestScore} onNew={() => leaveEnd('setup')} onTitle={() => leaveEnd('title')} />;
  } else {
    body = (
      <>
        <TopBar s={s} rm={rm} muted={prefs.muted} onPause={() => setPaused(true)} onMute={() => setPrefs({ ...prefs, muted: !prefs.muted })} />
        <ViewTabs view={view} setView={(v) => { sfx.click(); setView(v); }} tabs={[{ id: 'chamber', label: 'Chamber' }, { id: 'map', label: 'Map' }, { id: 'cabinet', label: 'Cabinet & Party', badge: s.wings && Object.values(s.wings).some((w) => w < 35) ? '!' : undefined }, { id: 'stats', label: 'Statistics' }]} />
        <AnimatePresence mode="wait" initial={false}>
          <m.div key={view} className="q-viewpane" initial={rm ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={rm ? undefined : { opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
            {view === 'chamber' && (
              <Dashboard s={s} rm={rm} log={s.history ?? []} onSheet={(x) => { sfx.click(); setToast(null); setSheet(x); }} onOpenVote={openVote}
                advisor={<><DebateBanner s={s} onOpen={() => { sfx.click(); setDebate(true); }} /><AdvisorCard s={s} advice={advice} onDo={(a) => { act(a); }} onOpenVote={openVote} onDismiss={() => setAdvisorOff(s.turn)} /></>}
                extra={<><FactionMeter s={s} rm={rm} compact /><GoalsCard s={s} /></>} />
            )}
            {view === 'map' && (
              <section className="q-card q-maptab" aria-labelledby="q-maptab-h">
                <h3 id="q-maptab-h" className="q-h3">The Republic of Calderra <span className="q-muted q-small">{s.phase === 'actions' && s.ap > 0 ? 'tap a region to campaign' : 'tap a region for its seats'}</span></h3>
                <MapView s={s} toggle tall onSelect={(id) => { sfx.click(); setToast(null); setSheet({ kind: 'map', region: id }); }} />
                <p className="q-small q-muted q-maptab__help">{hasWebGL() && prefs.map3d ? 'Drag to pan · pinch or scroll to zoom · two fingers or right-drag to rotate · arrows, +/−, R on the keyboard' : 'Tap or press Enter on a region to open it.'}</p>
              </section>
            )}
            {view === 'stats' && <StatsView s={s} />}
            {view === 'cabinet' && <CabinetView s={s} rm={rm} act={act} />}
          </m.div>
        </AnimatePresence>
        {s.phase === 'actions' && <EndBar s={s} onEndTurn={endTurn} undo={undo[undo.length - 1]?.label ?? null} onUndo={doUndo} />}
        {ov?.kind === 'summary' && <Dialog label="The morning paper" rm={rm} variant="center" className="q-dlg--paper" onClose={popOverlay}><FrontPage prev={ov.prev} s={s} log={ov.log} heads={ov.heads} rm={rm} onClose={popOverlay} /></Dialog>}
        {ov?.kind === 'election' && <Dialog label="Election night" rm={rm} variant="full" className="q-dlg--elec"><ElectionNight s={s} result={ov.result} rm={rm} onDone={popOverlay} onMajority={(c) => !rm && setConfetti((x) => ({ n: x.n + 1, colors: [c, '#ffffff', c] }))} /></Dialog>}
        {ov?.kind === 'era' && <Dialog label={`New era: ${ov.era.name}`} rm={rm} variant="full"><EraInterstitial era={ov.era} s={s} rm={rm} onClose={popOverlay} /></Dialog>}
        {!ov && s.phase === 'coalition' && <Dialog label="Government formation" rm={rm} variant="center"><CoalitionBuilder s={s} act={act} /></Dialog>}
        {!ov && eventDef && <Dialog label={`Event: ${eventDef.title}`} rm={rm} variant="center" className="q-dlg--event"><EventCard ev={eventDef} s={s} rm={rm} onChoose={(c) => act({ type: 'resolveEvent', choice: c })} /></Dialog>}
        {!ov && !eventDef && debate && <Dialog label="Debate" rm={rm} variant="center" className="q-dlg--debate" onClose={() => setDebate(false)}><DebateScene s={s} rm={rm} act={act} onClose={() => setDebate(false)} /></Dialog>}
        {!ov && !eventDef && voteId && <Dialog label="Assembly roll call" rm={rm} variant="full" onClose={() => setVoteId(null)}><VoteScreen s={s} itemId={voteId} rm={rm} act={act} onClose={() => setVoteId(null)} onPassed={onPassed} amendSlot={<AmendSlot s={s} itemId={voteId} act={act} />} wingNote={wingRebelNote} /></Dialog>}
        {!ov && !eventDef && !voteId && sheet && (
          <Dialog label={SHEET_TITLE[sheet.kind]} rm={rm} onClose={() => setSheet(null)}>
            <div className="q-sheet__head"><h2>{SHEET_TITLE[sheet.kind]}</h2><span className="q-muted q-small">{s.ap} AP left</span><button className="q-iconbtn" onClick={() => setSheet(null)} aria-label="Close">✕</button></div>
            {sheet.kind === 'map' && <RegionPanel s={s} initial={sheet.region} act={act} />}
            {sheet.kind === 'court' && <CourtPanel s={s} act={act} />}
            {sheet.kind === 'lobby' && <LobbyPanel s={s} act={act} />}
            {sheet.kind === 'laws' && <LawLibrary s={s} initialTab={sheet.tab} act={act} tutorialSuggest={coach !== null && sheet.tab === 'draft'} amendPicker={(law, close) => <AmendPicker s={s} law={law} act={act} onBack={close} />} />}
          </Dialog>
        )}
        {coach !== null && !blocking && s.phase === 'actions' && s.turn === 1 && (
          <Coach step={coach} onSkip={() => { setCoach(null); const m2 = { ...meta, tutorialDone: true }; writeMeta(m2); setMeta(m2); }}
            onNext={() => {
              if (coach === 1) { setSheet({ kind: 'laws', tab: 'draft' }); return; }
              if (coach === 2 && s.docket[0]) { setVoteId((s.docket.find((d) => d.proposer === 'player') ?? s.docket[0]).id); setCoach(3); return; } // the bill just drafted (rival bills can sit first)
              if (coach >= TUTORIAL.length - 1) { setCoach(null); const m2 = { ...meta, tutorialDone: true }; writeMeta(m2); setMeta(m2); return; }
              setCoach(coach + 1);
            }} />
        )}
      </>
    );
  }

  const gfx = useMemo(() => ({ enabled: prefs.map3d, quality: prefs.quality3d, rm, setEnabled: (on: boolean) => setPrefs({ ...prefs, map3d: on }) }), [prefs, rm]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Gfx3DContext.Provider value={gfx}>
    <div className="q-root" data-rm={rm ? '1' : undefined}>
      <AnimatePresence mode="wait" initial={false}>
        <m.div key={screen} initial={rm ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={rm ? undefined : { opacity: 0 }} transition={{ duration: 0.3 }}>{body}</m.div>
      </AnimatePresence>
      {pauseDlg}
      {perksOpen && <Dialog label="Perks and records" rm={rm} variant="center" onClose={() => setPerksOpen(false)}><PerksScreen achievements={meta.achievements} best={meta.bestScore} daily={meta.daily} onClose={() => setPerksOpen(false)} /></Dialog>}
      <TipLayer />
      <Confetti fire={confetti.n} colors={confetti.colors.length ? confetti.colors : ['#fff']} />
      <div className="q-toast-wrap" aria-live="polite" role="status">{toast && <div key={toast.id} className={`q-toast${toast.bad ? ' is-bad' : ''}`}>{toast.text}</div>}</div>
    </div>
    </Gfx3DContext.Provider>
  );
}
