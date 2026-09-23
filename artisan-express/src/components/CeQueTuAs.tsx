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
    titre: 'Un site d’une page qui donne envie d’appeler',
    texte:
      'Un gabarit éprouvé, remis à ton métier, à ta ville et à tes chantiers. Une seule page, parce qu’un client qui cherche un couvreur ne lit pas six onglets.',
  },
  {
    icone: Telephone,
    titre: 'Appel direct, WhatsApp, devis',
    texte:
      'Trois boutons, toujours sous le pouce, du haut de la page jusqu’en bas. Celui qui tombe sur ton site à 19 h te joint sans chercher.',
  },
  {
    icone: Loupe,
    titre: 'Google trouve ton site',
    texte:
      'Titre, description, plan du site, fiche d’établissement reliée : ce qu’il faut pour sortir sur « ton métier + ta ville ». Je ne te promets pas la première place, je te promets d’exister.',
  },
  {
    icone: Camera,
    titre: 'Ta vidéo de chantier montée, offerte',
    texte:
      'Tu m’envoies deux minutes filmées au téléphone, je te rends un format court monté — rythme, sous-titres, musique. Je la facture 49 € en dehors de cette offre ; avec le site, elle est comprise.',
  },
] as const;

export function CeQueTuAs() {
  return (
    <section className={`${SECTION} artisan-inclus`} id="contenu">
      <div className="artisan-section-heading">
        <p className="artisan-kicker"><span>01</span> Une offre complète, sans surprise</p>
        <h2 className={TITRE_SECTION}>Tout ce qu’il faut.<br /><span>Rien qui ne serve.</span></h2>
        <p>
          Un site fini, pensé pour être vu sur téléphone et pour transformer une visite en appel.
          Rien à installer, rien à apprendre, rien à payer le mois suivant.
        </p>
      </div>

      <ul className="artisan-inclus__grid">
        {LOTS.map(({ icone: Icone, titre, texte }, index) => (
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
          </li>
        ))}
      </ul>
    </section>
  );
}
