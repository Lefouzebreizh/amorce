'use client';

import { BOUTON_CONTOUR, BOUTON_PRINCIPAL, SECTION, TITRE_SECTION } from '@/components/ui';
import { OFFRES, type OffreId } from '@/lib/offres';

/* Les prix et périmètres viennent de src/lib/offres.ts, également utilisé par le formulaire. */
export function Offre() {
  function choisirOffre(id: OffreId) {
    window.dispatchEvent(new CustomEvent<OffreId>('artisan:offre', { detail: id }));
  }

  return (
    <section className="artisan-offre" id="offre">
      <div className={SECTION}>
        <div className="artisan-section-heading">
            <p className="artisan-kicker">En complément des outils</p>
            <h2 className={TITRE_SECTION}>Un site utile,<br /><span>si tu en as besoin.</span></h2>
            <p>Tu as déjà un site ? On le garde comme point de départ. Sinon, voici les formules de création. Ces prix ne comprennent pas les automatisations présentées plus haut.</p>
        </div>

        <div className="artisan-offre__stage" aria-label="Les trois formules Artisan Express">
          {OFFRES.map((offre, index) => (
            <article className={`artisan-offre__card artisan-offre__card--${offre.id}`} key={offre.id}>
              {offre.id === 'metier' ? <p className="artisan-offre__badge">Jusqu’à trois pages</p> : null}
              <div className="artisan-offre__card-head">
                <span>0{index + 1}</span>
                <p>{offre.repere}</p>
              </div>
              <h3>{offre.nom}</h3>
              <p className="artisan-offre__amount">{offre.prix}</p>
              <p className="artisan-offre__description">{offre.description}</p>
              <ul>
                {offre.details.map((detail) => <li key={detail}><span aria-hidden="true">↗</span>{detail}</li>)}
              </ul>
              <a className={offre.id === 'metier' ? BOUTON_PRINCIPAL : BOUTON_CONTOUR} href="#formulaire" onClick={() => choisirOffre(offre.id)}>
                Choisir {offre.nom}
              </a>
            </article>
          ))}
        </div>
        <p className="artisan-offre__note">Nom de domaine, hébergement et fonctions hors périmètre sont chiffrés séparément si nécessaires. Rien n’est prélevé depuis cette page.</p>
      </div>
    </section>
  );
}
