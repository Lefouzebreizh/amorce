import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ouvrir, sceller } from '../jetons.ts';

const SECRET = 'sceau_test';

test('un jeton scellé s’ouvre et rend sa charge', async () => {
  const jeton = await sceller(SECRET, { email: 'a@b.fr', type: 'connexion' }, 900);
  const charge = await ouvrir<{ email: string; type: string }>(SECRET, jeton);
  assert.equal(charge?.email, 'a@b.fr');
  assert.equal(charge?.type, 'connexion');
});

test('un jeton modifié, tronqué ou signé par un autre secret ne s’ouvre pas', async () => {
  const jeton = await sceller(SECRET, { email: 'a@b.fr' }, 900);
  const [corps, sceauValeur] = jeton.split('.');

  const cas = [
    `${corps}x.${sceauValeur}`,             // charge modifiée
    `${corps}.${sceauValeur}x`,             // sceau modifié
    corps,                                   // sceau absent
    `.${sceauValeur}`,                       // charge absente
    '',
    'nimporte.quoi',
  ];
  for (const fausse of cas) {
    assert.equal(await ouvrir(SECRET, fausse), null, `acceptée à tort : « ${fausse} »`);
  }
  assert.equal(await ouvrir('autre secret', jeton), null);
});

test('un jeton expiré ne s’ouvre plus', async () => {
  // Durée négative : l'expiration tombe dans le passé dès la fabrication.
  const jeton = await sceller(SECRET, { email: 'a@b.fr' }, -1);
  assert.equal(await ouvrir(SECRET, jeton), null);
});

test('la durée fait partie de ce que le sceau protège', async () => {
  /*
   * Le piège que ce test garde : si `exp` vivait en dehors de la charge
   * signée, changer l'expiration d'un jeton authentique sans casser sa
   * signature deviendrait possible. On fabrique un jeton court, on lui
   * greffe la charge d'un jeton long, et le sceau doit refuser le mélange.
   */
  const court = await sceller(SECRET, { email: 'a@b.fr' }, 1);
  const long = await sceller(SECRET, { email: 'a@b.fr' }, 999999);
  const [, sceauCourt] = court.split('.');
  const [corpsLong] = long.split('.');

  assert.equal(await ouvrir(SECRET, `${corpsLong}.${sceauCourt}`), null);
});
