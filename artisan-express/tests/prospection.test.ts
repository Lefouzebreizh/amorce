import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

/*
 * Le fichier qu'on ouvre devant un prospect ne peut porter qu'une adresse
 * vivante — et rien ne le vérifiait.
 *
 * `PROSPECTION.md` a donné pendant des heures `amorce-51up.vercel.app`, un
 * projet supprimé du tableau de bord dans la nuit du 02 au 03/09/2026.
 * L'adresse rendait **404** : chaque artisan contacté serait tombé sur une page
 * d'erreur Vercel, au moment exact où il vérifie qu'on sait faire un site.
 *
 * Aucun test ne l'a vu, et c'est normal : **une adresse dans un Markdown n'est
 * lue par personne.** Le typage ne l'atteint pas, ESLint non plus, et le build
 * ignore les documents. C'est la famille de défauts la plus silencieuse du
 * dépôt — il ne casse rien, il coûte juste le client.
 *
 * La garde est volontairement statique : elle ne fait aucune requête. Un test
 * qui appelle le réseau devient rouge quand le réseau tousse, et on apprend à
 * l'ignorer. Ce qu'on veut attraper est plus simple et suffit — un **nom de
 * projet périmé** qui traîne. Le jour où l'adresse change, ce test tombe, et
 * c'est le bon moment pour se souvenir qu'elle est écrite à deux endroits.
 */

/** L'adresse servie, mesurée le 03/09/2026 : 200 sur / et sur /exemple.html. */
const HOTE_VIVANT = 'artisan-express-ashy.vercel.app';

function lire(nom: string): string {
  return readFileSync(new URL(`../${nom}`, import.meta.url), 'utf8');
}

test('le script de prospection ne porte que l’adresse vivante', () => {
  const texte = lire('PROSPECTION.md');
  const hotes = new Set(
    [...texte.matchAll(/https?:\/\/([a-z0-9-]+\.vercel\.app)/gi)].map((m) => m[1]!.toLowerCase()),
  );

  for (const hote of hotes) {
    assert.equal(hote, HOTE_VIVANT,
      `PROSPECTION.md envoie un prospect sur « ${hote} », qui n’est pas l’adresse servie`);
  }
});

test('le script de prospection donne bien un exemple à montrer', () => {
  /*
   * L'autre moitié du défaut, et elle est symétrique : une adresse fausse coûte
   * le client, une adresse absente aussi. « Montre-moi un exemple » est la
   * première question d'un artisan, et sans lien la conversation s'arrête.
   */
  const texte = lire('PROSPECTION.md');

  assert.ok(texte.includes(`https://${HOTE_VIVANT}/exemple.html`),
    'le lien vers la page de démonstration a disparu du script');
});

test('le README ne présente pas un projet supprimé comme celui qui fait foi', () => {
  /*
   * Le README, lui, a le droit de **raconter** `amorce-51up` : son histoire
   * porte le piège du mur d'authentification invisible, qui vaut d'être gardé.
   * Ce qu'il n'a plus le droit de faire, c'est de le désigner comme l'adresse
   * de référence — c'est ce qu'il faisait encore ce matin.
   */
  const texte = lire('README.md');

  assert.ok(texte.includes(`https://${HOTE_VIVANT}`),
    'le README ne nomme pas l’adresse servie');
  assert.doesNotMatch(texte, /\*\*C'est `amorce-51up` qui fait\s*\nfoi\*\*/,
    'le README désigne encore un projet supprimé comme référence');
});
