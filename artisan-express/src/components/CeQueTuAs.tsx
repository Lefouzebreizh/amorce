import { SECTION, TITRE_SECTION } from '@/components/ui';

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
      'Le même gabarit que mes pages « Les 10 meilleurs outils IA pour… », remis à ton métier, à ta ville et à tes chantiers. Une seule page, parce qu’un client qui cherche un couvreur ne lit pas six onglets.',
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
    <section className={SECTION} id="contenu">
      <h2 className={TITRE_SECTION}>Ce que tu as pour 299&nbsp;€</h2>
      <p className="mt-3 max-w-2xl text-lg text-ardoise">
        Tout est livré fini. Rien à installer, rien à apprendre, rien à payer le mois suivant.
      </p>

      <ul className="mt-10 grid gap-5 sm:grid-cols-2">
        {LOTS.map(({ icone: Icone, titre, texte }) => (
          <li
            key={titre}
            className="rounded-2xl border border-bordure bg-bleu-pale p-6 sm:p-7"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-bleu text-white">
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
            <h3 className="mt-4 text-xl font-bold text-encre">{titre}</h3>
            <p className="mt-2 leading-relaxed text-ardoise">{texte}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
