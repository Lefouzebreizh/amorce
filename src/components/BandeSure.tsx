import { BANDE_SURE } from '@/lib/captions';

/**
 * La preuve visuelle de la page d'accueil, dessinée et non photographiée.
 *
 * ## Pourquoi un dessin plutôt qu'une capture
 *
 * L'invariant 8 interdit tout binaire versionné : un PNG de capture n'a pas sa
 * place dans ce dépôt. La contrainte tombe bien, parce qu'une capture d'écran
 * du studio montrerait une interface, là où ce qu'il faut montrer est un
 * **raisonnement** — pourquoi le texte se pose là et pas ailleurs.
 *
 * ## Ce que le dessin dit, et qu'aucun paragraphe ne dit aussi vite
 *
 * Les trois plateformes ne mangent pas les mêmes bords, et c'est leur
 * intersection qui décide. Un texte posé au milieu de l'image — le réflexe —
 * passe sous la description d'Instagram. Le montrer prend une seconde ;
 * l'expliquer prend un paragraphe qu'on ne lit pas.
 *
 * ## Les chiffres viennent du code, pas d'une recopie
 *
 * `BANDE_SURE` est la constante que le moteur applique réellement au tracé des
 * sous-titres. La page ne peut donc pas afficher une bande différente de celle
 * qui est posée sur les vidéos : si la constante bouge, le dessin bouge avec.
 * Une valeur recopiée à la main aurait dérivé au premier ajustement.
 */

/** Ce que chaque plateforme recouvre, relevé sur le terrain de référence. */
const HABILLAGES = [
  { nom: 'TikTok', de: 0.72, a: 1 },
  { nom: 'Instagram', de: 0.63, a: 1 },
] as const;

const HAUT = BANDE_SURE.haut;
const BAS = BANDE_SURE.bas;

export function BandeSure() {
  const pourcent = (v: number) => `${Math.round(v * 100)} %`;

  return (
    <figure className="flex flex-col gap-4">
      <div className="flex justify-center">
        {/*
          Un seul cadre, pas deux côte à côte : à 393 px de large, deux formats
          verticaux font 180 px chacun et la différence qu'on venait montrer
          disparaît. Le rapport 9:16 est celui de la composition réelle.
        */}
        <div className="relative aspect-[9/16] w-full max-w-[15rem] overflow-hidden rounded-2xl border border-edge bg-slab">
          {/* Ce que les plateformes recouvrent, du plus permissif au plus strict. */}
          {HABILLAGES.map((h) => (
            <div
              key={h.nom}
              className="absolute inset-x-0 bg-danger/15"
              style={{ top: `${h.de * 100}%`, bottom: `${(1 - h.a) * 100}%` }}
            />
          ))}
          {/* La bande où un texte survit sur les trois. */}
          <div
            className="absolute inset-x-0 border-y border-dashed border-accent/60 bg-accent/10"
            style={{ top: `${HAUT * 100}%`, bottom: `${(1 - BAS) * 100}%` }}
          />
          {/* Le sous-titre, posé là où le moteur le pose. */}
          <div
            className="absolute inset-x-3 flex items-center justify-center"
            style={{ top: `${HAUT * 100}%`, bottom: `${(1 - BAS) * 100}%` }}
          >
            <span className="text-center text-sm font-bold uppercase leading-tight tracking-tight text-mist">
              Ton texte
              <br />
              tient ici
            </span>
          </div>
          {/* Le repère du réflexe : le milieu de l'image, déjà recouvert. */}
          <div className="absolute inset-x-0 top-1/2 border-t border-dotted border-muted/50" />
          <span className="absolute right-2 top-[calc(50%+0.25rem)] text-[11px] tabular-nums text-muted">
            50 %
          </span>
        </div>
      </div>

      <figcaption className="flex flex-col gap-2 text-base leading-relaxed text-muted">
        <span className="flex flex-wrap gap-x-4 gap-y-1">
          <span className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm bg-danger/40" aria-hidden="true" />
            recouvert par l’habillage
          </span>
          <span className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm bg-accent/40" aria-hidden="true" />
            {pourcent(HAUT)} à {pourcent(BAS)} — la bande sûre
          </span>
        </span>
        <span>
          TikTok ferme à {pourcent(HABILLAGES[0].de)}, Instagram dès{' '}
          {pourcent(HABILLAGES[1].de)}, et Facebook mange la gauche. Un texte posé
          au milieu — le réflexe — passe sous la description. Amorce le pose dans
          l’intersection, sans que tu aies à y penser.
        </span>
      </figcaption>
    </figure>
  );
}
