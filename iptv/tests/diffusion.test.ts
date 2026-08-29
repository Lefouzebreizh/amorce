import assert from 'node:assert/strict'
import test from 'node:test'

import {
  adresseAbsolue,
  joignableParUnAutreAppareil,
  moyensDiffusion,
  obstacleDiffusion,
} from '../src/lecture/diffusion.ts'

test('rend une adresse qu’un appareil du salon peut joindre', () => {
  assert.equal(
    adresseAbsolue('/api/flux?e=fi_1', 'http://192.168.1.20:3000/lecture/fi_1'),
    'http://192.168.1.20:3000/api/flux?e=fi_1',
  )
  // Une adresse déjà absolue n'est pas retouchée.
  assert.equal(
    adresseAbsolue('http://ailleurs/x.m3u8', 'http://192.168.1.20:3000/'),
    'http://ailleurs/x.m3u8',
  )
  assert.equal(adresseAbsolue('/x', 'pas une adresse'), '/x')
})

test('sait qu’une adresse locale ne désigne pas la même machine partout', () => {
  // Donné à un Chromecast, « localhost » désigne le Chromecast : la lecture
  // échoue sur un écran noir, sans message.
  assert.equal(joignableParUnAutreAppareil('http://localhost:3000/'), false)
  assert.equal(joignableParUnAutreAppareil('http://127.0.0.1:3000/'), false)
  assert.equal(joignableParUnAutreAppareil('http://[::1]:3000/'), false)
  assert.equal(joignableParUnAutreAppareil('http://salon.local:3000/'), false)

  assert.equal(joignableParUnAutreAppareil('http://192.168.1.20:3000/'), true)
  assert.equal(joignableParUnAutreAppareil('https://maison.exemple/'), true)
})

test('relève ce que le navigateur expose, sans supposer', () => {
  assert.deepEqual(moyensDiffusion(undefined), { distant: false, airplay: false })
  assert.deepEqual(moyensDiffusion({}), { distant: false, airplay: false })

  // Les deux méthodes sont nécessaires : `prompt` seul ne dit pas s'il y a un
  // appareil, et afficher le bouton sans le savoir promet ce qu'on n'a pas.
  assert.deepEqual(moyensDiffusion({ remote: { prompt: () => {} } }), {
    distant: false,
    airplay: false,
  })
  assert.deepEqual(
    moyensDiffusion({ remote: { prompt: () => {}, watchAvailability: () => {} } }),
    { distant: true, airplay: false },
  )
  assert.deepEqual(moyensDiffusion({ webkitShowPlaybackTargetPicker: () => {} }), {
    distant: false,
    airplay: true,
  })
})

test('explique l’obstacle plutôt que de rester muet', () => {
  const avec = { distant: true, airplay: false }
  const sans = { distant: false, airplay: false }

  // L'adresse passe avant le navigateur : c'est l'obstacle le plus fréquent, et
  // le seul que l'utilisateur peut lever tout seul.
  assert.match(obstacleDiffusion('http://localhost:3000/', avec) ?? '', /adresse réseau/)
  assert.match(obstacleDiffusion('http://192.168.1.20:3000/', sans) ?? '', /n’expose pas/)
  assert.equal(obstacleDiffusion('http://192.168.1.20:3000/', avec), undefined)
})
