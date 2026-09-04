import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/*
 * Le lien d'évitement, contrôlé sur les coques elles-mêmes.
 *
 * Ce test ne vérifie pas « le fichier contient la ligne qu'on vient d'écrire » :
 * il contrôle la règle qui rend le lien nécessaire, et qui se casse sans qu'on
 * y pense. Une coque qui place une navigation avant son contenu oblige à la
 * traverser au clavier ; c'est le jour où l'on ajoute un menu à la coque
 * publique que le manque apparaît, pas aujourd'hui.
 *
 * Trois choses tenues ensemble : une coque à navigation porte le lien, la cible
 * qu'il désigne existe dans cette même coque, et elle est focalisable.
 */

const RACINE_APP = fileURLToPath(new URL('../../app', import.meta.url));

/** Les `layout.tsx` de l'arborescence, quel que soit le groupe de routes. */
function coques(dossier: string): string[] {
  const trouvees: string[] = [];

  for (const entree of readdirSync(dossier, { withFileTypes: true })) {
    const chemin = join(dossier, entree.name);

    if (entree.isDirectory()) trouvees.push(...coques(chemin));
    else if (entree.name === 'layout.tsx') trouvees.push(chemin);
  }

  return trouvees;
}

const COQUES = coques(RACINE_APP).map((chemin) => ({
  chemin: chemin.slice(RACINE_APP.length + 1) || 'layout.tsx',
  source: readFileSync(chemin, 'utf8'),
}));

test('les coques sont bien trouvées', () => {
  // Sans cette garde, un chemin cassé rendrait la liste vide et tous les
  // contrôles ci-dessous passeraient sur zéro fichier.
  assert.ok(COQUES.length >= 3, `Seulement ${COQUES.length} coque(s) trouvée(s) sous src/app.`);
});

for (const { chemin, source } of COQUES) {
  const porteUneNavigation = /<(BarreLaterale|nav\b)/.test(source);
  const porteLeLien = source.includes('<LienEvitement');

  if (!porteUneNavigation && !porteLeLien) continue;

  test(`lien d'évitement — ${chemin}`, () => {
    assert.ok(
      porteLeLien,
      `${chemin} place une navigation avant son contenu sans lien d'évitement : ` +
        'chaque page oblige alors à traverser le menu au clavier. ' +
        'Ajouter <LienEvitement /> en premier enfant et id={ID_CONTENU} sur le <main>.',
    );

    assert.ok(
      source.includes('id={ID_CONTENU}'),
      `${chemin} porte le lien d'évitement mais aucune cible : le lien mène nulle part.`,
    );

    assert.ok(
      source.includes('tabIndex={-1}'),
      `${chemin} : la cible du lien d'évitement doit porter tabIndex={-1}, sans quoi ` +
        'le focus ne s’y pose pas et la tabulation suivante repart du haut de la page.',
    );

    assert.ok(
      source.indexOf('<LienEvitement') < source.indexOf('id={ID_CONTENU}'),
      `${chemin} : le lien d'évitement est écrit après sa cible. Il doit être le premier ` +
        'élément atteignable au clavier, sinon il n’évite plus rien.',
    );
  });
}

test("la cible du lien porte le même identifiant des deux côtés", () => {
  const composant = readFileSync(
    fileURLToPath(new URL('../../components/lien-evitement.tsx', import.meta.url)),
    'utf8',
  );

  const identifiant = /ID_CONTENU = '([^']+)'/.exec(composant)?.[1];

  assert.ok(identifiant, "Le composant ne déclare plus ID_CONTENU.");
  assert.match(
    composant,
    new RegExp(`href={\`#\\$\\{ID_CONTENU}\`}`),
    "L’ancre du lien ne se déduit plus de ID_CONTENU : les deux peuvent diverger en silence.",
  );
});
