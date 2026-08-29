/*
 * Du dossier de commande au site livré.
 *
 * C'est l'étape qui manquait : `titan-builder` recueillait tout — modèle,
 * couleur, options cochées, photos — puis s'arrêtait sur un `commande.json`
 * dans un dossier, et le site se construisait ensuite à la main. Vendre trois
 * sites dans la semaine voulait donc dire les écrire trois fois.
 *
 * **Une page HTML autonome, et rien d'autre.** Le site d'un artisan tient sur
 * une page : un cadre applicatif y ajouterait une compilation, un hébergeur qui
 * exécute du Node, et un redéploiement pour changer un numéro de téléphone. Un
 * fichier unique se dépose sur n'importe quel hébergement, s'ouvre depuis une
 * clé USB pour le montrer au client, et se corrige par n'importe qui.
 *
 * **Ce module est pur**, comme `commande.ts` : il rend une chaîne, il ne touche
 * ni au disque ni au réseau. Seul le script d'appel écrit. C'est ce qui permet
 * de l'éprouver sans rien installer et de voir le résultat sans rien déployer.
 *
 * **Ce qui n'est pas réglé disparaît**, jamais un texte de remplacement : c'est
 * la règle de la page de vente d'`artisan-express`, et elle vaut doublement
 * ici. Un « [votre slogan] » resté sur le site d'un client est une facture
 * qu'on ne réclame pas.
 */

/*
 * Import relatif, et non l'alias `@/` du reste du dépôt : ce module est chargé
 * par `scripts/generer.mjs`, qui doit tourner avec `node` tout court, sans le
 * résolveur d'alias du harnais de test. Un script de livraison qui exige un
 * harnais n'est pas un script de livraison.
 */
import { MODELES, OPTIONS, modeleParId, type Commande, type IdentifiantOption } from './commande.ts';

/**
 * Échappe ce qui va entre des balises.
 *
 * Ce n'est pas une précaution de principe : le nom d'entreprise, le slogan et
 * la liste des services viennent d'un formulaire public. Sans cela, une
 * commande contenant `<script>` produirait un site qui l'exécute — chez le
 * client, sous son nom de domaine.
 */
/** L'encre sombre de la page, et le seul candidat foncé pour un texte. */
export const ENCRE = '#16202b';

export function echapper(texte: string): string {
  return texte
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** `06 12 34 56 78` → `+33612345678`. Même règle que la page de vente. */
export function lienTelephonique(brut: string): string {
  const chiffres = brut.replace(/[^\d+]/g, '');
  if (chiffres.startsWith('+')) return chiffres;
  if (chiffres.startsWith('0')) return `+33${chiffres.slice(1)}`;
  return chiffres;
}

/* ── La lisibilité, calculée et non supposée ──────────────────────────────── */

/*
 * Le client choisit sa couleur, et la page écrivait du blanc dessus quel que
 * soit son choix. Un artisan qui dit « jaune » recevait donc un titre à 1,4:1 —
 * illisible sur un chantier, en plein soleil, sur un téléphone à moitié
 * assombri. Ce n'est pas un détail d'esthétique : c'est la page qui ne se lit
 * pas là où elle est lue.
 *
 * Rien ici ne refuse ni ne remplace la couleur du client. On change **ce qu'on
 * écrit dessus**, et on assombrit la teinte pour le seul usage où elle sert de
 * texte. Sa couleur reste la sienne partout où elle est un fond.
 */

function canaux(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
}

function versHex(rvb: readonly number[]): string {
  return `#${rvb.map((c) => Math.round(Math.min(1, Math.max(0, c)) * 255).toString(16).padStart(2, '0')).join('')}`;
}

/** La luminance relative WCAG. */
function luminance(hex: string): number {
  const [r, v, b] = canaux(hex).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * v + 0.0722 * b;
}

/** Le rapport de contraste WCAG entre deux couleurs, de 1 à 21. */
export function contraste(a: string, b: string): number {
  const [clair, sombre] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (clair + 0.05) / (sombre + 0.05);
}

/**
 * Ce qu'on écrit sur la couleur du client : blanc, ou l'encre sombre.
 *
 * On prend le meilleur des deux plutôt que d'imposer le blanc. Sur un bleu
 * profond c'est le blanc qui gagne, sur un jaune c'est l'encre — et dans les
 * deux cas le titre se lit.
 */
export function encreSurAccent(accent: string): string {
  return contraste(accent, ENCRE) > contraste(accent, '#ffffff') ? ENCRE : '#ffffff';
}

/**
 * La couleur du client, assombrie ou éclaircie juste assez pour servir de
 * texte sur le fond de la page.
 *
 * Le bouton secondaire écrit l'accent sur du papier : un jaune y disparaît. On
 * la déplace par pas de 4 % vers le noir (ou vers le blanc en thème sombre)
 * jusqu'à franchir 4,5:1, et on s'arrête là — un pas de plus dénaturerait la
 * teinte sans rien gagner. Trente pas suffisent à atteindre le noir ou le
 * blanc purs, qui contrastent toujours : la boucle se termine toujours.
 */
export function accentLisible(accent: string, fond: string): string {
  const vers = luminance(fond) > 0.5 ? 0 : 1;
  let couleur = accent;

  for (let pas = 0; pas < 30 && contraste(couleur, fond) < 4.5; pas += 1) {
    couleur = versHex(canaux(couleur).map((c) => c + (vers - c) * 0.04));
  }

  return couleur;
}

/**
 * Une couleur de commande, ou celle du modèle.
 *
 * On n'accepte qu'un hexadécimal : la valeur part dans une feuille de style, et
 * une chaîne libre y ouvrirait une injection CSS. Un client qui a laissé le
 * champ vide reçoit la teinte de son modèle plutôt qu'un noir par défaut.
 */
export function couleurRetenue(commande: Commande): string {
  const propre = commande.couleur.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(propre)) return propre;
  return modeleParId(commande.modele)?.teintes[0] ?? '#004AAD';
}

/**
 * La présentation, un paragraphe par ligne vide, vides écartés.
 *
 * Le texte arrive d'un `<textarea>` : l'artisan y saute des lignes, et les
 * rendre dans un seul `<p>` collait ses paragraphes bout à bout — un pavé que
 * personne ne lit sur un téléphone, alors qu'il avait pris la peine d'aérer.
 */
export function paragraphes(texte: string): string[] {
  return texte
    .split(/\n\s*\n/)
    .map((p) => p.trim().replace(/\s*\n\s*/g, ' '))
    .filter((p) => p !== '');
}

/** Les services, une ligne par service, vides écartés. */
export function servicesListes(commande: Commande): string[] {
  return commande.services
    .split(/[\n;]+/)
    .map((s) => s.trim())
    .filter((s) => s !== '');
}

function aOption(commande: Commande, id: IdentifiantOption): boolean {
  return commande.options.includes(id);
}

export type Photo = { readonly fichier: string; readonly legende?: string };

/**
 * Le site complet, en une chaîne.
 *
 * Les photos sont désignées **en relatif** : le dossier produit se dépose tel
 * quel sur un hébergement, se zippe, ou s'ouvre depuis le disque. Un chemin
 * absolu ferait un site qui marche chez celui qui l'a fabriqué et nulle part
 * ailleurs.
 */
export function genererSite(commande: Commande, photos: readonly Photo[] = []): string {
  const modele = modeleParId(commande.modele);
  const couleur = couleurRetenue(commande);
  const entreprise = echapper(commande.entreprise);
  const ville = echapper(commande.ville);
  const services = servicesListes(commande);
  const telephone = commande.telephone.trim();

  const blocs: string[] = [];

  if (commande.presentation.trim() !== '') {
    blocs.push(`  <section class="bloc">
    <h2>Qui je suis</h2>
${paragraphes(commande.presentation)
      .map((p) => `    <p>${echapper(p)}</p>`)
      .join('\n')}
  </section>`);
  }

  if (services.length > 0) {
    const items = services.map((s) => `      <li>${echapper(s)}</li>`).join('\n');
    blocs.push(`  <section class="bloc">
    <h2>Ce que je fais</h2>
    <ul class="services">
${items}
    </ul>
  </section>`);
  }

  if (photos.length > 0) {
    const images = photos
      .map(
        (p) =>
          `      <figure><img src="${echapper(p.fichier)}" alt="${echapper(
            p.legende ?? `Chantier de ${commande.entreprise}`,
          )}" loading="lazy"></figure>`,
      )
      .join('\n');
    blocs.push(`  <section class="bloc">
    <h2>${aOption(commande, 'avant-apres') ? 'Avant / après' : 'Mes réalisations'}</h2>
    <div class="galerie">
${images}
    </div>
  </section>`);
  }

  blocs.push(`  <section class="bloc">
    <h2>Où j’interviens</h2>
    <p>${ville} et les communes autour.</p>
  </section>`);

  // Les boutons d'action : chacun n'apparaît que si son option est cochée
  // **et** si la donnée existe. Un bouton WhatsApp sans numéro serait un lien
  // mort sur la page d'un client qui a payé.
  const actions: string[] = [];
  if (aOption(commande, 'appel') && telephone !== '') {
    actions.push(
      `      <a class="action principale" href="tel:${echapper(lienTelephonique(telephone))}">Appeler ${entreprise}</a>`,
    );
  }
  if (aOption(commande, 'whatsapp') && telephone !== '') {
    const message = encodeURIComponent(`Bonjour, je vous contacte depuis votre site.`);
    actions.push(
      `      <a class="action" href="https://wa.me/${lienTelephonique(telephone).replace(/\D/g, '')}?text=${message}">WhatsApp</a>`,
    );
  }

  /*
   * L'entête écrit sur la couleur du client. On prend d'abord la meilleure des
   * deux encres ; si même la meilleure reste sous 4,5:1 — ce qui arrive sur les
   * teintes moyennes, un gris-vert ou un orange terne — on approfondit le fond
   * juste assez. La teinte se déplace alors un peu, et c'est un choix assumé :
   * un titre illisible sur un chantier coûte la visite, pas une nuance exacte.
   */
  const encreEntete = encreSurAccent(couleur);
  const fondEntete = accentLisible(couleur, encreEntete);

  const accroche = commande.slogan.trim() !== ''
    ? echapper(commande.slogan.trim())
    : `${modele ? echapper(modele.pourQui) : 'Artisan'} — ${ville}`;

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${entreprise} — ${ville}</title>
<meta name="description" content="${accroche}">
<style>
  /* Une seule couleur d'accent, celle du client. Tout le reste est neutre :
     c'est ce qui fait qu'on ne cherche jamais où appuyer. */
  :root {
    --accent: ${fondEntete}; --encre-entete: ${encreEntete};
    /* La même teinte, poussée jusqu'à se lire comme texte sur le papier. Le
       fond, lui, garde la couleur choisie : c'est là qu'elle se voit. */
    --accent-texte: ${accentLisible(couleur, '#ffffff')};
    --encre: ${ENCRE}; --papier: #ffffff; --gris: #5b6b7a;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--papier); color: var(--encre);
    font: 18px/1.6 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  }
  header {
    background: var(--accent); color: var(--encre-entete); padding: 2.5rem 1.25rem;
  }
  header h1 { margin: 0 0 .5rem; font-size: 2rem; line-height: 1.2; }
  header p { margin: 0; font-size: 1.15rem; }
  main { max-width: 40rem; margin: 0 auto; padding: 0 1.25rem 3rem; }
  .bloc { padding: 2rem 0; border-bottom: 1px solid #e4e9ee; }
  .bloc:last-of-type { border-bottom: 0; }
  h2 { font-size: 1.4rem; margin: 0 0 .75rem; }
  .services { margin: 0; padding-left: 1.2rem; }
  .services li { margin: .35rem 0; }
  .galerie { display: grid; gap: .75rem; grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr)); }
  .galerie figure { margin: 0; }
  .galerie img { width: 100%; height: 100%; object-fit: cover; border-radius: .6rem; display: block; }
  .actions { display: flex; flex-wrap: wrap; gap: .75rem; padding: 1.5rem 0; }
  /* 56 px de haut : des mains de chantier, souvent gantées, et un téléphone
     tenu à bout de bras au soleil. */
  .action {
    flex: 1 1 12rem; min-height: 56px; display: flex; align-items: center;
    justify-content: center; border-radius: .75rem; text-decoration: none;
    font-weight: 700; border: 2px solid var(--accent-texte); color: var(--accent-texte);
  }
  .action.principale { background: var(--accent); color: var(--encre-entete); border-color: var(--accent); }
  /* 1 rem, pas .95 : le plancher du dépôt est 18 px, et le pied de page porte
     le numéro de téléphone — c'est la ligne la moins bien vue et la plus utile. */
  footer { padding: 2rem 1.25rem; color: var(--gris); text-align: center; }
  @media (prefers-color-scheme: dark) {
    :root {
      --encre: #eef3f7; --papier: #10171e; --gris: #93a3b1;
      /* Sur fond sombre, la même teinte doit s'éclaircir au lieu de foncer. */
      --accent-texte: ${accentLisible(couleur, '#10171e')};
    }
    .bloc { border-bottom-color: #24313d; }
  }
</style>
</head>
<body>
<header>
  <h1>${entreprise}</h1>
  <p>${accroche}</p>
</header>
<main>
${actions.length > 0 ? `  <div class="actions">\n${actions.join('\n')}\n  </div>` : ''}
${blocs.join('\n')}
</main>
<footer>${entreprise} — ${ville}${telephone === '' ? '' : ` — ${echapper(telephone)}`}</footer>
</body>
</html>
`;
}

/** Les modèles et options connus, pour le script d'appel. */
export const CATALOGUE = { MODELES, OPTIONS } as const;
