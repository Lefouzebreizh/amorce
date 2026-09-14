import assert from 'node:assert/strict';
import test from 'node:test';

import { masquerSecrets, validerCleAnthropic } from './secrets';

test('refuse les clés absentes, entourées ou contenant des espaces et retours à la ligne', () => {
  assert.deepEqual(validerCleAnthropic(undefined), { valide: false, raison: 'absent' });
  assert.deepEqual(validerCleAnthropic(''), { valide: false, raison: 'absent' });
  for (const cle of ['cle-sans-prefixe', ' sk-ant-api03-test', 'sk-ant-api03-test\n', 'sk-ant-api03-a sk-ant-api03-b']) {
    assert.deepEqual(validerCleAnthropic(cle), { valide: false, raison: 'malforme' });
  }
});

test('refuse aussi une clé collée deux fois sans séparateur', () => {
  assert.deepEqual(
    validerCleAnthropic('sk-ant-api03-premier-sk-ant-api03-second'),
    { valide: false, raison: 'malforme' },
  );
});

test('conserve exactement une clé propre', () => {
  assert.deepEqual(
    validerCleAnthropic('sk-ant-api03-exemple'),
    { valide: true, valeur: 'sk-ant-api03-exemple' },
  );
});

test('masque une clé connue et toute clé Anthropic présente dans une erreur', () => {
  const cle = 'secret-sans-prefixe';
  const journal = masquerSecrets(`refus ${cle}; autre sk-ant-api03-ne-pas-journaliser`, [cle]);
  assert.equal(journal.includes(cle), false);
  assert.equal(journal.includes('sk-ant-'), false);
  assert.match(journal, /MASQUE/);
});
