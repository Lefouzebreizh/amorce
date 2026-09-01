import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lireCle, oublierCle, poserCle } from '../cle.ts';

/** Un stockage qui refuse tout, comme en navigation privée. */
function stockageQuiLeve(): void {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() {
      throw new Error('stockage refusé');
    },
  });
}

/** Un stockage qui marche, tenu en mémoire. */
function stockageEnMemoire(): void {
  const table = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => table.get(k) ?? null,
      setItem: (k: string, v: string) => void table.set(k, v),
      removeItem: (k: string) => void table.delete(k),
    },
  });
}

test('un stockage qui refuse ne fait pas tomber le studio', () => {
  /*
   * `localStorage` **lève** en navigation privée, et sur un navigateur qui
   * refuse le stockage : l'accès à la propriété elle-même jette, avant toute
   * lecture. Une exception ici arrêterait le studio pour une histoire de
   * licence, ce qui est exactement ce qu'on ne veut pas.
   */
  stockageQuiLeve();
  assert.equal(lireCle(), '', 'une lecture refusée doit valoir « pas de clé »');
  assert.equal(poserCle('X'), false, 'une écriture refusée doit se dire, pas se taire');
  assert.doesNotThrow(() => oublierCle());
});

test('une clé posée se relit, sans espaces parasites', () => {
  // Une clé arrive presque toujours par copier-coller depuis un courriel :
  // elle traîne des espaces et un retour à la ligne.
  stockageEnMemoire();
  assert.equal(poserCle('  AMO-1234-5678  \n'), true);
  assert.equal(lireCle(), 'AMO-1234-5678');
  oublierCle();
  assert.equal(lireCle(), '');
});
