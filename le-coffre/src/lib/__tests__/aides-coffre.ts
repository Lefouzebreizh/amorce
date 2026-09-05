/*
 * Harnais des tests du coffre hébergé.
 *
 * `coffre.ts` ne se teste pas comme une fonction pure : il parle à PostgREST,
 * à Supabase Storage et à une fonction serveur. On simule ces trois voisins et
 * on observe **ce qu'on leur transmet** — c'est là qu'est la promesse du
 * projet. Un test qui vérifierait seulement la valeur de retour laisserait
 * passer le seul défaut qui compte vraiment ici : une phrase secrète, un nom
 * de document ou un libellé qui partirait en clair.
 *
 * D'où le journal : chaque appel y laisse sa méthode et ses arguments, et les
 * tests lisent ce qui a réellement quitté le navigateur.
 *
 * Le client factice se laisse enchaîner indéfiniment et sait s'attendre :
 * `from().select().eq().maybeSingle()` et `from().delete().eq().eq()` mènent
 * tous deux au résultat prévu pour la table visée, sans qu'on ait à décrire
 * chaque chaîne.
 */

export type Appel = { methode: string; arguments: unknown[] };

export type Reponses = {
  /** Résultat rendu au bout de toute chaîne partant de `from(table)`. */
  tables?: Record<string, unknown>;
  televersement?: unknown;
  telechargement?: unknown;
  retrait?: unknown;
  fonction?: unknown;
};

const RIEN = { data: null, error: null };

export type Factice = {
  client: unknown;
  journal: Appel[];
  /** Arguments du premier appel à `methode`, ou `undefined`. */
  premier: (methode: string) => unknown[] | undefined;
  /** Tous les appels à `methode`, dans l'ordre. */
  tous: (methode: string) => unknown[][];
};

export function clientFactice(reponses: Reponses = {}): Factice {
  const journal: Appel[] = [];
  const noter = (methode: string, args: unknown[]) => journal.push({ methode, arguments: args });

  // Un maillon est à la fois appelable et attendable : c'est ce qui permet à
  // `.delete().eq().eq()` de se terminer sans méthode terminale explicite.
  const maillon = (resultat: unknown): unknown =>
    new Proxy({}, {
      get(_cible, propriete) {
        if (propriete === 'then') {
          return (resoudre: (valeur: unknown) => void) => resoudre(resultat);
        }
        return (...args: unknown[]) => {
          noter(String(propriete), args);
          return maillon(resultat);
        };
      },
    });

  const client = {
    from(table: string) {
      noter('from', [table]);
      return maillon(reponses.tables?.[table] ?? RIEN);
    },
    storage: {
      from(seau: string) {
        noter('storage.from', [seau]);
        return {
          upload: (...args: unknown[]) => {
            noter('upload', args);
            return Promise.resolve(reponses.televersement ?? { data: {}, error: null });
          },
          download: (...args: unknown[]) => {
            noter('download', args);
            return Promise.resolve(reponses.telechargement ?? RIEN);
          },
          remove: (...args: unknown[]) => {
            noter('remove', args);
            return Promise.resolve(reponses.retrait ?? { data: [], error: null });
          },
        };
      },
    },
    functions: {
      invoke: (...args: unknown[]) => {
        noter('invoke', args);
        return Promise.resolve(reponses.fonction ?? RIEN);
      },
    },
  };

  return {
    client,
    journal,
    premier: (methode) => journal.find((a) => a.methode === methode)?.arguments,
    tous: (methode) => journal.filter((a) => a.methode === methode).map((a) => a.arguments),
  };
}

/** Tout ce qui a transité vers le serveur, aplati en une seule chaîne.
 *
 * Sert aux tests de fuite : on y cherche la phrase secrète, un nom de fichier
 * ou un libellé de rendez-vous. Une recherche par champ raterait le jour où un
 * de ces mots part dans une clé qu'on n'avait pas prévu d'inspecter.
 */
export function toutCeQuiEstSorti(journal: Appel[]): string {
  return journal
    .map((appel) => {
      try {
        return JSON.stringify(appel.arguments);
      } catch {
        return '';
      }
    })
    .join(' ');
}
