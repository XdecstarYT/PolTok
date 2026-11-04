/** Per-race AI summary card (on demand). Mount on /race/:id: <AiRaceSummary raceId={id} />. */
import { Markdown } from './Markdown';
import { Disclaimer, Sources } from './Chat';
import { useAiOneShot, useAiStatus } from './useAsk';
import './ask.css';

export function AiRaceSummary({ raceId }: { raceId: string }) {
  const status = useAiStatus();
  const { text, busy, error, run } = useAiOneShot('race', `Summarize the ${raceId} race.`, raceId);
  if (status === 'not_configured' || status === 'unavailable') return null;
  return (
    <section className="ask-card" aria-label="AI race summary">
      <header className="ask-card-head">
        <strong>✦ AI summary</strong>
        <button type="button" className="ask-send" onClick={run} disabled={busy || status !== 'ok'}>
          {busy ? 'Writing…' : text ? 'Refresh' : 'Summarize'}
        </button>
      </header>
      {error && <p className="ask-msg--error">{error}</p>}
      {text && (
        <>
          <Markdown text={text} />
          <Sources text={text} />
        </>
      )}
      <Disclaimer />
    </section>
  );
}

export default AiRaceSummary;
