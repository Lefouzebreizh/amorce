import assert from 'node:assert/strict'
import test from 'node:test'

import { adresseIntegration, identifiantBandeAnnonce } from '../src/lecture/bande-annonce.ts'

test('un identifiant nu est pris tel quel', () => {
  assert.equal(identifiantBandeAnnonce({ info: { youtube_trailer: 'dQw4w9WgXcQ' } }), 'dQw4w9WgXcQ')
})

test('toutes les formes d’adresse rencontrées sont ramenées à l’identifiant', () => {
  const formes = [
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'http://youtube.com/watch?feature=share&v=dQw4w9WgXcQ',
    'https://youtu.be/dQw4w9WgXcQ',
    'https://www.youtube.com/embed/dQw4w9WgXcQ',
    'https://www.youtube.com/v/dQw4w9WgXcQ',
    '  https://youtu.be/dQw4w9WgXcQ  ',
  ]
  for (const forme of formes) {
    assert.equal(identifiantBandeAnnonce({ info: { youtube_trailer: forme } }), 'dQw4w9WgXcQ', forme)
  }
})

test('le champ se trouve à la racine comme dans « info »', () => {
  // Les panneaux hésitent sur l'emplacement de presque tous leurs champs ; ne
  // lire qu'un seul des deux rend la fonction muette une fois sur deux.
  assert.equal(identifiantBandeAnnonce({ youtube_trailer: 'dQw4w9WgXcQ' }), 'dQw4w9WgXcQ')
  assert.equal(identifiantBandeAnnonce({ info: { trailer: 'dQw4w9WgXcQ' } }), 'dQw4w9WgXcQ')
})

test('un champ vide veut dire « pas de bande-annonce », pas « champ absent »', () => {
  for (const vide of ['', '   ', 'null', 'n/a']) {
    assert.equal(identifiantBandeAnnonce({ info: { youtube_trailer: vide } }), undefined, vide)
  }
  assert.equal(identifiantBandeAnnonce({}), undefined)
  assert.equal(identifiantBandeAnnonce({ info: null }), undefined)
})

test('une valeur qui n’est pas un identifiant ne fabrique pas une adresse invalide', () => {
  // Le défaut qu'on cherche à éviter : une intégration construite sur du texte
  // arbitraire se charge sans erreur et n'affiche rien.
  assert.equal(identifiantBandeAnnonce({ info: { youtube_trailer: 'bande annonce vf' } }), undefined)
  assert.equal(identifiantBandeAnnonce({ info: { youtube_trailer: 'trop-court' } }), undefined)
})

test('l’intégration passe par le domaine sans mouchard', () => {
  const adresse = adresseIntegration('dQw4w9WgXcQ')
  assert.match(adresse, /^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?/)
  assert.ok(!adresse.includes('youtube.com/embed'), 'jamais le domaine qui écrit dès le chargement')
})
