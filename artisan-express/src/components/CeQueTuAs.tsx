import { CARTE_VIOLET, FILET_VIOLET, SECTION, TITRE_SECTION } from '@/components/ui';

/*
 * Les pictogrammes sont dessinés à la main, en SVG, dans ce fichier.
 *
 * Une bibliothèque d'icônes pèse plus lourd que cette page entière pour quatre
 * traits. La règle du dépôt est claire : rien de lourd sans raison.
 */
const TRAITS = {
  strokeWidth: 1.7,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

function Ecran() {
  return (
    <>
      <rect x="4" y="3" width="16" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </>
  );
}

function Telephone() {
  return (
    <>
      <rect x="6" y="2" width="12" height="20" rx="3" />
      <path d="M11 18h2" />
    </>
  );
}

function Loupe() {
  return (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="m20 20-4.5-4.5" />
    </>
  );
}

function Camera() {
  return (
    <>
      <rect x="2" y="6" width="13" height="12" rx="2" />
      <path d="m15 11 6-3.5v9L15 13z" />
    </>
  );
}

const LOTS = [
  {
    icone: Ecran,
    titre: 'Un appel manqué, un contact préservé',
    texte:
      'Découvre comment un SMS pourrait prendre le relais quand tu ne peux pas répondre, puis te laisser une demande claire à rappeler.',
    lien: '#appels-manques',
  },
  {
    icone: Telephone,
    titre: 'Un devis préparé avant de rentrer',
    texte:
      'Dicte ou écris tes notes. Retrouve un brouillon organisé, complète tes prix et télécharge un PDF de démonstration.',
    lien: '#devis-vocal',
  },
  {
    icone: Loupe,
    titre: 'Une présence locale qui inspire confiance',
    texte:
      'Remets ta fiche Google au carré et prépare un message pour recueillir les retours de tes clients, sans leur imposer de note.',
    lien: '#presence-locale',
  },
  {
    icone: Camera,
    titre: 'Et un site, s’il sert ton activité',
    texte:
      'Pour montrer tes réalisations et compléter ta fiche Google, la création de sites reste disponible. Explore les exemples de ton métier.',
    lien: '#galerie',
  },
] as const;

export function CeQueTuAs() {
  return (
    <section className={`${SECTION} artisan-inclus`} id="contenu">
      <div className="artisan-section-heading">
        <p className="artisan-kicker">Moins de friction, du chantier au bureau</p>
        <h2 className={TITRE_SECTION}>Qu’est-ce qui te fait<br /><span>perdre du temps ?</span></h2>
        <p>
          Commence par ton problème le plus concret. Teste les démonstrations,
          puis on regarde ce qui mérite d’être installé chez toi.
        </p>
      </div>

      <ul className="artisan-inclus__grid">
        {LOTS.map(({ icone: Icone, titre, texte, lien }, index) => (
          /*
            Le filet violet coiffe la carte d'un dégradé d'un pixel. C'est le
            relief que réclame une hiérarchie sombre, et la seule chose que le
            violet a le droit de faire ici : il ne porte ni mot ni action, donc
            ses 3,42:1 ne s'appliquent pas — il n'y a rien à lire dessus.
          */
          <li key={titre} className={`${CARTE_VIOLET} ${FILET_VIOLET} artisan-inclus__card`}>
            <div className="artisan-inclus__meta">
              <span className="artisan-inclus__icon">
              <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                aria-hidden="true"
                {...TRAITS}
              >
                <Icone />
              </svg>
              </span>
              <span className="artisan-inclus__number">0{index + 1}</span>
            </div>
            <h3>{titre}</h3>
            <p>{texte}</p>
            <a className="pivot-lien" href={lien}>Découvrir ↗</a>
          </li>
        ))}
      </ul>
    </section>
  );
}
