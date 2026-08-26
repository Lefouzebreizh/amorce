import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { formaterDate, formaterDateHeure, formaterMontant } from '@/lib/format';

/*
 * Les formats français séparent les milliers et précèdent l'euro par des
 * espaces insécables. Les comparer tels quels rendrait le test illisible et
 * dépendant d'une version d'ICU : ils sont ramenés à l'espace ordinaire.
 */
function sansEspacesInsecables(valeur: string): string {
  return valeur.replace(/[  ]/g, ' ');
}

describe('formatage des montants', () => {
  it('écrit un montant en euros à la française', () => {
    assert.equal(sansEspacesInsecables(formaterMontant(1234.5)), '1 234,50 €');
  });

  it('affiche toujours les centimes', () => {
    assert.equal(sansEspacesInsecables(formaterMontant(0)), '0,00 €');
  });
});

describe('formatage des dates', () => {
  it('rend la date du fuseau français, et non celle du serveur', () => {
    // 23 h 30 UTC, c'est le lendemain à Paris. Sans fuseau figé, le serveur
    // afficherait le 15 et le navigateur le 16 — React signalerait alors une
    // divergence d'hydratation sur chaque ligne de la liste.
    assert.equal(formaterDate('2026-01-15T23:30:00Z'), '16 janv. 2026');
  });

  it('tient compte de l’heure d’été', () => {
    assert.equal(formaterDateHeure('2026-07-04T09:05:00Z'), '4 juillet 2026 à 11:05');
  });
});
