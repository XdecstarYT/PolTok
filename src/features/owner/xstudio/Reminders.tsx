/** Banner shown when the owner panel opens: overdue / upcoming scheduled X posts and fresh auto-drafts. */
import { useEffect, useState } from 'react';
import { Button } from '../../../components';
import { getToken } from '../auth';
import { loadUpdates } from '../../updates/api';
import { autoDraftNew } from './autodraft';
import { reminders, subscribeQueue, queueState } from './queue';
import { fmtBoth } from './schedule';

export function XReminders({ onOpen }: { onOpen: (id?: string) => void }) {
  const [s, setS] = useState(queueState());
  const [hidden, setHidden] = useState(false);
  useEffect(() => subscribeQueue((st) => setS(st)), []);
  useEffect(() => {
    void loadUpdates(true, getToken()).then((posts) => autoDraftNew(posts)).catch(() => {});
  }, []);
  const r = reminders(s);
  const total = r.overdue.length + r.soon.length + r.autoDrafts.length;
  if (hidden || !total) return null;
  const first = r.overdue[0] ?? r.soon[0] ?? r.autoDrafts[0];
  return (
    <div className="xs-remind" role="status">
      <span className="xs-remind__dot" aria-hidden="true" />
      <div className="xs-remind__t">
        <b>X Studio:</b>{' '}
        {r.overdue.length > 0 && <span>{r.overdue.length} scheduled post{r.overdue.length === 1 ? ' is' : 's are'} overdue (“{r.overdue[0].title}”, {fmtBoth(r.overdue[0].scheduledAt!)}). </span>}
        {r.soon.length > 0 && <span>{r.soon.length} due in the next 2 hours. </span>}
        {r.autoDrafts.length > 0 && <span>{r.autoDrafts.length} auto-drafted post{r.autoDrafts.length === 1 ? '' : 's'} from new updates waiting for review.</span>}
      </div>
      <div className="ow-actions">
        <Button size="sm" onClick={() => onOpen(first?.id)}>Open</Button>
        <Button size="sm" variant="ghost" onClick={() => setHidden(true)}>Later</Button>
      </div>
    </div>
  );
}
