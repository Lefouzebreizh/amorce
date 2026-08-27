/**
 * Worker de veille quotidienne — « tracker » et « healer » dans le même passage.
 *
 * Deux métiers, une seule tournée de nuit (04 h 00 UTC, voir `wrangler.toml`) :
 *
 * 1. **Healer** — chaque lien suivi est appelé et `last_checked` est mis à jour.
 *    Un lien mort sur une page qui prétend renseigner, c'est pire que pas de
 *    page : la personne se dit qu'elle a mal cliqué, pas que l'info est vieille.
 *    Un échec part par courriel, tout de suite, une seule fois.
 *
 * 2. **Tracker** — un point de prix est ajouté à `price_history` pour alimenter
 *    la courbe du radar.
 *
 * ⚠️ Ce que ce Worker ne fait pas, et il faut le lire avant de croire les
 * courbes : il ne **lit** pas les prix. Un `HEAD` rend un code de statut, pas
 * un tarif ; chaque éditeur affiche le sien dans un balisage différent, souvent
 * derrière du JavaScript, et parfois seulement après connexion. Tant que
 * `SIMULER_PRIX` vaut « 1 », les variations écrites ici sont **fabriquées** et
 * la courbe est une démonstration. L'API du radar le répercute
 * (`RADAR_SIMULE` côté Pages) et la page le dit à ses visiteurs. Le jour où un
 * analyseur par éditeur existera, on posera la variable à « 0 » et rien
 * d'autre ne bougera.
 *
 * Écrire un prix inventé sans le dire sur un site qui promet de renseigner,
 * c'est exactement ce que ce projet reproche aux autres.
 */

/** Un lien lent n'est pas un lien mort : on laisse dix secondes, pas plus. */
const DELAI_MAX_MS = 10_000;

/** Amplitude de la variation simulée, en fraction du prix courant. */
const AMPLITUDE = 0.05;

/** Plancher : aucune de ces applications n'est descendue sous un euro. */
const PRIX_PLANCHER = 0.99;

/**
 * Appelle un lien et rend son état. Ne lève jamais : un site injoignable est un
 * résultat de la veille, pas une panne du Worker — s'il levait, les neuf outils
 * suivants ne seraient pas vérifiés du tout.
 */
async function verifier(url) {
  try {
    const reponse = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(DELAI_MAX_MS),
      // Certains hébergeurs rendent un 403 à un client sans identité. Se
      // présenter honnêtement évite un faux positif chaque nuit.
      headers: { 'user-agent': 'hypersensible-bienveillance-veille/1.0 (+https://hypersensible-bienveillance.com)' },
    });
    return { ok: reponse.ok, statut: reponse.status, detail: reponse.ok ? null : `HTTP ${reponse.status}` };
  } catch (erreur) {
    return { ok: false, statut: 0, detail: erreur?.name === 'TimeoutError' ? 'délai dépassé' : String(erreur?.message ?? erreur) };
  }
}

/** Nouveau prix simulé, borné et arrondi au centime. */
function prixSimule(actuel) {
  const facteur = 1 + (Math.random() * 2 - 1) * AMPLITUDE;
  return Math.max(PRIX_PLANCHER, Math.round(actuel * facteur * 100) / 100);
}

/**
 * Un seul courriel pour toute la tournée, et seulement s'il y a des pannes.
 * Dix messages une nuit d'incident réseau, c'est la garantie que le onzième ne
 * sera plus lu.
 */
async function alerter(env, pannes) {
  if (pannes.length === 0) return { envoye: false, raison: 'aucune panne' };
  if (!env.RESEND_API_KEY) return { envoye: false, raison: 'RESEND_API_KEY absente' };

  const lignes = pannes
    .map((p) => `<li><strong>${p.nom}</strong> — ${p.detail}<br><a href="${p.url}">${p.url}</a></li>`)
    .join('');

  const corps = {
    from: env.EXPEDITEUR_ALERTE ?? 'veille@hypersensible-bienveillance.com',
    to: [env.ADMIN_EMAIL],
    subject: `Radar : ${pannes.length} lien${pannes.length > 1 ? 's' : ''} en échec cette nuit`,
    html: `
      <p>La tournée de veille a trouvé ${pannes.length} lien(s) qui ne répondent plus :</p>
      <ul>${lignes}</ul>
      <p>Les autres outils ont été vérifiés normalement. Rien n'a été retiré du radar :
      un site peut être en panne une nuit et revenir le lendemain.</p>`,
  };

  try {
    const reponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.RESEND_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(corps),
      signal: AbortSignal.timeout(DELAI_MAX_MS),
    });
    return { envoye: reponse.ok, raison: reponse.ok ? 'ok' : `HTTP ${reponse.status}` };
  } catch (erreur) {
    // L'alerte a échoué : on le note dans le journal du Worker et on continue.
    // Faire échouer la tournée pour un courriel non parti perdrait aussi les
    // relevés, qui eux sont bons.
    return { envoye: false, raison: String(erreur?.message ?? erreur) };
  }
}

/** La tournée elle-même, isolée pour être appelable depuis `scheduled` et `fetch`. */
async function tournee(env) {
  const { results: outils } = await env.DB.prepare(
    'SELECT id, name, url, current_price FROM tools ORDER BY id',
  ).all();

  const simuler = (env.SIMULER_PRIX ?? '1') === '1';
  const pannes = [];
  const ecritures = [];
  const instantane = [];

  // Les dix vérifications partent ensemble : en série, dix sites lents
  // additionnent leurs délais et la tournée frôle la minute pour rien.
  const etats = await Promise.all(outils.map((outil) => verifier(outil.url)));

  for (let i = 0; i < outils.length; i += 1) {
    const outil = outils[i];
    const etat = etats[i];

    if (!etat.ok) pannes.push({ nom: outil.name, url: outil.url, detail: etat.detail });

    ecritures.push(
      env.DB.prepare('UPDATE tools SET last_checked = CURRENT_TIMESTAMP WHERE id = ?1').bind(outil.id),
    );

    // Un prix n'est relevé que sur un site qui a répondu. Prolonger la courbe
    // d'un site en panne inventerait une mesure là où il n'y en a pas eu.
    if (etat.ok && simuler) {
      const nouveau = prixSimule(outil.current_price);
      ecritures.push(
        env.DB.prepare('UPDATE tools SET current_price = ?2 WHERE id = ?1').bind(outil.id, nouveau),
        env.DB.prepare(
          'INSERT INTO price_history (tool_id, price, checked_at) VALUES (?1, ?2, CURRENT_TIMESTAMP)',
        ).bind(outil.id, nouveau),
      );
      instantane.push({ id: outil.id, nom: outil.name, prix: nouveau, joignable: true });
    } else {
      instantane.push({ id: outil.id, nom: outil.name, prix: outil.current_price, joignable: etat.ok });
    }
  }

  // Un seul aller-retour vers D1 : `batch` est transactionnel, donc soit la
  // nuit entière est enregistrée, soit rien ne l'est. Une tournée à moitié
  // écrite donnerait un radar où trois outils sont d'hier et sept d'aujourd'hui.
  await env.DB.batch(ecritures);

  // Archive du jour dans R2. D1 se purge, se restaure de travers, se perd ; un
  // instantané JSON par jour permet de reconstruire l'historique à la main.
  if (env.BUCKET_EMOTIONS) {
    const jour = new Date().toISOString().slice(0, 10);
    try {
      await env.BUCKET_EMOTIONS.put(
        `radar/${jour}.json`,
        JSON.stringify({ jour, simule: simuler, outils: instantane, pannes }, null, 2),
        { httpMetadata: { contentType: 'application/json; charset=utf-8' } },
      );
    } catch (erreur) {
      // Le seau est indisponible : les relevés sont déjà en base, on continue.
      console.error('archive R2 impossible', erreur);
    }
  }

  const alerte = await alerter(env, pannes);

  return {
    verifies: outils.length,
    pannes: pannes.length,
    simule: simuler,
    alerte,
  };
}

export default {
  /** Déclenché par le cron. Rien d'autre ne l'appelle en production. */
  async scheduled(event, env, ctx) {
    // `waitUntil` : sans lui, l'exécution est coupée dès que le gestionnaire
    // rend la main, et l'archive R2 comme le courriel d'alerte partent parfois
    // dans le vide — le symptôme classique étant « ça marche en local ».
    ctx.waitUntil(
      tournee(env)
        .then((bilan) => console.log('Tournée de veille terminée', JSON.stringify(bilan)))
        .catch((erreur) => console.error('Tournée de veille en échec', erreur)),
    );
  },

  /**
   * Point d'entrée HTTP réservé à l'essai manuel. Il ne lance rien de lui-même :
   * une adresse publique capable de réécrire tous les prix serait une porte
   * ouverte. Pour déclencher la tournée en local :
   *   wrangler dev --config workers/wrangler.toml --test-scheduled
   *   curl "http://localhost:8787/__scheduled?cron=0+4+*+*+*"
   */
  async fetch() {
    return new Response(
      'Worker de veille du radar. Il se réveille seul à 04 h 00 UTC ; il ne répond à rien d’autre.',
      { status: 200, headers: { 'content-type': 'text/plain; charset=utf-8' } },
    );
  },
};

export { tournee, prixSimule, verifier };
