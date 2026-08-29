import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Analysis, Criterion } from '../analysis.ts';
import { defautsAvantExport, resumeAvantExport, SEUIL_PRE_VOL } from '../preVol.ts';

function critere(p: Partial<Criterion> & Pick<Criterion, 'id' | 'score' | 'weight'>): Criterion {
  return { label: p.id, detail: 'détail', remedy: 'remède', ...p } as Criterion;
}

const analyse = (criteria: Criterion[]): Analysis => ({ criteria } as Analysis);

test('seuls les critères sous le seuil remontent', () => {
  const d = defautsAvantExport(
    analyse([
      critere({ id: 'hook', score: 1, weight: 30 }),
      critere({ id: 'rythme', score: SEUIL_PRE_VOL, weight: 20 }),
      critere({ id: 'texte', score: 0.79, weight: 15 }),
    ]),
  );
  assert.deepEqual(d.map((x) => x.id), ['texte']);
});

test('le classement suit les points perdus, jamais la note', () => {
  /*
   * Le piège que ce test garde : trier par la note ferait passer « format »
   * devant « hook », et enverrait corriger ce qui ne change presque rien.
   * 0,5 sur un critère à 5 points en coûte 2,5 ; 0,7 sur un critère à 30 en
   * coûte 9.
   */
  const d = defautsAvantExport(
    analyse([
      critere({ id: 'format', score: 0.5, weight: 5 }),
      critere({ id: 'hook', score: 0.7, weight: 30 }),
    ]),
  );
  assert.deepEqual(d.map((x) => x.id), ['hook', 'format']);
  assert.deepEqual(d.map((x) => x.perdus), [9, 2.5]);
});

test('un montage sain ne rend aucun défaut, et aucune phrase', () => {
  const d = defautsAvantExport(analyse([critere({ id: 'hook', score: 0.95, weight: 30 })]));
  assert.deepEqual(d, []);
  assert.equal(resumeAvantExport(d), null);
});

test('le remède est transporté tel quel — c’est lui qui sert', () => {
  const remedy = 'Ton plan le plus long fait 4,9 s. Coupe-le en deux.';
  const d = defautsAvantExport(analyse([critere({ id: 'rythme', score: 0.3, weight: 20, remedy })]));
  assert.equal(d[0].remedy, remedy);
});

test('la phrase nomme le nombre et le pire, sans juger', () => {
  const un = defautsAvantExport(analyse([critere({ id: 'texte', score: 0.2, weight: 15, label: 'Sous-titres' })]));
  assert.equal(resumeAvantExport(un), 'Un point à regarder avant d’exporter : sous-titres.');

  const deux = defautsAvantExport(
    analyse([
      critere({ id: 'texte', score: 0.2, weight: 15, label: 'Sous-titres' }),
      critere({ id: 'hook', score: 0.1, weight: 30, label: 'Accroche' }),
    ]),
  );
  assert.equal(resumeAvantExport(deux), '2 points à regarder avant d’exporter, à commencer par accroche.');
  // Rien qui juge la personne : le public de ce dépôt est celui que la
  // culpabilisation atteint le plus.
  for (const mot of ['mauvais', 'raté', 'nul', 'erreur']) {
    assert.equal(String(resumeAvantExport(deux)).includes(mot), false, `mot à bannir : ${mot}`);
  }
});
