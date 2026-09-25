import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from '@supabase/supabase-js';

export const MESSAGE_CODE_INCORRECT =
  'Mot de passe du compte refusé. Vérifie-le avec « Afficher » : ce n’est pas la phrase secrète de tes documents.';
export const MESSAGE_CONNEXION_INDISPONIBLE =
  'Connexion indisponible. Vérifie ta connexion puis réessaie.';

type CorpsErreur = { error?: unknown };

function estObjet(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function traduireErreurServeur(message: string, statut?: number): string {
  if (statut === 401 || /identifiant|mot de passe incorrect/i.test(message)) {
    return MESSAGE_CODE_INCORRECT;
  }
  if (statut === 429 || /trop de tentatives/i.test(message)) {
    return 'Trop de tentatives. Réessaie dans quelques minutes.';
  }
  if (statut === 403 || /origine non autorisée/i.test(message)) {
    return 'Cette adresse du site n’est pas autorisée. Recharge l’aperçu officiel.';
  }
  return MESSAGE_CONNEXION_INDISPONIBLE;
}

async function lireCorpsErreur(erreur: FunctionsHttpError): Promise<string> {
  try {
    const reponse = erreur.context as Response;
    const corps = (await reponse.clone().json()) as CorpsErreur;
    return typeof corps.error === 'string' ? corps.error : '';
  } catch {
    return '';
  }
}

/**
 * Convertit les erreurs techniques Supabase en consignes utiles sans révéler
 * de détail d'authentification. Une 401 est un code refusé ; les erreurs réseau
 * et relais ne doivent jamais être présentées comme un mauvais code.
 */
export async function messageErreurConnexion(
  erreur: unknown,
  donnees: unknown,
): Promise<string> {
  if (estObjet(donnees) && typeof donnees.error === 'string') {
    return traduireErreurServeur(donnees.error);
  }

  if (erreur instanceof FunctionsHttpError) {
    const reponse = erreur.context as Response;
    return traduireErreurServeur(await lireCorpsErreur(erreur), reponse.status);
  }

  if (erreur instanceof FunctionsFetchError || erreur instanceof FunctionsRelayError) {
    return MESSAGE_CONNEXION_INDISPONIBLE;
  }

  return erreur ? MESSAGE_CONNEXION_INDISPONIBLE : '';
}
