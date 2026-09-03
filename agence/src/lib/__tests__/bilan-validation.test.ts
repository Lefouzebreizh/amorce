import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { schemaBilan } from '@/lib/bilan/validation';
import { analyser } from '@/lib/validation';

/** Raccourci : un formulaire se décrit par ses paires clé / valeur. */
function formulaire(champs: Record<string, string>): FormData {
  const donnees = new FormData();

  for (const [cle, valeur] of Object.entries(champs)) {
    donnees.set(cle, valeur);
  }

  return donnees;
}

const SITUATION_MINIMALE = {
  age: '30-39',
  adultes: '2',
  enfants: '1',
  revenuMensuelNetEur: '2800',
  horizon: '10ans',
};

describe('schéma du bilan', () => {
  it('accepte le strict minimum, tous les champs facultatifs absents', () => {
    const analyse = analyser(schemaBilan, formulaire(SITUATION_MINIMALE));

    assert.equal(analyse.valide, true);
    assert.equal(analyse.valide && analyse.donnees.livretsEur, null);
    assert.equal(analyse.valide && analyse.donnees.logementValeurEur, null);
  });

  it('convertit un montant facultatif renseigné en nombre', () => {
    const analyse = analyser(schemaBilan, formulaire({ ...SITUATION_MINIMALE, livretsEur: '6000' }));

    assert.equal(analyse.valide, true);
    assert.equal(analyse.valide && analyse.donnees.livretsEur, 6000);
  });

  it('rend un champ facultatif vide sous forme de nul, comme s’il était absent', () => {
    const analyse = analyser(schemaBilan, formulaire({ ...SITUATION_MINIMALE, livretsEur: '   ' }));

    assert.equal(analyse.valide, true);
    assert.equal(analyse.valide && analyse.donnees.livretsEur, null);
  });

  it('refuse un logement dont seule la valeur est renseignée', () => {
    // `Logement` (le modèle) exige les deux champs ensemble ; en accepter un
    // seul laisserait passer une situation que le calcul ne sait pas modéliser.
    const analyse = analyser(schemaBilan, formulaire({ ...SITUATION_MINIMALE, logementValeurEur: '232000' }));

    assert.equal(analyse.valide, false);
    assert.ok(!analyse.valide && analyse.erreurs.logementValeurEur);
  });

  it('accepte un logement dont les deux champs sont renseignés', () => {
    const analyse = analyser(
      schemaBilan,
      formulaire({
        ...SITUATION_MINIMALE,
        logementValeurEur: '232000',
        logementCapitalRestantDuEur: '198000',
      }),
    );

    assert.equal(analyse.valide, true);
  });

  it('refuse une tranche d’âge inconnue', () => {
    const analyse = analyser(schemaBilan, formulaire({ ...SITUATION_MINIMALE, age: '15-17' }));

    assert.equal(analyse.valide, false);
    assert.ok(!analyse.valide && analyse.erreurs.age);
  });

  it('refuse un revenu négatif', () => {
    const analyse = analyser(schemaBilan, formulaire({ ...SITUATION_MINIMALE, revenuMensuelNetEur: '-1' }));

    assert.equal(analyse.valide, false);
    assert.ok(!analyse.valide && analyse.erreurs.revenuMensuelNetEur);
  });

  it('refuse un revenu laissé vide plutôt que de le prendre pour zéro', () => {
    // `Number('')` vaut 0 en JavaScript : un champ requis laissé vide doit
    // échouer, pas se faire accepter en silence comme « 0 € par mois ».
    const analyse = analyser(schemaBilan, formulaire({ ...SITUATION_MINIMALE, revenuMensuelNetEur: '' }));

    assert.equal(analyse.valide, false);
    assert.ok(!analyse.valide && analyse.erreurs.revenuMensuelNetEur);
  });

  it('refuse un taux facultatif au-delà de cent pour cent', () => {
    const analyse = analyser(schemaBilan, formulaire({ ...SITUATION_MINIMALE, tauxLivretsPct: '150' }));

    assert.equal(analyse.valide, false);
    assert.ok(!analyse.valide && analyse.erreurs.tauxLivretsPct);
  });
});
