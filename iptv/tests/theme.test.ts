import assert from 'node:assert/strict'
import test from 'node:test'

import { detecterTheme, ordreTheme, THEMES } from '../src/normalisation/theme.ts'

test('les thèmes que l’on cherche vraiment sont reconnus', () => {
  assert.equal(detecterTheme('FILMS | POLICIER'), 'Policier')
  assert.equal(detecterTheme('FR - THRILLER'), 'Thriller')
  assert.equal(detecterTheme('VOD FR ▪ FANTASTIQUE'), 'Fantastique')
  assert.equal(detecterTheme('SERIES ┃ HORREUR'), 'Horreur')
  assert.equal(detecterTheme('FILMS COMÉDIE VF'), 'Comédie')
})

test('l’anglais des listes est compris comme le français', () => {
  assert.equal(detecterTheme('MOVIES - CRIME'), 'Policier')
  assert.equal(detecterTheme('VOD | SCI-FI'), 'Science-fiction')
  assert.equal(detecterTheme('SERIES: FANTASY'), 'Fantastique')
  assert.equal(detecterTheme('KIDS TV'), 'Jeunesse')
  assert.equal(detecterTheme('DOCUMENTARY 4K'), 'Documentaire')
})

test('les composés ne sont pas coupés par un motif plus court', () => {
  // « science fiction » contient « fiction », et surtout ne doit pas tomber
  // dans un motif générique avant d'être reconnu.
  assert.equal(detecterTheme('FILMS SCIENCE FICTION'), 'Science-fiction')
  // « comédie dramatique » est une comédie, pas un drame.
  assert.equal(detecterTheme('COMEDIE DRAMATIQUE'), 'Comédie')
  assert.equal(detecterTheme('COMÉDIE ROMANTIQUE'), 'Romance')
  assert.equal(detecterTheme('ACTION & AVENTURE'), 'Action')
})

test('les mots de rangement ne fabriquent pas de thème', () => {
  // « FILMS », « VOD », « FR », « 4K » décrivent le contenant : un groupe qui
  // n'a qu'eux n'a pas de thème, et le dire est plus juste que d'inventer.
  for (const groupe of ['FILMS', 'VOD FR', 'SERIES 4K', 'FR | MULTI', 'NOUVEAUTÉS 2024']) {
    assert.equal(detecterTheme(groupe), undefined, groupe)
  }
  assert.equal(detecterTheme(undefined), undefined)
  assert.equal(detecterTheme(''), undefined)
})

test('les genres déclarés passent avant le nom du groupe', () => {
  // Un panneau Xtream déclare « Crime » sur la fiche ; son groupe de rangement
  // dit seulement « SERIES FR ». C'est la donnée qui gagne, pas le libellé.
  assert.equal(detecterTheme('SERIES FR', ['Crime']), 'Policier')
  // Et si les genres ne disent rien d'utile, on retombe sur le groupe.
  assert.equal(detecterTheme('FILMS WESTERN', ['']), 'Western')
})

test('l’ordre des dossiers est stable, et « Autres » ferme la marche', () => {
  assert.ok(ordreTheme('Action') < ordreTheme('Documentaire'))
  assert.equal(ordreTheme('Autres'), THEMES.length - 1)
  // Un thème inconnu — donc la chaîne vide de « Autres » — ne se glisse jamais
  // au milieu des dossiers nommés.
  assert.ok(ordreTheme('') >= ordreTheme('Autres'))
})

test('tout thème rendu appartient au vocabulaire fermé', () => {
  const groupes = [
    'FILMS ACTION',
    'MOVIES HORROR',
    'SERIES POLAR',
    'VOD ANIMATION',
    'FILMS GUERRE',
    'DOCS NATURE',
    'CONCERTS',
    'FILMS WESTERN',
    'BIOPIC',
  ]
  for (const groupe of groupes) {
    const theme = detecterTheme(groupe)
    assert.ok(
      theme !== undefined && (THEMES as readonly string[]).includes(theme),
      `${groupe} → ${String(theme)}`,
    )
  }
})
