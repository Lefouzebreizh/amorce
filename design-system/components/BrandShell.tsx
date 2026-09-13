import type { ReactNode } from 'react';
import Link from 'next/link';
import { BrandMark } from './LefouzebreizhUI';
import { BrandErmine } from './BrandErmine';
import './brand-shell.css';

export type BrandNavItem = { label: string; href: string };

export function BrandNavigation({ items }: { items: BrandNavItem[] }) {
  return (
    <header className="lfb-nav">
      <Link className="lfb-nav__brand" href="/" aria-label="Lefouzèbreizh — accueil"><BrandMark /></Link>
      <nav aria-label="Navigation principale"><ul>{items.map((item) => <li key={item.href}><a href={item.href}>{item.label}</a></li>)}</ul></nav>
      <a className="lfb-nav__cta" href="#univers">Explorer l’univers <span aria-hidden="true">→</span></a>
    </header>
  );
}

export function BrandFooter({ children }: { children?: ReactNode }) {
  return (
    <footer className="lfb-footer">
      <div className="lfb-footer__main"><BrandMark /><div className="lfb-footer__slot">{children}</div><div className="lfb-footer__breizh"><BrandErmine size={28} /><span>BRETAGNE<br />TOUJOURS PLUS LOIN</span></div></div>
      <div className="lfb-footer__meta"><span>La Bretagne en inspiration. Le monde en horizon.</span><span>Technologie · Humain · Bretagne · Demain</span></div>
    </footer>
  );
}
