import { useCallback, useEffect, useState } from 'react';
import { Button, Tabs } from '../../components';
import { clearToken, me } from './auth';
import { OwnerLoginForm } from './OwnerLogin';
import { TweetKit } from './TweetKit';
import { MakeWithAi } from './MakeWithAi';
import { CardStudio } from './CardStudio';
import { Health } from './Health';
import { ContentTools } from './ContentTools';
import { AiStudio } from './AiStudio';
import { Director } from './director/Director';
import { SocialPack } from './SocialPack';
import { MotionStudio } from './motion/MotionStudio';
import { OPEN_EDITOR } from './editorBus';
import { UpdatesAdmin } from './UpdatesAdmin';
import { XStudio, type XTab } from './xstudio/XStudio';
import { XReminders } from './xstudio/Reminders';
import { Analytics } from './Analytics';
import { MissingPhotos } from './MissingPhotos';
import './owner.css';

type Tab = 'xstudio' | 'analytics' | 'photos' | 'make' | 'director' | 'ai' | 'x' | 'studio' | 'motion' | 'social' | 'health' | 'content' | 'updates';
const TABS: { id: Tab; label: string }[] = [
  { id: 'xstudio', label: 'X Studio' },
  { id: 'make', label: 'Make with AI' },
  { id: 'director', label: 'Creative director' },
  { id: 'ai', label: 'AI Studio' },
  { id: 'x', label: 'X / Twitter kit' },
  { id: 'studio', label: 'Card studio' },
  { id: 'motion', label: 'Motion studio' },
  { id: 'social', label: 'Social pack' },
  { id: 'health', label: 'Site health' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'photos', label: 'Missing photos' },
  { id: 'content', label: 'Content tools' },
  { id: 'updates', label: 'Updates' },
];

export default function OwnerPage() {
  const [auth, setAuth] = useState<'checking' | 'out' | { user: string; exp: number }>('checking');
  const [tab, setTab] = useState<Tab>('xstudio');
  const [xs, setXs] = useState<{ tab: XTab; open: string | null; n: number }>({ tab: 'release', open: null, n: 0 });
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
  useEffect(() => {
    const on = () => setTab('studio');
    window.addEventListener(OPEN_EDITOR, on);
    return () => window.removeEventListener(OPEN_EDITOR, on);
  }, []);
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
      <XReminders onOpen={(id) => { setXs((x) => ({ tab: 'queue', open: id ?? null, n: x.n + 1 })); setTab('xstudio'); }} />
      <div className="ow-tabs"><Tabs tabs={TABS} value={tab} onChange={setTab} variant="pill" ariaLabel="Owner tools" /></div>
      <div className="ow-body">
        {tab === 'xstudio' && <XStudio key={xs.n} initialTab={xs.tab} openId={xs.open} />}
        {tab === 'analytics' && <Analytics />}
        {tab === 'photos' && <MissingPhotos />}
        {tab === 'make' && <MakeWithAi />}
        {tab === 'director' && <Director />}
        {tab === 'ai' && <AiStudio />}
        {tab === 'x' && <TweetKit />}
        {tab === 'studio' && <CardStudio />}
        {tab === 'motion' && <MotionStudio />}
        {tab === 'social' && <SocialPack />}
        {tab === 'health' && <Health />}
        {tab === 'content' && <ContentTools />}
        {tab === 'updates' && <UpdatesAdmin />}
      </div>
    </div>
  );
}
