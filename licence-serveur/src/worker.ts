import { traiter, type Base } from './index.ts';

/**
 * Le branchement Cloudflare, et lui seul.
 *
 * Tout ce qui décide vit dans `index.ts`, qui ne connaît que l'interface
 * `Base` — c'est ce qui permet d'éprouver le serveur entier sans D1, sans
 * wrangler et sans réseau. Ce fichier-ci n'a aucune logique à tester : s'il en
 * gagnait une, elle deviendrait la seule partie non couverte.
 */

type D1 = {
  prepare(sql: string): {
    bind(...valeurs: unknown[]): { first<T>(): Promise<T | null>; run(): Promise<unknown> };
  };
};

type Environnement = {
  BASE: D1;
  SECRET_WEBHOOK: string;
  SECRET_CLES: string;
  ORIGINES: string;
};

function base(d1: D1): Base {
  return {
    async lire(reference) {
      const ligne = await d1
        .prepare('SELECT revoquee FROM licences WHERE reference = ?')
        .bind(reference)
        .first<{ revoquee: number }>();
      return ligne ? { revoquee: ligne.revoquee === 1 } : null;
    },
    async enregistrer(reference, paiement) {
      // `OR IGNORE` : Stripe rejoue ses événements, et un rejeu ne doit ni
      // échouer ni écraser une ligne déjà révoquée.
      await d1
        .prepare('INSERT OR IGNORE INTO licences (reference, paiement) VALUES (?, ?)')
        .bind(reference, paiement)
        .run();
    },
    async revoquer(reference) {
      await d1
        .prepare('UPDATE licences SET revoquee = 1 WHERE reference = ?')
        .bind(reference)
        .run();
    },
  };
}

export default {
  fetch(requete: Request, env: Environnement): Promise<Response> {
    return traiter(requete, {
      base: base(env.BASE),
      secretWebhook: env.SECRET_WEBHOOK ?? '',
      secretCles: env.SECRET_CLES ?? '',
      origines: (env.ORIGINES ?? '').split(',').map((o) => o.trim()).filter(Boolean),
    });
  },
};
