export const METIERS_SMS = ['Plombier', 'Électricien', 'Maçon', 'Couvreur', 'Paysagiste', 'Serrurier'] as const;

export function messageAppelManque(metier: string): string {
  return `Bonjour, je suis en intervention et je n’ai pas pu répondre. Dites-moi en deux mots votre besoin, votre commune et si c’est urgent. Je vous rappelle dès que je suis disponible. Merci ! Votre ${metier.toLocaleLowerCase('fr-FR')}.`;
}

/** Seules les informations saisies par le visiteur rejoignent le récapitulatif. */
export function qualifierReponse(besoin: string, commune: string, urgence: string) {
  return { besoin: besoin.trim(), commune: commune.trim(), urgence };
}

export function lienAvisValide(brut: string): boolean {
  try {
    const url = new URL(brut.trim());
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return false;
    return (url.hostname === 'g.page' && /^\/r\/[^/]+\/review\/?$/.test(url.pathname))
      || (url.hostname === 'search.google.com' && url.pathname === '/local/writereview' && !!url.searchParams.get('placeid'));
  } catch { return false; }
}

export function messageAvis(entreprise: string, lien: string): string {
  return `Bonjour, merci d’avoir fait confiance à ${entreprise.trim() || 'notre entreprise'}. Votre retour sur notre intervention nous aide à progresser. Vous pouvez partager votre expérience ici : ${lien.trim() || '[votre lien d’avis Google]'}. Merci pour votre temps !`;
}
