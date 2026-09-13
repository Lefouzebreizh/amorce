import type { ReactNode } from 'react';
import { BrandMark } from './LefouzebreizhUI';
import './brand-shell.css';

export type BrandNavItem = { label: string; href: string };

export function BretonErmine({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 112" role="img" aria-label="Hermine bretonne">
      <path fill="currentColor" d="M32 2 40 20 32 30 24 20 32 2ZM5 31l19-8 8 9-12 12L5 39v-8Zm54 0-19-8-8 9 12 12 15-5v-8ZM32 34c-6 12-11 24-11 38 0 10-5 20-14 31l17-7 8 14 8-14 17 7C48 92 43 82 43 72c0-14-5-26-11-38Z" />
    </svg>
  );
}

export function BrandNavigation({ items }: { items: BrandNavItem[] }) {
  return (
    <header className="lfb-nav">
      <a className="lfb-nav__brand" href="/" aria-label="Lefouzebreizh — accueil"><BrandMark /></a>
      <nav aria-label="Navigation principale"><ul>{items.map((item) => <li key={item.href}><a href={item.href}>{item.label}</a></li>)}</ul></nav>
      <a className="lfb-nav__cta" href="#univers">Explorer l’univers <span aria-hidden="true">→</span></a>
    </header>
  );
}

export function BrandFooter({ children }: { children?: ReactNode }) {
  return (
    <footer className="lfb-footer">
      <div className="lfb-footer__main"><BrandMark /><div className="lfb-footer__slot">{children}</div><div className="lfb-footer__breizh"><BretonErmine /><span>BRETAGNE<br />TOUJOURS PLUS LOIN</span></div></div>
      <div className="lfb-footer__meta"><span>La Bretagne en inspiration. Le monde en horizon.</span><span>Technologie · Humain · Bretagne · Demain</span></div>
    </footer>
  );
}
