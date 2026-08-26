/*
 * Squelette affiché pendant que la page privée se rend côté serveur. Il reprend
 * la silhouette du tableau de bord : un titre, trois indicateurs, une liste.
 * Un simple « Chargement… » ferait sauter la mise en page à l'arrivée des
 * données.
 */
export default function Chargement() {
  return (
    <div className="flex animate-pulse flex-col gap-8" aria-hidden>
      <div className="h-8 w-56 rounded-md bg-muted" />

      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <div key={index} className="h-28 rounded-xl bg-muted" />
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((index) => (
          <div key={index} className="h-24 rounded-xl bg-muted" />
        ))}
      </div>
    </div>
  );
}
