import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/*
 * Ce que ce test garde : les avis de la démonstration restent des emplacements.
 *
 * `exemple.html` est la seule page qu'un prospect ouvre avant de payer — c'est
 * elle que « Voir un site fini, en vrai » lui donne. Elle portait le style des
 * avis et aucun avis : le bloc que l'artisan cherche des yeux manquait, et la
 * page avait l'air incomplète.
 *
 * Le remplir a une condition, et elle n'est pas négociable ici : **le dépôt
 * s'interdit le faux témoignage sans exception**. Pas de prénom inventé, pas de
 * phrase de client fabriquée. Les deux avis disent ce qui prendra leur place —
 * et c'est le même texte, mot pour mot, que `demo-prospect.mjs` pose sur les
 * démonstrations nominatives, pour qu'une seule formulation existe.
 *
 * La pente est connue : « juste un avis plausible, le temps de montrer ». Un
 * faux avis reste faux sous une mention, et une mention se rate à la lecture.
 * Le commentaire explique, le test refuse.
 */

const PAGE = readFileSync(new URL('../public/exemple.html', import.meta.url), 'utf8');

test('la démonstration montre le bloc des avis', () => {
  const citations = (PAGE.match(/<blockquote/g) ?? []).length;
  assert.ok(
    citations >= 2,
    `${citations} avis rendus dans exemple.html — le bloc que l’artisan cherche des yeux est vide`,
  );
});

test('la mention « avis d’exemple » accompagne les avis', () => {
  assert.match(
    PAGE,
    /Avis d’exemple/,
    'des avis sont rendus sans la mention qui dit qu’ils sont des emplacements',
  );
});

/*
 * Le signataire reste « Prénom, commune ».
 *
 * C'est le contrôle qui compte : un prénom concret sous une citation la fait
 * passer pour un vrai client, quelle que soit la mention posée au-dessus.
 */
test('aucun avis n’est signé d’un nom inventé', () => {
  const signatures = [...PAGE.matchAll(/<cite>([^<]+)<\/cite>/g)].flatMap((m) =>
    m[1] === undefined ? [] : [m[1].trim()],
  );
  assert.ok(signatures.length >= 2, 'les signatures des avis ont disparu');
  for (const signature of signatures) {
    assert.equal(
      signature,
      'Prénom, commune',
      `« ${signature} » signe un avis de la démonstration : un prénom concret le fait passer pour un vrai client`,
    );
  }
});

/*
 * Le plancher de 18 px, et pourquoi il se vérifie ici en `rem`.
 *
 * Ce fichier documente trois fois le même piège : `rem` vaut 16 px, jamais les
 * 18 px que le corps déclare. Toute fraction de `rem` — et `1rem` lui-même —
 * passe sous le plancher du §2. La mention des avis en avait fait les frais.
 *
 * Le bloc des avis n'a aujourd'hui aucune `font-size` : il hérite du corps, et
 * c'est la bonne réponse. Ce test refuse qu'on lui en donne une en `rem`.
 */
test('le bloc des avis ne se voit imposer aucune taille en rem', () => {
  const regles = PAGE.match(/\.(avis|mention)[^{}]*\{[^}]*\}/g) ?? [];
  assert.ok(regles.length > 0, 'les règles du bloc des avis ont disparu de la feuille de style');
  for (const regle of regles) {
    assert.doesNotMatch(
      regle,
      /font-size:\s*[\d.]+rem/,
      `une taille en rem est posée sur le bloc des avis (${regle.slice(0, 40)}…) : rem vaut 16 px, sous le plancher de 18 px`,
    );
  }
});
