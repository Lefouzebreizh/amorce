import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/*
 * Ce que ces tests gardent, et pourquoi ils lisent la source.
 *
 * Les mentions légales sont la seule page du site dont l'absence d'une ligne
 * est une infraction, pas un défaut d'affichage. Et c'est une page qu'on ne
 * regarde plus jamais après l'avoir écrite : personne ne s'apercevra qu'un
 * remaniement a fait sauter le SIREN ou l'hébergeur.
 *
 * On relit donc le fichier plutôt que d'appeler le composant. Rendre du JSX
 * demanderait React et un moteur de rendu dans une suite qui tourne
 * aujourd'hui sans rien installer — et ce qu'on veut vérifier est la
 * **présence d'une mention**, pas la mise en page.
 */

const SOURCE = readFileSync(
  new URL('../src/app/mentions-legales/page.tsx', import.meta.url),
  'utf8',
);

const OBLIGATOIRES: readonly (readonly [string, RegExp])[] = [
  ['le nom de l’éditeur', /Erwann Chevallier/],
  ['la forme — entrepreneur individuel', /Entrepreneur individuel \(EI\)/],
  ['l’adresse', /20A rue Clotilde Vautier, 35000 Rennes/],
  ['le SIREN', /109356972/],
  ['le nom de l’hébergeur', /Vercel Inc\./],
  ['l’adresse de l’hébergeur', /Covina, CA 91723/],
];

test('les mentions légales portent tout ce que la loi exige', () => {
  for (const [quoi, motif] of OBLIGATOIRES) {
    assert.match(SOURCE, motif, `il manque ${quoi}`);
  }
});

test('les mentions légales ne concurrencent pas la page de vente', () => {
  /*
   * `noindex` : ces informations doivent être trouvables **depuis** le site,
   * pas avant lui. Une page de mentions légales qui remonte devant la page de
   * vente est un contresens, et c'est arrivé à assez de sites pour valoir un
   * test plutôt qu'un commentaire.
   */
  assert.match(SOURCE, /robots: \{ index: false/,
    'la page doit sortir en noindex');
});

test('le pied de page mène aux mentions légales', () => {
  /*
   * La loi demande qu'elles soient accessibles. Une page parfaite que rien ne
   * lie ne l'est pas — et c'est le lien, pas la page, qu'un remaniement du
   * pied de page fait disparaître sans bruit.
   */
  const pied = readFileSync(
    new URL('../src/components/PiedDePage.tsx', import.meta.url),
    'utf8',
  );

  assert.match(pied, /href="\/mentions-legales"/,
    'le pied de page doit porter le lien');
});

test('le numéro de téléphone est réglé, donc le bouton d’appel existe', async () => {
  /*
   * Le canal que l'artisan visé utilise vraiment. Sans numéro, la règle
   * « ce qui n'est pas réglé disparaît » retire le bouton de l'entête **et**
   * du bandeau collé en bas : la page reste belle et devient injoignable.
   *
   * Ce test-là n'a l'air de rien et couvre la panne la plus chère du site.
   */
  const { aUnTelephone, contact } = await import('@/lib/config');

  assert.equal(aUnTelephone, true, 'sans numéro, la page perd son bouton d’appel');
  assert.match(contact.telephoneLien, /^tel:\+33\d{9}$/,
    'le lien d’appel doit être au format international');
});
