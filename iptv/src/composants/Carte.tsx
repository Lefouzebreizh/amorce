import Link from 'next/link'

import type { Element } from '../domaine/types.ts'

const COULEUR_LANGUE: Record<string, string> = {
  vf: 'bg-emerald-500/15 text-emerald-300',
  multi: 'bg-sky-500/15 text-sky-300',
  vostfr: 'bg-amber-500/15 text-amber-300',
  vo: 'bg-slate-500/20 text-slate-300',
}

export function Etiquette({ texte, ton }: { texte: string; ton?: string }) {
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-xs font-medium uppercase tracking-wide ${
        ton ?? 'bg-bord text-doux'
      }`}
    >
      {texte}
    </span>
  )
}

/**
 * Une carte d'élément.
 *
 * Le logo est un `<img>` nu, pas `next/image` : les adresses viennent de la
 * liste du fournisseur, donc de n'importe quel domaine, et il faudrait les
 * autoriser un par un dans la configuration. Un logo de chaîne pèse deux
 * kilooctets ; l'optimiser ne rapporterait rien et casserait la moitié des
 * vignettes.
 */
export function Carte({ element, sousTitre }: { element: Element; sousTitre?: string }) {
  const detail =
    sousTitre ??
    (element.saison !== undefined || element.episode !== undefined
      ? `S${String(element.saison ?? 1).padStart(2, '0')}E${String(element.episode ?? 0).padStart(2, '0')}`
      : (element.groupe ?? ''))

  return (
    <Link
      href={`/lecture/${encodeURIComponent(element.id)}`}
      className="group flex items-center gap-3 rounded-carte border border-bord bg-surface p-3
                 transition-colors hover:border-accent hover:bg-surface-haute"
    >
      <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-haute">
        {element.logo === undefined ? (
          <span aria-hidden className="text-xl text-doux">
            {element.genre === 'direct' ? '◉' : element.genre === 'film' ? '▷' : '☰'}
          </span>
        ) : (
          <img src={element.logo} alt="" className="h-full w-full object-contain" loading="lazy" />
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{element.titre}</span>
        {detail !== '' && <span className="block truncate text-sm text-doux">{detail}</span>}
        <span className="mt-1 flex flex-wrap gap-1">
          {element.langue !== 'inconnue' && (
            <Etiquette texte={element.langue} ton={COULEUR_LANGUE[element.langue]} />
          )}
          {element.qualite !== 'inconnue' && <Etiquette texte={element.qualite} />}
          {element.annee !== undefined && <Etiquette texte={String(element.annee)} />}
        </span>
      </span>
    </Link>
  )
}

export function Grille({ elements }: { elements: readonly Element[] }) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {elements.map((element) => (
        <li key={element.id}>
          <Carte element={element} />
        </li>
      ))}
    </ul>
  )
}
