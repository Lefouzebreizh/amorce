import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  analyser,
  schemaInscription,
  schemaNouveauMotDePasse,
  schemaProjet,
} from '@/lib/validation';

/** Raccourci : un formulaire se décrit par ses paires clé / valeur. */
function formulaire(champs: Record<string, string>): FormData {
  const donnees = new FormData();

  for (const [cle, valeur] of Object.entries(champs)) {
    donnees.set(cle, valeur);
  }

  return donnees;
}

const PROJET_VALIDE = {
  titre: 'Refonte du site vitrine',
  description: 'Six pages, charte existante.',
  statut: 'in_progress',
  montant: '1200.50',
};

describe('schéma de projet', () => {
  it('accepte un projet complet et convertit le montant en nombre', () => {
    const analyse = analyser(schemaProjet, formulaire(PROJET_VALIDE));

    assert.equal(analyse.valide, true);
    assert.equal(analyse.valide && analyse.donnees.montant, 1200.5);
    assert.equal(analyse.valide && analyse.donnees.statut, 'in_progress');
  });

  it('rend une description vide sous forme de nul, jamais de chaîne vide', () => {
    const analyse = analyser(schemaProjet, formulaire({ ...PROJET_VALIDE, description: '   ' }));

    assert.equal(analyse.valide, true);
    assert.equal(analyse.valide && analyse.donnees.description, null);
  });

  it('refuse un titre qui ne contient que des espaces', () => {
    const analyse = analyser(schemaProjet, formulaire({ ...PROJET_VALIDE, titre: '   ' }));

    assert.equal(analyse.valide, false);
    assert.ok(!analyse.valide && analyse.erreurs.titre);
  });

  it('refuse un titre plus long que la contrainte de la base', () => {
    const analyse = analyser(schemaProjet, formulaire({ ...PROJET_VALIDE, titre: 'a'.repeat(121) }));

    assert.equal(analyse.valide, false);
  });

  it("refuse un montant négatif, qui n'existe pas pour une estimation", () => {
    const analyse = analyser(schemaProjet, formulaire({ ...PROJET_VALIDE, montant: '-1' }));

    assert.equal(analyse.valide, false);
    assert.ok(!analyse.valide && analyse.erreurs.montant);
  });

  it('refuse un montant qui n’est pas un nombre', () => {
    const analyse = analyser(schemaProjet, formulaire({ ...PROJET_VALIDE, montant: '1 200,50' }));

    assert.equal(analyse.valide, false);
    assert.ok(!analyse.valide && analyse.erreurs.montant);
  });

  it('refuse un statut absent de la contrainte CHECK', () => {
    const analyse = analyser(schemaProjet, formulaire({ ...PROJET_VALIDE, statut: 'archive' }));

    assert.equal(analyse.valide, false);
    assert.ok(!analyse.valide && analyse.erreurs.statut);
  });

  it('ignore un champ que le schéma ne connaît pas', () => {
    // Le formulaire de modification transporte l'identifiant du projet ; il est
    // lu à part, et ne doit pas faire échouer la validation.
    const analyse = analyser(schemaProjet, formulaire({ ...PROJET_VALIDE, id: 'abc' }));

    assert.equal(analyse.valide, true);
  });
});

describe("schéma d'inscription", () => {
  it('accepte une inscription sans entreprise', () => {
    const analyse = analyser(
      schemaInscription,
      formulaire({
        email: 'camille@exemple.fr',
        motDePasse: 'motdepasse',
        nomComplet: 'Camille Martin',
        entreprise: '',
      }),
    );

    assert.equal(analyse.valide, true);
    assert.equal(analyse.valide && analyse.donnees.entreprise, null);
  });

  it('refuse un mot de passe plus court que ce qu’acceptera Supabase', () => {
    const analyse = analyser(
      schemaInscription,
      formulaire({ email: 'camille@exemple.fr', motDePasse: 'court', nomComplet: 'Camille' }),
    );

    assert.equal(analyse.valide, false);
    assert.ok(!analyse.valide && analyse.erreurs.motDePasse);
  });

  it('refuse une adresse électronique invalide', () => {
    const analyse = analyser(
      schemaInscription,
      formulaire({ email: 'camille', motDePasse: 'motdepasse', nomComplet: 'Camille' }),
    );

    assert.equal(analyse.valide, false);
    assert.ok(!analyse.valide && analyse.erreurs.email);
  });
});

describe('schéma de nouveau mot de passe', () => {
  it('accepte deux saisies identiques', () => {
    const analyse = analyser(
      schemaNouveauMotDePasse,
      formulaire({ motDePasse: 'motdepasse', confirmation: 'motdepasse' }),
    );

    assert.equal(analyse.valide, true);
  });

  it('signale la divergence sur le champ de confirmation, pas sur le premier', () => {
    const analyse = analyser(
      schemaNouveauMotDePasse,
      formulaire({ motDePasse: 'motdepasse', confirmation: 'motdepass' }),
    );

    assert.equal(analyse.valide, false);
    assert.ok(!analyse.valide && analyse.erreurs.confirmation);
    assert.equal(analyse.valide === false && analyse.erreurs.motDePasse, undefined);
  });
});
