import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { ouvrirDepot } from '../src/cache/depot.ts'
import { chargerEnv, identifiantsXtream } from '../src/serveur/reglages.ts'

function fichierEnv(contenu: string): string {
  const dossier = mkdtempSync(join(tmpdir(), 'iptv-env-'))
  const chemin = join(dossier, '.env')
  writeFileSync(chemin, contenu, 'utf8')
  return chemin
}

/** Efface les clés qu'un test a posées, pour ne pas contaminer le suivant. */
function oublier(...cles: readonly string[]): void {
  for (const cle of cles) delete process.env[cle]
}

test('lit un .env, commentaires et guillemets compris', () => {
  const chemin = fichierEnv(
    [
      '# un commentaire',
      '',
      'ESSAI_SIMPLE=valeur',
      'ESSAI_GUILLEMETS="entre guillemets"',
      "ESSAI_APOSTROPHES='entre apostrophes'",
      'ESSAI_ESPACES =  autour  ',
      'ligne sans egal',
    ].join('\n'),
  )
  try {
    chargerEnv(chemin)
    assert.equal(process.env['ESSAI_SIMPLE'], 'valeur')
    // Les guillemets sont une convention d'écriture, pas une partie du secret :
    // un mot de passe qui les garde est refusé par le serveur, et on cherche
    // ailleurs pendant une demi-heure.
    assert.equal(process.env['ESSAI_GUILLEMETS'], 'entre guillemets')
    assert.equal(process.env['ESSAI_APOSTROPHES'], 'entre apostrophes')
    assert.equal(process.env['ESSAI_ESPACES'], 'autour')
  } finally {
    oublier('ESSAI_SIMPLE', 'ESSAI_GUILLEMETS', 'ESSAI_APOSTROPHES', 'ESSAI_ESPACES')
  }
})

test('n’écrase jamais une variable déjà posée', () => {
  process.env['ESSAI_PRIORITE'] = 'de la ligne de commande'
  const chemin = fichierEnv('ESSAI_PRIORITE=du fichier')
  try {
    chargerEnv(chemin)
    // Sinon un réglage passé à la main pour un essai serait ignoré en silence.
    assert.equal(process.env['ESSAI_PRIORITE'], 'de la ligne de commande')
  } finally {
    oublier('ESSAI_PRIORITE')
  }
})

test('un .env absent ne fait rien, et surtout ne lève pas', () => {
  assert.doesNotThrow(() => chargerEnv('/aucun/chemin/.env'))
})

test('un panneau à moitié réglé n’existe pas', () => {
  const cles = ['IPTV_XTREAM_SERVEUR', 'IPTV_XTREAM_UTILISATEUR', 'IPTV_XTREAM_MOT_DE_PASSE'] as const
  const avant = cles.map((cle) => process.env[cle])
  try {
    oublier(...cles)
    assert.equal(identifiantsXtream(), undefined)

    process.env['IPTV_XTREAM_SERVEUR'] = 'http://exemple.tv:8080'
    process.env['IPTV_XTREAM_UTILISATEUR'] = 'jean'
    assert.equal(identifiantsXtream(), undefined, 'deux valeurs sur trois ne suffisent pas')

    // Une valeur vide n'en est pas une : elle donnerait un panneau qui répond 403.
    process.env['IPTV_XTREAM_MOT_DE_PASSE'] = '   '
    assert.equal(identifiantsXtream(), undefined)

    process.env['IPTV_XTREAM_MOT_DE_PASSE'] = 's3cr3t'
    assert.deepEqual(identifiantsXtream(), {
      serveur: 'http://exemple.tv:8080',
      utilisateur: 'jean',
      motDePasse: 's3cr3t',
    })
  } finally {
    oublier(...cles)
    cles.forEach((cle, rang) => {
      const valeur = avant[rang]
      if (valeur !== undefined) process.env[cle] = valeur
    })
  }
})

test('retrouve une fiche de série par son titre, sans se soucier de la casse', () => {
  const depot = ouvrirDepot(':memory:')
  try {
    const sourceId = depot.declarerSource({
      genre: 'xtream',
      adresse: 'http://exemple.tv:8080',
      utilisateur: 'jean',
    })
    depot.enregistrerFiches(sourceId, [
      {
        id: 'se_1',
        refExterne: '42',
        titre: 'Engrenages',
        titreBrut: 'Engrenages',
        annee: 2005,
        logo: undefined,
        resume: 'Une brigade criminelle.',
        genres: ['Policier'],
        groupe: 'SERIES FR',
        langue: 'vf',
      },
    ])

    assert.equal(depot.ficheParTitre('Engrenages')?.refExterne, '42')
    // L'URL porte le titre tel qu'il s'affiche ; la casse ne doit pas décider.
    assert.equal(depot.ficheParTitre('engrenages')?.id, 'se_1')
    assert.deepEqual(depot.ficheParTitre('Engrenages')?.genres, ['Policier'])
    assert.equal(depot.ficheParTitre('Jamais vue'), undefined)
  } finally {
    depot.fermer()
  }
})
