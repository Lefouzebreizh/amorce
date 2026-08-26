import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { APRES_CONNEXION, destinationSure } from '@/lib/navigation';

describe('destinationSure', () => {
  it('laisse passer un chemin interne', () => {
    assert.equal(destinationSure('/projets/42'), '/projets/42');
  });

  it("refuse une adresse absolue, qui déposerait l'utilisateur hors du site", () => {
    assert.equal(destinationSure('https://exemple-malveillant.fr'), APRES_CONNEXION);
  });

  it('refuse un chemin protocole-relatif, qui est une adresse absolue déguisée', () => {
    assert.equal(destinationSure('//exemple-malveillant.fr'), APRES_CONNEXION);
  });

  it('refuse la barre oblique inversée, que certains navigateurs normalisent en barre', () => {
    assert.equal(destinationSure('/\\exemple-malveillant.fr'), APRES_CONNEXION);
  });

  it("retombe sur le repli quand la valeur n'est pas une chaîne", () => {
    assert.equal(destinationSure(null), APRES_CONNEXION);
    assert.equal(destinationSure(undefined), APRES_CONNEXION);
    assert.equal(destinationSure(42), APRES_CONNEXION);
  });

  it('accepte un repli explicite', () => {
    assert.equal(destinationSure('http://ailleurs.fr', '/compte'), '/compte');
  });
});
