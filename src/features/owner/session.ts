/** Is this visitor the signed-in owner? Light module (no owner UI): regular visitors without a token make
 *  no request at all; with a token we verify it once per page load against /api/owner/me. */
import { useEffect, useState } from 'react';
import { getToken, me } from './auth';

let verified: Promise<boolean> | null = null;
export function checkOwner(): Promise<boolean> {
  if (!getToken()) return Promise.resolve(false);
  verified ??= me().then((u) => !!u).catch(() => false);
  return verified;
}

export function useIsOwner(): boolean {
  const [owner, setOwner] = useState(false);
  useEffect(() => {
    let live = true;
    checkOwner().then((v) => live && setOwner(v));
    return () => void (live = false);
  }, []);
  return owner;
}
