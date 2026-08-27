/*
 * Politique de sécurité du contenu (CSP).
 *
 * Les trois en-têtes de `next.config.ts` sont fixes : ils se déclarent une fois
 * pour toutes. Celui-ci ne peut pas l'être, parce qu'il contient un jeton
 * différent à chaque requête — d'où sa place dans le proxy et non dans la
 * configuration.
 *
 * Ce jeton est ce qui distingue une CSP utile d'une CSP décorative. Sans lui,
 * il faudrait autoriser `'unsafe-inline'` pour que les scripts que Next.js
 * injecte lui-même s'exécutent, et cette autorisation profite d'abord au
 * script injecté par un tiers. Avec lui, seuls les scripts que le serveur a
 * signé démarrent.
 *
 * `'strict-dynamic'` va avec : Next.js charge ses fragments en fabriquant des
 * balises `<script>` depuis un script déjà signé. Sans cette directive, chacun
 * de ces fragments serait refusé et l'application resterait inerte.
 *
 * En développement, deux tolérances de plus, et elles ne franchissent jamais la
 * production : `'unsafe-eval'`, dont le rechargement à chaud a besoin, et la
 * prise WebSocket locale par laquelle il annonce ses changements.
 */

/** Une politique et le jeton qu'elle autorise, pour cette requête-là. */
export type Politique = {
  entete: string;
  jeton: string;
};

/** Jeton à usage unique, en base64. `crypto` et `btoa` existent dans les deux
 * environnements où ce code tourne : la périphérie de Next.js et Node. */
function jetonUnique(): string {
  const octets = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...octets));
}

/**
 * Compose la politique. L'adresse Supabase y entre telle qu'elle est
 * configurée : la coder en dur ferait passer les requêtes du client suivant
 * pour une tentative d'exfiltration.
 */
export function politiqueDeSecurite(urlSupabase: string, developpement: boolean): Politique {
  const jeton = jetonUnique();
  const origine = origineDe(urlSupabase);

  // Composées avant la liste : le typage strict du socle refuse d'atteindre une
  // entrée de dictionnaire par son nom sans prouver qu'elle existe.
  const scripts = ["'self'", `'nonce-${jeton}'`, "'strict-dynamic'"];
  const connexions = ["'self'", origine, origine.replace(/^https:/, 'wss:')];

  if (developpement) {
    // React évalue du code à la volée pour reconstruire les piles d'erreur, et
    // le rechargement à chaud annonce ses changements par une prise WebSocket.
    scripts.push("'unsafe-eval'");
    connexions.push('ws://localhost:*', 'http://localhost:*');
  }

  const directives: [string, string[]][] = [
    ['default-src', ["'self'"]],
    ['script-src', scripts],
    // Pas de jeton sur les styles : Next.js et Tailwind en posent en ligne, et
    // un jeton sur cette directive annulerait `'unsafe-inline'` sans les
    // couvrir. Un style injecté peut défigurer une page, pas exfiltrer un jeton.
    ['style-src', ["'self'", "'unsafe-inline'"]],
    ['img-src', ["'self'", 'data:', 'blob:']],
    ['font-src', ["'self'", 'data:']],
    ['connect-src', connexions],
    // Doublon assumé de `X-Frame-Options` : les deux disent la même chose, et
    // le premier navigateur qui ignore l'un comprend l'autre.
    ['frame-ancestors', ["'none'"]],
    ['base-uri', ["'self'"]],
    ['form-action', ["'self'"]],
    ['object-src', ["'none'"]],
  ];

  if (!developpement) {
    directives.push(['upgrade-insecure-requests', []]);
  }

  const entete = directives
    .map(([nom, valeurs]) => [nom, ...valeurs].join(' ').trim())
    .join('; ');

  return { entete, jeton };
}

/** Origine d'une URL, ou la chaîne telle quelle si elle n'en est pas une —
 * l'absence de configuration se signale au démarrage, pas ici. */
function origineDe(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}
