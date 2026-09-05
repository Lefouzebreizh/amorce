/*
 * Les deux fonctions pures que le Tiroir Secret utilise pour *présenter* —
 * le statut d'une échéance et la correspondance d'une recherche.
 *
 * Elles ne chiffrent rien et ne parlent à personne : ni client factice, ni
 * clé, ni journal d'appels. C'est pourquoi elles vivent dans leur propre
 * fichier plutôt que dans `coffre.test.ts`, dont tout le harnais existe pour
 * observer ce qui sort du navigateur.
 *
 * **Portées depuis la suite vitest retirée le 05/09/2026.** Deux sessions
 * avaient doté ce projet de deux lanceurs de tests en parallèle ; le
 * propriétaire a tranché pour `node --test`, qui n'ajoute aucune dépendance et
 * tourne sans `node_modules`. La décision portait sur le lanceur, pas sur la
 * couverture : ces douze cas étaient les seuls que l'autre suite gardait
 * seule, et les perdre aurait fait payer un choix d'outillage à deux fonctions
 * qui n'y sont pour rien.
 *
 * Ce que ces cas ont de précieux et qu'on ne réécrit pas de mémoire : ils
 * épinglent les **bornes**, 7 et 30 jours inclus. Un seuil se déplace d'un
 * jour sans que rien ne le signale, et c'est exactement ce qui ferait passer
 * une échéance d'« urgent » à « bientôt » la veille du jour où elle compte.
 */

import { strict as assert } from 'node:assert';
import { describe, it, mock } from 'node:test';

// **Deux fonctions pures, et il faut quand même simuler Supabase.** Elles
// vivent dans `coffre.ts`, qui importe `./supabase`, qui construit son client
// au chargement et exige `@supabase/supabase-js` — absent tant qu'on n'a rien
// installé, ce qui est précisément le cas où ces tests doivent tourner.
//
// C'est la **frontière du module** qui décide de la testabilité, jamais la
// pureté de la fonction : importer une fonction, c'est exécuter tout ce que
// son fichier importe. Le jour où ces deux-là déménageront dans un module sans
// dépendance, ces quatre lignes disparaîtront — et ce serait un progrès.
mock.module(new URL('../supabase.ts', import.meta.url).href, {
  namedExports: { supabase: {} },
});

const { statutEcheance, rechercheCorrespond } = await import('../coffre');
type ObjetIndex = Parameters<typeof rechercheCorrespond>[0];

describe('le statut d’une échéance', () => {
  it('est urgent quand la date est dépassée', () => {
    assert.equal(statutEcheance(-3), 'urgent');
  });

  it('est urgent à sept jours pile — la borne est incluse', () => {
    assert.equal(statutEcheance(7), 'urgent');
  });

  it('passe à « bientôt » dès le huitième jour', () => {
    assert.equal(statutEcheance(8), 'bientot');
  });

  it('reste « bientôt » à trente jours pile — la borne est incluse', () => {
    assert.equal(statutEcheance(30), 'bientot');
  });

  it('est calme au-delà de trente jours', () => {
    assert.equal(statutEcheance(31), 'calme');
  });
});

describe('la recherche dans les documents', () => {
  const OBJET: ObjetIndex = {
    nom: 'Facture EDF septembre', taille: 100, type: 'application/pdf',
    categorie: 'Énergie', deposeLe: '2026-09-01T00:00:00.000Z',
    emetteur: 'EDF', texteExtrait: 'Contrat électricité — référence 12345',
  };

  it('rend tout sur une requête vide, espaces compris', () => {
    assert.equal(rechercheCorrespond(OBJET, ''), true);
    assert.equal(rechercheCorrespond(OBJET, '   '), true);
  });

  it('trouve sur le nom, sans se soucier de la casse', () => {
    assert.equal(rechercheCorrespond(OBJET, 'FACTURE'), true);
  });

  it('trouve sur la catégorie sans exiger l’accent', () => {
    // Personne ne tape « Énergie » avec son accent sur un clavier de téléphone.
    assert.equal(rechercheCorrespond(OBJET, 'energie'), true);
  });

  it('trouve sur l’émetteur', () => {
    assert.equal(rechercheCorrespond(OBJET, 'edf'), true);
  });

  it('trouve dans le texte extrait à l’analyse', () => {
    // C'est ce qui permet de retrouver un document par son numéro de contrat,
    // que personne ne met jamais dans le nom du fichier.
    assert.equal(rechercheCorrespond(OBJET, '12345'), true);
  });

  it('ne trouve rien sur ce qui n’apparaît nulle part', () => {
    assert.equal(rechercheCorrespond(OBJET, 'assurance habitation'), false);
  });

  it('ne casse pas sur un document sans texte extrait ni émetteur', () => {
    // Les deux champs sont optionnels : un document déposé avant l'analyse, ou
    // dont l'analyse a échoué, n'en a aucun. La recherche doit continuer de
    // fonctionner sur ce qui reste plutôt que de lever.
    const minimal: ObjetIndex = {
      nom: 'Doc', taille: 1, type: 'image/png', categorie: '',
      deposeLe: '2026-01-01T00:00:00.000Z',
    };
    assert.equal(rechercheCorrespond(minimal, 'doc'), true);
    assert.equal(rechercheCorrespond(minimal, 'rien'), false);
  });
});
