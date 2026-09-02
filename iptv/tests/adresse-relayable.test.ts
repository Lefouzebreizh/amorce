// Le filtre anti-SSRF du mandataire de flux.
//
// La signature prouve qu'une adresse vient de nous ; elle ne dit rien de sa
// destination. Et les adresses du catalogue viennent d'une liste M3U fournie
// par un tiers — c'est ce que ce filtre ferme.
//
// Le test porte dans les deux sens : ce qui doit passer autant que ce qui doit
// être refusé. Un filtre qui refuse tout protégerait aussi bien, et casserait
// la lecture.

import assert from 'node:assert/strict'
import test from 'node:test'

import { adresseRelayable } from '../src/serveur/flux.ts'

test('un flux public ordinaire passe', () => {
  for (const url of [
    'http://fournisseur.example/live/1.ts',
    'https://cdn.example.com:8080/hls/manifeste.m3u8?jeton=abc',
    'https://203.0.113.7/segment.ts',
  ]) {
    assert.equal(adresseRelayable(url), true, url)
  }
})

test('les adresses locales et privées sont refusées', () => {
  for (const url of [
    'http://127.0.0.1:8080/admin',
    'http://localhost/etat',
    'http://boitier.local/config',
    'http://10.0.0.1/',
    'http://192.168.1.1/',
    'http://172.16.4.2/',
    'http://172.31.255.254/',
    'http://169.254.169.254/latest/meta-data/', // métadonnées d'hébergeur
    'http://100.64.0.1/',
    'http://0.0.0.0/',
    'http://[::1]/',
    'http://[fd00::1]/',
    'http://[fe80::1]/',
  ]) {
    assert.equal(adresseRelayable(url), false, url)
  }
})

test('172.15 et 172.32 restent publiques — la borne est 16 à 31', () => {
  assert.equal(adresseRelayable('http://172.15.0.1/'), true)
  assert.equal(adresseRelayable('http://172.32.0.1/'), true)
})

test('seuls http et https passent', () => {
  for (const url of ['file:///etc/passwd', 'ftp://hote/x', 'data:text/plain,x', 'gopher://hote/']) {
    assert.equal(adresseRelayable(url), false, url)
  }
})

test('une adresse illisible est refusée plutôt que de lever', () => {
  assert.equal(adresseRelayable('pas une adresse'), false)
  assert.equal(adresseRelayable(''), false)
})
