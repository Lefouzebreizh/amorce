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

test('le verrou d’encaissement est ouvert, et sa raison est écrite', async () => {
  /*
   * Ce test a longtemps dit l'inverse, et c'était juste : il tenait le
   * paiement fermé tant que l'immatriculation n'était pas validée.
   *
   * Elle l'est — SIREN 109356972, confirmé le 03/09/2026 pour une validation
   * du 31/08. Le verrou n'a donc plus de raison d'être, et le garder fermé
   * coûterait maintenant des ventes au lieu d'en protéger.
   *
   * Ce qui reste gardé n'est plus la valeur, c'est **la traçabilité** : le
   * SIREN doit rester écrit à côté de la constante. Sans lui, la prochaine
   * session lit `true` sans savoir qui l'a décidé ni sur quelle preuve, et
   * c'est exactement ce qu'on voulait éviter en posant le verrou dans le code
   * plutôt que dans un réglage d'hébergeur.
   */
  const { ENCAISSEMENT_OUVERT } = await import('@/lib/config');
  const { readFileSync } = await import('node:fs');
  const source = readFileSync(new URL('../src/lib/config.ts', import.meta.url), 'utf8');

  assert.equal(ENCAISSEMENT_OUVERT, true);
  assert.match(source, /SIREN \*\*109356972\*\*/,
    'le SIREN qui autorise l’encaissement doit rester écrit à côté de la constante');
});

test('un verrou ouvert n’encaisse rien sans lien Stripe', async () => {
  /*
   * Le garde-fou qui compte désormais, et il vaut plus que le précédent.
   *
   * Le verrou levé, il ne reste qu'une chose entre la page et un bouton
   * « payer » cassé : `NEXT_PUBLIC_LIEN_STRIPE`. L'environnement de test ne le
   * pose pas — donc `aUnStripe` doit être faux, et le bouton doit continuer de
   * mener au formulaire.
   *
   * Un bouton de paiement qui ne mène nulle part coûte le client **et** la
   * réputation : celui qui a sorti sa carte et s'est heurté à une page morte
   * ne rappelle pas, et il le raconte.
   */
  const { aUnStripe, contact } = await import('@/lib/config');

  assert.equal(contact.stripeLien, '', 'l’environnement de test ne règle aucun lien');
  assert.equal(aUnStripe, false, 'sans lien réglé, aucun paiement ne doit être proposé');
});

test('le lien Stripe ne peut pas rouvrir l’encaissement à lui seul', async () => {
  /*
   * Le piège que ce test garde depuis le début, et qui survit à l'ouverture :
   * `NEXT_PUBLIC_LIEN_STRIPE` se pose sur l'hébergeur, sans relire une ligne
   * de code. L'ordre des deux conditions doit rester celui-ci — le verrou
   * d'abord, la variable ensuite — sans quoi refermer le paiement un jour
   * demanderait de retrouver le réglage au lieu de changer la constante.
   */
  const { readFileSync } = await import('node:fs');
  const source = readFileSync(new URL('../src/lib/config.ts', import.meta.url), 'utf8');

  assert.match(source, /aUnStripe = ENCAISSEMENT_OUVERT && /,
    'aUnStripe doit dépendre du verrou avant la variable');
});
