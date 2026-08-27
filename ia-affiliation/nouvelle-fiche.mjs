#!/usr/bin/env node
/**
 * Squelette d'une fiche outil — Radar IA
 *
 * Rallonger le vivier est le seul geste que le site ne sait pas faire seul.
 * Il doit donc coûter le moins possible : une commande, un fichier, et il ne
 * reste plus qu'à écrire l'avis.
 *
 *   node nouvelle-fiche.mjs "Notion Calendar" Productivité
 *   node nouvelle-fiche.mjs "Cursor" Développement "À partir de 20$/mois"
 *
 * Le fichier est écrit dans `vivier/`, où l'auto-pilote le trouvera. Tant que
 * les marques « À COMPLÉTER » y sont, la fiche n'est pas publiable : ni
 * l'auto-pilote ni le vérificateur ne la laisseront passer. C'est volontaire —
 * une fiche à moitié écrite mise en ligne toute seule à huit heures du matin
 * est bien pire qu'une fiche qui attend.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.dirname(fileURLToPath(import.meta.url));
const DOSSIER_VIVIER = path.join(RACINE, 'vivier');

const [nom, categorie, prix] = process.argv.slice(2);

if (!nom || !categorie) {
  console.error('Usage : node nouvelle-fiche.mjs "Nom de l\'outil" Catégorie ["Tarif"]');
  console.error('Exemple : node nouvelle-fiche.mjs "Cursor" Développement "À partir de 20$/mois"');
  process.exit(1);
}

// L'identifiant sert d'URL dans le sitemap : il doit survivre à un copier-coller
// dans une barre d'adresse, donc ni accent, ni espace, ni majuscule.
function identifiant(valeur) {
  return String(valeur)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const id = identifiant(nom);
if (!id) {
  console.error("✗ Ce nom ne donne aucun identifiant utilisable (que des caractères spéciaux ?).");
  process.exit(1);
}

const cible = path.join(DOSSIER_VIVIER, id + '.json');
if (fs.existsSync(cible)) {
  console.error('✗ vivier/' + id + '.json existe déjà. Ouvrez-le plutôt que d\'en créer un second.');
  process.exit(1);
}

const fiche = {
  id,
  nom,
  categorie,
  prix: prix || 'À COMPLÉTER — ex. « Freemium — à partir de 19$/mois »',
  description_courte: 'À COMPLÉTER — une phrase, le bénéfice concret, moins de 160 caractères.',
  description_longue: [
    'À COMPLÉTER — deux ou trois phrases qui situent l\'outil : ce qu\'il fait,',
    'pour qui, et ce qui le distingue de ses concurrents directs.',
    '',
    '### Points forts',
    '- À COMPLÉTER',
    '- À COMPLÉTER',
    '- À COMPLÉTER',
    '',
    '### Points faibles',
    '- À COMPLÉTER — au moins deux, sincères. Une fiche sans reproche ne',
    '  convainc personne et ne se distingue pas d\'une publicité.',
    '- À COMPLÉTER',
    '',
    '### Idéal pour',
    '- À COMPLÉTER — un profil de métier, pas « tout le monde ».',
    '- À COMPLÉTER'
  ].join('\n'),
  lien_affiliation: 'https://exemple-affiliation.com/' + id
};

fs.mkdirSync(DOSSIER_VIVIER, { recursive: true });
fs.writeFileSync(cible, JSON.stringify(fiche, null, 2) + '\n', 'utf8');

console.log('── Fiche créée : vivier/' + id + '.json');
console.log('· Remplacez les « À COMPLÉTER », puis contrôlez :');
console.log('    node verifier.mjs');
console.log('· Elle partira toute seule à son tour dans la file de publication.');
