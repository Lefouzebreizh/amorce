// Trois bilans à lire, sur trois situations qui ne se ressemblent pas.
//
// Les tests disent que les règles sont justes ; ils ne disent pas si le texte
// se lit. C'est ce que ce script sert à regarder — et c'est ce qui a déjà
// trouvé deux défauts que cinquante-trois tests verts ne voyaient pas : un
// rapport qui ouvrait sur des reproches faute de constat positif, et une
// phrase qui disait « un besoin dans la retraite ».
//
//     npm run exemple

import type { Situation } from './modeles.ts'
import { rediger } from './redaction.ts'

const PROFILS: readonly (readonly [string, Situation])[] = [
  [
    'Le couple qui vient d’acheter — 34 ans, un enfant, tout dans les murs',
    {
      age: '30-39',
      foyer: { adultes: 2, enfants: 1 },
      revenuMensuelNetEur: 3400,
      horizon: '10ans',
      livretsEur: 6000,
      tauxLivretsPct: null,
      assuranceVieEur: null,
      tauxAssuranceViePct: null,
      bourseEur: null,
      logement: { valeurEur: 232000, capitalRestantDuEur: 198000 },
    },
  ],
  [
    'La quinquagénaire prudente — épargne bien, place peu, vise la retraite',
    {
      age: '50-59',
      foyer: { adultes: 1, enfants: 0 },
      revenuMensuelNetEur: 2200,
      horizon: 'retraite',
      livretsEur: 28000,
      tauxLivretsPct: null,
      assuranceVieEur: 9000,
      tauxAssuranceViePct: 1.6,
      bourseEur: 0,
      logement: null,
    },
  ],
  [
    'Le trentenaire déjà bien installé — rien d’urgent à lui dire',
    {
      age: '30-39',
      foyer: { adultes: 2, enfants: 0 },
      revenuMensuelNetEur: 5200,
      horizon: '10ans',
      livretsEur: 19000,
      tauxLivretsPct: null,
      assuranceVieEur: 46000,
      tauxAssuranceViePct: 3.3,
      bourseEur: 38000,
      logement: { valeurEur: 310000, capitalRestantDuEur: 140000 },
    },
  ],
]

// Une date où les barèmes livrés sont encore en vigueur : sinon les trois
// bilans sortent sans un seul montant, et il n'y a plus rien à juger.
const LE = new Date('2025-09-01T12:00:00Z')

for (const [titre, situation] of PROFILS) {
  const bilan = rediger(situation, LE)
  console.log(`\n${'═'.repeat(78)}\n  ${titre}\n${'═'.repeat(78)}\n`)
  console.log(bilan.texte)
}
