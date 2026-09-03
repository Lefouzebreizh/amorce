import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { TEINTE_DU_METIER } from '@/lib/charte';

/*
 * Les métiers du générateur de démos et ceux de la charte ne peuvent pas
 * diverger, et ils l'avaient fait.
 *
 * La charte connaît quatorze métiers ; `demo-prospect.mjs` n'en portait que
 * six. Le défaut ne s'est pas vu au moment où il a été introduit — il s'est vu
 * bien plus tard, le jour où une liste de prospects a désigné les carreleurs et
 * les plaquistes comme les premiers à appeler, et où la commande a répondu
 * « --metier au choix : couvreur, macon, plombier, electricien, menuisier,
 * peintre ». Le meilleur prospect de la liste était injoignable par l'outil
 * censé le servir.
 *
 * C'est la forme de défaut la plus coûteuse de ce dépôt : **deux tables qui
 * décrivent la même chose et qu'aucun code ne relie.** Ni le typage ni le build
 * ne les rapprochent — l'une est en TypeScript, l'autre dans un script `.mjs`
 * lu par personne d'autre que lui-même.
 *
 * On les compare donc en texte, dans les deux sens. Le sens inverse compte
 * autant : un profil de démo pour un métier absent de la charte produirait un
 * site à la teinte par défaut, et deux métiers différents recevraient la même
 * page sans que rien ne le signale.
 */

const SCRIPT = new URL('../scripts/demo-prospect.mjs', import.meta.url);

/** Les clés de premier niveau de la table `METIERS` du script. */
function metiersDuScript(): Set<string> {
  const source = readFileSync(SCRIPT, 'utf8');
  const debut = source.indexOf('const METIERS = {');
  assert.ok(debut >= 0, 'la table METIERS a disparu de demo-prospect.mjs');
  const bloc = source.slice(debut, source.indexOf('\n};', debut));
  return new Set([...bloc.matchAll(/^ {2}([a-z]+): \{/gm)].map((m) => m[1]!));
}

test('tout métier de la charte a un profil de démonstration', () => {
  const script = metiersDuScript();

  for (const metier of Object.keys(TEINTE_DU_METIER)) {
    assert.ok(script.has(metier),
      `« ${metier} » a une teinte mais aucune démo : impossible d’en faire une page prospect`);
  }
});

test('aucun profil de démonstration ne sort de la charte', () => {
  const charte = new Set(Object.keys(TEINTE_DU_METIER));

  for (const metier of metiersDuScript()) {
    assert.ok(charte.has(metier),
      `« ${metier} » a une démo mais aucune teinte : il sortirait au vert par défaut`);
  }
});

test('chaque profil porte de quoi remplir une page', () => {
  /*
   * Un profil incomplet ne casse rien : il rend une page à trous, envoyée à un
   * artisan. C'est exactement le « ce qui n'est pas réglé disparaît » que le
   * gabarit applique — sauf qu'ici la disparition se voit chez le prospect.
   */
  const source = readFileSync(SCRIPT, 'utf8');
  const debut = source.indexOf('const METIERS = {');
  const bloc = source.slice(debut, source.indexOf('\n};', debut));

  for (const [, nom, corps] of bloc.matchAll(/^ {2}([a-z]+): \{\n([\s\S]*?)^ {2}\},$/gm)) {
    for (const champ of ['modele', 'accroche', 'services']) {
      assert.match(corps!, new RegExp(`${champ}:\\s*'[^']+'`),
        `le profil « ${nom} » n’a pas de ${champ}`);
    }
    // Quatre prestations : moins fait une page maigre, plus ne se lit pas.
    const services = /services:\s*'([^']+)'/.exec(corps!)?.[1] ?? '';
    assert.ok(services.split(';').length >= 3,
      `« ${nom} » n’annonce que ${services.split(';').length} prestation(s)`);
  }
});
