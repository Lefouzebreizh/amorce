import { describe, expect, it } from 'vitest';
import { composerLettreResiliation, type Identite } from './coffre';

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
