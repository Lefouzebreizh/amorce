'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'

import type { Antenne } from '../cache/depot.ts'
import { EnCours } from './Carte.tsx'

// La mosaïque : voir ce qui passe sans avoir à cliquer.
//
// **Pourquoi toutes les chaînes ne peuvent pas jouer en même temps**, et ce
// n'est pas un choix de confort. Trois plafonds, dans cet ordre de sévérité :
//
// 1. **L'abonnement.** Un fournisseur IPTV limite les connexions simultanées,
//    souvent à une ou deux. Vingt vignettes qui jouent, c'est vingt connexions
//    ouvertes : le serveur refuse tout, y compris la chaîne qu'on regardait.
//    C'est le plafond qui casse le plus vite, et le seul qu'on ne voit pas
//    venir — il se manifeste par des flux « morts » qui ne le sont pas.
// 2. **Le navigateur.** Chrome n'accorde que six à huit décodeurs vidéo
//    simultanés. Au-delà, les vignettes en trop restent noires sans erreur.
// 3. **La bande passante.** Une chaîne HD, c'est 3 à 6 Mb/s. Dix vignettes
//    saturent une fibre grand public à elles seules.
//
// D'où le plafond, et d'où le fait qu'il porte sur **ce qu'on regarde** : seules
// les vignettes visibles à l'écran consomment un créneau, et le libèrent en
// sortant du champ. Faire défiler ne cumule donc pas les connexions.
//
// **Le son reste coupé, et c'est aussi ce qui rend la lecture possible** : un
// navigateur refuse de démarrer une vidéo sonore sans geste de l'utilisateur.
// Une mosaïque sonore serait de toute façon inécoutable.
//
// **`prefers-reduced-motion` coupe l'aperçu par défaut.** Douze vidéos qui
// bougent en même temps sont exactement ce que ce réglage existe pour éviter,
// et le catalogue reste entièrement utilisable sans elles.

/** Vignettes qui jouent en même temps. Voir les trois plafonds ci-dessus. */
const CRENEAUX = 4

const MEMOIRE = 'iptv.apercu'

export interface ChaineApercu {
  readonly id: string
  readonly titre: string
  readonly logo: string | undefined
  readonly canal: number | undefined
  readonly src: string
  readonly antenne: Antenne | undefined
}

function Vignette({
  chaine,
  actif,
  surVisibilite,
}: {
  chaine: ChaineApercu
  actif: boolean
  surVisibilite: (id: string, visible: boolean) => void
}) {
  const cadre = useRef<HTMLLIElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const [joue, setJoue] = useState(false)

  // La visibilité, et rien d'autre : c'est elle qui donne droit à un créneau.
  useEffect(() => {
    const element = cadre.current
    if (element === null) return
    const observateur = new IntersectionObserver(
      (entrees) => {
        for (const entree of entrees) surVisibilite(chaine.id, entree.isIntersecting)
      },
      // Une marge d'une demi-hauteur d'écran : la vignette s'allume juste avant
      // d'arriver, plutôt qu'après, sinon on ne voit que des cases noires en
      // faisant défiler.
      { rootMargin: '50% 0px' },
    )
    observateur.observe(element)
    return () => {
      observateur.disconnect()
      surVisibilite(chaine.id, false)
    }
  }, [chaine.id, surVisibilite])

  useEffect(() => {
    const element = video.current
    if (element === null || !actif) return
    let annule = false
    let detruire: (() => void) | undefined

    const preparer = async (): Promise<void> => {
      if (element.canPlayType('application/vnd.apple.mpegurl') !== '') {
        element.src = chaine.src
      } else {
        const { default: Hls } = await import('hls.js')
        if (annule || !Hls.isSupported()) return
        const hls = new Hls({
          enableWorker: true,
          // La qualité la plus basse, et bornée à la taille réelle de la
          // vignette : une 1080p dans un cadre de 120 px coûte la bande
          // passante d'un plein écran pour un résultat identique à l'œil.
          startLevel: 0,
          capLevelToPlayerSize: true,
          // Un aperçu n'a pas besoin de tampon : dix secondes d'avance sur
          // quatre vignettes, c'est quarante secondes de vidéo téléchargée
          // pour rien à chaque défilement.
          maxBufferLength: 4,
          // Un aperçu qui rame ne se répare pas, il se remplace : on laisse
          // tomber plutôt que de s'acharner sur une chaîne morte.
          manifestLoadingMaxRetry: 1,
          levelLoadingMaxRetry: 1,
          fragLoadingMaxRetry: 1,
        })
        hls.attachMedia(element)
        hls.loadSource(chaine.src)
        detruire = () => {
          hls.destroy()
        }
      }
      if (annule) return
      // Muet obligatoire : un navigateur refuse de démarrer une vidéo sonore
      // sans geste explicite, et l'échec est silencieux.
      element.muted = true
      void element.play().catch(() => undefined)
    }

    void preparer()
    return () => {
      annule = true
      detruire?.()
      element.removeAttribute('src')
      element.load()
      setJoue(false)
    }
  }, [actif, chaine.src])

  return (
    <li ref={cadre}>
      <Link
        href={`/lecture/${encodeURIComponent(chaine.id)}`}
        className="group block overflow-hidden rounded-carte border border-bord bg-surface
                   transition-colors hover:border-accent"
      >
        <span className="relative block aspect-video bg-black">
          <video
            ref={video}
            muted
            playsInline
            preload="none"
            className={`h-full w-full object-contain transition-opacity ${joue ? 'opacity-100' : 'opacity-0'}`}
            onPlaying={() => {
              setJoue(true)
            }}
          />

          {/* Tant que l'image ne joue pas, le logo — jamais une case noire, qui
              ne se distingue pas d'une chaîne en panne. */}
          {!joue && (
            <span className="absolute inset-0 flex items-center justify-center p-3">
              {chaine.logo === undefined ? (
                <span className="truncate text-sm text-doux">{chaine.titre}</span>
              ) : (
                <img src={chaine.logo} alt="" loading="lazy" className="max-h-full max-w-full object-contain" />
              )}
            </span>
          )}

          {chaine.canal !== undefined && (
            <span className="absolute left-1 top-1 rounded bg-black/70 px-1.5 py-0.5 font-mono text-xs tabular-nums">
              {chaine.canal}
            </span>
          )}
        </span>

        <span className="block p-2">
          <span className="block truncate text-sm font-medium">{chaine.titre}</span>
          {/* Le même bloc que dans la liste : ce qui passe, l'avancement, ce
              qui suit. Le réécrire ici en aurait fait deux versions à tenir —
              c'est la vérification d'interface qui a signalé la première. */}
          {chaine.antenne !== undefined && <EnCours antenne={chaine.antenne} />}
        </span>
      </Link>
    </li>
  )
}

export function Mosaique({ chaines }: { chaines: readonly ChaineApercu[] }) {
  const [apercu, setApercu] = useState(false)
  const [actifs, setActifs] = useState<readonly string[]>([])
  const visibles = useRef<string[]>([])

  // Le réglage est lu **après** le premier rendu : le serveur ne connaît ni le
  // stockage local ni les préférences d'affichage, et lire l'un ou l'autre
  // pendant le rendu ferait diverger les deux HTML.
  useEffect(() => {
    let voulu = true
    try {
      const garde = window.localStorage.getItem(MEMOIRE)
      if (garde !== null) voulu = garde === 'oui'
      else voulu = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    } catch {
      voulu = true
    }
    setApercu(voulu)
  }, [])

  const basculer = (): void => {
    const suivant = !apercu
    setApercu(suivant)
    if (!suivant) setActifs([])
    try {
      window.localStorage.setItem(MEMOIRE, suivant ? 'oui' : 'non')
    } catch {
      // Navigation privée, stockage refusé : le réglage ne survit pas à la
      // page, et ce n'est pas une raison pour casser l'écran.
    }
  }

  // Identité stable, et ce n'est pas de la coquetterie : cette fonction est la
  // dépendance de l'`IntersectionObserver` de chaque vignette. Recréée à chaque
  // rendu, elle ferait démonter et remonter les soixante observateurs à chaque
  // changement de créneau — donc à chaque pixel de défilement.
  const surVisibilite = useCallback((id: string, visible: boolean): void => {
    const liste = visibles.current
    const rang = liste.indexOf(id)
    if (visible && rang === -1) liste.push(id)
    else if (!visible && rang !== -1) liste.splice(rang, 1)
    // Premier arrivé, premier servi : celui qui est déjà en train de jouer
    // garde son créneau tant qu'il reste à l'écran, sinon la mosaïque
    // clignoterait à chaque pixel de défilement.
    setActifs(liste.slice(0, CRENEAUX))
  }, [])

  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-3 rounded-carte border border-bord bg-surface p-3">
        <span className="min-w-0">
          <span className="block font-medium">Aperçu en direct</span>
          <span className="block text-sm text-doux">
            {CRENEAUX} chaînes à la fois, sans le son. Au-delà, un abonnement IPTV refuse les
            connexions.
          </span>
        </span>
        <button
          type="button"
          onClick={basculer}
          aria-pressed={apercu}
          className={`min-h-[44px] shrink-0 rounded-lg border px-4 text-sm ${
            apercu ? 'border-accent bg-accent-sombre' : 'border-bord text-doux'
          }`}
        >
          {apercu ? 'Activé' : 'Désactivé'}
        </button>
      </div>

      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {chaines.map((chaine) => (
          <Vignette
            key={chaine.id}
            chaine={chaine}
            actif={apercu && actifs.includes(chaine.id)}
            surVisibilite={surVisibilite}
          />
        ))}
      </ul>
    </>
  )
}
