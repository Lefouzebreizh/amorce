import Link from 'next/link'

import type { Genre, Langue } from '../domaine/types.ts'
import { antennesDe } from '../serveur/antennes.ts'
import { depot } from '../serveur/depot-partage.ts'
import { Grille } from './Carte.tsx'
import { Vide } from './Vide.tsx'

const LANGUES: readonly { valeur: Langue; libelle: string }[] = [
  { valeur: 'vf', libelle: 'VF' },
  { valeur: 'multi', libelle: 'Multi' },
  { valeur: 'vostfr', libelle: 'VOSTFR' },
  { valeur: 'vo', libelle: 'VO' },
]

const PAR_PAGE = 60

export interface Recherche {
  readonly langue?: string
  readonly groupe?: string
  readonly p?: string
}

function lien(base: string, actuel: Recherche, changement: Partial<Recherche>): string {
  const parametres = new URLSearchParams()
  const fusion = { ...actuel, ...changement, p: changement.p }
  for (const [cle, valeur] of Object.entries(fusion)) {
    if (typeof valeur === 'string' && valeur !== '') parametres.set(cle, valeur)
  }
  const suffixe = parametres.toString()
  return suffixe === '' ? base : `${base}?${suffixe}`
}

function Puce({ href, actif, children }: { href: string; actif: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1.5 text-sm ${
        actif ? 'border-accent bg-accent-sombre text-texte' : 'border-bord text-doux hover:text-texte'
      }`}
    >
      {children}
    </Link>
  )
}

/**
 * La grille d'un genre, avec ses filtres.
 *
 * Les filtres sont des **liens**, pas des champs : l'état vit dans l'adresse,
 * donc un filtre se partage, se met en favori et survit au retour arrière. Un
 * menu déroulant piloté en JavaScript aurait coûté un composant client et perdu
 * les trois.
 */
export function Catalogue({
  genre,
  titre,
  base,
  recherche,
}: {
  genre: Genre
  titre: string
  base: string
  recherche: Recherche
}) {
  const cache = depot()
  if (cache.compter() === 0) return <Vide quoi={titre.toLowerCase()} />

  const langue = LANGUES.find((entree) => entree.valeur === recherche.langue)?.valeur
  const groupe = recherche.groupe
  const page = Math.max(1, Number.parseInt(recherche.p ?? '1', 10) || 1)

  const filtres = {
    genre,
    ...(langue === undefined ? {} : { langue }),
    ...(groupe === undefined ? {} : { groupe }),
  }
  const total = cache.compter(filtres)
  const elements = cache.lister({ ...filtres, limite: PAR_PAGE, decalage: (page - 1) * PAR_PAGE })
  const groupes = cache.groupes({ genre }).slice(0, 12)
  const pages = Math.max(1, Math.ceil(total / PAR_PAGE))

  return (
    <>
      <header className="mb-4">
        <h1 className="text-2xl font-bold">{titre}</h1>
        <p className="text-doux">{total.toLocaleString('fr-FR')} entrées</p>
      </header>

      <div className="mb-3 flex flex-wrap gap-2">
        <Puce href={lien(base, recherche, { langue: '' })} actif={langue === undefined}>
          Toutes langues
        </Puce>
        {LANGUES.map((entree) => (
          <Puce
            key={entree.valeur}
            href={lien(base, recherche, { langue: entree.valeur })}
            actif={langue === entree.valeur}
          >
            {entree.libelle}
          </Puce>
        ))}
      </div>

      {groupes.length > 1 && (
        <div className="mb-5 flex flex-wrap gap-2">
          <Puce href={lien(base, recherche, { groupe: '' })} actif={groupe === undefined}>
            Tous groupes
          </Puce>
          {groupes.map((entree) => (
            <Puce
              key={entree.nom}
              href={lien(base, recherche, { groupe: entree.nom })}
              actif={groupe === entree.nom}
            >
              {entree.nom} <span className="text-doux">({entree.compte})</span>
            </Puce>
          ))}
        </div>
      )}

      {elements.length === 0 ? (
        <p className="rounded-carte border border-bord bg-surface p-6 text-doux">
          Aucun résultat avec ces filtres.
        </p>
      ) : (
        <Grille elements={elements} antennes={antennesDe(cache, elements)} />
      )}

      {pages > 1 && (
        <nav className="mt-6 flex items-center justify-between" aria-label="Pagination">
          {page > 1 ? (
            <Link
              href={lien(base, recherche, { p: String(page - 1) })}
              className="rounded-lg border border-bord px-4 py-2"
            >
              ← Précédent
            </Link>
          ) : (
            <span />
          )}
          <span className="text-sm text-doux">
            Page {page} sur {pages}
          </span>
          {page < pages ? (
            <Link
              href={lien(base, recherche, { p: String(page + 1) })}
              className="rounded-lg border border-bord px-4 py-2"
            >
              Suivant →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </>
  )
}
