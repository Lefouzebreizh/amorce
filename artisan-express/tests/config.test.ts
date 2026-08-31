import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { aUnCourrielDirect, aUnTelephone, aUnWhatsapp, contact } from '@/lib/config';

/*
 * Ce fichier éprouve un seul comportement, et c'est le plus cher de la page :
 * ce qu'elle fait quand **rien** n'est réglé.
 *
 * Les tests tournent sans aucune variable d'environnement — c'est exactement
 * l'état d'un premier déploiement, et c'est celui qui perdait les demandes.
 */

test('sans rien de réglé, il reste un chemin pour joindre le vendeur', () => {
  /*
   * Le défaut réparé ici : la page déployée sans variable disait « réessaie
   * dans quelques minutes » à quelqu'un qui venait de taper son nom, son
   * métier et son numéro. Une page de vente qui perd ses prospects en silence
   * est pire qu'une page absente — elle a l'air de marcher.
   */
  assert.equal(aUnCourrielDirect, true, 'aucun chemin de repli sur une page nue');
  assert.match(contact.courrielDirect, /^[^@\s]+@[^@\s]+\.[^@\s]+$/);
});

test('ce qui n’est pas réglé disparaît, et n’est jamais inventé', () => {
  // Un numéro faux sur une page de vente coûte plus cher qu'un bouton absent.
  assert.equal(aUnTelephone, false);
  assert.equal(aUnWhatsapp, false);
  assert.equal(contact.telephoneAffiche, '');
});

test('aucune adresse de site n’est inventée', async () => {
  /*
   * Le défaut que ce test garde : `layout.tsx` portait
   * `?? 'https://artisan-express.vercel.app'`, une adresse qui n'a jamais
   * existé — aucun projet Vercel ne la sert, vérifié le 30/08/2026. Elle a
   * fait croire à une session que le site était en ligne, et elle aurait
   * publié une `og:url` vers un domaine mort le jour du déploiement.
   *
   * On relit donc les fichiers plutôt que la valeur : c'est la présence de
   * l'adresse en dur dans la source qui est le défaut, pas ce qu'elle vaut à
   * l'exécution.
   */
  const { readFileSync } = await import('node:fs');
  for (const fichier of ['src/app/layout.tsx', 'src/lib/config.ts']) {
    const texte = readFileSync(new URL(`../${fichier}`, import.meta.url), 'utf8');
    const enDur = texte.match(/['"`]https?:\/\/[^'"`\s]+['"`]/g) ?? [];
    // Les adresses citées dans un commentaire ne sont pas des valeurs.
    assert.deepEqual(enDur, [], `${fichier} porte une adresse en dur : ${enDur.join(', ')}`);
  }
});

test('sans variable réglée, le site n’affirme aucune adresse', async () => {
  const { adresseDuSite } = await import('@/lib/config');
  // L'environnement de test ne pose pas NEXT_PUBLIC_SITE_URL.
  assert.equal(adresseDuSite, null);
});
