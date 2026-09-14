const PREFIXE_CLE_ANTHROPIC = 'sk-ant-';

export type ValidationSecret =
  | { valide: true; valeur: string }
  | { valide: false; raison: 'absent' | 'malforme' };

/**
 * Accepte uniquement une valeur prête à être placée dans un en-tête HTTP.
 * On ne corrige pas silencieusement un secret : un trim masquerait notamment
 * un collage avec retour à la ligne ou une valeur dupliquée dans Vercel.
 */
export function validerCleAnthropic(valeur: string | undefined): ValidationSecret {
  if (valeur === undefined || valeur === '') return { valide: false, raison: 'absent' };
  if (
    !valeur.startsWith(PREFIXE_CLE_ANTHROPIC)
    ||
    valeur !== valeur.trim()
    || /\s|[\u0000-\u001f\u007f]/u.test(valeur)
    || valeur.indexOf(PREFIXE_CLE_ANTHROPIC, PREFIXE_CLE_ANTHROPIC.length) !== -1
  ) {
    return { valide: false, raison: 'malforme' };
  }
  return { valide: true, valeur };
}

/** Retire les secrets connus d'un texte avant toute journalisation serveur. */
export function masquerSecrets(texte: string, secrets: readonly (string | undefined)[]): string {
  let resultat = texte;
  for (const secret of secrets) {
    if (secret) resultat = resultat.split(secret).join('[SECRET MASQUE]');
  }
  // Défense supplémentaire si le fournisseur recopie une autre clé Anthropic.
  return resultat.replace(/sk-ant-[A-Za-z0-9_-]+/gu, '[CLE ANTHROPIC MASQUEE]');
}
