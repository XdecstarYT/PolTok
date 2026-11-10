/** /ask — "Night in 60 seconds" AI brief + full chat. */
import { useSeo } from '../../lib/seo';
import { PageHeader } from '../../components';
import { Markdown } from './Markdown';
import { Chat, Sources } from './Chat';
import { useAiOneShot, useAiStatus, errorText } from './useAsk';
import './ask.css';

export default function AskPage() {
  useSeo({ title: 'Ask PolTok', description: 'Ask questions about elections, results and polling.' });
  const status = useAiStatus();
  const brief = useAiOneShot('brief', 'Give me the night in 60 seconds.');
  const off = status === 'not_configured' || status === 'unavailable';
  return (
    <div className="page ask-page">
      <PageHeader kicker="AI assistant" title="Ask PolTok" crumbLabel="Ask" sub="An AI assistant grounded only in PolTok’s live results, markets and headlines. Every answer cites its sources." />
      {off && <p className="ask-empty" role="status">{errorText(status, '')}</p>}
      <section className="ask-card">
        <header className="ask-card-head">
          <strong>The night in 60 seconds</strong>
          <button type="button" className="ask-send" onClick={brief.run} disabled={off || brief.busy || status !== 'ok'}>
            {brief.busy ? 'Writing…' : brief.text ? 'Refresh' : 'Generate brief'}
          </button>
        </header>
        {brief.error && <p className="ask-msg--error">{brief.error}</p>}
        {brief.text && (
          <>
            <Markdown text={brief.text} />
            <Sources text={brief.text} />
          </>
        )}
      </section>
      <section className="ask-card ask-card--chat">
        <Chat hideOffNotice />
      </section>
    </div>
  );
}
