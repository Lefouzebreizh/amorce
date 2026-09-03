/*
 * Le téléphone du haut de page, dessiné en HTML et non photographié.
 *
 * L'invariant du dépôt interdit tout binaire versionné, et une capture d'écran
 * serait de toute façon fausse : le site montré ici n'existe pas encore, c'est
 * celui qu'on promet. Le dessiner en div coûte zéro octet de réseau, reste net
 * sur tous les écrans, et se corrige en changeant deux lignes le jour où
 * l'offre change.
 *
 * `aria-hidden` : rien de ce qui est écrit là-dedans n'a de sens lu à voix
 * haute. C'est une image, elle est décrite par le texte qui l'entoure.
 */
export function MockupChantier() {
  return (
    <div className="relative mx-auto w-full max-w-[19rem]" aria-hidden="true">
      {/* Le fond de chantier : bandes de signalisation et poussière de lumière,
          posées au gradient plutôt qu'en image.

          Il était en dégradé bleu clair, et il éclairait tout le bloc au milieu
          d'une page sombre — le téléphone flottait dans une tache blanche. Il
          prend le voile de la charte, qui est exactement ce que fait l'entête
          d'un site livré : un halo, pas un aplat. */}
      <div
        className="absolute inset-0 -m-6 rounded-[2.5rem] opacity-90"
        style={{
          background:
            'radial-gradient(120% 80% at 50% 0%, var(--color-voile) 0%, var(--color-slab) 55%, var(--color-ink) 100%)',
        }}
      />
      <div
        className="absolute inset-0 -m-6 rounded-[2.5rem] opacity-[0.18]"
        style={{
          background:
            'repeating-linear-gradient(135deg, var(--color-accent) 0 14px, transparent 14px 34px)',
        }}
      />

      <div className="relative rounded-[2.25rem] border border-edge bg-ink p-2 shadow-2xl">
        <div className="relative overflow-hidden rounded-[1.75rem] bg-slab">
          {/* L'encoche */}
          <div className="absolute left-1/2 top-2 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-ink" />

          {/* En-tête du site livré */}
          <div className="bg-accent px-4 pb-4 pt-8 text-accent-encre">
            <p className="text-[0.6rem] font-bold uppercase tracking-[0.2em] text-accent-encre/70">
              Maçonnerie
            </p>
            <p className="text-base font-bold leading-tight">DURAND &amp; FILS</p>
            <p className="mt-1 text-[0.65rem] text-accent-encre/80">Rennes et 30 km autour</p>
          </div>

          {/* La bande d'accroche */}
          <div className="bg-slab px-4 py-3">
            <p className="text-[0.7rem] font-bold leading-snug text-encre">
              Mur, terrasse, ouverture&nbsp;: devis sous 24 h.
            </p>
            <div className="mt-2 flex gap-1.5">
              <span className="rounded-md bg-accent px-2 py-1 text-[0.6rem] font-bold text-accent-encre">
                Appeler
              </span>
              <span className="rounded-md bg-[#25D366] px-2 py-1 text-[0.6rem] font-bold text-white">
                WhatsApp
              </span>
              <span className="rounded-md border border-accent px-2 py-1 text-[0.6rem] font-bold text-accent">
                Devis
              </span>
            </div>
          </div>

          {/* Trois chantiers en vitrine */}
          <div className="grid grid-cols-3 gap-1 px-4 py-3">
            {['var(--color-panel)', 'var(--color-edge)', 'var(--color-slab)'].map((teinte) => (
              <div key={teinte} className="h-10 rounded-md" style={{ backgroundColor: teinte }} />
            ))}
          </div>

          {/* La preuve */}
          <div className="border-t border-edge px-4 py-3">
            <p className="text-[0.6rem] font-semibold text-ardoise">★★★★★ 27 avis Google</p>
            <div className="mt-2 h-1.5 w-4/5 rounded-full bg-edge" />
            <div className="mt-1.5 h-1.5 w-3/5 rounded-full bg-edge" />
          </div>

          {/* Le bandeau d'appel collé en bas, comme sur les sites qu'on livre */}
          <div className="bg-accent px-4 py-2.5 text-center text-[0.7rem] font-bold text-accent-encre">
            06 12 34 56 78
          </div>
        </div>
      </div>
    </div>
  );
}
