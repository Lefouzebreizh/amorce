'use client';

import { COFFRE_IMAGE, MER_VIDEO } from './coffreMedia';

type CoffreMerProps = {
  ouvert: boolean;
  onBasculer: () => void;
};

/**
 * Le coffre est volontairement un élément d'interface, pas une illustration
 * décorative : la porte possède une vraie position fermée et ouverte, et la
 * mer animée est un média léger qui reste visible dans les deux états.
 */
export function CoffreMer({ ouvert, onBasculer }: CoffreMerProps) {
  return (
    <section className={`coffre-mer ${ouvert ? 'coffre-mer--ouvert' : ''}`} aria-label="Coffre ouvert sur la mer">
      <img className="coffre-mer__image" src={COFFRE_IMAGE} alt="" aria-hidden="true" />
      <div className="coffre-mer__ocean" aria-hidden="true">
        <video autoPlay loop muted playsInline poster={COFFRE_IMAGE}>
          <source src={MER_VIDEO} type="video/mp4" />
        </video>
        <span className="coffre-mer__brume" />
        <span className="coffre-mer__lueur" />
      </div>
      <div className="coffre-mer__cadre" aria-hidden="true">
        <span className="coffre-mer__porte coffre-mer__porte--gauche"><i /><b /></span>
        <span className="coffre-mer__porte coffre-mer__porte--droite"><i /><b /></span>
        <span className="coffre-mer__seuil" />
      </div>
      <div className="coffre-mer__contenu">
        <p className="coffre-mer__eyebrow"><span /> Vue intérieure · côte bretonne</p>
        <h2>Le coffre s&apos;ouvre.<br /><em>La mer respire.</em></h2>
        <p>Un espace fermé au monde, ouvert sur ce qui te fait du bien.</p>
        <button type="button" onClick={onBasculer} aria-pressed={ouvert} className="coffre-mer__commande">
          <span aria-hidden="true">{ouvert ? '◐' : '◌'}</span>
          {ouvert ? 'Refermer le coffre' : 'Ouvrir sur la mer'}
        </button>
      </div>
    </section>
  );
}
