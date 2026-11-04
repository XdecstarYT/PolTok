import { useEffect, useRef, useState } from 'react';
import { Markdown } from './Markdown';
import { citedSources } from '../../lib/ai';
import { useAiChat, useAiStatus, errorText } from './useAsk';

export const SUGGESTED = ['Who won the Senate?', 'Biggest upsets?', 'Explain the Victorian election', 'Which races are still uncalled?'];

export function Disclaimer() {
  return <p className="ask-disclaimer">AI-generated from live data — may contain errors. Check race pages for official results.</p>;
}

export function Sources({ text }: { text: string }) {
  const s = citedSources(text);
  if (!s.length) return null;
  return (
    <div className="ask-sources" aria-label="Sources cited">
      {s.map((n) => (
        <span key={n} className="ask-chip">{n}</span>
      ))}
    </div>
  );
}

export function Chat({ autoFocus }: { autoFocus?: boolean }) {
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
    if (disabled) return;
    ask(text);
    setQ('');
  };
  return (
    <div className="ask-chat">
      <div className="ask-log" aria-live="polite">
        {disabled && <div className="ask-empty">{errorText(status, '')}</div>}
        {!disabled && !msgs.length && (
          <div className="ask-empty">
            <p>Ask about tonight’s results, the balance of power, markets or the news. Answers use only PolTok’s live data.</p>
            <div className="ask-suggest">
              {SUGGESTED.map((s) => (
                <button key={s} type="button" className="ask-chip ask-chip--btn" onClick={() => submit(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`ask-msg ask-msg--${m.role}${m.error ? ' ask-msg--error' : ''}`}>
            {m.role === 'user' ? (
              <p>{m.content}</p>
            ) : m.content ? (
              <>
                <Markdown text={m.content} />
                {!m.error && <Sources text={m.content} />}
              </>
            ) : (
              <span className="ask-typing" aria-label="Thinking">●●●</span>
            )}
          </div>
        ))}
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
          <button type="submit" className="ask-send" disabled={disabled || !q.trim()}>Ask</button>
        )}
      </form>
      <div className="ask-foot">
        <Disclaimer />
        {msgs.length > 0 && <button type="button" className="ask-link" onClick={reset}>Clear</button>}
      </div>
    </div>
  );
}
