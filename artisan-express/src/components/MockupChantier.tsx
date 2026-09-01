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
          posées au gradient plutôt qu'en image. */}
      <div
        className="absolute inset-0 -m-6 rounded-[2.5rem] opacity-90"
        style={{
          background:
            'radial-gradient(120% 80% at 50% 0%, #eef4fc 0%, #dbe6f5 55%, #c7d7ec 100%)',
        }}
      />
      <div
        className="absolute inset-0 -m-6 rounded-[2.5rem] opacity-[0.18]"
        style={{
          background:
            'repeating-linear-gradient(135deg, #004aad 0 14px, transparent 14px 34px)',
        }}
      />

      <div className="relative rounded-[2.25rem] border border-bordure bg-encre p-2 shadow-2xl">
        <div className="relative overflow-hidden rounded-[1.75rem] bg-white">
          {/* L'encoche */}
          <div className="absolute left-1/2 top-2 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-encre" />

          {/* En-tête du site livré */}
          <div className="bg-bleu px-4 pb-4 pt-8 text-white">
            <p className="text-[0.6rem] font-bold uppercase tracking-[0.2em] text-white/70">
              Maçonnerie
            </p>
            <p className="text-base font-bold leading-tight">DURAND &amp; FILS</p>
            <p className="mt-1 text-[0.65rem] text-white/80">Rennes et 30 km autour</p>
          </div>

          {/* La bande d'accroche */}
          <div className="bg-bleu-pale px-4 py-3">
            <p className="text-[0.7rem] font-bold leading-snug text-encre">
              Mur, terrasse, ouverture&nbsp;: devis sous 24 h.
            </p>
            <div className="mt-2 flex gap-1.5">
              <span className="rounded-md bg-chantier px-2 py-1 text-[0.6rem] font-bold text-white">
                Appeler
              </span>
              <span className="rounded-md bg-[#25D366] px-2 py-1 text-[0.6rem] font-bold text-white">
                WhatsApp
              </span>
              <span className="rounded-md border border-bleu px-2 py-1 text-[0.6rem] font-bold text-bleu">
                Devis
              </span>
            </div>
          </div>

          {/* Trois chantiers en vitrine */}
          <div className="grid grid-cols-3 gap-1 px-4 py-3">
            {['#b8c6d9', '#a5b7cd', '#c3cfdd'].map((teinte) => (
              <div key={teinte} className="h-10 rounded-md" style={{ backgroundColor: teinte }} />
            ))}
          </div>

          {/* La preuve */}
          <div className="border-t border-bordure px-4 py-3">
            <p className="text-[0.6rem] font-semibold text-ardoise">★★★★★ 27 avis Google</p>
            <div className="mt-2 h-1.5 w-4/5 rounded-full bg-bordure" />
            <div className="mt-1.5 h-1.5 w-3/5 rounded-full bg-bordure" />
          </div>

          {/* Le bandeau d'appel collé en bas, comme sur les sites qu'on livre */}
          <div className="bg-chantier px-4 py-2.5 text-center text-[0.7rem] font-bold text-white">
            06 12 34 56 78
          </div>
        </div>
      </div>
    </div>
  );
}
