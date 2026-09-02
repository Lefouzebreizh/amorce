/**
 * POST /api/reforme — reformule un message piquant en Communication Non
 * Violente, et compte les analyses du trafic externe.
 *
 * Deux règles de trafic, une seule ligne de code pour les séparer :
 *
 * - `src === 'groupe'` : accès illimité, aucune écriture en base, aucun
 *   décompte. Les 48 000 personnes du groupe sont chez elles ; on ne compte pas
 *   les cafés de quelqu'un qu'on héberge.
 * - tout le reste : cinq analyses par jour et par empreinte d'adresse, puis un
 *   429 qui propose le soutien à 19 € — proposé, jamais imposé, et le message
 *   reste lisible et sans culpabilisation.
 *
 * Ce qui n'est *pas* écrit en base, et c'est délibéré : le texte soumis. Ni en
 * clair, ni haché, ni tronqué. Quelqu'un qui colle ici la phrase qui l'a tenu
 * éveillé n'a pas à se demander où elle atterrit.
 */
import { reformuler, valider } from '../../src/lib/cnv.ts';

interface Env {
  DB: D1Database;
  BUCKET_EMOTIONS: R2Bucket;
  ADMIN_EMAIL: string;
  QUOTA_GRATUIT?: string;
  PRIX_SOUTIEN?: string;
  /**
   * Le mot de passe du groupe, à distribuer dans le groupe et nulle part
   * ailleurs. Sans lui, `src=groupe` ne donne plus rien de particulier.
   *   wrangler pages secret put JETON_GROUPE
   */
  JETON_GROUPE?: string;
  /**
   * Sel du hachage des adresses. Une adresse IPv4 tient dans 32 bits : sans
   * sel, retrouver l'adresse derrière un SHA-256 prend quelques secondes sur
   * un ordinateur portable, et la « pseudonymisation » n'en est pas une.
   * À poser en secret avant le déploiement :
   *   wrangler pages secret put SEL_QUOTA
   */
  SEL_QUOTA?: string;
}

interface CorpsRequete {
  texte?: unknown;
  src?: unknown;
  jeton?: unknown;
}

const QUOTA_PAR_DEFAUT = 5;

/**
 * Sel de repli, et il n'a qu'un seul usage légitime : le développement local,
 * où wrangler ne pose pas `cf-connecting-ip` et où tout le monde partage donc
 * déjà la même empreinte. Sa valeur est publique — elle est dans ce dépôt.
 *
 * En production, il n'est jamais atteint : voir le garde-fou plus bas.
 */
const SEL_LOCAL = 'sel-local-a-remplacer';

function json(charge: unknown, statut = 200, entetes: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(charge), {
    status: statut,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // Une réponse comptabilisée ne doit jamais être resservie par un cache
      // intermédiaire : ce serait offrir une analyse gratuite à un inconnu et
      // en facturer une à celui qui l'a demandée.
      'cache-control': 'no-store',
      ...entetes,
    },
  });
}

/** Empreinte salée de l'adresse. Rend une chaîne hexadécimale de 64 signes. */
async function empreinteAdresse(adresse: string, sel: string): Promise<string> {
  const octets = new TextEncoder().encode(`${sel}:${adresse}`);
  const condensat = await crypto.subtle.digest('SHA-256', octets);
  return [...new Uint8Array(condensat)].map((o) => o.toString(16).padStart(2, '0')).join('');
}

/**
 * Consomme une analyse et rend ce qu'il reste, ou `null` si le quota du jour
 * est épuisé.
 *
 * Tout tient dans un seul UPSERT, et ce n'est pas de la coquetterie SQL : deux
 * onglets ouverts sur la même page envoient deux requêtes en même temps. Avec
 * un SELECT puis un UPDATE séparés, les deux lisent « 4 » et écrivent « 5 » —
 * six analyses passent. La condition `WHERE` de la branche `DO UPDATE` fait le
 * contrôle et l'incrément dans la même écriture ; quand elle est fausse, la
 * clause `RETURNING` ne rend aucune ligne, et c'est ça, le quota atteint.
 */
async function consommer(
  db: D1Database,
  empreinte: string,
  src: string | null,
  quota: number,
): Promise<number | null> {
  const ligne = await db
    .prepare(
      `INSERT INTO users (id, ip_hash, src, usage_count, last_request)
       VALUES (?1, ?2, ?3, 1, date('now'))
       ON CONFLICT(ip_hash) DO UPDATE SET
         usage_count = CASE WHEN users.last_request = date('now')
                            THEN users.usage_count + 1
                            ELSE 1 END,
         last_request = date('now'),
         src = COALESCE(excluded.src, users.src)
       WHERE users.last_request <> date('now') OR users.usage_count < ?4
       RETURNING usage_count`,
    )
    .bind(crypto.randomUUID(), empreinte, src, quota)
    .first<{ usage_count: number }>();

  if (!ligne) return null;
  return Math.max(0, quota - ligne.usage_count);
}

/**
 * Comparaison en temps constant, sur les octets.
 *
 * Un `===` sur deux chaînes s'arrête au premier caractère qui diffère, et le
 * temps de réponse dit alors combien de caractères étaient justes. Sur un
 * secret partagé par un groupe entier, c'est peu exploitable — mais l'écrire
 * juste coûte six lignes, et `licence-serveur` fait déjà de même.
 */
function memeSecret(a: string, b: string): boolean {
  const encodeur = new TextEncoder();
  const x = encodeur.encode(a);
  const y = encodeur.encode(b);
  if (x.length !== y.length) return false;
  let ecart = 0;
  for (let i = 0; i < x.length; i += 1) ecart |= x[i]! ^ y[i]!;
  return ecart === 0;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let corps: CorpsRequete;
  try {
    corps = (await request.json()) as CorpsRequete;
  } catch {
    return json({ error: 'corps_illisible', message: 'Le message n’est pas arrivé jusqu’ici. Réessaie.' }, 400);
  }

  const controle = valider(corps.texte);
  if (!controle.ok) {
    return json({ error: 'saisie_invalide', message: controle.raison }, 400);
  }

  const quota = Number(env.QUOTA_GRATUIT ?? QUOTA_PAR_DEFAUT) || QUOTA_PAR_DEFAUT;
  const prix = env.PRIX_SOUTIEN ?? '19';
  const src = typeof corps.src === 'string' ? corps.src : null;

  // L'accès du groupe se **prouve** désormais, il ne se déclare plus.
  //
  // Avant, `?src=groupe` suffisait : n'importe qui l'ajoutait à l'adresse et
  // n'était plus décompté. L'intention était juste — quelqu'un qui arrive du
  // groupe ne doit pas voir un quota clignoter — mais elle reposait sur la
  // parole du visiteur.
  //
  // Le repli est **volontairement le régime normal**, pas un refus : sans
  // `JETON_GROUPE` posé, ou avec un jeton qui ne correspond pas, on retombe
  // sur le quota de tout le monde. Personne n'est renvoyé, et un secret que
  // l'exploitant a oublié de poser ne coûte à personne son analyse — c'est la
  // même règle que le sel absent et la base en panne, deux paragraphes plus
  // bas.
  const jeton = typeof corps.jeton === 'string' ? corps.jeton : null;
  if (src === 'groupe' && env.JETON_GROUPE && jeton && memeSecret(jeton, env.JETON_GROUPE)) {
    return json({ ...reformuler(controle.texte), acces: 'groupe', restant: null, quota });
  }

  // `cf-connecting-ip` est posé par Cloudflare et ne peut pas être falsifié par
  // le client — contrairement à `x-forwarded-for`, qu'il suffit d'envoyer soi-
  // même pour remettre son compteur à zéro. En local, wrangler ne pose rien :
  // tout le monde partage alors la même empreinte, ce qui est exactement ce
  // qu'il faut pour essayer la limite à la main.
  const adresseReelle = request.headers.get('cf-connecting-ip');

  // Garde-fou : du vrai trafic Cloudflare, et pas de sel.
  //
  // Le repli `SEL_LOCAL` est écrit en clair dans ce dépôt. S'en servir ici
  // reviendrait à hacher des adresses réelles sans sel : une IPv4 tient dans
  // 32 bits, et retrouver celle qui est derrière un SHA-256 non salé prend
  // quelques secondes sur un ordinateur portable. La deuxième règle du projet
  // n'y survivrait pas, et l'empreinte serait déjà en base quand on s'en
  // apercevrait.
  //
  // Alors on sert et on ne compte pas — exactement ce que fait déjà la panne de
  // base juste en dessous, et pour la même raison : un secret que l'exploitant
  // a oublié de poser n'est pas la faute de la personne qui écrit. Le quota
  // sauté coûte quelques analyses ; l'empreinte écrite ne se reprend pas.
  if (adresseReelle && !env.SEL_QUOTA) {
    console.error('SEL_QUOTA absente : quota désactivé, aucune empreinte écrite.');
    return json({ ...reformuler(controle.texte), acces: 'degrade', restant: null, quota });
  }

  const adresse = adresseReelle ?? '127.0.0.1';
  const empreinte = await empreinteAdresse(adresse, env.SEL_QUOTA ?? SEL_LOCAL);

  let restant: number | null;
  try {
    restant = await consommer(env.DB, empreinte, src, quota);
  } catch {
    // La base est en panne. Refuser l'analyse punirait la personne pour une
    // panne qui n'est pas la sienne : on sert, et on ne compte pas.
    return json({ ...reformuler(controle.texte), acces: 'degrade', restant: null, quota });
  }

  if (restant === null) {
    return json(
      {
        error: 'quota_reached',
        message: `Tu as utilisé tes ${quota} analyses du jour. Elles reviennent demain, gratuitement. Si tu veux que ça reste gratuit pour le groupe, l’accès complet est à ${prix} €.`,
        quota,
        restant: 0,
      },
      429,
      { 'retry-after': '3600' },
    );
  }

  return json({ ...reformuler(controle.texte), acces: 'externe', restant, quota });
};

/** Toute autre méthode : on répond en français plutôt qu'avec une page blanche. */
export const onRequest: PagesFunction<Env> = async ({ request, next }) => {
  if (request.method === 'POST') return next();
  return json(
    { error: 'methode_non_supportee', message: 'Cette adresse n’accepte que l’envoi d’un message (POST).' },
    405,
    { allow: 'POST' },
  );
};
