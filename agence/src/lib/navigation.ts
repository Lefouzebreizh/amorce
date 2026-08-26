/*
 * Destination de retour après une étape d'authentification.
 *
 * Ce fichier existe pour une seule fonction, et c'est justifié : elle ferme une
 * redirection ouverte, elle est appelée depuis un module `'use server'` — où
 * tout export doit être une fonction asynchrone — et depuis un gestionnaire de
 * route. Elle est donc à la fois partagée et directement testable.
 */

/** Là où atterrit un utilisateur connecté quand rien d'autre n'est demandé. */
export const APRES_CONNEXION = '/tableau-de-bord';

/**
 * Page de choix d'un nouveau mot de passe. Elle est nommée ici parce que trois
 * endroits en dépendent : le lien envoyé par courriel, le garde du proxy et la
 * page elle-même. Une chaîne recopiée trois fois se désynchronise à la première
 * renommée, et le parcours de récupération casse en silence.
 */
export const PAGE_NOUVEAU_MOT_DE_PASSE = '/nouveau-mot-de-passe';

/**
 * N'accepte qu'un chemin interne. Reprendre tel quel un paramètre venu de
 * l'URL ou du formulaire ouvrirait une redirection vers un domaine tiers : le
 * lien, légitime en apparence, déposerait l'utilisateur sur une copie du site
 * juste après qu'il a saisi son mot de passe.
 *
 * Sont refusés : une adresse absolue (`https://…`), un chemin protocole-relatif
 * (`//exemple.fr`), une barre oblique inversée — que certains navigateurs
 * normalisent en `/` — et tout ce qui n'est pas une chaîne.
 */
export function destinationSure(valeur: unknown, repli: string = APRES_CONNEXION): string {
  if (typeof valeur !== 'string') {
    return repli;
  }

  const estCheminInterne =
    valeur.startsWith('/') && !valeur.startsWith('//') && !valeur.includes('\\');

  return estCheminInterne ? valeur : repli;
}
