import { useCallback, useEffect, useRef, useState } from 'react';
import { useLive } from '../../lib/live';
import { AiError, aiStatus, askAi, buildContext, type AiMode, type AiMsg } from '../../lib/ai';

export type AiAvail = 'checking' | 'ok' | 'not_configured' | 'unavailable';

export function useAiStatus() {
  const [s, setS] = useState<AiAvail>('checking');
  useEffect(() => {
    let dead = false;
    aiStatus().then((v) => !dead && setS(v));
    return () => {
      dead = true;
    };
  }, []);
  return s;
}

export const errorText = (code: string, msg: string) =>
  code === 'not_configured'
    ? 'AI isn’t configured on this deployment yet (the site owner needs to set a Groq API key).'
    : code === 'unavailable'
      ? 'The AI service isn’t reachable here. The rest of PolTok works normally.'
      : msg;

/** One-shot generation (race summary / night brief). */
export function useAiOneShot(mode: AiMode, question: string, raceId?: string) {
  const live = useLive();
  const liveRef = useRef(live);
  liveRef.current = live;
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ctl = useRef<AbortController | null>(null);
  const run = useCallback(async () => {
    ctl.current?.abort();
    const c = (ctl.current = new AbortController());
    setBusy(true);
    setError(null);
    setText('');
    try {
      const context = await buildContext(liveRef.current, question, raceId);
      await askAi({ question, context, mode, signal: c.signal }, setText);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError(e instanceof AiError ? errorText(e.code, e.message) : 'Something went wrong.');
    } finally {
      if (ctl.current === c) setBusy(false);
    }
  }, [mode, question, raceId]);
  useEffect(() => () => ctl.current?.abort(), []);
  return { text, busy, error, run };
}

/** Multi-turn chat. */
export function useAiChat() {
  const live = useLive();
  const liveRef = useRef(live);
  liveRef.current = live;
  const [msgs, setMsgs] = useState<(AiMsg & { error?: boolean; at?: number })[]>([]);
  const [busy, setBusy] = useState(false);
  const ctl = useRef<AbortController | null>(null);
  const ask = useCallback(
    async (q: string) => {
      const question = q.trim().slice(0, 600);
      if (!question || busy) return;
      const history = msgs.filter((m) => !m.error).slice(-6).map(({ role, content }) => ({ role, content }));
      const now = Date.now();
      setMsgs((m) => [...m, { role: 'user', content: question, at: now }, { role: 'assistant', content: '', at: now }]);
      setBusy(true);
      const c = (ctl.current = new AbortController());
      const setLast = (content: string, error = false) =>
        setMsgs((m) => [...m.slice(0, -1), { role: 'assistant', content, error, at: Date.now() }]);
      try {
        const context = await buildContext(liveRef.current, question);
        const full = await askAi({ question, context, history, signal: c.signal }, (t) => setLast(t));
        if (!full.trim()) setLast("I don't know based on the live data I have.");
      } catch (e) {
        if ((e as Error).name === 'AbortError') setLast('(stopped)', true);
        else setLast(e instanceof AiError ? errorText(e.code, e.message) : 'Something went wrong.', true);
      } finally {
        setBusy(false);
      }
    },
    [busy, msgs],
  );
  const stop = useCallback(() => ctl.current?.abort(), []);
  const reset = useCallback(() => {
    ctl.current?.abort();
    setMsgs([]);
  }, []);
  useEffect(() => () => ctl.current?.abort(), []);
  return { msgs, busy, ask, stop, reset };
}
