// `npm run regarder` — passe une série de messages réalistes dans la couche
// 1 et affiche le verdict de chacun, pour REGARDER au lieu de mesurer.
//
// Pourquoi cet outil existe : une suite de tests ne vérifie que ce à quoi
// son auteur a pensé. Une liste de mots-clés sur le suicide a deux façons de
// se tromper, et les tests unitaires n'en voient aucune — rater un vrai
// signal (inacceptable), ou se déclencher sur une tournure ordinaire
// (« mort de rire », « ce film m'a tué »), ce qui apprend à la personne que
// l'outil raconte n'importe quoi et la fait fuir avant le jour où elle en
// aurait eu besoin.
//
// Cet outil n'affirme rien : il affiche, et c'est l'œil qui décide. Il est
// destiné à être relu avec le professionnel de santé mentale de la couche 4.

import { detecterCrise } from '../src/lib/crisisDetection.ts';

interface Cas {
  message: string;
  attendu: 'aucun' | 'modere' | 'fort';
  pourquoi: string;
}

// Ce qui DOIT déclencher — rater l'un d'eux est le défaut inacceptable.
const DOIT_DECLENCHER: Cas[] = [
  { message: "je crois que je veux mourir", attendu: 'fort', pourquoi: 'tournure explicite' },
  { message: "jve plus vivre, ça sert à quoi", attendu: 'fort', pourquoi: 'phonétique' },
  { message: "j'ai tout préparé pour ce soir", attendu: 'fort', pourquoi: 'plan concret' },
  { message: "je suis un poids pour tout le monde", attendu: 'modere', pourquoi: 'fardeau' },
  { message: "ça ne s'arrangera jamais de toute façon", attendu: 'modere', pourquoi: 'désespoir' },
];

// Ce qui NE DOIT PAS déclencher — chaque faux positif ici coûte la confiance
// de la personne, et le produit avec.
const NE_DOIT_PAS_DECLENCHER: Cas[] = [
  { message: "j'étais mort de rire hier soir", attendu: 'aucun', pourquoi: 'expression courante' },
  { message: "ce film m'a tué tellement il est long", attendu: 'aucun', pourquoi: 'expression courante' },
  { message: "je suis crevé, la journée a été longue", attendu: 'aucun', pourquoi: 'fatigue ordinaire' },
  { message: "mon grand-père est mort l'année dernière", attendu: 'aucun', pourquoi: 'deuil, pas idéation' },
  { message: "j'ai envie de partir en vacances", attendu: 'aucun', pourquoi: '« partir » sans « pour de bon »' },
  { message: "je veux en finir avec ce dossier au boulot", attendu: 'fort', pourquoi: 'FAUX POSITIF CONNU — voir plus bas' },
  { message: "je prends des médicaments pour dormir", attendu: 'aucun', pourquoi: 'traitement, pas moyen' },
  { message: "j'ai disparu des radars ces temps-ci", attendu: 'aucun', pourquoi: '« disparaître » sans « je veux »' },
];

function afficher(titre: string, cas: Cas[]): number {
  console.log(`\n${titre}`);
  console.log('─'.repeat(72));
  let ecarts = 0;
  for (const { message, attendu, pourquoi } of cas) {
    const { niveau, motifs } = detecterCrise([message]);
    const conforme = niveau === attendu;
    if (!conforme) ecarts += 1;
    const marque = conforme ? '  ' : '→ ';
    const declenche = niveau === 'aucun' ? '·····' : niveau.toUpperCase().padEnd(5);
    console.log(`${marque}[${declenche}] « ${message} »`);
    console.log(`             ${pourquoi}${motifs.length ? ` — motif : ${motifs.join(', ')}` : ''}`);
  }
  return ecarts;
}

afficher('CE QUI DOIT DÉCLENCHER', DOIT_DECLENCHER);
afficher('CE QUI NE DOIT PAS DÉCLENCHER', NE_DOIT_PAS_DECLENCHER);

console.log(`
────────────────────────────────────────────────────────────────────────
Ce tableau ne se lit pas comme une suite de tests : il se REGARDE, et il
se relit avec le professionnel de santé mentale de la couche 4.

Le faux positif connu, laissé visible à dessein : « je veux en finir avec
ce dossier au boulot » déclenche le niveau fort. C'est assumé et non
corrigé — la note d'initialisation tranche en toutes lettres : en cas de
doute on déclenche, un faux positif est gênant, un faux négatif est
inacceptable. Une personne qui reçoit le message du 3114 à tort perd dix
secondes ; l'inverse ne se rattrape pas. Ne « corriger » ce cas qu'avec
l'accord d'un professionnel, jamais pour faire joli dans la sortie.
`);
