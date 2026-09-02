// Le mandataire de flux abandonne une origine muette, plutôt que d'attendre.
//
// Le cas réel qui a fait naître ce test : un panneau saturé qui accepte la
// connexion et ne répond jamais. Sans borne, `fetch` attendait le délai par
// défaut du moteur — plusieurs minutes — pendant que le lecteur affichait
// « Connexion au flux… » sans un mot ni une erreur. Le décor ci-dessous
// reproduit exactement cette origine-là : un serveur qui écoute et se tait.

process.env['IPTV_BASE'] = ':memory:'
process.env['IPTV_DELAI_AMONT_MS'] = '80'
// L'origine muette de ce test écoute sur 127.0.0.1, que le filtre anti-SSRF de
// `adresseRelayable` refuse — à raison. La porte est donc ouverte ici, et ici
// seulement.
process.env['IPTV_RELAI_AUTORISE_LOCAL'] = '1'

import assert from 'node:assert/strict'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import test from 'node:test'

import { GET } from '../src/app/api/flux/route.ts'
import { signer } from '../src/serveur/flux.ts'

async function origineMuette(): Promise<{ url: string; fermer: () => Promise<void> }> {
  const serveur: Server = createServer(() => {
    // Rien : ni réponse, ni fin de connexion. C'est le décor du panneau saturé.
  })
  await new Promise<void>((resolu) => serveur.listen(0, resolu))
  const { port } = serveur.address() as AddressInfo
  return {
    url: `http://127.0.0.1:${String(port)}/chaine.m3u8`,
    fermer: () => new Promise((resolu) => serveur.close(() => resolu())),
  }
}

test('une origine qui ne répond jamais rend un 504 rapide, pas un blocage', async () => {
  const { url, fermer } = await origineMuette()
  try {
    const signature = signer(url)
    const requete = new Request(
      `http://localhost/api/flux?u=${encodeURIComponent(url)}&s=${signature}`,
    )

    const depart = Date.now()
    const reponse = await GET(requete)
    const duree = Date.now() - depart

    assert.equal(reponse.status, 504)
    assert.ok(
      duree < 2000,
      `le mandataire a attendu ${String(duree)} ms — le délai réglé (80 ms) n'a pas coupé la connexion`,
    )
  } finally {
    await fermer()
  }
})
