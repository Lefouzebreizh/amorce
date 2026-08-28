/*
 * La route qui transforme le formulaire en courriel.
 *
 * Elle ne garde rien : pas de base, pas de fichier, pas de mouchard. Ce que
 * l'artisan écrit part dans une boîte aux lettres et nulle part ailleurs.
 *
 * Elle revalide côté serveur ce que le navigateur a déjà contrôlé, parce qu'un
 * contrôle fait uniquement dans le navigateur ne contrôle rien : la route est
 * publique et se poste avec n'importe quel outil.
 */

import { analyserDemande } from '@/lib/demande';
import { envoyerDemande, lireReglages } from '@/lib/courriel';

export const runtime = 'nodejs';

export async function POST(requete: Request): Promise<Response> {
  let charge: unknown;

  try {
    charge = await requete.json();
  } catch {
    return Response.json({ statut: 'invalide', erreurs: {} }, { status: 400 });
  }

  const analyse = analyserDemande(charge);

  /*
   * Un robot reçoit exactement la même réponse qu'un humain servi. Lui dire
   * qu'il a été repéré n'apprend rien à personne, sauf à lui.
   */
  if (analyse.statut === 'robot') {
    return Response.json({ statut: 'recu' }, { status: 200 });
  }

  if (analyse.statut === 'invalide') {
    return Response.json({ statut: 'invalide', erreurs: analyse.erreurs }, { status: 400 });
  }

  const resultat = await envoyerDemande(analyse.demande, lireReglages(process.env));

  if (resultat.statut === 'non-configure') {
    return Response.json({ statut: 'non-configure' }, { status: 503 });
  }

  if (resultat.statut === 'echec') {
    // Le détail reste dans les journaux de l'hébergeur : il ne dit rien à
    // l'artisan et renseignerait un attaquant sur le prestataire d'envoi.
    console.error('[devis] envoi refusé :', resultat.detail);
    return Response.json({ statut: 'echec' }, { status: 502 });
  }

  return Response.json({ statut: 'recu' }, { status: 200 });
}
