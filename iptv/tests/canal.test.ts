import assert from 'node:assert/strict'
import test from 'node:test'

import { cle, numeroDeCanal, rangDeChaine } from '../src/normalisation/canal.ts'

test('les six premières chaînes sont celles qu’on descend sans regarder', () => {
  assert.equal(numeroDeCanal('TF1'), 1)
  assert.equal(numeroDeCanal('France 2'), 2)
  assert.equal(numeroDeCanal('France 3'), 3)
  assert.equal(numeroDeCanal('France 4'), 4)
  assert.equal(numeroDeCanal('France 5'), 5)
  assert.equal(numeroDeCanal('M6'), 6)
})

test('la numérotation est celle du 6 juin 2025, pas celle d’avant', () => {
  // C8 et NRJ 12 ont cessé d'émettre : leurs canaux ont été repris.
  assert.equal(numeroDeCanal('LCP'), 8)
  assert.equal(numeroDeCanal('Gulli'), 12)
  // Les quatre chaînes d'information forment un bloc de 13 à 16.
  assert.equal(numeroDeCanal('BFM TV'), 13)
  assert.equal(numeroDeCanal('CNews'), 14)
  assert.equal(numeroDeCanal('LCI'), 15)
  assert.equal(numeroDeCanal('franceinfo'), 16)
})

test('les scories des listes réelles ne cachent pas le nom', () => {
  for (const titre of ['TF1 HD', 'TF1 FHD', 'TF1 1080p', 'TF1 (FR)', 'tf1.fr', 'TF1  4K']) {
    assert.equal(numeroDeCanal(titre), 1, titre)
  }
  assert.equal(numeroDeCanal('France 3 HEVC'), 3)
  assert.equal(numeroDeCanal("L'Équipe"), 21)
  assert.equal(numeroDeCanal('Chérie 25 HD'), 25)
})

test('une déclinaison n’usurpe pas le numéro de la chaîne mère', () => {
  // « TF1 Séries Films » a son propre canal, et ne doit surtout pas valoir 1.
  assert.equal(numeroDeCanal('TF1 Séries Films'), 20)
  assert.equal(numeroDeCanal('France 3 Bretagne'), undefined)
  assert.equal(numeroDeCanal('M6 Music'), undefined)
})

test('après la cinquantaine, le sport passe en premier — le football d’abord', () => {
  const ligue1 = rangDeChaine('Ligue 1+')
  const bein = rangDeChaine('beIN SPORTS 1')
  const canalFoot = rangDeChaine('Canal+ Foot')
  const eurosport = rangDeChaine('Eurosport 1')
  const inconnue = rangDeChaine('Télé Machin')

  for (const majeur of [ligue1, bein, canalFoot]) {
    assert.ok(majeur < eurosport, 'un diffuseur de Ligue 1 passe avant le sport général')
  }
  assert.ok(eurosport < inconnue)
})

test('Canal+ ouvre le cinéma, et ses déclinaisons sportives ne le suivent pas', () => {
  const canal = rangDeChaine('Canal+')
  const canalCinema = rangDeChaine('Canal+ Cinéma')
  const cine = rangDeChaine('Ciné+ Premier')
  const ocs = rangDeChaine('OCS Max')
  const musique = rangDeChaine('MTV Hits')

  assert.ok(canal < canalCinema, 'Canal+ passe avant le reste du cinéma')
  assert.ok(canalCinema <= cine && cine <= ocs)
  assert.ok(ocs < musique, 'le cinéma passe avant la musique')

  // « Canal+ Sport » contient « Canal », et part pourtant au sport.
  assert.ok(rangDeChaine('Canal+ Sport') < canal)
})

test('la musique vient après le cinéma, et le reste ferme la marche', () => {
  const musique = ['MTV', 'M6 Music', 'NRJ Hits', 'MCM', 'Trace Urban', 'Mezzo'].map((titre) =>
    rangDeChaine(titre),
  )
  const reste = rangDeChaine('Une chaîne quelconque')
  for (const rang of musique) {
    assert.ok(rang > rangDeChaine('OCS Max'), 'après le cinéma')
    assert.ok(rang < reste, 'avant le reste')
  }
})

test('l’ordre complet est celui demandé, bout à bout', () => {
  const chaines = [
    'Une chaîne quelconque',
    'MTV',
    'OCS Max',
    'Canal+',
    'Eurosport 1',
    'beIN SPORTS 1',
    'Paris Première',
    'M6',
    'TF1',
  ]
  const ordonnees = [...chaines].sort(
    (a, b) => rangDeChaine(a) - rangDeChaine(b) || a.localeCompare(b, 'fr'),
  )
  assert.deepEqual(ordonnees, [
    'TF1',
    'M6',
    'Paris Première',
    'beIN SPORTS 1',
    'Eurosport 1',
    'Canal+',
    'OCS Max',
    'MTV',
    'Une chaîne quelconque',
  ])
})

test('le numéro déclaré par la liste départage le reste, sans jamais doubler une famille', () => {
  const premier = rangDeChaine('Chaîne inconnue A', { 'tvg-chno': '12' })
  const second = rangDeChaine('Chaîne inconnue B', { 'tvg-chno': '340' })
  const sans = rangDeChaine('Chaîne inconnue C')

  assert.ok(sans < premier && premier < second, 'l’ordre du fournisseur est conservé')
  // Un « 12 » déclaré ne doit pas placer la chaîne au canal 12.
  assert.ok(premier > rangDeChaine('MTV'), 'jamais devant une famille connue')
  assert.equal(numeroDeCanal('Chaîne inconnue A'), undefined, 'et rien ne s’affiche')
})

test('la clé de comparaison ne se vide jamais', () => {
  // « FR » est un suffixe ailleurs, mais c'est ici le titre entier : le retirer
  // rendrait une clé vide, qui collerait à toutes les autres.
  assert.equal(cle('FR'), 'fr')
  assert.equal(cle('HD'), 'hd')
  assert.equal(cle('Ciné+ Frisson'), 'cinefrisson')
})
