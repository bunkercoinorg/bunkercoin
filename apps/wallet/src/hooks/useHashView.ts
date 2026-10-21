import { useCallback, useEffect, useState } from 'react';

export type ViewName = 'home' | 'send' | 'receive' | 'token' | 'tokens' | 'activity' | 'tx' | 'settings';

export interface View {
  name: ViewName;
  /** `#tx/<id>`, `#tokens/<id>`, `#settings/<sub>`. */
  param: string | null;
}

const NAMES: ViewName[] = ['home', 'send', 'receive', 'token', 'tokens', 'activity', 'tx', 'settings'];
const HOME: View = { name: 'home', param: null };

const PARENT: Partial<Record<ViewName, ViewName>> = { tx: 'activity', tokens: 'home', send: 'home' };

/** Unknown names go home; a missing or undecodable param falls back to the parent view. */
export function parseHash(hash: string): View {
  const [head, ...rest] = hash.replace(/^#/, '').split('/');
  const name = NAMES.find((n) => n === head);
  if (!name) return HOME;
  const up: View = { name: PARENT[name] ?? name, param: null };
  let param: string;
  try {
    param = decodeURIComponent(rest.join('/'));
  } catch {
    return up;
  }
  if (param) return { name, param };
  return name === 'tx' || name === 'tokens' ? up : { name, param: null };
}

export const viewHref = (name: ViewName, param?: string | null) =>
  `#${name}${param ? `/${encodeURIComponent(param)}` : ''}`;

/** The wallet's one route: views live in the hash so reload and back keep the place. */
export function useHashView(): [View, (href: string, replace?: boolean) => void] {
  const [view, setView] = useState<View>(HOME);
  useEffect(() => {
    const sync = () => setView(parseHash(window.location.hash));
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);
  const go = useCallback((href: string, replace = false) => {
    if (replace) window.history.replaceState(null, '', href);
    else window.history.pushState(null, '', href);
    setView(parseHash(href));
    window.scrollTo(0, 0);
  }, []);
  return [view, go];
}
