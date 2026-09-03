'use server';

/*
 * L'action du Bilan Patrimoine : calculer, jamais écrire.
 *
 * Contrairement à `creerProjet`/`mettreAJourProjet`, aucun `exigerSession()`
 * (l'outil est public, gratuit, sans compte — README §6 de bilan-patrimoine),
 * aucun accès à Supabase, aucun `revalidatePath` (rien n'est persisté, donc
 * rien à invalider). L'action valide le formulaire puis appelle `rediger()`
 * du cœur copié dans `@/lib/bilan` ; le `Bilan` obtenu repart tel quel dans
 * l'état renvoyé au client, qui ne quitte jamais la mémoire du navigateur.
 */
import { rediger } from '@/lib/bilan/redaction';
import type { Logement, Situation } from '@/lib/bilan/modeles';
import { analyser } from '@/lib/validation';
import { schemaBilan } from '@/lib/bilan/validation';
import type { EtatBilan } from '@/lib/actions/etat-bilan';

export async function soumettreBilan(_etat: EtatBilan, donnees: FormData): Promise<EtatBilan> {
  const analyse = analyser(schemaBilan, donnees);

  if (!analyse.valide) {
    return { statut: 'erreur', message: 'Vérifiez les champs signalés.', erreurs: analyse.erreurs, bilan: null };
  }

  const { donnees: d } = analyse;

  const logement: Logement | null =
    d.logementValeurEur === null || d.logementCapitalRestantDuEur === null
      ? null
      : { valeurEur: d.logementValeurEur, capitalRestantDuEur: d.logementCapitalRestantDuEur };

  const situation: Situation = {
    age: d.age,
    foyer: { adultes: d.adultes as 1 | 2, enfants: d.enfants },
    revenuMensuelNetEur: d.revenuMensuelNetEur,
    horizon: d.horizon,
    livretsEur: d.livretsEur,
    tauxLivretsPct: d.tauxLivretsPct,
    assuranceVieEur: d.assuranceVieEur,
    tauxAssuranceViePct: d.tauxAssuranceViePct,
    bourseEur: d.bourseEur,
    logement,
  };

  const bilan = rediger(situation, new Date());

  return { statut: 'succes', message: '', erreurs: {}, bilan };
}
