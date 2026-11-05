import { useCallback, useEffect, useState } from 'react';
import { Button, Tabs } from '../../components';
import { clearToken, me } from './auth';
import { OwnerLoginForm } from './OwnerLogin';
import { TweetKit } from './TweetKit';
import { CardStudio } from './CardStudio';
import { Health } from './Health';
import { ContentTools } from './ContentTools';
import './owner.css';

type Tab = 'x' | 'studio' | 'health' | 'content';
const TABS: { id: Tab; label: string }[] = [
  { id: 'x', label: 'X / Twitter kit' },
  { id: 'studio', label: 'Card studio' },
  { id: 'health', label: 'Site health' },
  { id: 'content', label: 'Content tools' },
];

export default function OwnerPage() {
  const [auth, setAuth] = useState<'checking' | 'out' | { user: string; exp: number }>('checking');
  const [tab, setTab] = useState<Tab>('x');
  const check = useCallback(() => {
    me().then((u) => setAuth(u ?? 'out'));
  }, []);
  useEffect(() => {
    check();
    try {
      document.querySelector('meta[name="robots"]')?.setAttribute('content', 'noindex');
    } catch {
      /* ignore */
    }
  }, [check]);
  if (auth === 'checking') return <div className="ow-wrap"><p className="ow-muted">Checking session…</p></div>;
  if (auth === 'out')
    return (
      <div className="ow-wrap ow-wrap--login">
        <h1 className="ow-title">Owner sign-in</h1>
        <OwnerLoginForm onSuccess={check} />
      </div>
    );
  return (
    <div className="ow-wrap">
      <header className="ow-head">
        <div>
          <h1 className="ow-title">Owner panel</h1>
          <p className="ow-muted">Signed in as {auth.user} · session until {new Date(auth.exp).toLocaleTimeString()}</p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => { clearToken(); setAuth('out'); }}>Sign out</Button>
      </header>
      <div className="ow-tabs"><Tabs tabs={TABS} value={tab} onChange={setTab} variant="pill" ariaLabel="Owner tools" /></div>
      <div className="ow-body">
        {tab === 'x' && <TweetKit />}
        {tab === 'studio' && <CardStudio />}
        {tab === 'health' && <Health />}
        {tab === 'content' && <ContentTools />}
      </div>
    </div>
  );
}
