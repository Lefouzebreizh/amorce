import { traiter, type Base } from './index.ts';

/**
 * Le branchement Cloudflare, et lui seul — même partage des rôles que
 * `licence-serveur/src/worker.ts` : tout ce qui décide vit dans `index.ts`,
 * qui ne connaît que l'interface `Base`.
 */

type D1 = {
  prepare(sql: string): {
    bind(...valeurs: unknown[]): {
      first<T>(): Promise<T | null>;
      run(): Promise<{ meta: { changes: number } }>;
    };
  };
};

type Environnement = {
  BASE: D1;
  SECRET_JETONS: string;
  SECRET_WEBHOOK: string;
  CLE_RESEND: string;
  EXPEDITEUR: string;
  ADRESSE_SITE: string;
  ORIGINES: string;
  /** JSON `{"centimes": credits, ...}` — voir `packs` dans `Reglages`. */
  PACKS: string;
};

function base(d1: D1): Base {
  return {
    async compteParEmail(email) {
      const ligne = await d1
        .prepare('SELECT id, solde FROM comptes WHERE email = ?')
        .bind(email)
        .first<{ id: string; solde: number }>();
      return ligne;
    },
    async creerCompte(id, email) {
      // `OR IGNORE` : deux vérifications concurrentes du même lien ne
      // doivent pas se marcher dessus sur la contrainte `UNIQUE(email)`.
      await d1
        .prepare('INSERT OR IGNORE INTO comptes (id, email, solde, cree_le) VALUES (?, ?, 0, ?)')
        .bind(id, email, Math.floor(Date.now() / 1000))
        .run();
    },
    async solde(compteId) {
      const ligne = await d1
        .prepare('SELECT solde FROM comptes WHERE id = ?')
        .bind(compteId)
        .first<{ solde: number }>();
      return ligne ? ligne.solde : null;
    },
    async mouvement(id) {
      const ligne = await d1
        .prepare('SELECT compte_id, delta FROM mouvements WHERE id = ?')
        .bind(id)
        .first<{ compte_id: string; delta: number }>();
      return ligne ? { compteId: ligne.compte_id, delta: ligne.delta } : null;
    },
    async crediter(id, compteId, delta, motif) {
      /*
       * `INSERT OR IGNORE` sur `mouvements.id` (clé primaire) rend
       * `meta.changes` à 0 si ce mouvement existe déjà — rejeu d'un webhook
       * Stripe, ou retentative d'un appel de génération après coupure
       * réseau. Le solde ne bouge alors pas une seconde fois.
       *
       * D1 sérialise les écritures sur une même base (une seule connexion
       * active par base, documenté par Cloudflare) : deux appels concurrents
       * sur le même `id` ne peuvent pas tous les deux lire `changes: 1`,
       * donc pas tous les deux créditer. C'est cette garantie, pas une
       * transaction explicite entre les deux requêtes, qui empêche le
       * double crédit.
       */
      const insertion = await d1
        .prepare('INSERT OR IGNORE INTO mouvements (id, compte_id, delta, motif, horodatage) VALUES (?, ?, ?, ?, ?)')
        .bind(id, compteId, delta, motif, Math.floor(Date.now() / 1000))
        .run();

      if (insertion.meta.changes > 0) {
        await d1.prepare('UPDATE comptes SET solde = solde + ? WHERE id = ?').bind(delta, compteId).run();
      }
    },
  };
}

const worker = {
  fetch(requete: Request, env: Environnement): Promise<Response> {
    let packs: Record<string, number> = {};
    try {
      packs = env.PACKS ? JSON.parse(env.PACKS) : {};
    } catch {
      // Une table de paliers illisible ne doit pas faire tomber tout le
      // serveur — elle fait tomber les achats, silencieusement, exactement
      // comme un montant sans palier connu : voir la note dans `webhook`.
      packs = {};
    }

    return traiter(requete, {
      base: base(env.BASE),
      secretJetons: env.SECRET_JETONS ?? '',
      secretWebhook: env.SECRET_WEBHOOK ?? '',
      cleResend: env.CLE_RESEND ?? '',
      expediteur: env.EXPEDITEUR ?? '',
      adresseSite: env.ADRESSE_SITE ?? '',
      origines: (env.ORIGINES ?? '').split(',').map((o) => o.trim()).filter(Boolean),
      packs,
    });
  },
};

export default worker;
