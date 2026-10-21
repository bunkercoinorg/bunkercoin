'use client';

import { createContext, useContext, type AnchorHTMLAttributes, type ElementType, type ReactNode } from 'react';

export type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; external?: boolean };

const LinkContext = createContext<ElementType>('a');

/** Lets an app route internal links through its router (e.g. next/link); defaults to <a>. */
export function LinkProvider({ component, children }: { component: ElementType; children: ReactNode }) {
  return <LinkContext.Provider value={component}>{children}</LinkContext.Provider>;
}

export function Link({ external, href, ...rest }: LinkProps) {
  const Component = useContext(LinkContext);
  if (external) return <a href={href} rel="noopener noreferrer" {...rest} />;
  return <Component href={href} {...rest} />;
}
