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
          <p className="artisan-kicker"><span>05</span> Trois façons d’être visible</p>
          <h2 className={TITRE_SECTION}>Ton métier mérite<br /><span>la bonne échelle.</span></h2>
          <p>Chaque formule est un prix net, sans abonnement ni frais caché. Tu choisis le niveau qui correspond à ton activité aujourd’hui.</p>
        </div>

        <div className="artisan-offre__stage" aria-label="Les trois formules Artisan Express">
          {OFFRES.map((offre, index) => (
            <article className={`artisan-offre__card artisan-offre__card--${offre.id}`} key={offre.id}>
              {offre.id === 'metier' ? <p className="artisan-offre__badge">Le plus choisi</p> : null}
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
