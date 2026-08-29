import Link from 'next/link'

import type { Element } from '../domaine/types.ts'

// Les jaquettes, et pourquoi elles ne sont pas des logos agrandis.
//
// Une chaîne se reconnaît à son logo : un carré, une marque, lisible à
// cinquante pixels. Un film se reconnaît à son affiche : un rectangle 2:3,
// composé pour être vu de loin, et qui perd tout son sens recadré en carré.
// C'est pour cela que ce fichier existe à côté de `Carte.tsx` plutôt que de lui
// ajouter une option — les deux objets ne se regardent pas de la même façon.
//
// **L'image est un `<img>` nu, pas `next/image`.** Les adresses viennent de la
// liste du fournisseur, donc de n'importe quel domaine, et `next/image` exige
// de les autoriser une par une dans la configuration. Une jaquette pèse
// quelques dizaines de kilooctets ; l'optimiser casserait la moitié des
// vignettes pour rien.
//
// **Une jaquette absente n'est pas une case vide.** Beaucoup de listes n'en
// portent pas. Le repli montre le titre en grand sur un fond neutre — ce qui
// reste lisible, cliquable et de la même taille que les autres, plutôt qu'un
// trou dans la grille qui donne l'impression que le chargement a échoué.

function Repli({ titre }: { titre: string }) {
  return (
    <span className="flex h-full w-full items-center justify-center bg-surface-haute p-2">
      <span className="line-clamp-4 text-center text-sm font-medium text-doux">{titre}</span>
    </span>
  )
}

/**
 * Une jaquette, indépendante de ce qu'elle désigne.
 *
 * Un film mène au lecteur, une série mène à sa fiche — et une série n'est pas
 * un `Element`, elle n'a pas d'URL. Ce composant ne connaît donc qu'un lien, un
 * titre et une image, ce qui permet aux deux écrans de se ressembler sans que
 * l'un ait à faire semblant d'être l'autre.
 */
export function AfficheLien({
  href,
  titre,
  logo,
  sousTitre,
}: {
  href: string
  titre: string
  logo: string | undefined
  sousTitre?: string | undefined
}) {
  return (
    <Link
      href={href}
      className="group block rounded-carte border border-bord bg-surface p-2
                 transition-colors hover:border-accent hover:bg-surface-haute"
    >
      {/* 2 sur 3, le format d'une affiche de cinéma. Le rapport est imposé au
          conteneur et non à l'image : une jaquette carrée ou panoramique se
          contient alors dans le cadre au lieu de déformer la grille entière. */}
      <span className="block aspect-[2/3] overflow-hidden rounded-lg bg-surface-haute">
        {logo === undefined ? (
          <Repli titre={titre} />
        ) : (
          <img src={logo} alt="" loading="lazy" className="h-full w-full object-cover" />
        )}
      </span>

      <span className="mt-2 block truncate text-sm font-medium">{titre}</span>
      {sousTitre !== undefined && sousTitre !== '' && (
        <span className="block truncate text-xs text-doux">{sousTitre}</span>
      )}
    </Link>
  )
}

export function Affiche({
  element,
  sousTitre,
}: {
  element: Element
  sousTitre?: string | undefined
}) {
  const detail =
    sousTitre ??
    [element.annee, element.langue === 'inconnue' ? undefined : element.langue.toUpperCase()]
      .filter((part) => part !== undefined)
      .join(' · ')

  return (
    <AfficheLien
      href={`/lecture/${encodeURIComponent(element.id)}`}
      titre={element.titre}
      logo={element.logo}
      sousTitre={detail}
    />
  )
}

/**
 * Une planche de jaquettes.
 *
 * Trois colonnes sur téléphone : à 393 px de large, c'est 120 px par affiche —
 * assez pour reconnaître une image qu'on connaît déjà, ce qui est exactement ce
 * qu'on fait en parcourant un catalogue. Deux colonnes gaspilleraient l'écran,
 * quatre rendraient les titres illisibles.
 */
export function Planche({ elements }: { elements: readonly Element[] }) {
  return (
    <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
      {elements.map((element) => (
        <li key={element.id}>
          <Affiche element={element} />
        </li>
      ))}
    </ul>
  )
}

/**
 * Un dossier de thème : ce qu'on ouvre avant de voir des jaquettes.
 *
 * La cible fait toute la carte, jamais le seul libellé — quarante-quatre pixels
 * minimum, et un dossier se touche au pouce.
 */
export function Dossier({
  href,
  nom,
  compte,
  apercus,
}: {
  href: string
  nom: string
  compte: number
  apercus?: readonly string[]
}) {
  return (
    <Link
      href={href}
      className="flex min-h-[4.5rem] items-center gap-3 rounded-carte border border-bord
                 bg-surface p-3 transition-colors hover:border-accent hover:bg-surface-haute"
    >
      {/* Trois jaquettes en éventail : un dossier qui montre ce qu'il contient
          se choisit d'un coup d'œil, là où un nom seul se lit. */}
      <span className="flex shrink-0 -space-x-4">
        {(apercus ?? []).slice(0, 3).map((affiche, index) => (
          <span
            key={affiche}
            className="h-14 w-10 overflow-hidden rounded border border-bord bg-surface-haute"
            style={{ zIndex: 3 - index }}
          >
            <img src={affiche} alt="" loading="lazy" className="h-full w-full object-cover" />
          </span>
        ))}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{nom}</span>
        <span className="block text-sm text-doux">
          {compte.toLocaleString('fr-FR')} {compte > 1 ? 'titres' : 'titre'}
        </span>
      </span>
      <span aria-hidden className="text-doux">
        ›
      </span>
    </Link>
  )
}
