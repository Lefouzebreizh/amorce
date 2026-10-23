import assert from 'node:assert/strict';
import test from 'node:test';
import { musicPrompt } from '../song.ts';

test('le brief rassemble les informations saisies sans perdre les retours à la ligne', () => {
  const brief = musicPrompt({
    title: '  Les mots qui pansent  ',
    lyrics: 'Couplet 1\nUne pierre à l’édifice\n\nRefrain\nOn avance',
    style: 'slam parlé et refrain chanté',
    mood: 'libérateur, sensible',
    voice: 'voix grave et proche',
  });

  assert.match(brief, /Titre : Les mots qui pansent/);
  assert.match(brief, /Style musical : slam parlé et refrain chanté/);
  assert.match(brief, /Couplet 1\nUne pierre à l’édifice\n\nRefrain\nOn avance/);
  assert.match(brief, /Respecter les paroles/);
});

test('le brief reste utilisable quand le projet est encore vide', () => {
  assert.equal(
    musicPrompt({ title: '', lyrics: '', style: '', mood: '', voice: '' }),
    'Créer un morceau cohérent avec cette intention. Respecter les paroles et leur structure, laisser respirer les transitions et terminer proprement.',
  );
});
