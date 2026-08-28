import { Grille } from '../../composants/Carte.tsx'
import { Vide } from '../../composants/Vide.tsx'
import { depot } from '../../serveur/depot-partage.ts'

/*
 * La recherche est un formulaire qui poste dans l'adresse, sans une ligne de
 * JavaScript. Elle fonctionne donc avant l'hydratation, se partage par lien, et
 * survit au retour arrière. La base répond en treize millisecondes sur 120 000
 * entrées : la recherche « à la frappe » n'apporterait qu'une dépendance.
 */
export default async function Recherche({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const cache = depot()
  if (cache.compter() === 0) return <Vide quoi="la recherche" />

  const saisie = q ?? ''
  const resultats = saisie.trim() === '' ? [] : cache.chercher(saisie, { limite: 60 })

  return (
    <>
      <h1 className="mb-4 text-2xl font-bold">Chercher</h1>

      <form action="/recherche" method="get" className="mb-6 flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={saisie}
          placeholder="Un titre, une chaîne, une série…"
          aria-label="Chercher dans le catalogue"
          autoFocus
          className="min-h-[44px] w-full min-w-0 flex-1 rounded-lg border border-bord bg-surface px-4 py-2
                     text-texte placeholder:text-doux focus:border-accent focus:outline-none"
        />
        <button
          type="submit"
          className="shrink-0 rounded-lg border border-accent bg-accent-sombre px-4 py-2"
        >
          Chercher
        </button>
      </form>

      {saisie.trim() === '' ? (
        <p className="text-doux">Tapez quelques lettres : la recherche répond avant la fin du mot.</p>
      ) : resultats.length === 0 ? (
        <p className="rounded-carte border border-bord bg-surface p-6 text-doux">
          Rien pour « {saisie} ». Les accents et la casse sont ignorés ; essayez un mot plus court.
        </p>
      ) : (
        <>
          <p className="mb-3 text-doux">{resultats.length} résultats</p>
          <Grille elements={resultats} />
        </>
      )}
    </>
  )
}
