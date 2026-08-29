'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ONGLETS = [
  { href: '/', libelle: 'Accueil', icone: '⌂' },
  { href: '/direct', libelle: 'Direct', icone: '◉' },
  { href: '/films', libelle: 'Films', icone: '▷' },
  { href: '/series', libelle: 'Séries', icone: '☰' },
  { href: '/recherche', libelle: 'Chercher', icone: '⌕' },
] as const

export function Navigation() {
  const chemin = usePathname()

  const actif = (href: string): boolean =>
    href === '/' ? chemin === '/' : chemin.startsWith(href)

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 border-t border-bord bg-surface/95 backdrop-blur
                 md:static md:w-48 md:shrink-0 md:border-r md:border-t-0 md:bg-transparent md:pt-6"
      aria-label="Navigation principale"
    >
      <ul className="flex md:flex-col md:gap-1">
        {ONGLETS.map((onglet) => (
          <li key={onglet.href} className="flex-1">
            <Link
              href={onglet.href}
              aria-current={actif(onglet.href) ? 'page' : undefined}
              className={`flex flex-col items-center justify-center gap-0.5 px-2 py-2 text-sm
                          md:flex-row md:justify-start md:gap-3 md:rounded-lg md:px-3 md:text-base
                          ${
                            actif(onglet.href)
                              ? 'text-accent md:bg-accent-sombre'
                              : 'text-doux hover:text-texte'
                          }`}
            >
              <span aria-hidden className="text-xl leading-none md:text-lg">
                {onglet.icone}
              </span>
              {onglet.libelle}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
