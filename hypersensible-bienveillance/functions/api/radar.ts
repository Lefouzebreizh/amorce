/**
 * GET /api/radar — les dix outils suivis, leur prix du jour et leur historique.
 *
 * Une seule requête pour toute la section : la page en fait une au chargement,
 * et rien d'autre. Deux appels (un pour les outils, un pour les courbes)
 * doubleraient la latence sur un téléphone en 4G pour économiser trois lignes
 * de code ici.
 *
 * Le radar n'est pas de l'affiliation : aucun lien n'est pisté, aucune
 * commission n'est prise. Il dit simplement ce que coûtent ces applications ce
 * mois-ci, y compris quand la réponse est « moins cher qu'avant ».
 */
interface Env {
  DB: D1Database;
  /**
   * « 1 » tant que le Worker de veille fabrique les variations au lieu de les
   * lire. L'API le dit, la page l'affiche : une courbe de démonstration
   * présentée comme un relevé serait exactement le procédé que ce site
   * reproche aux autres.
   */
  RADAR_SIMULE?: string;
}

interface LigneOutil {
  id: number;
  name: string;
  url: string;
  current_price: number;
  last_checked: string;
}

interface LignePoint {
  tool_id: number;
  price: number;
  checked_at: string;
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  try {
    const [outils, points] = await env.DB.batch<LigneOutil | LignePoint>([
      env.DB.prepare('SELECT id, name, url, current_price, last_checked FROM tools ORDER BY name'),
      env.DB.prepare(
        // 91 et non 90 : le relevé d'amorce le plus ancien est posé à
        // exactement `-90 days`, et une comparaison à la seconde près l'exclut
        // systématiquement — la courbe perdait son premier point sans que rien
        // ne le signale.
        `SELECT tool_id, price, checked_at FROM price_history
         WHERE checked_at >= datetime('now', '-91 days')
         ORDER BY tool_id, checked_at`,
      ),
    ]);

    const historique = new Map<number, { prix: number; date: string }[]>();
    for (const point of (points.results ?? []) as LignePoint[]) {
      const serie = historique.get(point.tool_id) ?? [];
      serie.push({ prix: point.price, date: point.checked_at });
      historique.set(point.tool_id, serie);
    }

    const charge = ((outils.results ?? []) as LigneOutil[]).map((outil) => {
      const serie = historique.get(outil.id) ?? [];
      // Le dernier point sert de référence pour la variation. Il vient de la
      // table d'historique et non de `current_price` : si le Worker de veille
      // n'a pas tourné, les deux sont identiques et la variation est nulle,
      // ce qui est la vérité, plutôt qu'un écart inventé.
      const premier = serie[0]?.prix ?? outil.current_price;
      const variation = premier === 0 ? 0 : ((outil.current_price - premier) / premier) * 100;
      return {
        id: outil.id,
        nom: outil.name,
        url: outil.url,
        prix: outil.current_price,
        verifie: outil.last_checked,
        variation: Math.round(variation * 10) / 10,
        courbe: serie.map((p) => p.prix),
      };
    });

    return new Response(JSON.stringify({ outils: charge, simule: (env.RADAR_SIMULE ?? '1') === '1' }), {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        // Les prix ne bougent qu'une fois par nuit : un quart d'heure de cache
        // au bord suffit à absorber une pointe de trafic après une publication
        // sans jamais montrer un prix de la veille au matin.
        'cache-control': 'public, max-age=900',
      },
    });
  } catch {
    return new Response(
      JSON.stringify({
        error: 'radar_indisponible',
        message: 'Le radar ne répond pas pour le moment. Les prix reviendront tout seuls.',
      }),
      { status: 503, headers: { 'content-type': 'application/json; charset=utf-8' } },
    );
  }
};
