type ErreurMiseAJourMotDePasse = {
  status?: number;
  code?: string;
  message?: string;
};

export function messageErreurMiseAJourMotDePasse(erreur: ErreurMiseAJourMotDePasse): string {
  const code = (erreur.code ?? '').toLowerCase();
  const message = (erreur.message ?? '').toLowerCase();
  if (
    erreur.status === 401
    || code === 'otp_expired'
    || /expired|invalid.*(token|recovery)|recovery.*(token|expired)|session.*not found/.test(message)
  ) {
    return 'Le lien de récupération a expiré ou a déjà été utilisé. Demande-en un nouveau.';
  }
  if (code === 'weak_password' || /password.*(weak|short|characters)|weak password/.test(message)) {
    return 'Le mot de passe n’a pas été accepté. Choisis-en un autre d’au moins 12 caractères.';
  }
  return 'Le nouveau mot de passe n’a pas pu être enregistré. Vérifie ta connexion et réessaie.';
}
