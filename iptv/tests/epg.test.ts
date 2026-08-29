import assert from 'node:assert/strict'
import test from 'node:test'

import { ouvrirDepot } from '../src/cache/depot.ts'
import { importerEpg } from '../src/cache/importer.ts'
import {
  analyserXmltv,
  attribut,
  contenu,
  decoder,
  versInstant,
  type EntreeEpg,
} from '../src/epg/xmltv.ts'

const GUIDE = `<?xml version="1.0" encoding="UTF-8"?>
<tv generator-info-name="essai">
  <channel id="tf1.fr">
    <display-name>TF1</display-name>
    <icon src="http://img/tf1.png" />
  </channel>
  <channel id="arte.fr"><display-name>Arte</display-name></channel>
  <programme start="20260828200000 +0200" stop="20260828215500 +0200" channel="tf1.fr">
    <title>Le Journal de 20h</title>
    <sub-title>Édition du soir</sub-title>
    <desc>Toute l&apos;actualité du jour &amp; le sport.</desc>
    <category>Information</category>
    <category>Journal</category>
  </programme>
  <programme start="20260828215500 +0200" stop="20260828230000 +0200" channel="tf1.fr">
    <title><![CDATA[Film : Les Bronzés]]></title>
  </programme>
  <programme start="20260828200000 +0200" channel="arte.fr"><title>Documentaire</title></programme>
  <programme start="20260828203000 +0200" channel="inconnue.fr"><title>Sans titre valide</title></programme>
  <programme start="pas une date" channel="tf1.fr"><title>Ignorée</title></programme>
  <programme start="20260828210000 +0200" channel="tf1.fr"></programme>
</tv>`

async function toutLire(source: string): Promise<{ entrees: EntreeEpg[]; ignores: number }> {
  const analyse = analyserXmltv(source)
  const entrees: EntreeEpg[] = []
  let pas = await analyse.next()
  while (pas.done !== true) {
    entrees.push(pas.value)
    pas = await analyse.next()
  }
  return { entrees, ignores: pas.value.ignores }
}

test('décode les entités, y compris numériques', () => {
  assert.equal(decoder('L&apos;été &amp; l&#39;hiver'), "L'été & l'hiver")
  assert.equal(decoder('&#x41;&#66;'), 'AB')
  assert.equal(decoder('rien &inconnue; ici'), 'rien &inconnue; ici')
})

test('lit un contenu, section CDATA comprise', () => {
  // Le CDATA protège son contenu : retirer les balises avant de le déballer
  // ferait ressortir « Les » tout court.
  assert.equal(contenu('<title><![CDATA[Les <Bronzés>]]></title>', 'title'), 'Les <Bronzés>')
  // Et une entité dans un CDATA n'en est pas une : elle reste littérale.
  assert.equal(contenu('<title><![CDATA[Marx &amp; Engels]]></title>', 'title'), 'Marx &amp; Engels')
  assert.equal(contenu('<title>  </title>', 'title'), undefined)
  assert.equal(contenu('<desc lang="fr">Un film</desc>', 'desc'), 'Un film')
  assert.equal(attribut('<programme channel="tf1.fr" start="x">', 'channel'), 'tf1.fr')
})

test('convertit un instant XMLTV, décalage compris', () => {
  assert.equal(versInstant('20260828200000 +0200'), '2026-08-28T18:00:00.000Z')
  assert.equal(versInstant('20260828200000 -0500'), '2026-08-29T01:00:00.000Z')
  assert.equal(versInstant('20260828200000Z'), '2026-08-28T20:00:00.000Z')
  assert.equal(versInstant('pas une date'), undefined)
  assert.equal(versInstant(undefined), undefined)
})

test('un instant sans décalage est lu dans le fuseau de la machine', () => {
  // Le format autorise l'absence de décalage. Le prendre pour de l'UTC
  // décalerait toute la grille de deux heures en été, sans que rien ne le dise.
  const attendu = new Date('2026-08-28T20:00:00').toISOString()
  assert.equal(versInstant('20260828200000'), attendu)
})

test('rend chaînes et programmes, et compte ce qu’il ne comprend pas', async () => {
  const { entrees, ignores } = await toutLire(GUIDE)
  const chaines = entrees.filter((entree) => entree.type === 'chaine')
  const programmes = entrees.filter((entree) => entree.type === 'programme')

  assert.equal(chaines.length, 2)
  assert.equal(programmes.length, 4)
  // Deux entrées inexploitables : une date illisible, un programme sans titre.
  assert.equal(ignores, 2)
})

test('lit un programme étalé sur plusieurs lignes', async () => {
  const { entrees } = await toutLire(GUIDE)
  const premier = entrees.find(
    (entree) => entree.type === 'programme' && entree.programme.titre.startsWith('Le Journal'),
  )
  assert.ok(premier?.type === 'programme')
  assert.equal(premier.programme.chaine, 'tf1.fr')
  assert.equal(premier.programme.debut, '2026-08-28T18:00:00.000Z')
  assert.equal(premier.programme.fin, '2026-08-28T19:55:00.000Z')
  assert.equal(premier.programme.sousTitre, 'Édition du soir')
  assert.equal(premier.programme.resume, "Toute l'actualité du jour & le sport.")
  assert.deepEqual(premier.programme.categories, ['Information', 'Journal'])
})

test('lit une chaîne et son logo', async () => {
  const { entrees } = await toutLire(GUIDE)
  const tf1 = entrees.find((entree) => entree.type === 'chaine' && entree.chaine.id === 'tf1.fr')
  assert.ok(tf1?.type === 'chaine')
  assert.equal(tf1.chaine.nom, 'TF1')
  assert.equal(tf1.chaine.logo, 'http://img/tf1.png')
})

test('un programme sans fin reste exploitable', async () => {
  const { entrees } = await toutLire(GUIDE)
  const arte = entrees.find(
    (entree) => entree.type === 'programme' && entree.programme.chaine === 'arte.fr',
  )
  assert.ok(arte?.type === 'programme')
  assert.equal(arte.programme.fin, undefined)
})

test('ne charge pas le fichier entier en mémoire', { timeout: 5000 }, async () => {
  let produits = 0
  async function* interminable(): AsyncGenerator<string> {
    yield '<tv>\n'
    for (;;) {
      produits += 1
      yield `<programme start="20260828${String(produits % 24).padStart(2, '0')}0000 +0200" channel="c"><title>P${produits}</title></programme>\n`
    }
  }
  const vus: string[] = []
  for await (const entree of analyserXmltv(interminable())) {
    if (entree.type === 'programme') vus.push(entree.programme.titre)
    if (vus.length === 3) break
  }
  assert.deepEqual(vus, ['P1', 'P2', 'P3'])
  assert.ok(produits < 20, `la source a été consommée ${produits} fois`)
})

test('verse le guide en base et dit ce qui passe en ce moment', async () => {
  const depot = ouvrirDepot(':memory:')
  try {
    const resume = await importerEpg(depot, GUIDE, { purgerAvant: '2000-01-01T00:00:00.000Z' })
    assert.equal(resume.ecrits, 4)
    assert.equal(resume.chaines, 2)

    // 20 h 30 heure de Paris, soit 18 h 30 UTC : le journal est commencé.
    const antennes = depot.maintenant(['tf1.fr', 'arte.fr'], '2026-08-28T18:30:00.000Z')
    assert.equal(antennes.get('tf1.fr')?.actuel?.titre, 'Le Journal de 20h')
    assert.equal(antennes.get('tf1.fr')?.suivant?.titre, 'Film : Les Bronzés')
    // Arte n'a qu'une entrée, sans fin : elle est en cours et rien ne suit.
    assert.equal(antennes.get('arte.fr')?.actuel?.titre, 'Documentaire')
    assert.equal(antennes.get('arte.fr')?.suivant, undefined)
  } finally {
    depot.fermer()
  }
})

test('une chaîne sans guide rend une antenne vide plutôt que rien', async () => {
  const depot = ouvrirDepot(':memory:')
  try {
    await importerEpg(depot, GUIDE, { purgerAvant: '2000-01-01T00:00:00.000Z' })
    const antennes = depot.maintenant(['jamais.vue'], '2026-08-28T18:30:00.000Z')
    assert.ok(antennes.has('jamais.vue'))
    assert.equal(antennes.get('jamais.vue')?.actuel, undefined)
    assert.deepEqual(depot.maintenant([]), new Map())
  } finally {
    depot.fermer()
  }
})

test('réimporter le même guide ne double pas la grille', async () => {
  const depot = ouvrirDepot(':memory:')
  try {
    await importerEpg(depot, GUIDE, { purgerAvant: '2000-01-01T00:00:00.000Z' })
    await importerEpg(depot, GUIDE, { purgerAvant: '2000-01-01T00:00:00.000Z' })
    const total = depot.base.prepare('SELECT COUNT(*) AS n FROM programme').get() as { n: number }
    assert.equal(total.n, 4, 'la clé (chaine, debut) doit rendre le réimport idempotent')
  } finally {
    depot.fermer()
  }
})

test('purge le passé, en gardant ce qui a commencé hier soir', async () => {
  const depot = ouvrirDepot(':memory:')
  try {
    // Purge à une date postérieure à tout le guide : rien ne doit rester.
    const resume = await importerEpg(depot, GUIDE, { purgerAvant: '2030-01-01T00:00:00.000Z' })
    assert.equal(resume.ecrits, 4)
    assert.equal(resume.purges, 4)
    const total = depot.base.prepare('SELECT COUNT(*) AS n FROM programme').get() as { n: number }
    assert.equal(total.n, 0)
  } finally {
    depot.fermer()
  }
})

test('rend la grille d’une chaîne sur une tranche horaire', async () => {
  const depot = ouvrirDepot(':memory:')
  try {
    await importerEpg(depot, GUIDE, { purgerAvant: '2000-01-01T00:00:00.000Z' })
    const grille = depot.grille('tf1.fr', '2026-08-28T17:00:00.000Z', '2026-08-28T23:00:00.000Z')
    assert.deepEqual(
      grille.map((programme) => programme.titre),
      ['Le Journal de 20h', 'Film : Les Bronzés'],
    )
  } finally {
    depot.fermer()
  }
})
