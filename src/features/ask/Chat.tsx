import { useEffect, useRef, useState } from 'react';
import { Markdown } from './Markdown';
import { citedSources } from '../../lib/ai';
import { useAiChat, useAiStatus, errorText } from './useAsk';

/** Showcase questions: live results, civics guide, bills, AU seats, markets. */
export const SUGGESTED = [
  'Who won the Senate?',
  'Which races are still uncalled?',
  'How does ranked-choice work in Alaska?',
  'What bills passed this week?',
  'Who leads in Kooyong?',
  'Explain the Victorian election',
  'Polymarket odds for House control?',
  'Where can I see ballot measures?',
];

export function Disclaimer() {
  return <p className="ask-disclaimer">AI answers from live data + the PolTok guide — may contain errors. Check race pages for official results.</p>;
}

export function Sources({ text }: { text: string }) {
  const s = citedSources(text);
  if (!s.length) return null;
  return (
    <div className="ask-sources" aria-label="Sources cited">
      {s.map((n) => (
        <span key={n} className="ask-chip ask-chip--src">{n}</span>
      ))}
    </div>
  );
}

const hhmm = (t?: number) => (t ? new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '');
const plain = (t: string) => t.replace(/\[\[[^\]\n]*\]\]\n?/g, '').trim();

function CopyBtn({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="ask-copy"
      aria-label="Copy answer"
      onClick={() => {
        navigator.clipboard?.writeText(plain(text)).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        }, () => {});
      }}
    >
      {done ? 'Copied' : 'Copy'}
    </button>
  );
}

export function Sparkle() {
  return (
    <span className="ask-avatar" aria-hidden>
      <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M12 2l2.2 6.3L20.5 10l-6.3 2.2L12 18.5l-2.2-6.3L3.5 10l6.3-1.7zM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z" /></svg>
    </span>
  );
}

/** `hideOffNotice`: the host page already shows the "AI isn't configured" notice. */
export function Chat({ autoFocus, hideOffNotice }: { autoFocus?: boolean; hideOffNotice?: boolean }) {
  const status = useAiStatus();
  const { msgs, busy, ask, stop, reset } = useAiChat();
  const [q, setQ] = useState('');
  const end = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [msgs]);
  useEffect(() => {
    if (autoFocus) input.current?.focus();
  }, [autoFocus]);
  const disabled = status === 'not_configured' || status === 'unavailable';
  const submit = (text: string) => {
    if (disabled || !text.trim()) return;
    ask(text);
    setQ('');
  };
  const last = msgs[msgs.length - 1];
  return (
    <div className="ask-chat">
      <div className="ask-log" aria-live="polite">
        {disabled && !hideOffNotice && <div className="ask-empty">{errorText(status, '')}</div>}
        {!disabled && !msgs.length && (
          <div className="ask-empty">
            <div className="ask-hero">
              <Sparkle />
              <div>
                <strong>Ask anything about the elections</strong>
                <p>Live AP results, markets, polls, bills, Australian seats — plus how it all works.</p>
              </div>
            </div>
            <div className="ask-suggest">
              {SUGGESTED.map((s, i) => (
                <button key={s} type="button" className="ask-chip ask-chip--btn" style={{ animationDelay: `${i * 40}ms` }} onClick={() => submit(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`ask-row ask-row--${m.role}`}>
            {m.role === 'assistant' && <Sparkle />}
            <div className={`ask-msg ask-msg--${m.role}${m.error ? ' ask-msg--error' : ''}`}>
              {m.role === 'user' ? (
                <p>{m.content}</p>
              ) : m.content ? (
                <>
                  <Markdown text={m.content} />
                  {!m.error && <Sources text={m.content} />}
                </>
              ) : (
                <span className="ask-typing" role="status" aria-label="Thinking">
                  <span /><span /><span />
                  <em className="ask-shimmer">Checking live data…</em>
                </span>
              )}
              <div className="ask-meta">
                <time>{hhmm(m.at)}</time>
                {m.role === 'assistant' && m.content && !m.error && !(busy && i === msgs.length - 1) && <CopyBtn text={m.content} />}
              </div>
            </div>
          </div>
        ))}
        {!busy && last?.role === 'assistant' && !last.error && (
          <div className="ask-suggest ask-suggest--inline">
            {SUGGESTED.filter((s) => !msgs.some((m) => m.content === s)).slice(0, 3).map((s) => (
              <button key={s} type="button" className="ask-chip ask-chip--btn" onClick={() => submit(s)}>{s}</button>
            ))}
          </div>
        )}
        <div ref={end} />
      </div>
      <form
        className="ask-form"
        onSubmit={(e) => {
          e.preventDefault();
          submit(q);
        }}
      >
        <textarea
          ref={input}
          value={q}
          maxLength={600}
          rows={1}
          placeholder={disabled ? 'AI unavailable' : 'Ask PolTok…'}
          aria-label="Your question"
          disabled={disabled}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit(q);
            }
          }}
        />
        {busy ? (
          <button type="button" className="ask-send" onClick={stop}>Stop</button>
        ) : (
          <button type="submit" className="ask-send" disabled={disabled || !q.trim()} aria-label="Send">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden><path fill="currentColor" d="M3 20.5l18-8.5L3 3.5v6.6l12 1.9-12 1.9z" /></svg>
          </button>
        )}
      </form>
      <div className="ask-foot">
        <Disclaimer />
        {msgs.length > 0 && <button type="button" className="ask-link" onClick={reset}>Clear</button>}
      </div>
    </div>
  );
}
