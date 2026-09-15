import { ApercuSite } from '@/components/ApercuSite';

/*
 * Scène signature d’Artisan Express : les plans et les matières mettent en
 * relief un aperçu de site réellement livrable, sans simuler un faux chantier.
 */
export function AtelierIntro() {
  return (
    <div className="atelier-intro" aria-hidden="true">
      <span className="atelier-intro__halo" />
      <span className="atelier-intro__plan" />
      <span className="atelier-intro__roof" />
      <span className="atelier-intro__dot" />
    </div>
  );
}

export function MockupChantier() {
  return (
    <div className="atelier-scene" aria-hidden="true">
      <div className="atelier-scene__aura" />
      <div className="atelier-scene__blueprint" />
      <div className="atelier-scene__plan"><span /><span /><span /><i /></div>
      <div className="atelier-scene__material atelier-scene__material--stone"><span>MATIÈRE</span></div>
      <div className="atelier-scene__material atelier-scene__material--copper"><span>FINITION</span></div>
      <div className="atelier-scene__phone">
        <div className="atelier-scene__speaker" />
        <ApercuSite chargement="eager" contour="" fichier="/modeles/macon.html" hauteur="h-[26rem]" titre="Aperçu d’un site d’artisan livré, ouvert sur un téléphone" />
      </div>
      <div className="atelier-scene__label"><span className="atelier-scene__label-dot" /><span>Ton site, dans la main</span></div>
      <div className="atelier-scene__measure atelier-scene__measure--one" />
      <div className="atelier-scene__measure atelier-scene__measure--two" />
    </div>
  );
}
