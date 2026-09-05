import { describe, expect, it, vi } from 'vitest';

// coffre.ts appelle Supabase (storage + tables) pour déposer, supprimer et
// modifier — sans mock, ces appels tenteraient un vrai réseau vers l'URL
// factice de .env.local. On simule juste assez de surface pour observer ce
// que la fonction écrit dans l'index, jamais le comportement réel de Supabase.
vi.mock('./supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      upsert: vi.fn().mockResolvedValue({ error: null }),
      insert: vi.fn().mockResolvedValue({ error: null }),
      delete: () => ({ eq: () => ({ eq: vi.fn().mockResolvedValue({ error: null }) }) }),
    })),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ error: null }),
        remove: vi.fn().mockResolvedValue({ error: null }),
      })),
    },
  },
}));

import {
  composerLettreResiliation, statutEcheance, deposerFichier, supprimerFichier,
  ajouterRendezVous, supprimerRendezVous, rechercheCorrespond, type Identite, type IndexCoffre,
  type ObjetIndex,
} from './coffre';
import { ITERATIONS, deriverCle } from './crypto';

const IDENTITE: Identite = {
  nom: 'Erwann Chevallier',
  adresse: '20a rue Clotilde Vautier',
  codePostal: '35000',
  ville: 'Rennes',
};

describe('composerLettreResiliation', () => {
  it('ne signale aucune mention manquante quand tout est connu', () => {
    const lettre = composerLettreResiliation(IDENTITE, 'EDF', 'ABC123', '2026-11-01');
    expect(lettre.mentionsManquantes).toEqual([]);
  });

  it('signale la référence client manquante, sans bloquer la composition', () => {
    const lettre = composerLettreResiliation(IDENTITE, 'EDF', null, '2026-11-01');
    expect(lettre.mentionsManquantes.some((m) => m.includes('référence client'))).toBe(true);
    // Toujours un brouillon utilisable, même incomplet — jamais une exception.
    expect(lettre.corps.length).toBeGreaterThan(0);
  });

  it('inclut le nom et l\'adresse de l\'identité dans le corps', () => {
    const lettre = composerLettreResiliation(IDENTITE, 'EDF', 'ABC123', '2026-11-01');
    expect(lettre.corps).toContain(IDENTITE.nom);
    expect(lettre.corps).toContain(IDENTITE.adresse);
    expect(lettre.corps).toContain(IDENTITE.ville);
  });

  it('inclut le nom de l\'émetteur', () => {
    const lettre = composerLettreResiliation(IDENTITE, 'Orange', 'ABC123', '2026-11-01');
    expect(lettre.corps).toContain('Orange');
  });

  it('inclut la référence client dans l\'objet quand elle est connue', () => {
    const lettre = composerLettreResiliation(IDENTITE, 'EDF', 'REF-42', '2026-11-01');
    expect(lettre.objet).toContain('REF-42');
  });

  it('formate la date d\'effet en français et ne l\'invente jamais', () => {
    const lettre = composerLettreResiliation(IDENTITE, 'EDF', 'ABC123', '2026-11-01');
    expect(lettre.corps).toContain('01/11/2026');
  });

  it('ne prétend jamais une demande de confirmation absente du texte', () => {
    const lettre = composerLettreResiliation(IDENTITE, 'EDF', 'ABC123', '2026-11-01');
    expect(lettre.corps.toLowerCase()).toContain('confirmation');
    expect(lettre.mentionsManquantes.some((m) => m.includes('confirmation'))).toBe(false);
  });
});

describe('statutEcheance', () => {
  it('urgent quand la date est dépassée (jours négatif)', () => {
    expect(statutEcheance(-3)).toBe('urgent');
  });

  it('urgent à 7 jours pile (borne incluse)', () => {
    expect(statutEcheance(7)).toBe('urgent');
  });

  it('bientôt dès 8 jours', () => {
    expect(statutEcheance(8)).toBe('bientot');
  });

  it('bientôt à 30 jours pile (borne incluse)', () => {
    expect(statutEcheance(30)).toBe('bientot');
  });

  it('calme au-delà de 30 jours', () => {
    expect(statutEcheance(31)).toBe('calme');
  });
});

// Régression du 05/09/2026 : les quatre fonctions ci-dessous reconstruisaient
// l'index sans reprendre tous ses champs — un dépôt de fichier ou l'ajout
// d'un rendez-vous effaçait silencieusement l'identité et/ou les rendez-vous
// déjà enregistrés. Corrigé par un simple `{ ...index, ... }` ; ces tests
// gardent le correctif en place.
describe("fusion de l'index — rien de déjà enregistré ne doit disparaître", () => {
  async function indexDePart(): Promise<{ cle: CryptoKey; index: IndexCoffre }> {
    const cle = await deriverCle('phrase-test', new Uint8Array(16), ITERATIONS);
    const index: IndexCoffre = {
      objets: {},
      rendezVous: { r1: { id: 'r1', libelle: 'Dentiste', date: '2026-10-01' } },
      identite: IDENTITE,
    };
    return { cle, index };
  }

  it('déposer un fichier conserve les rendez-vous et l\'identité déjà présents', async () => {
    const { cle, index } = await indexDePart();
    const fichier = new File(['contenu'], 'facture.pdf', { type: 'application/pdf' });
    const resultat = await deposerFichier('user-1', cle, fichier, 'Énergie', index);
    expect(resultat.rendezVous).toEqual(index.rendezVous);
    expect(resultat.identite).toEqual(index.identite);
    expect(Object.keys(resultat.objets)).toHaveLength(1);
  });

  it('supprimer un fichier conserve les rendez-vous et l\'identité déjà présents', async () => {
    const { cle, index } = await indexDePart();
    index.objets['deja-la'] = {
      nom: 'ancien.pdf', taille: 10, type: 'application/pdf', categorie: 'Autre',
      deposeLe: '2026-01-01T00:00:00.000Z',
    };
    const resultat = await supprimerFichier('user-1', cle, 'deja-la', index);
    expect(resultat.rendezVous).toEqual(index.rendezVous);
    expect(resultat.identite).toEqual(index.identite);
    expect(resultat.objets['deja-la']).toBeUndefined();
  });

  it('ajouter un rendez-vous conserve l\'identité déjà enregistrée', async () => {
    const { cle, index } = await indexDePart();
    const resultat = await ajouterRendezVous('user-1', cle, 'Cabinet Martin', '2026-11-05', index);
    expect(resultat.identite).toEqual(index.identite);
    expect(resultat.rendezVous?.r1).toEqual(index.rendezVous?.r1);
  });

  it('supprimer un rendez-vous conserve l\'identité déjà enregistrée', async () => {
    const { cle, index } = await indexDePart();
    const resultat = await supprimerRendezVous('user-1', cle, 'r1', index);
    expect(resultat.identite).toEqual(index.identite);
    expect(resultat.rendezVous?.r1).toBeUndefined();
  });
});

describe('rechercheCorrespond', () => {
  const OBJET: ObjetIndex = {
    nom: 'Facture EDF septembre', taille: 100, type: 'application/pdf',
    categorie: 'Énergie', deposeLe: '2026-09-01T00:00:00.000Z',
    emetteur: 'EDF', texteExtrait: 'Contrat électricité — référence 12345',
  };

  it('une requête vide correspond à tout', () => {
    expect(rechercheCorrespond(OBJET, '')).toBe(true);
    expect(rechercheCorrespond(OBJET, '   ')).toBe(true);
  });

  it('trouve sur le nom, insensible à la casse', () => {
    expect(rechercheCorrespond(OBJET, 'FACTURE')).toBe(true);
  });

  it('trouve sur la catégorie sans exiger l\'accent', () => {
    expect(rechercheCorrespond(OBJET, 'energie')).toBe(true);
  });

  it('trouve sur l\'émetteur', () => {
    expect(rechercheCorrespond(OBJET, 'edf')).toBe(true);
  });

  it('trouve sur le texte extrait à l\'analyse', () => {
    expect(rechercheCorrespond(OBJET, '12345')).toBe(true);
  });

  it('ne trouve rien sur ce qui n\'apparaît nulle part', () => {
    expect(rechercheCorrespond(OBJET, 'assurance habitation')).toBe(false);
  });

  it('ne casse pas sur un document sans texteExtrait ni émetteur', () => {
    const minimal: ObjetIndex = { nom: 'Doc', taille: 1, type: 'image/png', categorie: '', deposeLe: '2026-01-01T00:00:00.000Z' };
    expect(rechercheCorrespond(minimal, 'doc')).toBe(true);
    expect(rechercheCorrespond(minimal, 'rien')).toBe(false);
  });
});
