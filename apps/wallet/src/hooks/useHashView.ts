import { useCallback, useEffect, useState } from 'react';

export type ViewName = 'home' | 'send' | 'receive' | 'token' | 'tokens' | 'activity' | 'tx' | 'settings';

export interface View {
  name: ViewName;
  /** `#tx/<id>`, `#tokens/<id>`, `#settings/<sub>`. */
  param: string | null;
}

const NAMES: ViewName[] = ['home', 'send', 'receive', 'token', 'tokens', 'activity', 'tx', 'settings'];
const HOME: View = { name: 'home', param: null };

export function parseHash(hash: string): View {
  const [head, ...rest] = hash.replace(/^#/, '').split('/');
  const name = NAMES.find((n) => n === head);
  if (!name) return HOME;
  const param = rest.length > 0 ? decodeURIComponent(rest.join('/')) : null;
  if ((name === 'tx' || name === 'tokens') && !param) return { name: name === 'tx' ? 'activity' : 'home', param: null };
  return { name, param };
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
