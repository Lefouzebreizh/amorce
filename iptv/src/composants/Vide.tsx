/**
 * L'état vide, et pourquoi il compte plus qu'il n'en a l'air.
 *
 * Une application sans données affiche d'ordinaire une grille blanche, et la
 * personne devant conclut que c'est cassé. Ici on dit ce qui manque **et** la
 * commande exacte qui le règle : c'est le seul écran dont on est sûr qu'il sera
 * vu au premier lancement.
 */
export function Vide({ quoi }: { quoi: string }) {
  return (
    <div className="rounded-carte border border-bord bg-surface p-6">
      <h2 className="text-lg font-semibold">Rien à afficher : {quoi}</h2>
      <p className="mt-2 text-doux">
        Le cache est vide. Importez une liste — un fichier local ou l’adresse de votre
        fournisseur — puis rechargez la page&nbsp;:
      </p>
      <pre className="mt-3 overflow-x-auto rounded-lg bg-fond p-3 text-sm">
        <code>npm run iptv -- importer ma-liste.m3u</code>
      </pre>
      <p className="mt-3 text-sm text-doux">
        Rien de ce que vous importez ne quitte cette machine, et aucun mot de passe n’est
        enregistré en base.
      </p>
    </div>
  )
}

export function Section({
  titre,
  lien,
  children,
}: {
  titre: string
  lien?: { href: string; libelle: string }
  children: React.ReactNode
}) {
  return (
    <section className="mb-8">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold">{titre}</h2>
        {lien !== undefined && (
          <a href={lien.href} className="compact text-sm text-accent hover:underline">
            {lien.libelle}
          </a>
        )}
      </div>
      {children}
    </section>
  )
}
