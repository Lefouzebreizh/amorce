'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

// L'entretien du catalogue, sans terminal.
//
// **Pourquoi cet écran existe.** Ranger les chaînes et éprouver les flux se
// faisaient uniquement en ligne de commande. C'est tenable pour qui développe,
// et pas pour qui a installé l'application un soir : chaque entretien demandait
// de retrouver un terminal, le bon dossier et la bonne incantation — soit trois
// occasions d'abandonner avant d'avoir rien lancé.
//
// **Le test s'affiche en avançant, parce qu'il est long.** Deux cents flux
// prennent plusieurs minutes. Un bouton qui reste enfoncé pendant ce temps est
// indiscernable d'un bouton cassé : chaque lot rend son bilan, le compteur
// monte, et l'on voit que ça travaille. C'est la même leçon que « Connexion au
// flux… » sur le lecteur — un écran qui ne bouge pas est jugé en panne.
//
// **Rien n'est irréversible ici, et c'est dit.** Le seul geste qui retire
// quelque chose de la vue — masquer les flux morts — se défait d'un bouton
// voisin. Sans cette réversibilité affichée, personne n'ose lancer un balayage
// sur son propre catalogue.

interface Etat {
  readonly total: number
  readonly vivants: number
  readonly morts: number
  readonly inconnus: number
  readonly aTester: number
}

interface Avancement {
  readonly faits: number
  readonly total: number
  readonly ok: number
  readonly mort: number
  readonly inconnu: number
}

export function Entretien({ initial }: { initial: Etat }) {
  const router = useRouter()
  const [etat, setEtat] = useState(initial)
  const [occupe, setOccupe] = useState<'ranger' | 'tester' | 'ranimer' | undefined>(undefined)
  const [message, setMessage] = useState<string | undefined>(undefined)
  const [avancement, setAvancement] = useState<Avancement | undefined>(undefined)

  /**
   * Relit l'état **et** le reste de la page.
   *
   * Vu à l'écran : après un balayage qui masque cinquante chaînes, ce bloc
   * affichait les bons chiffres pendant que l'en-tête et les grilles du dessous
   * montraient encore le catalogue d'avant. Ils sont rendus par le serveur ;
   * seul `router.refresh()` les redemande. Sans lui, l'écran se contredit
   * lui-même jusqu'au prochain rechargement à la main.
   */
  const relire = async (): Promise<void> => {
    const reponse = await fetch('/api/entretien')
    setEtat((await reponse.json()) as Etat)
    router.refresh()
  }

  const appeler = async (tache: string, lot?: number): Promise<Record<string, number>> => {
    const reponse = await fetch('/api/entretien', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(lot === undefined ? { tache } : { tache, lot }),
    })
    return (await reponse.json()) as Record<string, number>
  }

  const ranger = async (): Promise<void> => {
    setOccupe('ranger')
    setMessage(undefined)
    try {
      const bilan = await appeler('ranger')
      await relire()
      const reclasses = bilan['reclasses'] ?? 0
      setMessage(
        (reclasses > 0
          ? `${String(reclasses)} entrées ont changé de genre — elles étaient classées par une ` +
            `règle depuis corrigée. `
          : '') +
          `${String(bilan['numerotees'])} chaînes numérotées sur ${String(bilan['chaines'])}. ` +
          `Les autres suivent par familles : sport, cinéma, musique, puis le reste.`,
      )
    } finally {
      setOccupe(undefined)
    }
  }

  const ranimer = async (): Promise<void> => {
    setOccupe('ranimer')
    setMessage(undefined)
    try {
      const bilan = await appeler('ranimer')
      setAvancement(undefined)
      await relire()
      setMessage(`${String(bilan['remis'])} entrées remises en jeu.`)
    } finally {
      setOccupe(undefined)
    }
  }

  const tester = async (): Promise<void> => {
    setOccupe('tester')
    setMessage(undefined)
    const total = etat.aTester
    let faits = 0
    const cumul = { ok: 0, mort: 0, inconnu: 0 }

    try {
      // Une boucle bornée par ce que le serveur dit rester, jamais par un
      // compteur local : un lot peut rendre moins que demandé, et une boucle
      // qui compte elle-même finirait par tourner à vide.
      for (;;) {
        const lot = await appeler('tester')
        if ((lot['faits'] ?? 0) === 0) break
        faits += lot['faits'] ?? 0
        cumul.ok += lot['ok'] ?? 0
        cumul.mort += lot['mort'] ?? 0
        cumul.inconnu += lot['inconnu'] ?? 0
        setAvancement({ faits, total: Math.max(total, faits), ...cumul })
        if ((lot['restants'] ?? 0) === 0) break
      }
      await relire()
      setMessage(
        `${String(cumul.ok)} vivants, ${String(cumul.mort)} hors service (masqués), ` +
          `${String(cumul.inconnu)} indécis — laissés visibles, parce qu'un refus ambigu ne ` +
          `dit rien de la santé d'un flux.`,
      )
    } finally {
      setOccupe(undefined)
    }
  }

  const enCours = occupe !== undefined
  const bouton =
    'min-h-[44px] rounded-lg border px-4 text-sm disabled:opacity-50 disabled:cursor-not-allowed'

  return (
    <section className="mb-6 rounded-carte border border-bord bg-surface p-4">
      <h2 className="font-semibold">Entretien du catalogue</h2>
      <p className="mt-1 text-sm text-doux">
        {etat.total.toLocaleString('fr-FR')} entrées — {etat.vivants} vérifiées vivantes,{' '}
        {etat.morts} masquées, {etat.aTester} jamais éprouvées.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void ranger()}
          disabled={enCours}
          className={`${bouton} border-accent bg-accent-sombre`}
        >
          {occupe === 'ranger' ? 'Rangement…' : 'Ranger les chaînes'}
        </button>
        <button
          type="button"
          onClick={() => void tester()}
          disabled={enCours || etat.aTester === 0}
          className={`${bouton} border-bord`}
        >
          {occupe === 'tester' ? 'Test en cours…' : `Éprouver ${String(etat.aTester)} flux`}
        </button>
        {etat.morts > 0 && (
          <button
            type="button"
            onClick={() => void ranimer()}
            disabled={enCours}
            className={`${bouton} border-bord text-doux`}
          >
            Tout remettre en jeu
          </button>
        )}
      </div>

      {avancement !== undefined && (
        <div className="mt-3">
          <div className="h-2 w-full overflow-hidden rounded bg-bord">
            <div
              className="h-full bg-accent transition-all"
              style={{ width: `${String(Math.round((avancement.faits / Math.max(1, avancement.total)) * 100))}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-doux">
            {avancement.faits} / {avancement.total} — {avancement.ok} vivants, {avancement.mort}{' '}
            hors service, {avancement.inconnu} indécis
          </p>
        </div>
      )}

      {message !== undefined && <p className="mt-3 text-sm">{message}</p>}

      <p className="mt-3 text-xs text-doux">
        Rien n’est effacé : masquer se défait, et les identifiants d’un abonnement se posent
        toujours au terminal, jamais ici.
      </p>
    </section>
  )
}
