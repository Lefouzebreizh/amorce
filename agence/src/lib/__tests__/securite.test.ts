import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { politiqueDeSecurite } from '@/lib/securite';

const SUPABASE = 'https://projet-client.supabase.co';

/** Valeurs d'une directive, dans l'en-tête composé. */
function directive(entete: string, nom: string): string[] {
  const trouvee = entete
    .split('; ')
    .find((morceau) => morceau === nom || morceau.startsWith(`${nom} `));

  assert.ok(trouvee, `directive absente : ${nom}`);
  return trouvee.split(' ').slice(1);
}

describe('politique de sécurité du contenu', () => {
  it('signe les scripts par un jeton, et ce jeton figure dans l’en-tête', () => {
    const { entete, jeton } = politiqueDeSecurite(SUPABASE, false);

    assert.ok(jeton.length >= 16, 'un jeton court se devine');
    assert.ok(directive(entete, 'script-src').includes(`'nonce-${jeton}'`));
  });

  it('rend un jeton différent à chaque appel', () => {
    // Un jeton réutilisé ne vaut pas mieux que pas de jeton : il suffit de
    // lire une page pour connaître celui de la suivante.
    const jetons = new Set(
      Array.from({ length: 20 }, () => politiqueDeSecurite(SUPABASE, false).jeton),
    );

    assert.equal(jetons.size, 20);
  });

  it('n’autorise aucun script en ligne non signé', () => {
    const scripts = directive(politiqueDeSecurite(SUPABASE, false).entete, 'script-src');

    assert.ok(!scripts.includes("'unsafe-inline'"));
    assert.ok(!scripts.includes("'unsafe-eval'"));
  });

  it('ouvre la connexion vers le projet Supabase configuré, et vers lui seul', () => {
    const connexions = directive(politiqueDeSecurite(SUPABASE, false).entete, 'connect-src');

    assert.deepEqual(connexions, [
      "'self'",
      'https://projet-client.supabase.co',
      'wss://projet-client.supabase.co',
    ]);
  });

  it('ne garde de l’adresse que son origine', () => {
    // Une adresse copiée avec un chemin au bout produirait une directive que
    // le navigateur refuse en silence, et l'application perdrait sa base.
    const connexions = directive(
      politiqueDeSecurite(`${SUPABASE}/rest/v1/`, false).entete,
      'connect-src',
    );

    assert.ok(connexions.includes(SUPABASE));
  });

  it('ne desserre pour le développement que le développement', () => {
    const dev = politiqueDeSecurite(SUPABASE, true).entete;
    const production = politiqueDeSecurite(SUPABASE, false).entete;

    assert.ok(directive(dev, 'script-src').includes("'unsafe-eval'"));
    assert.ok(directive(dev, 'connect-src').includes('ws://localhost:*'));
    assert.ok(!production.includes('localhost'));
    assert.ok(production.includes('upgrade-insecure-requests'));
  });

  it('interdit l’encadrement et la balise de base, quel que soit l’environnement', () => {
    for (const developpement of [true, false]) {
      const entete = politiqueDeSecurite(SUPABASE, developpement).entete;

      assert.deepEqual(directive(entete, 'frame-ancestors'), ["'none'"]);
      assert.deepEqual(directive(entete, 'base-uri'), ["'self'"]);
      assert.deepEqual(directive(entete, 'object-src'), ["'none'"]);
    }
  });
});
