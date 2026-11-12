import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lienAvisValide, messageAvis, qualifierReponse } from '@/lib/sms';

test('la qualification conserve uniquement ce que le client a donné', () => {
  assert.deepEqual(qualifierReponse(' fuite ', ' Rennes ', 'À planifier'), { besoin: 'fuite', commune: 'Rennes', urgence: 'À planifier' });
});
test('un lien d’avis doit mener à un format Google explicite, en HTTPS', () => {
  for (const lien of ['https://g.page/r/EXEMPLE/review', 'https://search.google.com/local/writereview?placeid=ChIJexemple']) assert.equal(lienAvisValide(lien), true);
  for (const lien of ['', 'javascript:alert(1)', 'http://g.page/r/id/review', 'https://g.page.evil.test/r/id/review', 'https://evil.test', 'https://user@g.page/r/id/review', 'https://g.page/', 'https://search.google.com/local/writereview']) assert.equal(lienAvisValide(lien), false, lien);
});
test('la demande d’avis n’impose ni note ni témoignage', () => {
  const texte = messageAvis('Atelier Démo', 'https://g.page/r/id/review');
  assert.match(texte, /Atelier Démo/);
  assert.match(texte, /partager votre expérience/);
  assert.doesNotMatch(texte, /5|cinq|positif|satisfait|récompense/i);
});
