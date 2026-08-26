/*
 * Validation des formulaires, côté serveur.
 *
 * Les mêmes règles existent dans le schéma SQL (contraintes CHECK). Ce n'est
 * pas une redite inutile : la base refuse une valeur invalide, mais elle le
 * fait avec un message anglais destiné à un développeur. Zod sert à répondre
 * « Le titre est obligatoire » sous le bon champ.
 */
import { z } from 'zod';

import { STATUTS_PROJET } from '@/lib/types';

/** Vide ou absent devient `null` : la base ne stocke pas de chaîne vide. */
const texteFacultatif = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Ce champ ne peut pas dépasser ${max} caractères.`)
    .transform((valeur) => (valeur.length === 0 ? null : valeur))
    .nullable();

export const schemaConnexion = z.object({
  email: z.email({ message: 'Adresse électronique invalide.' }),
  motDePasse: z.string().min(1, 'Le mot de passe est obligatoire.'),
});

export const schemaInscription = z.object({
  email: z.email({ message: 'Adresse électronique invalide.' }),
  // Huit caractères est le minimum accepté par Supabase Auth ; annoncer la même
  // règle ici évite un aller-retour réseau pour l'apprendre.
  motDePasse: z.string().min(8, 'Huit caractères au minimum.'),
  nomComplet: z.string().trim().min(2, 'Indiquez votre nom.').max(120),
  entreprise: texteFacultatif(120),
});

export const schemaAdresse = z.object({
  email: z.email({ message: 'Adresse électronique invalide.' }),
});

export const schemaNouveauMotDePasse = z
  .object({
    motDePasse: z.string().min(8, 'Huit caractères au minimum.'),
    confirmation: z.string().min(1, 'Retapez le mot de passe.'),
  })
  // La confirmation n'est pas une coquetterie : la saisie est masquée, et une
  // faute de frappe enfermerait dehors quelqu'un qui vient justement de perdre
  // son accès.
  .refine((valeurs) => valeurs.motDePasse === valeurs.confirmation, {
    message: 'Les deux saisies diffèrent.',
    path: ['confirmation'],
  });

export const schemaProfil = z.object({
  nomComplet: z.string().trim().min(2, 'Indiquez votre nom.').max(120),
  entreprise: texteFacultatif(120),
});

export const schemaProjet = z.object({
  titre: z
    .string()
    .trim()
    .min(1, 'Le titre est obligatoire.')
    .max(120, 'Le titre ne peut pas dépasser 120 caractères.'),
  description: texteFacultatif(2000),
  statut: z.enum(STATUTS_PROJET, { message: 'Statut inconnu.' }),
  montant: z
    .coerce
    .number({ message: 'Indiquez un montant en euros.' })
    .min(0, 'Un montant estimé ne peut pas être négatif.')
    .max(99_999_999.99, 'Montant trop élevé pour la fiche.'),
});

export type DonneesProjet = z.infer<typeof schemaProjet>;

/** Erreurs indexées par nom de champ, prêtes à passer au formulaire. */
export type ErreursChamps = Record<string, string>;

export type Analyse<T> =
  | { valide: true; donnees: T }
  | { valide: false; erreurs: ErreursChamps };

/**
 * Applique un schéma à un `FormData`. Un `FormData` ne contient que des chaînes
 * et des fichiers : les champs absents deviennent `undefined` pour que Zod
 * distingue « non envoyé » de « envoyé vide ».
 */
export function analyser<S extends z.ZodType>(
  schema: S,
  donnees: FormData,
): Analyse<z.output<S>> {
  const brut: Record<string, unknown> = {};

  for (const [cle, valeur] of donnees.entries()) {
    if (typeof valeur === 'string') {
      brut[cle] = valeur;
    }
  }

  const resultat = schema.safeParse(brut);

  if (resultat.success) {
    return { valide: true, donnees: resultat.data };
  }

  const erreurs: ErreursChamps = {};
  for (const probleme of resultat.error.issues) {
    const champ = probleme.path[0];
    if (typeof champ === 'string' && !(champ in erreurs)) {
      erreurs[champ] = probleme.message;
    }
  }

  return { valide: false, erreurs };
}
