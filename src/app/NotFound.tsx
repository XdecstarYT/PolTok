import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { EmptyState, PageHeader } from '../components';

/** Unknown routes get a real 404 instead of silently rendering Home. */
export default function NotFound() {
  const { pathname } = useLocation();
  useEffect(() => {
    document.title = 'Page not found · PolTok';
    let robots = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (!robots) {
      robots = document.createElement('meta');
      robots.name = 'robots';
      document.head.appendChild(robots);
    }
    robots.content = 'noindex';
    return () => robots?.remove();
  }, [pathname]);
  return (
    <div className="page page--narrow">
      <PageHeader kicker="Error 404" title="Page not found" crumbs={[{ to: '/', label: 'Home' }, { label: 'Not found' }]} />
      <EmptyState
        title="We couldn’t find that page"
        description={<>Nothing lives at <code>{pathname}</code>. It may have moved, or the link may be mistyped.</>}
        action={
          <div className="row" style={{ gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link className="btn btn--accent" to="/">Go home</Link>
            <Link className="btn" to="/live">Live results</Link>
            <Link className="btn" to={`/search?q=${encodeURIComponent(pathname.split('/').filter(Boolean).join(' '))}`}>Search</Link>
          </div>
        }
      />
    </div>
  );
}
