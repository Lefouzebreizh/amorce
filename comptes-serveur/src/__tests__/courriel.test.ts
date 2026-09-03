import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { envoyerLienConnexion } from '../courriel.ts';

const original = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = original;
});

test('sans clé Resend, aucun appel n’est fait', async () => {
  let appele = false;
  globalThis.fetch = (async () => {
    appele = true;
    return new Response('{}', { status: 200 });
  }) as typeof fetch;

  const resultat = await envoyerLienConnexion('', 'a@b.fr', 'https://x/verifier?jeton=y', 'Amorce <c@d.fr>');
  assert.equal(resultat, false);
  assert.equal(appele, false, 'un appel est parti sans clé');
});

test('avec une clé, le lien part vers Resend, au bon destinataire', async () => {
  const capture: { corps: Record<string, unknown>; adresse: string }[] = [];
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    capture.push({ adresse: String(url), corps: JSON.parse(String(init?.body)) });
    return new Response('{}', { status: 200 });
  }) as typeof fetch;

  const ok = await envoyerLienConnexion('re_test', 'client@exemple.fr', 'https://x/verifier?jeton=abc', 'Amorce <compte@amorce.example>');

  assert.equal(ok, true);
  const [{ adresse, corps }] = capture;
  assert.equal(adresse, 'https://api.resend.com/emails');
  assert.equal(corps.to, 'client@exemple.fr');
  assert.equal(corps.from, 'Amorce <compte@amorce.example>');
  assert.match(String(corps.text), /https:\/\/x\/verifier\?jeton=abc/);
});

test('un échec côté Resend est rapporté, pas avalé', async () => {
  globalThis.fetch = (async () => new Response('erreur', { status: 500 })) as typeof fetch;
  const ok = await envoyerLienConnexion('re_test', 'a@b.fr', 'https://x', 'Amorce <c@d.fr>');
  assert.equal(ok, false);
});
