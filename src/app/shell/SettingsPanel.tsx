import { Modal, fmtTime, tzAbbr, useNow, LOCAL_TZ } from '../../components';
import { TIME_ZONES, useSettings, playCallChime, type AlertLevel } from '../../lib/settings';

function zoneNow(tz: string, now: number) {
  const id = tz === 'local' ? LOCAL_TZ : tz;
  try {
    const t = new Intl.DateTimeFormat('en-US', { timeZone: id, hour: 'numeric', minute: '2-digit' }).format(now);
    return `${t} ${tzAbbr(now, id)}`;
  } catch {
    return '';
  }
}

export function SettingsPanel() {
  const { settings, update, panelOpen: open, setPanelOpen } = useSettings();
  const onClose = () => setPanelOpen(false);
  const now = useNow(30000);
  const groups = [...new Set(TIME_ZONES.map((z) => z.group))];

  return (
    <Modal open={open} onClose={onClose} title="Settings" variant="sheet" width={560}>
      <div className="set">
        <section className="set__sec" aria-labelledby="set-ui">
          <h3 id="set-ui" className="set__h">Look</h3>
          <div className="set__looks" role="radiogroup" aria-labelledby="set-ui">
            {([
              ['command', 'Command Center', 'Dark neon election-night control room'],
              ['broadcast', 'Broadcast', 'Cable-news desk: navy & red, lower-third crawl, ALERT bars'],
              ['paper', 'Paper', 'Light broadsheet: newsprint, black ink, serif headlines'],
              ['terminal', 'Terminal', 'Market terminal: black, amber monospace, dense & square'],
              ['aurora', 'Aurora', 'Vibrant glass: purple-teal mesh, neon pink & cyan'],
            ] as const).map(([v, l, d]) => (
              <button key={v} type="button" role="radio" aria-checked={settings.ui === v} className={`set__look set__look--${v} ${settings.ui === v ? 'is-on' : ''}`} onClick={() => update({ ui: v })}>
                <span className="set__look-swatch" aria-hidden="true" />
                <b>{l}</b>
                <span className="set__help">{d}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="set__sec" aria-labelledby="set-tz">
          <h3 id="set-tz" className="set__h">Time zone</h3>
          <p className="set__help">Every time in PolTok — poll closings, race calls, the clock — is shown in this zone. Now: <b className="num">{fmtTime(now)} {tzAbbr(now)}</b></p>
          {groups.map((g) => (
            <div key={g} className="set__group">
              <div className="set__gl">{g}</div>
              <div className="set__grid" role="radiogroup" aria-label={`${g} time zones`}>
                {TIME_ZONES.filter((z) => z.group === g).map((z) => (
                  <button
                    key={z.id}
                    type="button"
                    role="radio"
                    aria-checked={settings.timeZone === z.id}
                    className={`set__opt ${settings.timeZone === z.id ? 'is-on' : ''}`}
                    onClick={() => update({ timeZone: z.id })}
                  >
                    <span className="set__opt-l">{z.label}{z.id === 'local' ? ` (${LOCAL_TZ.split('/').pop()?.replace(/_/g, ' ')})` : ''}</span>
                    <span className="set__opt-s num">{zoneNow(z.id, now)}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </section>

        <section className="set__sec" aria-labelledby="set-alerts">
          <h3 id="set-alerts" className="set__h">Race-call alerts</h3>
          <div className="set__seg" role="radiogroup" aria-labelledby="set-alerts">
            {([
              ['all', 'Every call'],
              ['key', 'Key races & flips'],
              ['off', 'Off'],
            ] as [AlertLevel, string][]).map(([v, l]) => (
              <button key={v} type="button" role="radio" aria-checked={settings.alerts === v} className={`set__segb ${settings.alerts === v ? 'is-on' : ''}`} onClick={() => update({ alerts: v })}>
                {l}
              </button>
            ))}
          </div>
          <label className="set__row">
            <span>
              <b>Sound</b>
              <span className="set__help">A short chime when a race is called.</span>
            </span>
            <input
              type="checkbox"
              className="set__switch"
              checked={settings.sound}
              onChange={(e) => {
                update({ sound: e.target.checked });
                if (e.target.checked) playCallChime('D');
              }}
            />
          </label>
        </section>

      </div>
    </Modal>
  );
}
