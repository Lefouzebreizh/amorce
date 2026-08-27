/*
 * Harnais des tests d'actions serveur.
 *
 * Une action ne se teste pas comme une fonction pure : elle demande une
 * session, parle à PostgREST et se termine souvent par une redirection, qui
 * hors requête n'existe pas. On simule donc ses quatre voisins — session,
 * client Supabase, invalidation de cache, redirection — et on observe ce
 * qu'elle leur demande.
 *
 * Le client factice est un mandataire qui se laisse enchaîner indéfiniment et
 * qui sait s'attendre : `from().update().eq().eq().select().maybeSingle()` et
 * `from().delete().eq().eq()` mènent tous deux au même résultat, sans qu'on ait
 * à décrire chaque chaîne. Ce qui compte n'est pas la forme de l'appel mais ce
 * qu'il transporte, d'où le journal des arguments.
 */
import { mock } from 'node:test';

/*
 * Les entrées de Next.js se simulent par leur fichier, pas par leur nom : le
 * résolveur des tests (`tests/resolveur-alias.mjs`) les y mène déjà, et la
 * simulation de Node veut la même adresse que celle qu'a résolue le module
 * qu'elle intercepte.
 */
const cheminDe = (nom: string) =>
  new URL(`../../../node_modules/next/${nom.slice('next/'.length)}.js`, import.meta.url).href;

export type Appel = { methode: string; arguments: unknown[] };

export type Espion = {
  appels: Appel[];
  /** Arguments du premier appel à `methode`, ou `undefined`. */
  premier: (methode: string) => unknown[] | undefined;
};

/**
 * Client Supabase factice : toute chaîne d'appels aboutit à `resultat`.
 *
 * La racine n'est délibérément **pas** attendable, contrairement aux maillons :
 * `const client = await creerClientServeur()` déballerait sinon le mandataire
 * lui-même et rendrait le résultat à la place du client. Seul ce qui se trouve
 * au bout d'un appel — `from(…)`, `auth.signUp(…)` — sait s'attendre.
 */
export function clientFactice(resultat: unknown = { data: null, error: null }) {
  const journal: Appel[] = [];

  const maillon: unknown = new Proxy(
    {},
    {
      get(_cible, propriete) {
        if (propriete === 'then') {
          return (resoudre: (valeur: unknown) => void) => resoudre(resultat);
        }

        return (...args: unknown[]) => {
          journal.push({ methode: String(propriete), arguments: args });
          return maillon;
        };
      },
    },
  );

  const enregistrer = (methode: string) => (...args: unknown[]) => {
    journal.push({ methode, arguments: args });
    return maillon;
  };

  const client = {
    from: enregistrer('from'),
    // Les fonctions du schéma s'appellent par `rpc` : c'est par là que passe
    // l'effacement du compte, qui n'a pas de table à viser.
    rpc: enregistrer('rpc'),
    // `auth` est un objet, pas une méthode : ses appels mènent aux maillons.
    auth: new Proxy(
      {},
      { get: (_cible, propriete) => enregistrer(String(propriete)) },
    ),
  };

  const espion: Espion = {
    appels: journal,
    premier: (methode) => journal.find((appel) => appel.methode === methode)?.arguments,
  };

  return { client, espion };
}

/** Erreur que lance la redirection simulée, pour interrompre l'action comme
 * le fait la vraie. */
export class Redirection extends Error {
  // Champ posé à la main : le mode « strip-only » de Node ne sait pas
  // transformer une propriété déclarée dans la signature du constructeur.
  cible: string;

  constructor(cible: string) {
    super(`redirection vers ${cible}`);
    this.cible = cible;
  }
}

export type Decor = {
  session: unknown;
  redirections: string[];
  invalidations: unknown[][];
};

/**
 * Installe les simulacres et rend le décor, mutable par chaque test. À appeler
 * une fois par fichier, avant d'importer l'action.
 */
export function poserLeDecor(base: string | URL): Decor {
  const decor: Decor = { session: null, redirections: [], invalidations: [] };

  mock.module(new URL('../supabase/session.ts', base).href, {
    namedExports: {
      exigerSession: async () => decor.session,
      lireSession: async () => decor.session,
    },
  });

  mock.module(new URL('../supabase/server.ts', base).href, {
    namedExports: {
      creerClientServeur: async () => (decor.session as { client: unknown } | null)?.client,
    },
  });

  mock.module(cheminDe('next/cache'), {
    namedExports: {
      revalidatePath: (...args: unknown[]) => {
        decor.invalidations.push(args);
      },
    },
  });

  mock.module(cheminDe('next/navigation'), {
    namedExports: {
      redirect: (cible: string) => {
        decor.redirections.push(cible);
        throw new Redirection(cible);
      },
      notFound: () => {
        throw new Error('introuvable');
      },
    },
  });

  return decor;
}

/** Exécute une action dont on attend qu'elle redirige, et rend la cible. */
export async function attendreRedirection(action: () => Promise<unknown>): Promise<string> {
  try {
    await action();
  } catch (cause) {
    if (cause instanceof Redirection) {
      return cause.cible;
    }
    throw cause;
  }

  throw new Error('aucune redirection');
}

/** Construit un FormData à partir de paires clé / valeur. */
export function formulaire(champs: Record<string, string>): FormData {
  const donnees = new FormData();

  for (const [cle, valeur] of Object.entries(champs)) {
    donnees.set(cle, valeur);
  }

  return donnees;
}
