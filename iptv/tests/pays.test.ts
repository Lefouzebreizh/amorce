import assert from 'node:assert/strict'
import test from 'node:test'

import { estEtrangerDirect, estEtrangerVod } from '../src/normalisation/pays.ts'

test('reconnaît les groupes de pays étrangers rencontrés dans un vrai catalogue', () => {
  const etrangers = [
    'ARABES  ( العربية)',
    'ESPAGNOLES (España)',
    'ITALIENNES (ITALIANA)',
    'TURQUES (Türk)',
    'ALLEMANDES (Deutsch)',
    'ETATS-UNIS ( USA )',
    'INFINITY ETATS-UNIS ( USA FULL CHANNELS )',
    'CANADA ( CA )',
    'POLONAISES (Polonez)',
    'Scandinavie (Danemark Norway Sweden)',
    'PORTUGAISES (Português)',
    'DSTV SUD AFRIQUE (SOUTH AFRICA)',
    'BOSNIAQUE (BOSNA HERCEGOVINA)',
    'ANGLAISES (UK)',
    'CROATES (HRVATI)',
    'RUSSES (РОССИЯ)',
    'MAGHRÈBINES (DZ/MA/TN)',
    'Grecques ( ελληνικά )',
    'BRÈSILIENNES (Brasileiro)',
    'Albanaises (Shqiptar)',
    'PAYS-BAS (NETHERLANDS)',
    'Roumaines (Romanian)',
    'SUISSES (SWITZERLAND)',
    'Tchéquie (Česko)',
    'Armeniennes (ՀԱՅԵՐԵՆ)',
    'INDE (भारतीय)',
    'OSN & MY HD (Arabic)',
    'MLS & NBA PASS & PEACOCK (USA)',
    'BeIN & Sports & Entertainment (Arabic)',
    'DAZN ITALIA SERIE A / SERIE B ( SOLO DIRETTO )',
    'PARAMOUNT+ US (CBS SPORT | UFC)',
    'UK PREMIER LEAGUE+ | DAZN | PREMIERSHIP | OTHERS|',
    'DAZN SPAIN ( LIVE ONLY )',
    'AR SPORTS (رياضة بالعربي)',
    'AD SPORTS | STARZPLAY | ALRABIAA',
  ]
  for (const groupe of etrangers) assert.equal(estEtrangerDirect(groupe), true, groupe)
})

test('garde les groupes français, y compris ceux qui mêlent un marqueur étranger', () => {
  const francais = [
    'FR TV HD (France)',
    'FR TV FULL HD|4K  (France)',
    'FR TV SD (FRANCE)',
    'FR SPORTS (France)',
    'PLUTO TV (FRANCE)',
    'RAKUTEN TV (FRANCE)',
    'FR CANAL+ LIVE | HBOX MAX (France)',
    'FR TV CINEMA FHD ( DOLBY DIGITAL)',
    'FR | DÉMO',
    'FR LALIGA | SERIE A (DAZN | DISNEY+)',
    'LIGUE 1+ FRANCE | DAZN| MAGNUS TV | FANSEAT FRANCE',
    // Mêle un marqueur français et un marqueur étranger : le français gagne.
    'BELGES (FR-SPORTS-FLAMAND)',
    'DAZN BELGIQUE ( UNIQUEMENT LIVE )',
  ]
  for (const groupe of francais) assert.equal(estEtrangerDirect(groupe), false, groupe)
})

test('un groupe générique ou absent n’est pas étranger faute de motif reconnu', () => {
  // Ces catégories anglaises et génériques portent en réalité des chaînes
  // françaises dans ce catalogue (6ter, arte, BFM, France 4, Gulli…) : les
  // masquer par excès en ferait disparaître.
  for (const groupe of ['Movies', 'General', 'Entertainment', 'Kids', 'Series', 'News', undefined, '']) {
    assert.equal(estEtrangerDirect(groupe), false, String(groupe))
  }
})

test('une œuvre est étrangère seulement sans piste française', () => {
  assert.equal(estEtrangerVod('vostfr'), true)
  assert.equal(estEtrangerVod('vo'), true)
  assert.equal(estEtrangerVod('vf'), false)
  assert.equal(estEtrangerVod('multi'), false)
  assert.equal(estEtrangerVod('inconnue'), false)
})
