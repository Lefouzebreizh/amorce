import { type Commande, MODELES, OPTIONS, prixTotal } from '@/lib/commande';
import { CLE_RESEND, DESTINATAIRE, EXPEDITEUR, aUnCourriel } from '@/lib/config';

/*
 * L'envoi du dossier par courriel, via l'API HTTP de Resend.
 *
 * Appel direct plutôt que le paquet officiel : une dépendance de plus pour une
 * requête POST alourdit l'installation, la CI et la surface à tenir à jour.
 *
 * Sans clé, la fonction ne prétend pas avoir envoyé. Elle rend `envoye: false`
 * et la page l'annonce — un accusé de réception faux coûte plus cher qu'un
 * message honnête, parce qu'on ne rappelle pas quelqu'un qui pense être servi.
 */

export type Resultat = { envoye: boolean; raison?: string };

/** Le corps du courriel, en texte. Pur, donc éprouvable sans réseau. */
export function corpsDuCourriel(
  commande: Commande,
  reference: string,
  fichiers: readonly string[],
  chemin: string,
): string {
  const modele = MODELES.find((m) => m.id === commande.modele);
  const retenues = OPTIONS.filter((o) => commande.options.includes(o.id));

  const lignes = [
    `NOUVELLE COMMANDE — ${reference}`,
    '',
    `Modèle      : ${modele ? modele.nom : commande.modele}`,
    `Entreprise  : ${commande.entreprise}`,
    `Téléphone   : ${commande.telephone}`,
    `Ville       : ${commande.ville}`,
    `Couleur     : ${commande.couleur}`,
    `Slogan      : ${commande.slogan || '(aucun)'}`,
    '',
    `TOTAL       : ${prixTotal(commande.options)} €`,
    '',
    'FONCTIONS DEMANDÉES',
    ...(retenues.length === 0
      ? ['  (aucune)']
      : retenues.map((o) => `  - ${o.nom}${o.supplement > 0 ? ` (+ ${o.supplement} €)` : ''}`)),
    '',
    'PRÉSENTATION',
    commande.presentation.trim() === '' ? '  (vide)' : commande.presentation.trim(),
    '',
    'SERVICES ET PRIX',
    commande.services.trim() === '' ? '  (vide)' : commande.services.trim(),
    '',
    `PHOTOS (${fichiers.length})`,
    ...(fichiers.length === 0 ? ['  (aucune)'] : fichiers.map((f) => `  - ${f}`)),
    '',
    `Dossier local : ${chemin}`,
  ];

  return lignes.join('\n');
}

export async function envoyerDossier(
  commande: Commande,
  reference: string,
  fichiers: readonly string[],
  chemin: string,
): Promise<Resultat> {
  if (!aUnCourriel) {
    return { envoye: false, raison: 'RESEND_API_KEY absente : le dossier est écrit, rien n’est parti.' };
  }

  try {
    const reponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${CLE_RESEND}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: EXPEDITEUR,
        to: [DESTINATAIRE],
        subject: `TITAN — ${commande.entreprise} (${commande.ville}) — ${prixTotal(commande.options)} €`,
        text: corpsDuCourriel(commande, reference, fichiers, chemin),
      }),
    });

    if (!reponse.ok) {
      return { envoye: false, raison: `Resend a répondu ${reponse.status}.` };
    }
    return { envoye: true };
  } catch (e) {
    return { envoye: false, raison: e instanceof Error ? e.message : 'Envoi impossible.' };
  }
}
