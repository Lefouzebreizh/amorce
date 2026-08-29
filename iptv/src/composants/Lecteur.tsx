'use client'

import { useEffect, useRef, useState } from 'react'

import {
  adresseAbsolue,
  moyensDiffusion,
  obstacleDiffusion,
  type MoyensDiffusion,
} from '../lecture/diffusion.ts'

interface Piste {
  readonly index: number
  readonly nom: string
}

interface PisteExterne {
  readonly id: string
  readonly fournisseur: string
  readonly langue: string
  readonly nom: string
}

interface Props {
  readonly id: string
  readonly src: string
  readonly positionDepart: number
  readonly direct: boolean
}

/** Le nom d'une piste tel qu'il s'affiche : ce que le flux déclare, ou son code. */
function nommer(piste: { name?: string; lang?: string }, rang: number): string {
  const nom = piste.name?.trim()
  if (nom !== undefined && nom !== '') return nom
  const langue = piste.lang?.trim()
  if (langue !== undefined && langue !== '') return langue.toUpperCase()
  return `Piste ${rang + 1}`
}

/*
 * Le lecteur.
 *
 * **Pas d'autoplay** : la lecture démarre sur un geste, jamais toute seule.
 * C'est une règle du dépôt, et elle évite aussi le refus silencieux des
 * navigateurs, qui bloquent une vidéo sonore lancée sans interaction — la page
 * paraît alors cassée sans qu'aucune erreur ne s'affiche.
 *
 * **hls.js seulement s'il le faut** : Safari lit HLS nativement et le fait
 * mieux (décodage matériel, économie de batterie). Ailleurs, aucun navigateur
 * de bureau ne sait lire un `.m3u8`, d'où la bibliothèque — chargée à la
 * demande, pour qu'elle ne pèse pas sur les écrans de navigation.
 */
export function Lecteur({ id, src, positionDepart, direct }: Props) {
  const video = useRef<HTMLVideoElement>(null)
  const [pistesAudio, setPistesAudio] = useState<Piste[]>([])
  const [pistesSousTitres, setPistesSousTitres] = useState<Piste[]>([])
  const [audioActive, setAudioActive] = useState(-1)
  const [sousTitreActif, setSousTitreActif] = useState(-1)
  const [erreur, setErreur] = useState<string | undefined>(undefined)
  const [externes, setExternes] = useState<PisteExterne[] | undefined>(undefined)
  const [motSousTitres, setMotSousTitres] = useState<string | undefined>(undefined)
  const [cherche, setCherche] = useState(false)
  // 'local' : la page décode. 'distant' : un appareil du salon s'en charge, et
  // la page ne fait plus que piloter.
  const [mode, setMode] = useState<'local' | 'distant'>('local')
  const [moyens, setMoyens] = useState<MoyensDiffusion>({ distant: false, airplay: false })
  const [appareils, setAppareils] = useState(false)
  const [motDiffusion, setMotDiffusion] = useState<string | undefined>(undefined)
  const detruireLecture = useRef<(() => void) | undefined>(undefined)
  const commande = useRef<{ audio: (i: number) => void; sousTitre: (i: number) => void }>({
    audio: () => {},
    sousTitre: () => {},
  })

  useEffect(() => {
    const element = video.current
    if (element === null) return
    let annule = false
    let detruire: (() => void) | undefined

    const natif = element.canPlayType('application/vnd.apple.mpegurl') !== ''

    const preparer = async (): Promise<void> => {
      // En diffusion, la source doit être une **adresse**, pas un flux assemblé
      // dans la page : c'est l'appareil du salon qui va la chercher.
      if (mode === 'distant') {
        element.src = adresseAbsolue(src, window.location.href)
        return
      }
      if (natif) {
        element.src = src
        return
      }

      const { default: Hls } = await import('hls.js')
      if (annule) return
      if (!Hls.isSupported()) {
        setErreur("Ce navigateur ne sait pas lire ce flux. Chrome, Edge ou Safari le font.")
        return
      }

      const hls = new Hls({ enableWorker: true, lowLatencyMode: direct })
      hls.attachMedia(element)
      hls.loadSource(src)

      const relever = (): void => {
        setPistesAudio(hls.audioTracks.map((piste, rang) => ({ index: rang, nom: nommer(piste, rang) })))
        setPistesSousTitres(
          hls.subtitleTracks.map((piste, rang) => ({ index: rang, nom: nommer(piste, rang) })),
        )
        setAudioActive(hls.audioTrack)
        setSousTitreActif(hls.subtitleTrack)
      }

      hls.on(Hls.Events.MANIFEST_PARSED, relever)
      hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, relever)
      hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, relever)
      hls.on(Hls.Events.ERROR, (_evenement, donnees) => {
        if (!donnees.fatal) return
        // Une erreur fatale n'est pas toujours définitive : hls.js sait
        // repartir d'un trou réseau ou d'une erreur de démuxage. On ne rend la
        // main à l'utilisateur qu'au troisième cas, celui dont on ne revient pas.
        if (donnees.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad()
        else if (donnees.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError()
        else setErreur('Le flux ne répond pas. Le fournisseur l’a peut-être retiré.')
      })

      commande.current = {
        audio: (rang) => {
          hls.audioTrack = rang
          setAudioActive(rang)
        },
        sousTitre: (rang) => {
          hls.subtitleTrack = rang
          hls.subtitleDisplay = rang !== -1
          setSousTitreActif(rang)
        },
      }
      detruire = () => hls.destroy()
      detruireLecture.current = detruire
    }

    void preparer()
    return () => {
      annule = true
      detruire?.()
      detruireLecture.current = undefined
    }
  }, [src, direct, mode])

  // Ce que le navigateur sait faire, et s'il voit un appareil.
  useEffect(() => {
    const element = video.current
    if (element === null) return
    const disponibles = moyensDiffusion(element)
    setMoyens(disponibles)
    if (!disponibles.distant) {
      // AirPlay ne dit pas s'il voit un appareil : le sélecteur s'en charge.
      setAppareils(disponibles.airplay)
      return
    }

    let annuler: (() => void) | undefined
    element.remote
      .watchAvailability((present) => setAppareils(present))
      .then((identifiant) => {
        annuler = () => void element.remote.cancelWatchAvailability(identifiant)
      })
      .catch(() => setAppareils(false))

    const fini = (): void => setMode('local')
    element.remote.addEventListener('disconnect', fini)
    return () => {
      annuler?.()
      element.remote.removeEventListener('disconnect', fini)
    }
  }, [])

  // Reprise de lecture : posée une fois les métadonnées connues, sinon la durée
  // vaut NaN et l'affectation est ignorée sans erreur.
  useEffect(() => {
    const element = video.current
    if (element === null || direct || positionDepart <= 0) return
    const poser = (): void => {
      element.currentTime = positionDepart
      element.removeEventListener('loadedmetadata', poser)
    }
    element.addEventListener('loadedmetadata', poser)
    return () => element.removeEventListener('loadedmetadata', poser)
  }, [positionDepart, direct])

  // La position se retient toutes les dix secondes, et une dernière fois au
  // départ de la page. `sendBeacon` est le seul envoi qui survive à la
  // fermeture d'un onglet — un `fetch` y est annulé avant d'être parti.
  useEffect(() => {
    if (direct) return
    const element = video.current
    if (element === null) return

    const retenir = (fiable: boolean): void => {
      const position = element.currentTime
      if (!Number.isFinite(position) || position <= 0) return
      const charge = JSON.stringify({
        id,
        position,
        duree: Number.isFinite(element.duration) ? element.duration : undefined,
      })
      if (fiable && typeof navigator.sendBeacon === 'function') {
        navigator.sendBeacon('/api/position', new Blob([charge], { type: 'application/json' }))
        return
      }
      void fetch('/api/position', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: charge,
        keepalive: true,
      })
    }

    const minuterie = setInterval(() => retenir(false), 10_000)
    const auDepart = (): void => retenir(true)
    element.addEventListener('pause', auDepart)
    window.addEventListener('pagehide', auDepart)
    return () => {
      clearInterval(minuterie)
      element.removeEventListener('pause', auDepart)
      window.removeEventListener('pagehide', auDepart)
      retenir(true)
    }
  }, [id, direct])

  /*
   * La recherche externe part sur un geste, jamais à l'ouverture.
   *
   * Une requête automatique dirait à un service tiers ce que la personne
   * regarde, à chaque lecture. Un sous-titre ne vaut pas cela — et dans le cas
   * courant, la vidéo à la demande porte déjà les siens.
   */
  const chercherSousTitres = async (): Promise<void> => {
    setCherche(true)
    try {
      const reponse = await fetch(`/api/sous-titres?e=${encodeURIComponent(id)}`)
      const donnees = (await reponse.json()) as {
        disponible?: boolean
        raison?: string
        pistes?: PisteExterne[]
      }
      setExternes(donnees.pistes ?? [])
      setMotSousTitres(
        donnees.disponible === false
          ? donnees.raison
          : (donnees.pistes ?? []).length === 0
            ? 'Aucun sous-titre trouvé pour ce titre.'
            : undefined,
      )
    } catch {
      setMotSousTitres('La recherche de sous-titres n’a pas abouti.')
      setExternes([])
    } finally {
      setCherche(false)
    }
  }

  /**
   * Ajoute une piste au lecteur.
   *
   * `<track>` posé dans le DOM ne s'affiche pas tout seul : il faut passer son
   * `mode` à « showing » **après** que le navigateur l'a enregistré, d'où le
   * passage par `video.textTracks` plutôt que par un attribut. Les autres
   * pistes sont éteintes au passage, sans quoi deux jeux de sous-titres se
   * superposent au bas de l'image.
   */
  const poserPiste = (piste: PisteExterne): void => {
    const element = video.current
    if (element === null) return

    const balise = document.createElement('track')
    balise.kind = 'subtitles'
    balise.label = `${piste.nom} (${piste.langue.toUpperCase()})`
    balise.srclang = piste.langue
    balise.src = `/api/sous-titres?piste=${encodeURIComponent(piste.id)}`
    balise.addEventListener('load', () => {
      for (const suivie of Array.from(element.textTracks)) {
        suivie.mode = suivie.label === balise.label ? 'showing' : 'disabled'
      }
    })
    element.append(balise)
  }

  /*
   * Diffuser, dans l'ordre où les gestes doivent se faire.
   *
   * Détruire hls.js **avant** de poser la source directe : laisser les deux en
   * place fait que la bibliothèque reprend la main sur l'élément et écrase
   * l'adresse qu'on vient d'y mettre — la diffusion démarre alors sur rien, et
   * l'appareil affiche un écran noir sans erreur.
   */
  const diffuser = async (): Promise<void> => {
    const element = video.current
    if (element === null) return

    const obstacle = obstacleDiffusion(window.location.href, moyens)
    if (obstacle !== undefined) {
      setMotDiffusion(obstacle)
      return
    }

    detruireLecture.current?.()
    detruireLecture.current = undefined
    element.src = adresseAbsolue(src, window.location.href)
    setMode('distant')

    try {
      if (moyens.distant) await element.remote.prompt()
      else (element as unknown as { webkitShowPlaybackTargetPicker: () => void }).webkitShowPlaybackTargetPicker()
    } catch {
      // Refus ou fermeture du sélecteur : on revient à la lecture locale.
      setMode('local')
    }
  }

  return (
    <div>
      <video
        ref={video}
        controls
        playsInline
        preload="metadata"
        className="aspect-video w-full rounded-carte bg-black"
      />

      {erreur !== undefined && (
        <p role="alert" className="mt-3 rounded-lg bg-red-500/15 p-3 text-red-200">
          {erreur}
        </p>
      )}

      {(appareils || motDiffusion !== undefined) && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => void diffuser()}
            aria-pressed={mode === 'distant'}
            className={`rounded-lg border px-4 py-2 ${
              mode === 'distant' ? 'border-accent bg-accent-sombre' : 'border-bord hover:border-accent'
            }`}
          >
            <span aria-hidden>▢</span>{' '}
            {mode === 'distant' ? 'Diffusion en cours — changer d’appareil' : 'Diffuser sur la télévision'}
          </button>
          {motDiffusion !== undefined && (
            <p className="mt-2 text-sm text-doux">{motDiffusion}</p>
          )}
          {mode === 'distant' && (
            <p className="mt-2 text-sm text-doux">
              L’appareil lit le flux lui-même ; ce téléphone peut se verrouiller.
            </p>
          )}
        </div>
      )}

      <div className="mt-4">
        {externes === undefined ? (
          <button
            type="button"
            onClick={() => void chercherSousTitres()}
            disabled={cherche}
            className="rounded-lg border border-bord px-4 py-2 text-sm text-doux hover:text-texte"
          >
            {cherche ? 'Recherche…' : 'Chercher des sous-titres'}
          </button>
        ) : (
          <div className="flex flex-wrap gap-2">
            {externes.map((piste) => (
              <button
                key={`${piste.fournisseur}-${piste.id}`}
                type="button"
                onClick={() => poserPiste(piste)}
                className="rounded-lg border border-bord px-3 py-2 text-sm hover:border-accent"
              >
                {piste.langue.toUpperCase()} · {piste.nom.slice(0, 40)}
              </button>
            ))}
          </div>
        )}
        {motSousTitres !== undefined && <p className="mt-2 text-sm text-doux">{motSousTitres}</p>}
      </div>

      {(pistesAudio.length > 1 || pistesSousTitres.length > 0) && (
        <div className="mt-4 flex flex-wrap gap-4">
          {pistesAudio.length > 1 && (
            <Choix
              intitule="Audio"
              pistes={pistesAudio}
              actif={audioActive}
              aucun={false}
              surChoix={(rang) => commande.current.audio(rang)}
            />
          )}
          {pistesSousTitres.length > 0 && (
            <Choix
              intitule="Sous-titres"
              pistes={pistesSousTitres}
              actif={sousTitreActif}
              aucun
              surChoix={(rang) => commande.current.sousTitre(rang)}
            />
          )}
        </div>
      )}
    </div>
  )
}

function Choix({
  intitule,
  pistes,
  actif,
  aucun,
  surChoix,
}: {
  intitule: string
  pistes: readonly Piste[]
  actif: number
  aucun: boolean
  surChoix: (rang: number) => void
}) {
  return (
    <fieldset>
      <legend className="mb-1 text-sm text-doux">{intitule}</legend>
      <div className="flex flex-wrap gap-2">
        {aucun && (
          <Bouton actif={actif === -1} onClick={() => surChoix(-1)}>
            Aucun
          </Bouton>
        )}
        {pistes.map((piste) => (
          <Bouton key={piste.index} actif={actif === piste.index} onClick={() => surChoix(piste.index)}>
            {piste.nom}
          </Bouton>
        ))}
      </div>
    </fieldset>
  )
}

function Bouton({
  actif,
  onClick,
  children,
}: {
  actif: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={actif}
      className={`rounded-lg border px-3 py-2 text-sm ${
        actif ? 'border-accent bg-accent-sombre text-texte' : 'border-bord text-doux hover:text-texte'
      }`}
    >
      {children}
    </button>
  )
}
