import { useEffect, useState } from 'react';
import { Skeleton } from '../components';

/** Route-chunk fallback: a quiet page-shaped placeholder, shown only if the chunk takes >150ms. */
export function PageSkeleton() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShow(true), 150);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="page page-skeleton" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Loading page…</span>
      {show && (
        <>
          <Skeleton width={220} height={30} radius={8} />
          <Skeleton width="min(520px, 100%)" height={14} style={{ marginTop: 12 }} />
          <div className="page-skeleton__grid">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="page-skeleton__card">
                <Skeleton width="40%" height={12} />
                <Skeleton lines={3} height={12} style={{ marginTop: 14 }} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
