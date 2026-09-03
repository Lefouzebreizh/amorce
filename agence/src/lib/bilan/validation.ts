/*
 * Validation du formulaire du Bilan Patrimoine, côté serveur.
 *
 * Mêmes outils que `@/lib/validation` (Zod + `analyser()`, générique et
 * réutilisée telle quelle) : un schéma de plus, sur le même modèle que
 * `schemaProjet`. La différence porte sur les champs facultatifs — ce
 * formulaire en a beaucoup plus, et une chaîne vide doit devenir `null` (« je
 * ne sais pas »), jamais 0 (« je sais, et c'est zéro ») : voir modeles.ts.
 */
import { z } from 'zod';

/**
 * Chaîne vide ou absente → `null`. Le pendant numérique de `texteFacultatif`
 * dans `@/lib/validation`.
 *
 * « Absente » compte autant que « vide » : les deux champs du logement ne
 * sont même pas rendus dans le DOM tant que la case « propriétaire » n'est
 * pas cochée, donc absents du `FormData`, pas seulement vides.
 */
const nombreFacultatif = (max: number, message: string) =>
  z.preprocess((valeur) => {
    if (typeof valeur !== 'string') return null;
    const nettoye = valeur.trim();
    return nettoye.length === 0 ? null : nettoye;
  }, z.union([z.null(), z.coerce.number({ message }).min(0, message).max(max, message)]));

/**
 * Le pendant obligatoire : une chaîne vide doit échouer, pas devenir `0`.
 *
 * `z.coerce.number()` seul seul ne fait pas cette différence : `Number('')`
 * vaut `0` en JavaScript, donc un champ requis laissé vide passerait la
 * validation en silence — repéré à l'essai dans le navigateur sur
 * `revenuMensuelNetEur`, qui restait sans erreur affichée alors qu'il était
 * vide.
 */
const nombreObligatoire = (max: number, message: string) =>
  z.preprocess((valeur) => {
    if (typeof valeur !== 'string') return valeur;
    const nettoye = valeur.trim();
    // Vide devient `undefined`, jamais une chaîne vide : `Number('')` vaut `0`
    // en JavaScript, ce qui ferait passer un champ requis laissé vide.
    return nettoye.length === 0 ? undefined : nettoye;
  }, z.coerce.number({ message }).min(0, message).max(max, message));

export const TRANCHES_AGE = ['18-29', '30-39', '40-49', '50-59', '60+'] as const;
export const LIBELLES_TRANCHE_AGE: Record<(typeof TRANCHES_AGE)[number], string> = {
  '18-29': '18 à 29 ans',
  '30-39': '30 à 39 ans',
  '40-49': '40 à 49 ans',
  '50-59': '50 à 59 ans',
  '60+': '60 ans et plus',
};

export const HORIZONS = ['3ans', '10ans', 'retraite', 'inconnu'] as const;
export const LIBELLES_HORIZON: Record<(typeof HORIZONS)[number], string> = {
  '3ans': 'Dans 3 ans',
  '10ans': 'Dans 10 ans',
  retraite: 'Pour la retraite',
  inconnu: 'Je ne sais pas',
};

/** Plafond de saisie large et non un plafond réglementaire : il n'existe que
 *  pour repousser une faute de frappe (un zéro de trop), jamais pour brider
 *  une vraie situation. */
const PLAFOND_SAISIE_EUR = 50_000_000;

export const schemaBilan = z
  .object({
    age: z.enum(TRANCHES_AGE, { message: 'Choisissez une tranche d’âge.' }),
    // `adultes` et `enfants` ont toujours une valeur par défaut côté formulaire
    // (le select part sur 1, le nombre d'enfants sur 0) : `z.coerce.number()`
    // seul suffit, ils n'arrivent jamais vides en pratique.
    adultes: z.coerce.number().int().min(1).max(2),
    enfants: z.coerce.number().int().min(0, 'Le nombre d’enfants ne peut pas être négatif.').max(20),
    // `revenuMensuelNetEur` n'a pas de valeur par défaut : `nombreObligatoire`
    // évite qu'un champ laissé vide ne devienne silencieusement 0 €.
    revenuMensuelNetEur: nombreObligatoire(PLAFOND_SAISIE_EUR, 'Indiquez votre revenu mensuel net.'),
    horizon: z.enum(HORIZONS, { message: 'Choisissez à quoi sert cet argent.' }),

    livretsEur: nombreFacultatif(PLAFOND_SAISIE_EUR, 'Indiquez un montant valide.'),
    tauxLivretsPct: nombreFacultatif(100, 'Indiquez un taux entre 0 et 100.'),

    assuranceVieEur: nombreFacultatif(PLAFOND_SAISIE_EUR, 'Indiquez un montant valide.'),
    tauxAssuranceViePct: nombreFacultatif(100, 'Indiquez un taux entre 0 et 100.'),

    bourseEur: nombreFacultatif(PLAFOND_SAISIE_EUR, 'Indiquez un montant valide.'),

    // Portée par une case « je suis propriétaire » côté formulaire : décochée,
    // ces deux champs n'arrivent pas dans le FormData, `analyser()` les rend
    // `undefined`, et le schéma les traite comme absents.
    logementValeurEur: nombreFacultatif(PLAFOND_SAISIE_EUR, 'Indiquez la valeur du logement.'),
    logementCapitalRestantDuEur: nombreFacultatif(PLAFOND_SAISIE_EUR, 'Indiquez le capital restant dû.'),
  })
  // Une valeur de logement sans l'autre serait une situation invalide côté
  // modèle (`Logement` exige les deux) — refusée ici plutôt que devinée.
  .refine(
    (valeurs) => (valeurs.logementValeurEur === null) === (valeurs.logementCapitalRestantDuEur === null),
    {
      message: 'Indiquez la valeur du logement et le capital restant dû, ou aucun des deux.',
      path: ['logementValeurEur'],
    },
  );

export type DonneesBilan = z.infer<typeof schemaBilan>;
