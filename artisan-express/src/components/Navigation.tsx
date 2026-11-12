import { BOUTON_PRINCIPAL } from '@/components/ui';

export function Navigation() {
  return (
    <nav className="artisan-nav" aria-label="Navigation principale">
      <div className="artisan-nav__inner">
        <a className="artisan-nav__brand" href="#top" aria-label="Artisan Express — retour en haut">
          <span className="artisan-nav__mark" aria-hidden="true">
            <span>AE</span>
          </span>
          <span>
            <strong>Artisan Express</strong>
            <small>par Lefouzèbreizh Studio</small>
          </span>
        </a>

        <div className="artisan-nav__links">
          <a href="#appels-manques">Appels manqués</a>
          <a href="#devis-vocal">Devis vocal</a>
          <a href="#presence-locale">Visibilité & avis</a>
        </div>

        <a className={`${BOUTON_PRINCIPAL} artisan-nav__cta`} href="#formulaire">
          Parlons de ton quotidien
        </a>
      </div>
    </nav>
  );
}
