/**
 * Le portage rend-il exactement ce que le Python rend ?
 *
 * Ce fichier ne contient **aucune valeur attendue écrite à la main**. Tout
 * vient de `temoins/cas.json`, engendré par `outils/engendrer-temoins.py` en
 * faisant tourner le noyau Python. Écrire les attentes ici aurait produit un
 * test qui vérifie ce que son auteur croyait, ce qui est précisément la faute
 * que ce dépôt a payée quatre fois — un `max()` sur des rangs différents, cinq
 * cartes vertes, une classe muette, un repli sur `Purr`.
 *
 * La comparaison la plus sévère est celle du **SVG entier** : une divergence
 * d'arrondi, de découpe de ligne ou de teinte s'y voit au caractère près.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { Intention } from "../src/intentions.ts";
import { juger, affichable } from "../src/verdict.ts";
import { enSvg } from "../src/carte.ts";
import { classer, lire } from "../src/tete.ts";
import { hauteurBloc } from "../src/traits.ts";

const chemin = fileURLToPath(new URL("../temoins/cas.json", import.meta.url));
const temoins = JSON.parse(readFileSync(chemin, "utf-8"));

test("les verdicts sont ceux du noyau Python", () => {
  for (const cas of temoins.verdicts) {
    const options = cas.tete
      ? { teteIntention: () => [cas.tete[0] as Intention, cas.tete[1]] as [Intention, number] }
      : {};
    const v = juger(cas.fenetres, options);
    assert.equal(v.intention, cas.attendu.intention, cas.nom);
    assert.equal(v.source, cas.attendu.source, cas.nom);
    assert.equal(v.confiance, cas.attendu.confiance, cas.nom);
    assert.equal(v.classeDominante, cas.attendu.classeDominante, cas.nom);
    assert.equal(affichable(v), cas.attendu.affichable, cas.nom);
    // La phrase de journal aussi : c'est elle que l'utilisateur lit quand
    // la porte se ferme, et une traduction approximative s'y verrait.
    assert.equal(v.raison, cas.attendu.raison, cas.nom);
  }
});

test("les cartes SVG sont identiques au caractère près", () => {
  for (const cas of temoins.verdicts) {
    if (cas.svg === null) continue;
    const options = cas.tete
      ? { teteIntention: () => [cas.tete[0] as Intention, cas.tete[1]] as [Intention, number] }
      : {};
    assert.equal(enSvg(juger(cas.fenetres, options)), cas.svg, cas.nom);
  }
});

test("la tête acoustique classe et lit comme le Python", () => {
  for (const cas of temoins.tetes) {
    const t = {
      hauteur: cas.traits.hauteur,
      duree: cas.traits.duree,
      mesuresFiables: cas.traits.mesuresFiables,
    };
    assert.equal(classer(t), cas.attendu.type, cas.nom);
    const l = lire(t);
    assert.equal(l.intention, cas.attendu.intention, cas.nom);
    assert.equal(l.confiance, cas.attendu.confiance, cas.nom);
    assert.equal(l.raison, cas.attendu.raison, cas.nom);
  }
});

test("l'autocorrélation rend les mêmes hertz", () => {
  for (const cas of temoins.hauteurs) {
    const bloc = new Array<number>(cas.echantillons);
    for (let i = 0; i < cas.echantillons; i++) {
      bloc[i] = Math.sin((2 * Math.PI * cas.hertz * i) / 16_000);
    }
    const [f0, confiance] = hauteurBloc(bloc);
    assert.equal(f0, cas.attendu.f0, cas.nom);
    // La confiance est une somme de produits flottants : on la compare à
    // douze chiffres plutôt qu'au bit, parce que `Math.sin` n'est pas tenu de
    // rendre le même dernier bit que celui de Python. Les hertz, eux, sont
    // exacts — ils sortent d'une division entière.
    assert.ok(Math.abs(confiance - cas.attendu.confiance) < 1e-12, cas.nom);
  }
});
