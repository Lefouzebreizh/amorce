/**
 * L'unique appel sortant de ce serveur, et il est nommé comme tel : envoyer
 * le lien de connexion. Tout le reste — vérifier un jeton, lire un solde,
 * créditer un achat — ne parle qu'à sa propre base D1.
 *
 * Resend plutôt qu'un autre fournisseur : c'est déjà celui qu'utilise
 * `artisan-express` pour son formulaire de devis, donc déjà une clé que le
 * propriétaire sait poser sur Vercel/Cloudflare et déjà un domaine
 * expéditeur à vérifier une seule fois pour tout le dépôt.
 *
 * Appelé par `fetch` brut, sans SDK : l'API de Resend est un `POST` JSON, et
 * un SDK ajouterait une dépendance pour économiser huit lignes.
 */

export async function envoyerLienConnexion(
  cleResend: string,
  destinataire: string,
  lien: string,
  expediteur: string,
): Promise<boolean> {
  if (!cleResend) return false;

  const reponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cleResend}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: expediteur,
      to: destinataire,
      subject: 'Ton lien de connexion Amorce',
      // Texte brut aussi : un client de messagerie qui bloque le HTML doit
      // pouvoir lire et copier le lien quand même.
      text: `Pour te connecter à Amorce, ouvre ce lien dans les quinze minutes qui suivent :\n\n${lien}\n\nSi tu n'as rien demandé, ignore ce message.`,
      html: `<p>Pour te connecter à Amorce, ouvre ce lien dans les quinze minutes qui suivent :</p><p><a href="${lien}">${lien}</a></p><p>Si tu n'as rien demandé, ignore ce message.</p>`,
    }),
  });

  return reponse.ok;
}
