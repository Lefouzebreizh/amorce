import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CHAMP_PIEGE, analyserDemande, normaliserTelephone } from '@/lib/demande';

const COMPLETE = {
  nom: 'Yann Le Goff',
  metier: 'Couvreur',
  ville: 'Quimper',
  telephone: '06 12 34 56 78',
  courriel: 'yann@exemple.fr',
  message: 'Rénovation de toiture sur 30 km.',
};

describe('analyserDemande', () => {
  it('accepte une demande complète et normalise le téléphone', () => {
    const analyse = analyserDemande(COMPLETE);

    assert.equal(analyse.statut, 'valide');
    assert.equal(analyse.statut === 'valide' && analyse.demande.telephone, '0612345678');
  });

  it('accepte une demande sans courriel ni message : le téléphone suffit', () => {
    const analyse = analyserDemande({ ...COMPLETE, courriel: '', message: '' });

    assert.equal(analyse.statut, 'valide');
  });

  it('rogne les espaces autour de chaque champ', () => {
    const analyse = analyserDemande({ ...COMPLETE, nom: '  Yann Le Goff  ' });

    assert.equal(analyse.statut === 'valide' && analyse.demande.nom, 'Yann Le Goff');
  });

  it('refuse les champs vides en les nommant tous d’un coup', () => {
    const analyse = analyserDemande({});

    assert.equal(analyse.statut, 'invalide');
    if (analyse.statut !== 'invalide') return;
    assert.deepEqual(Object.keys(analyse.erreurs).sort(), ['metier', 'nom', 'telephone', 'ville']);
  });

  it('refuse un numéro trop court', () => {
    const analyse = analyserDemande({ ...COMPLETE, telephone: '06 12' });

    assert.equal(analyse.statut, 'invalide');
    assert.ok(analyse.statut === 'invalide' && analyse.erreurs.telephone);
  });

  it('refuse un courriel mal formé, mais seulement s’il est rempli', () => {
    const casse = analyserDemande({ ...COMPLETE, courriel: 'yann@exemple' });
    assert.equal(casse.statut, 'invalide');

    const absent = analyserDemande({ ...COMPLETE, courriel: '   ' });
    assert.equal(absent.statut, 'valide');
  });

  it('refuse un message à rallonge', () => {
    const analyse = analyserDemande({ ...COMPLETE, message: 'a'.repeat(2001) });

    assert.equal(analyse.statut, 'invalide');
    assert.ok(analyse.statut === 'invalide' && analyse.erreurs.message);
  });

  it('signale un robot sans rendre d’erreur : il n’a rien à apprendre', () => {
    const analyse = analyserDemande({ ...COMPLETE, [CHAMP_PIEGE]: 'https://spam.example' });

    assert.equal(analyse.statut, 'robot');
  });

  it('ne casse pas sur une charge qui n’est pas un objet', () => {
    for (const charge of [null, undefined, 42, 'texte', []]) {
      assert.equal(analyserDemande(charge).statut, 'invalide');
    }
  });
});

describe('normaliserTelephone', () => {
  it('garde les chiffres et un seul plus de tête', () => {
    assert.equal(normaliserTelephone('06.12.34.56.78'), '0612345678');
    assert.equal(normaliserTelephone('+33 6 12 34 56 78'), '+33612345678');
    assert.equal(normaliserTelephone('06 12 34 56 78'), '0612345678');
  });
});
