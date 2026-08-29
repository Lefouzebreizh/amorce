import Link from 'next/link'

import type { Genre, Langue } from '../domaine/types.ts'
import { antennesDe } from '../serveur/antennes.ts'
import { depot } from '../serveur/depot-partage.ts'
import { adresseLecture } from '../serveur/flux.ts'
import { Dossier, Planche } from './Affiche.tsx'
import { Grille } from './Carte.tsx'
import { Mosaique } from './Mosaique.tsx'
import { Vide } from './Vide.tsx'

const LANGUES: readonly { valeur: Langue; libelle: string }[] = [
  { valeur: 'vf', libelle: 'VF' },
  { valeur: 'multi', libelle: 'Multi' },
  { valeur: 'vostfr', libelle: 'VOSTFR' },
  { valeur: 'vo', libelle: 'VO' },
]

const PAR_PAGE = 60

/**
 * En dessous de ce nombre de titres, pas de dossiers : la planche directement.
 *
 * Un écran de dossiers fait gagner du temps sur deux mille films et en fait
 * perdre sur douze — il ajoute alors un clic pour montrer ce qui tenait déjà à
 * l'écran. C'est la vérification d'interface qui l'a signalé, sur un catalogue
 * de trois séries : elle cherchait un titre et trouvait un dossier.
 */
export const SEUIL_DOSSIERS = 24

export interface Recherche {
  readonly langue?: string
  readonly groupe?: string
  /** Le thème ouvert. Présent mais vide : le dossier « Autres ». */
  readonly theme?: string
  readonly p?: string
}

function lien(base: string, actuel: Recherche, changement: Partial<Recherche>): string {
  const parametres = new URLSearchParams()
  const fusion = { ...actuel, ...changement, p: changement.p }
  for (const [cle, valeur] of Object.entries(fusion)) {
    // Le thème fait exception : sa chaîne vide **est** une valeur — le dossier
    // « Autres ». La retirer comme les autres le rendrait inatteignable.
    if (typeof valeur !== 'string') continue
    if (valeur !== '' || (cle === 'theme' && changement.theme === '')) parametres.set(cle, valeur)
  }
  const suffixe = parametres.toString()
  return suffixe === '' ? base : `${base}?${suffixe}`
}

/** Le libellé d'un thème : la chaîne vide est le fourre-tout, et se nomme. */
function nomTheme(nom: string): string {
  return nom === '' ? 'Autres' : nom
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

  const theme = recherche.theme
  const filtres = {
    genre,
    ...(langue === undefined ? {} : { langue }),
    ...(groupe === undefined ? {} : { groupe }),
    ...(theme === undefined ? {} : { theme }),
  }

  // Un film et une série se rangent par thème et se regardent en jaquettes ;
  // une chaîne se zappe dans une liste, dans l'ordre de la télécommande. Les
  // deux écrans ne se ressemblent pas parce que les deux gestes diffèrent.
  const parThemes = genre !== 'direct'

  const dossiers = parThemes
    ? cache.themes({ genre, ...(langue === undefined ? {} : { langue }) })
    : []
  const totalOeuvres = dossiers.reduce((somme, dossier) => somme + dossier.compte, 0)

  if (parThemes && theme === undefined && dossiers.length > 1 && totalOeuvres > SEUIL_DOSSIERS) {
    return (
      <>
        <header className="mb-4">
          <h1 className="text-2xl font-bold">{titre}</h1>
          <p className="text-doux">
            {totalOeuvres.toLocaleString('fr-FR')} titres, {dossiers.length} thèmes
          </p>
        </header>

        <div className="mb-5 flex flex-wrap gap-2">
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

        {dossiers.length === 0 ? (
          <p className="rounded-carte border border-bord bg-surface p-6 text-doux">
            Rien à ranger ici pour l’instant.
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {dossiers.map((dossier) => (
              <li key={dossier.nom || 'autres'}>
                <Dossier
                  href={lien(base, recherche, { theme: dossier.nom, p: undefined })}
                  nom={nomTheme(dossier.nom)}
                  compte={dossier.compte}
                  apercus={cache
                    .lister({ ...filtres, theme: dossier.nom, limite: 3 })
                    .map((element) => element.logo)
                    .filter((affiche): affiche is string => affiche !== undefined)}
                />
              </li>
            ))}
          </ul>
        )}
      </>
    )
  }
  const total = cache.compter(filtres)
  const elements = cache.lister({ ...filtres, limite: PAR_PAGE, decalage: (page - 1) * PAR_PAGE })
  const groupes = cache.groupes({ genre }).slice(0, 12)
  const pages = Math.max(1, Math.ceil(total / PAR_PAGE))

  return (
    <>
      <header className="mb-4">
        {/* Le retour n'a de sens que si l'on est entré dans un dossier : sur un
            petit catalogue, il n'y a pas d'écran de dossiers où revenir. */}
        {parThemes && theme !== undefined && (
          <Link href={lien(base, recherche, { theme: undefined, p: undefined })} className="text-sm text-doux">
            ‹ Tous les thèmes
          </Link>
        )}
        <h1 className="text-2xl font-bold">
          {parThemes && theme !== undefined ? nomTheme(theme) : titre}
        </h1>
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

      {!parThemes && groupes.length > 1 && (
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
        parThemes ? (
          <Planche elements={elements} />
        ) : (
          // Le direct se regarde, il ne se lit pas : la mosaïque montre ce qui
          // passe. L'adresse de lecture est calculée ici, côté serveur — elle
          // porte la signature, qui n'a rien à faire dans le navigateur.
          // `antennesDe` fait **une** requête pour toute la page : l'appeler
          // dans le map en ferait une par vignette, soit soixante allers-retours
          // là où il en faut un.
          <Mosaique
            chaines={((antennes) =>
              elements.map((element) => ({
              id: element.id,
              titre: element.titre,
              logo: element.logo,
              canal: element.canal,
              src: adresseLecture(element),
                antenne:
                  element.tvgId === undefined ? undefined : antennes.get(element.tvgId),
              })))(antennesDe(cache, elements))}
          />
        )
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
