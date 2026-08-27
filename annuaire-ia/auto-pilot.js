#!/usr/bin/env node
/**
 * Auto-pilote du réseau : ajoute un outil à chaque niche, sans intervention.
 *
 * Un annuaire qui ne bouge pas cesse d'être exploré. Google revient sur un
 * site à la fréquence à laquelle il y trouve du neuf, et dix sites figés se
 * font oublier ensemble. Ce script est la réponse : il tient une réserve
 * d'outils déjà rédigés, et en publie un par niche à chaque exécution.
 *
 * Trois décisions à connaître avant d'y toucher :
 *
 * 1. La réserve est **dans ce fichier**, pas dans une base externe. Un contenu
 *    publié sans relecture doit avoir été écrit une fois par un humain : la
 *    réserve est le point où cette relecture a eu lieu. Générer le texte au
 *    moment de la publication, sur un site qui vit d'être crédible, reviendrait
 *    à publier ce que personne n'a lu.
 * 2. **Un seul outil par niche et par exécution.** Vider la réserve d'un coup
 *    donnerait un site qui grossit une fois puis n'a plus rien à montrer ; la
 *    valeur est dans la régularité, pas dans le volume.
 * 3. **La base est validée avant et après écriture.** Ce script pousse
 *    directement sur `main` sans relecture humaine : un fichier JSON cassé,
 *    et les dix sites affichent une page d'erreur jusqu'à ce que quelqu'un
 *    s'en aperçoive. La validation échoue bruyamment plutôt que d'écrire.
 *
 * Usage :
 *   node auto-pilot.js              publie un outil par niche
 *   node auto-pilot.js --dry-run    montre ce qui serait publié, sans écrire
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validerBase, creerReleve } from './valider.js';

const racine = path.dirname(fileURLToPath(import.meta.url));
const dossierNiches = path.join(racine, 'niches');
const ESSAI = process.argv.includes('--dry-run');
const ETAT = process.argv.includes('--etat-reserve');

const aujourdhui = () => new Date().toISOString().slice(0, 10);

/* Ce qu'est une base valide est défini une seule fois, dans `valider.js` :
   l'intégration continue et ce script doivent refuser exactement les mêmes
   fichiers, sans quoi l'un laisserait passer ce que l'autre bloque. */
function valider(base, fichier) {
  const releve = validerBase(base, path.basename(fichier), creerReleve());
  if (releve.erreurs.length) {
    throw new Error(`${path.basename(fichier)} invalide :\n    - ${releve.erreurs.join('\n    - ')}`);
  }
}

function lireNiches() {
  if (!fs.existsSync(dossierNiches)) {
    throw new Error(`Dossier introuvable : ${dossierNiches}`);
  }
  return fs
    .readdirSync(dossierNiches)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => {
      const fichier = path.join(dossierNiches, f);
      const base = JSON.parse(fs.readFileSync(fichier, 'utf8'));
      valider(base, fichier);
      return { fichier, base };
    });
}

function publierUnOutil({ fichier, base }) {
  const reserve = BACKLOG[base.niche.id] ?? [];
  const enLigne = new Set(base.outils.map((o) => o.id));
  const candidats = reserve.filter((o) => !enLigne.has(o.id));

  if (reserve.length === 0) return { etat: 'sans-reserve' };
  if (candidats.length === 0) return { etat: 'epuisee' };

  const choisi = candidats[Math.floor(Math.random() * candidats.length)];
  base.outils.push({ ...choisi, date_ajout: aujourdhui() });
  valider(base, fichier);

  if (!ESSAI) {
    fs.writeFileSync(fichier, JSON.stringify(base, null, 2) + '\n', 'utf8');
  }
  return { etat: 'publie', outil: choisi, restants: candidats.length - 1 };
}

/** Combien de publications tient encore chaque niche. Le travail programmé
 *  lit ce relevé pour ouvrir un billet **avant** que la réserve soit vide :
 *  un auto-pilote qui tourne à vide ne se signale nulle part, et le réseau
 *  s'arrête de bouger sans qu'une ligne rouge n'apparaisse. */
function etatDeLaReserve() {
  const niches = lireNiches();
  const restant = {};
  for (const { base } of niches) {
    const enLigne = new Set(base.outils.map((o) => o.id));
    restant[base.niche.id] = (BACKLOG[base.niche.id] ?? []).filter((o) => !enLigne.has(o.id)).length;
  }
  const valeurs = Object.values(restant);
  return {
    minimum: valeurs.length ? Math.min(...valeurs) : 0,
    total: valeurs.reduce((n, v) => n + v, 0),
    vides: Object.keys(restant).filter((id) => restant[id] === 0),
    niches: restant,
  };
}

function main() {
  if (ETAT) {
    console.log(JSON.stringify(etatDeLaReserve(), null, 2));
    return;
  }
  const niches = lireNiches();
  if (niches.length === 0) throw new Error('Aucune base de niche dans niches/.');

  console.log(`Auto-pilote — ${niches.length} niches, ${aujourdhui()}${ESSAI ? ' (essai à blanc)' : ''}`);

  let publies = 0;
  const asec = [];

  for (const niche of niches) {
    const nom = niche.base.niche.id.padEnd(14);
    const resultat = publierUnOutil(niche);
    switch (resultat.etat) {
      case 'publie':
        publies += 1;
        console.log(`  + ${nom} ${resultat.outil.nom} — ${resultat.outil.categorie} (${resultat.restants} en réserve)`);
        break;
      case 'epuisee':
        asec.push(niche.base.niche.id);
        console.log(`  · ${nom} réserve épuisée — tout est déjà en ligne`);
        break;
      default:
        asec.push(niche.base.niche.id);
        console.log(`  · ${nom} aucune réserve déclarée dans BACKLOG`);
    }
  }

  console.log(`\n${publies} outil${publies > 1 ? 's' : ''} publié${publies > 1 ? 's' : ''}${ESSAI ? ' (rien écrit)' : ''}.`);
  if (asec.length) {
    console.log(`Réserve à réalimenter : ${asec.join(', ')}.`);
  }
  if (!ESSAI) {
    const etat = etatDeLaReserve();
    console.log(`Réserve : ${etat.total} outils, soit ${etat.minimum} passage(s) avant la panne sèche.`);
  }
}

/* ------------------------------------------------------------------------ */
/* Réserve : cinq outils par niche, rédigés et relus, en attente de publication */
/* ------------------------------------------------------------------------ */

export const BACKLOG = {

  immobilier: [
    {
      id: `restb-ai`,
      nom: `Restb.ai`,
      categorie: `Analyse de photos`,
      prix: `Sur devis`,
      description_courte: `La reconnaissance automatique de ce que montrent les photos d'un bien : pièces, état, équipements, prestations haut de gamme.`,
      lien_affiliation: `https://exemple-affiliation.com/go/restb-ai`,
      score_avis: 4.2,
      description_longue: `## Notre verdict
Restb.ai regarde les photos d'une annonce et en tire des données exploitables : type de pièce, état d'entretien, présence d'une cuisine équipée, d'une cheminée, d'une piscine. Pour un portefeuille de plusieurs milliers de biens, c'est le seul moyen de qualifier des annonces sans qu'un humain ouvre chaque dossier — et de repérer celles dont les photos ne suivent pas la charte de l'agence.

## Points forts
- Détection des pièces et des équipements sans intervention humaine
- Contrôle automatique de la qualité et de la conformité des photos publiées
- Enrichissement des annonces existantes, ce qui améliore leur classement sur les portails
- Interface de programmation propre, greffable sur un logiciel de transaction

## Points faibles
- Outil de développeur : il faut une équipe technique pour en tirer quelque chose
- Aucun intérêt pour une agence à quelques dizaines de mandats
- La détection d'état reste grossière sur les biens à rénover

## Idéal pour
Les réseaux, les portails et les éditeurs de logiciels immobiliers qui traitent des volumes de photos qu'aucune équipe ne peut relire.`,
    },
    {
      id: `epique-ai`,
      nom: `Epique AI`,
      categorie: `Marketing & prospection`,
      prix: `Freemium — à partir de 20 $/mois`,
      description_courte: `La boîte à outils marketing du négociateur : annonce, publication réseaux, biographie, courriel de prospection, le tout en quelques clics.`,
      lien_affiliation: `https://exemple-affiliation.com/go/epique-ai`,
      score_avis: 4.1,
      description_longue: `## Notre verdict
Epique regroupe une quinzaine de générateurs pensés pour un seul métier : texte d'annonce à partir des caractéristiques du bien, publication pour les réseaux sociaux, courriel de prospection sur un secteur, biographie professionnelle, visuel de vitrine. Rien qu'un assistant généraliste ne saurait faire, mais chaque outil pose déjà les bonnes questions, ce qui fait la différence entre un usage régulier et un abonnement oublié.

## Points forts
- Trames spécifiques au métier : aucune consigne à rédiger soi-même
- Génération d'images de biens et de visuels de vitrine incluse
- Tarif accessible à un négociateur indépendant
- Prise en main immédiate, sans formation

## Points faibles
- Textes calibrés sur le marché américain, à retravailler pour la France
- La qualité varie beaucoup d'un générateur à l'autre
- Rien n'empêche deux agences voisines de publier le même texte

## Idéal pour
Le négociateur indépendant ou la petite agence sans service marketing, qui publie ses annonces et ses réseaux sociaux entre deux visites.`,
    },
    {
      id: `yanport`,
      nom: `Yanport`,
      categorie: `Données de marché`,
      prix: `Sur devis`,
      description_courte: `La donnée immobilière française analysée en continu : tension, délais de vente, écarts entre prix affiché et prix signé.`,
      lien_affiliation: `https://exemple-affiliation.com/go/yanport`,
      score_avis: 4.3,
      description_longue: `## Notre verdict
Yanport observe le marché français annonce par annonce et suit chaque bien jusqu à son retrait : c'est ce qui permet de mesurer un délai de vente réel et un écart entre le prix demandé et le prix obtenu, deux chiffres que personne d'autre ne fournit à cette maille. Pour l'estimation comme pour l'argumentaire de baisse de prix, c'est la donnée qui fait autorité en rendez-vous.

## Points forts
- Suivi longitudinal des annonces : délais réels et négociation moyenne par secteur
- Découpage fin, jusqu au quartier, sur les zones denses
- Indicateurs de tension utiles pour arbitrer un secteur de prospection
- Données françaises, régulièrement rafraîchies

## Points faibles
- Vendu aux professionnels sur devis, avec un engagement annuel
- Rien à en tirer sans quelqu un capable de lire un tableau de bord
- La précision se dégrade en zone rurale, faute de volume d'annonces

## Idéal pour
Les directions de réseau, les promoteurs et les agences qui pilotent plusieurs secteurs et veulent décider sur des chiffres plutôt qu'au ressenti.`,
    },
    {
      id: `write-homes`,
      nom: `Write.homes`,
      categorie: `Rédaction d'annonces`,
      prix: `Freemium — à partir de 15 $/mois`,
      description_courte: `L'annonce rédigée à partir des caractéristiques du bien, déclinée pour chaque portail et chaque réseau social.`,
      lien_affiliation: `https://exemple-affiliation.com/go/write-homes`,
      score_avis: 4.0,
      description_longue: `## Notre verdict
Rédiger trente annonces par mois est une corvée dont la qualité baisse à la troisième. Write.homes prend les caractéristiques saisies et produit un texte structuré, décliné aux formats des portails et des réseaux sociaux, avec les variantes de longueur qu'ils imposent. Le gain n'est pas dans la prose — elle reste sage — mais dans le fait que la trentième annonce vaut la première.

## Points forts
- Déclinaison automatique aux formats des différents portails
- Variantes de ton : familial, investisseur, résidence secondaire
- Textes de visite guidée et de publication sociale générés dans la foulée
- Formule gratuite suffisante pour juger avant de payer

## Points faibles
- Style reconnaissable si l'on publie sans retoucher
- Aucune connaissance des mentions obligatoires françaises : à vérifier soi-même
- Ne se connecte pas aux logiciels de transaction du marché français

## Idéal pour
Les agences qui publient beaucoup et dont les annonces se ressemblent toutes parce qu'elles sont écrites à la chaîne en fin de journée.`,
    },
    {
      id: `reimagine-home`,
      nom: `Reimagine Home AI`,
      categorie: `Home staging`,
      prix: `Freemium — à partir de 20 $/mois`,
      description_courte: `La pièce reméublée et redécorée en plusieurs styles à partir d'une seule photo, pour montrer le potentiel d'un bien fatigué.`,
      lien_affiliation: `https://exemple-affiliation.com/go/reimagine-home`,
      score_avis: 4.0,
      description_longue: `## Notre verdict
Là où le home staging virtuel classique meuble une pièce vide, Reimagine Home va plus loin : il redécore une pièce occupée, change les revêtements, propose une rénovation plausible. C'est l'outil du bien daté qui ne se vend pas parce qu'aucun visiteur ne se projette. Le rendu extérieur, jardins et façades compris, est un bonus rare sur ce type de service.

## Points forts
- Redécoration de pièces occupées, pas seulement d'espaces vides
- Simulation de rénovation : sols, murs, cuisines, salles d'eau
- Traite aussi les extérieurs, façades et jardins
- Formule gratuite pour tester sur un mandat difficile

## Points faibles
- La géométrie de la pièce est parfois modifiée : à surveiller avant publication
- La mention du caractère virtuel de la projection est une obligation d'information
- Les résultats demandent souvent trois ou quatre essais

## Idéal pour
Les mandats sur biens datés ou à rénover, où la difficulté n'est pas de meubler mais de faire imaginer autre chose que l'existant.`,
    },
  ],

  btp: [
    {
      id: `openspace`,
      nom: `OpenSpace`,
      categorie: `Suivi de chantier`,
      prix: `Sur devis`,
      description_courte: `Une caméra 360 sur le casque, une marche dans le chantier, et tout l'ouvrage est photographié et repositionné sur le plan.`,
      lien_affiliation: `https://exemple-affiliation.com/go/openspace`,
      score_avis: 4.5,
      description_longue: `## Notre verdict
OpenSpace résout le problème de l'archive de chantier : on marche avec une caméra 360, l'outil replace automatiquement chaque image sur le plan, et l'on obtient une visite navigable datée. Six mois plus tard, retrouver ce qu'il y avait derrière une cloison avant fermeture prend dix secondes au lieu d'une journée de fouille dans les photos du téléphone.

## Points forts
- Aucune saisie : la captation demande de marcher normalement dans le chantier
- Comparaison de deux dates au même endroit, côte à côte
- Preuve visuelle datée, décisive en réclamation ou en litige
- Prise en main immédiate par les compagnons comme par l'encadrement

## Points faibles
- Le repositionnement se dégrade dans les grands volumes sans repères
- Coût annuel réel dès que l'on équipe plusieurs opérations
- L'analyse d'avancement automatique reste moins fine que celle des outils spécialisés

## Idéal pour
Toute entreprise qui a déjà perdu un litige faute de photo au bon moment, et tout conducteur de travaux qui suit plusieurs chantiers à distance.`,
    },
    {
      id: `nplan`,
      nom: `nPlan`,
      categorie: `Planning`,
      prix: `Sur devis`,
      description_courte: `Le planning passé au crible de milliers de chantiers réels : quelles tâches vont déraper, et de combien.`,
      lien_affiliation: `https://exemple-affiliation.com/go/nplan`,
      score_avis: 4.2,
      description_longue: `## Notre verdict
Un planning de chantier est un vœu ; nPlan le confronte à l'historique de milliers d'opérations comparables et rend une probabilité de tenue, tâche par tâche. Le résultat est souvent désagréable — la date annoncée est rarement celle qui sort — mais c'est exactement ce dont on a besoin pour arbitrer une provision de retard avant de signer.

## Points forts
- Prévision fondée sur des chantiers réels, pas sur l'optimisme du planificateur
- Identification des tâches qui dérapent le plus souvent, avant qu'elles ne dérapent
- Simulation de scénarios : effet d'un décalage sur l'ensemble du chemin critique
- Argumentaire chiffré face au maître d'ouvrage sur les provisions de délai

## Points faibles
- Exige un planning correctement structuré au format des logiciels du marché
- Réservé aux opérations d'infrastructure et de bâtiment de grande taille
- Le résultat n'a de valeur que si la direction accepte de l'entendre

## Idéal pour
Les entreprises générales et maîtres d'ouvrage sur des opérations où un mois de retard se chiffre en centaines de milliers d'euros de pénalités.`,
    },
    {
      id: `alice-technologies`,
      nom: `ALICE Technologies`,
      categorie: `Planning`,
      prix: `Sur devis`,
      description_courte: `Des milliers de scénarios de phasage générés à partir de la maquette : la meilleure séquence de travaux, pas la première trouvée.`,
      lien_affiliation: `https://exemple-affiliation.com/go/alice-technologies`,
      score_avis: 4.1,
      description_longue: `## Notre verdict
ALICE part de la maquette numérique et des moyens disponibles pour générer des milliers de séquences de construction possibles, puis les classe par durée et par coût. Un planificateur explore trois ou quatre variantes dans sa carrière sur un projet donné ; la machine en essaie dix mille en une nuit, et trouve régulièrement des phasages qui gagnent dix à quinze pour cent de délai.

## Points forts
- Exploration exhaustive du phasage, hors de portée d'un planificateur humain
- Arbitrage explicite entre durée, moyens mobilisés et coût
- Réponse rapide à un aléa : le replanning se recalcule au lieu de se refaire
- Gains de délai mesurés et documentés sur des opérations réelles

## Points faibles
- Sans maquette numérique correctement renseignée, l'outil ne sert à rien
- Investissement en paramétrage initial de plusieurs semaines
- Les contraintes de site réelles doivent être décrites finement, sinon la solution est théorique

## Idéal pour
Les grands travaux et les opérations répétitives — logements, hôpitaux, data centers — où le phasage est le principal levier sur la marge.`,
    },
    {
      id: `kreo`,
      nom: `Kreo`,
      categorie: `Métré & chiffrage`,
      prix: `Freemium — à partir de 60 £/mois`,
      description_courte: `Le métré sur plan 2D et la bibliothèque de prix dans le même outil : du plan au devis sans ressaisie.`,
      lien_affiliation: `https://exemple-affiliation.com/go/kreo`,
      score_avis: 4.0,
      description_longue: `## Notre verdict
Kreo couvre la chaîne complète du chiffrage : reconnaissance des éléments sur le plan PDF, quantités, puis application d'une bibliothèque de prix pour sortir le devis. C'est moins spécialisé que les outils de métré pur, mais le fait de ne pas exporter vers un tableur intermédiaire supprime la source d'erreur la plus banale du chiffrage — la ressaisie.

## Points forts
- Du plan au devis dans un seul outil, sans transfert de fichier
- Bibliothèque de prix modifiable, propre à l'entreprise
- Version gratuite réellement utilisable pour juger sur un dossier
- Interface plus simple d'accès que les logiciels d'économie de la construction historiques

## Points faibles
- Reconnaissance moins fiable que les outils dédiés au seul métré
- Bibliothèques de prix calibrées sur le marché britannique
- La gestion multi-utilisateurs reste sommaire

## Idéal pour
Les petites et moyennes entreprises du bâtiment qui chiffrent encore au tableur et perdent des heures entre le métré et le devis.`,
    },
    {
      id: `doxel`,
      nom: `Doxel`,
      categorie: `Suivi de chantier`,
      prix: `Sur devis`,
      description_courte: `L'avancement mesuré par balayage laser et vision : ce qui est réellement posé, comparé à ce qui est facturé.`,
      lien_affiliation: `https://exemple-affiliation.com/go/doxel`,
      score_avis: 4.2,
      description_longue: `## Notre verdict
Doxel compare l'ouvrage réellement construit à la maquette et au planning, à partir de relevés laser et photographiques. La différence avec un suivi visuel classique est le niveau de détail : l'outil sait qu'il manque vingt mètres de gaine dans un plénum. Le résultat sert autant au pilotage qu'à la vérification des situations de travaux présentées par les sous-traitants.

## Points forts
- Mesure objective de l'avancement, opposable en réunion de chantier
- Rapprochement direct entre avancement physique et facturation
- Détection des écarts d'exécution par rapport à la maquette avant qu'ils soient recouverts
- Historique complet exploitable en fin d'opération

## Points faibles
- Nécessite une maquette de bonne qualité et des relevés réguliers
- Coût qui ne se justifie que sur des opérations techniques importantes
- Le déploiement demande l'adhésion des entreprises, rarement acquise d'emblée

## Idéal pour
Les maîtres d'ouvrage et entreprises générales sur des projets techniques — hôpitaux, industrie, data centers — où l'écart entre le facturé et le posé coûte cher.`,
    },
  ],

  rh: [
    {
      id: `paradox-olivia`,
      nom: `Paradox (Olivia)`,
      categorie: `Présélection`,
      prix: `Sur devis`,
      description_courte: `L'assistant conversationnel qui qualifie le candidat, planifie l'entretien et remplit l'agenda du recruteur pendant la nuit.`,
      lien_affiliation: `https://exemple-affiliation.com/go/paradox-olivia`,
      score_avis: 4.4,
      description_longue: `## Notre verdict
Paradox s'attaque à la partie du recrutement de volume qui décourage tout le monde : les questions de qualification, la prise de rendez-vous et les relances. Le candidat échange par messagerie, répond à quelques critères éliminatoires, choisit son créneau, reçoit ses rappels. Sur des métiers en tension, le délai entre la candidature et l'entretien tombe de plusieurs jours à quelques heures — et c'est ce délai qui décide qui recrute.

## Points forts
- Qualification et prise de rendez-vous menées de bout en bout sans recruteur
- Fonctionne le soir et le week-end, quand les candidats postulent réellement
- Réduction spectaculaire du délai de première réponse
- Intégration avec les principaux systèmes de gestion des candidatures

## Points faibles
- Pensé pour le recrutement de masse : sans volume, l'investissement ne se justifie pas
- Le dialogue automatisé rebute certains profils qualifiés
- Le paramétrage des critères éliminatoires demande de la vigilance sur la non-discrimination

## Idéal pour
La distribution, la logistique, la restauration et l'intérim, où le candidat est perdu si personne ne le rappelle dans les vingt-quatre heures.`,
    },
    {
      id: `seekout`,
      nom: `SeekOut`,
      categorie: `Sourcing`,
      prix: `Sur devis`,
      description_courte: `Le moteur de recherche de profils qui va chercher ailleurs que dans les bases habituelles, y compris les candidats qui ne cherchent pas.`,
      lien_affiliation: `https://exemple-affiliation.com/go/seekout`,
      score_avis: 4.3,
      description_longue: `## Notre verdict
SeekOut agrège des centaines de millions de profils venus de sources publiques variées — dépôts de code, publications scientifiques, brevets, réseaux professionnels — et permet de chercher sur des critères que les bases classiques ignorent. Pour un poste technique rare, c'est la différence entre les vingt mêmes profils que tous les cabinets contactent et un vivier réellement neuf.

## Points forts
- Sources bien au-delà des réseaux professionnels habituels
- Recherche par compétence démontrée, pas seulement par intitulé de poste
- Filtres de diversité utiles pour élargir un vivier trop homogène
- Séquences de contact intégrées, avec suivi des réponses

## Points faibles
- Couverture nettement plus riche sur les profils américains
- Tarification annuelle par licence, lourde pour une équipe de deux recruteurs
- La qualité des données publiques est inégale : des profils obsolètes remontent

## Idéal pour
Les recruteurs de profils techniques rares — développement, données, recherche — qui ont épuisé les viviers classiques.`,
    },
    {
      id: `eightfold-ai`,
      nom: `Eightfold AI`,
      categorie: `Gestion des talents`,
      prix: `Sur devis`,
      description_courte: `La cartographie des compétences de l'entreprise : qui sait faire quoi, qui pourrait apprendre quoi, et pour quel poste.`,
      lien_affiliation: `https://exemple-affiliation.com/go/eightfold-ai`,
      score_avis: 4.1,
      description_longue: `## Notre verdict
Eightfold raisonne en compétences plutôt qu'en intitulés de poste, ce qui change la conversation sur la mobilité interne : un poste ouvert fait remonter les salariés qui en sont à une formation près, pas seulement ceux qui ont déjà le titre. Sur une entreprise de plusieurs milliers de personnes, c'est le seul moyen de savoir ce que l'on a déjà en interne avant de recruter à l'extérieur.

## Points forts
- Modèle de compétences qui rend visible la mobilité interne possible
- Rapprochement entre besoins ouverts et salariés à former
- Plans de développement individualisés appuyés sur des trajectoires réelles
- Couvre le recrutement externe et la gestion interne dans le même référentiel

## Points faibles
- Projet de plusieurs mois avant le premier résultat utile
- Suppose des données ressources humaines propres, ce qui est rarement le cas
- Toute utilisation pour classer des personnes appelle un cadre d'usage écrit et communiqué

## Idéal pour
Les grandes entreprises engagées dans une transformation des métiers et qui recrutent à l'extérieur des compétences déjà présentes en interne.`,
    },
    {
      id: `leena-ai`,
      nom: `Leena AI`,
      categorie: `Expérience collaborateur`,
      prix: `Sur devis`,
      description_courte: `Le guichet ressources humaines automatisé : congés, attestations, notes de frais, questions de paie, répondus à toute heure.`,
      lien_affiliation: `https://exemple-affiliation.com/go/leena-ai`,
      score_avis: 4.0,
      description_longue: `## Notre verdict
Une équipe ressources humaines passe une part considérable de son temps à répondre trente fois par mois aux mêmes questions : solde de congés, procédure d'attestation, remboursement de frais. Leena branche un assistant sur les outils internes et traite ces demandes de bout en bout, y compris les actions dans le système de paie. Les taux de résolution sans intervention humaine dépassent souvent 60 %.

## Points forts
- Agit sur les systèmes internes, il ne se contente pas de répondre
- Disponible sur les messageries d'entreprise déjà utilisées par les salariés
- Fait remonter les questions récurrentes : on découvre ce que la documentation n'explique pas
- Couvre aussi les demandes informatiques et administratives

## Points faibles
- Sans documentation interne à jour, l'assistant répond mal ou pas
- Intégration au système d'information à prévoir comme un vrai projet
- Le ton par défaut demande un travail de personnalisation pour ne pas sonner froid

## Idéal pour
Les directions des ressources humaines de plusieurs centaines de salariés, dont l'équipe passe ses journées en support plutôt qu'en accompagnement.`,
    },
    {
      id: `visier`,
      nom: `Visier`,
      categorie: `Analyse RH`,
      prix: `Sur devis`,
      description_courte: `Les chiffres sociaux enfin lisibles : turnover, absentéisme, équité salariale, avec la question posée en français.`,
      lien_affiliation: `https://exemple-affiliation.com/go/visier`,
      score_avis: 4.2,
      description_longue: `## Notre verdict
Visier assemble les données de paie, de temps et de gestion des talents en un modèle unique, puis répond à des questions posées en langage courant : quel service perd le plus de monde, à quel moment de l'ancienneté les départs se produisent, où subsiste un écart salarial injustifié. C'est ce qui remplace le tableur trimestriel que personne ne lit par un tableau de bord que la direction ouvre.

## Points forts
- Question posée en français, réponse immédiate : plus d'aller-retour avec le contrôle de gestion
- Indicateurs sociaux calculés de façon homogène entre filiales et pays
- Détection des écarts de rémunération, obligation qui devient une routine
- Prévision des départs, avec les facteurs associés

## Points faibles
- La consolidation initiale des sources est le vrai chantier, et il est long
- Réservé aux entreprises de taille conséquente
- Les prévisions de départ demandent un cadre d'usage clair pour ne pas devenir un outil de surveillance

## Idéal pour
Les directions des ressources humaines multi-sites qui n'ont pas de vision consolidée fiable de leur masse salariale et de leurs départs.`,
    },
  ],

  comptabilite: [
    {
      id: `rossum`,
      nom: `Rossum`,
      categorie: `Extraction de documents`,
      prix: `Sur devis`,
      description_courte: `L'extraction de données sur des documents qu'aucun modèle n'a jamais vus : factures, bons de commande, relevés, sans gabarit à créer.`,
      lien_affiliation: `https://exemple-affiliation.com/go/rossum`,
      score_avis: 4.4,
      description_longue: `## Notre verdict
La reconnaissance de documents classique demande un gabarit par fournisseur, ce qui condamne l'approche dès que le portefeuille dépasse quelques dizaines d'émetteurs. Rossum lit la mise en page comme le ferait un humain et retrouve les champs sans modèle préalable. Sur un flux hétérogène de plusieurs milliers de documents par mois, c'est ce qui fait la différence entre un projet qui tient et un projet abandonné.

## Points forts
- Aucun gabarit à créer : un fournisseur nouveau est traité dès la première facture
- Apprentissage continu à partir des corrections des opérateurs
- Interface de validation pensée pour aller vite, champ par champ
- Connecteurs vers les progiciels de gestion et les outils comptables courants

## Points faibles
- Tarification au volume, hors de portée d'un petit cabinet
- Les documents très dégradés demandent toujours une reprise manuelle
- La mise en service exige un référent interne pendant plusieurs semaines

## Idéal pour
Les centres de services partagés et les cabinets qui traitent des flux documentaires hétérogènes que les gabarits ne couvrent plus.`,
    },
    {
      id: `booke-ai`,
      nom: `Booke AI`,
      categorie: `Révision`,
      prix: `À partir de 20 $/mois par dossier`,
      description_courte: `L'assistant de révision qui repère les écritures douteuses et pose les questions au client à votre place.`,
      lien_affiliation: `https://exemple-affiliation.com/go/booke-ai`,
      score_avis: 4.1,
      description_longue: `## Notre verdict
La clôture d'un dossier bloque toujours au même endroit : les opérations non identifiées, dont seul le client connaît la nature. Booke détecte les écritures incohérentes, formule la question dans un portail simple et relance jusqu'à obtenir la réponse. Le collaborateur cesse d'être l'huissier de son propre dossier et reprend la main quand les réponses sont là.

## Points forts
- Détection des incohérences et des doublons avant la révision proprement dite
- Relance automatique du client, avec un portail qu'il sait utiliser
- Se greffe sur les principaux logiciels de tenue du marché
- Tarif au dossier, lisible pour un cabinet

## Points faibles
- Couverture limitée aux logiciels anglo-saxons dominants
- Ne remplace ni la révision ni le jugement professionnel
- Les clients qui ne répondaient pas au téléphone ne répondent pas davantage au portail

## Idéal pour
Les cabinets dont les clôtures traînent faute de réponses clients, et qui relancent encore par courriels manuels en fin de trimestre.`,
    },
    {
      id: `klippa`,
      nom: `Klippa`,
      categorie: `Notes de frais`,
      prix: `À partir de 6 €/mois par utilisateur`,
      description_courte: `Les notes de frais photographiées, lues, contrôlées et rapprochées de la politique interne avant même d'arriver au comptable.`,
      lien_affiliation: `https://exemple-affiliation.com/go/klippa`,
      score_avis: 4.2,
      description_longue: `## Notre verdict
Klippa lit un ticket ou une facture en quelques secondes, extrait le montant, la taxe, le fournisseur, et applique les règles de la politique de frais : plafond dépassé, dépense non éligible, doublon avec une note déjà passée. Le contrôle se fait donc à la saisie et non trois semaines plus tard, ce qui supprime l'essentiel des allers-retours entre le salarié et la comptabilité.

## Points forts
- Reconnaissance fiable sur les tickets froissés et les factures étrangères
- Contrôle des règles internes appliqué au moment du dépôt
- Détection des doublons et des fraudes simples sur les justificatifs
- Tarif par utilisateur accessible aux structures moyennes

## Points faibles
- La configuration fine des règles demande un vrai temps de paramétrage
- Périmètre limité aux frais : ce n'est pas un outil comptable complet
- Le rapprochement avec les cartes bancaires d'entreprise reste perfectible

## Idéal pour
Les entreprises de cinquante à cinq cents salariés dont les notes de frais reviennent en boucle faute d'être contrôlées à la source.`,
    },
    {
      id: `tiime`,
      nom: `Tiime`,
      categorie: `Plateforme comptable`,
      prix: `Freemium — à partir de 20 €/mois`,
      description_courte: `L'outil français qui met la facturation du client et la pré-comptabilité du cabinet dans le même flux.`,
      lien_affiliation: `https://exemple-affiliation.com/go/tiime`,
      score_avis: 4.4,
      description_longue: `## Notre verdict
Tiime aborde le problème par le client plutôt que par le cabinet : l'entrepreneur facture, encaisse, photographie ses justificatifs et suit sa trésorerie dans une application qu'il ouvre volontiers, et le cabinet récupère une pré-comptabilité déjà catégorisée. C'est la meilleure réponse au dossier de petite entreprise où le vrai coût n'est pas la saisie mais la collecte.

## Points forts
- Application client réellement adoptée, ce qui est la condition de tout le reste
- Rapprochement bancaire et catégorisation automatiques
- Solution française, avec les obligations de facturation locales prises en charge
- Formule d'entrée gratuite pour les très petites structures

## Points faibles
- Moins puissant que les plateformes complètes sur les dossiers complexes
- Le cabinet dépend de l'adhésion du client à l'application
- Fonctions de production comptable en retrait sur les dossiers de taille moyenne

## Idéal pour
Les cabinets à forte proportion d'indépendants et de très petites entreprises, où la collecte des pièces est le vrai goulot d'étranglement.`,
    },
    {
      id: `sage-copilot`,
      nom: `Sage Copilot`,
      categorie: `Assistant intégré`,
      prix: `Inclus dans certaines offres Sage`,
      description_courte: `L'assistant greffé dans le logiciel comptable déjà en place : relances, anomalies, prévision de trésorerie, sans changer d'outil.`,
      lien_affiliation: `https://exemple-affiliation.com/go/sage-copilot`,
      score_avis: 3.9,
      description_longue: `## Notre verdict
L'intérêt de Sage Copilot n'est pas d'être le meilleur assistant du marché, c'est d'être déjà là. Pour les cabinets et les entreprises équipés de Sage, il propose des relances clients rédigées, signale les anomalies de saisie et projette la trésorerie sans qu'aucune donnée sorte du système en place. La barrière la plus coûteuse d'un projet d'intelligence artificielle — l'intégration — disparaît.

## Points forts
- Aucun projet d'intégration : les données sont déjà dans l'outil
- Relances clients rédigées et priorisées selon le risque d'impayé
- Détection d'anomalies de saisie au fil de l'eau
- Inclus dans certaines offres, donc sans arbitrage budgétaire supplémentaire

## Points faibles
- Nettement en retrait des outils spécialisés sur chaque fonction prise isolément
- Disponibilité inégale selon les produits et les pays de la gamme
- Enfermement accru dans l'écosystème d'un éditeur

## Idéal pour
Les cabinets et directions financières déjà équipés Sage, qui veulent un premier usage utile sans conduire un projet.`,
    },
    {
      id: `cegid-pulse`,
      nom: `Cegid Pulse`,
      categorie: `Plateforme comptable`,
      prix: `Sur devis`,
      description_courte: `La production comptable de Cegid avec l'IA intégrée au moteur, pas posée à côté — le socle le plus répandu des cabinets français.`,
      lien_affiliation: `https://exemple-affiliation.com/go/cegid-pulse`,
      score_avis: 4.2,
      description_longue: `## Notre verdict
L'IA comptable qui compte n'est pas celle qu'on ajoute, c'est celle qui est déjà dans l'outil où la production se fait. Cegid Pulse joue exactement là : l'automatisation vit dans le moteur de production, et l'association avec un outil de capture comme Dext est devenue un standard de fait dans les cabinets français. C'est moins spectaculaire qu'un assistant conversationnel, et beaucoup plus utile au quotidien.

## Points forts
- IA intégrée à la production, sans passerelle à maintenir entre deux outils
- Éditeur installé, présent dans une grande part des cabinets français
- S'associe naturellement aux outils de capture de pièces du marché
- Continuité réglementaire assurée par un acteur qui suit la norme française

## Points faibles
- Aucun tarif public : tout passe par un devis et un projet
- Changer de socle de production est un chantier, pas une souscription
- Enfermement dans l'écosystème d'un éditeur unique
- Peu adapté à une petite structure qui cherche la souplesse

## Idéal pour
Les cabinets qui veulent l'automatisation là où se fait réellement la production, et qui acceptent d'engager un projet plutôt qu'un abonnement.`,
    },
    {
      id: `myunisoft`,
      nom: `MyUnisoft`,
      categorie: `Plateforme comptable`,
      prix: `Sur devis`,
      description_courte: `La plateforme comptable française en ligne, pensée pour que le cabinet et son client travaillent dans le même outil.`,
      lien_affiliation: `https://exemple-affiliation.com/go/myunisoft`,
      score_avis: 4.2,
      description_longue: `## Notre verdict
MyUnisoft s'est construite sur une idée simple : la rupture entre l'outil du cabinet et celui du client est la source de la moitié des allers-retours. Tout se passe donc sur la même plateforme, avec l'automatisation de la pré-comptabilité en amont. L'éditeur publie ses propres relevés d'usage — plus d'un expert-comptable sur deux déclare déjà se servir d'IA, surtout pour accélérer la saisie et l'extraction — ce qui traduit assez bien où se trouve le gain réel aujourd'hui.

## Points forts
- Cabinet et client sur le même outil : moins d'échanges de fichiers
- Automatisation concentrée sur la pré-comptabilité, là où le temps se perd
- Éditeur français, calé sur la norme et le calendrier fiscal d'ici
- Plateforme en ligne, sans installation sur les postes

## Points faibles
- Tarification sur devis, non comparable d'un coup d'œil
- Le bénéfice suppose que les clients acceptent d'entrer dans l'outil
- Migration depuis un socle existant à ne pas sous-estimer
- Moins d'ancienneté que les grands éditeurs historiques

## Idéal pour
Les cabinets qui veulent réduire les allers-retours avec leurs clients plutôt que d'ajouter un outil de plus à une chaîne déjà longue.`,
    },
    {
      id: `chaintrust`,
      nom: `Chaintrust`,
      categorie: `Collecte de pièces`,
      prix: `Sur devis`,
      description_courte: `La capture de pièces qui ne choisit pas son camp : compatible avec les principaux logiciels de production français.`,
      lien_affiliation: `https://exemple-affiliation.com/go/chaintrust`,
      score_avis: 4.3,
      description_longue: `## Notre verdict
Le piège de la capture de pièces est l'attachement : la plupart des outils performants tirent le cabinet vers l'écosystème de leur éditeur. Chaintrust revendique l'inverse et se branche sur les principaux logiciels de production du marché français — Cegid, Sage, MyUnisoft, Pennylane, Fulll, Quadratus et d'autres. Pour un cabinet qui ne veut pas parier sur un socle unique, ou qui en fait cohabiter plusieurs selon les portefeuilles, c'est l'argument décisif.

## Points forts
- Agnostique : compatible avec les principaux logiciels de production français
- Permet de garder son socle de production tout en changeant d'outil de capture
- Utile aux cabinets qui font cohabiter plusieurs environnements
- Périmètre clair, sans chercher à devenir une plateforme de plus

## Points faibles
- Aucun tarif public
- Un outil de plus dans la chaîne, avec sa propre courbe d'apprentissage
- Ne couvre que la capture : la production reste ailleurs
- L'avantage de l'agnosticisme s'estompe si le socle de production intègre déjà la capture

## Idéal pour
Les cabinets multi-environnements, et ceux qui veulent améliorer la collecte sans se lier davantage à l'éditeur de leur logiciel de production.`,
    },
    {
      id: `inqom`,
      nom: `Inqom`,
      categorie: `Révision`,
      prix: `Sur devis`,
      description_courte: `La production comptable automatisée par un éditeur français, jusqu'aux contrôles de révision.`,
      lien_affiliation: `https://exemple-affiliation.com/go/inqom`,
      score_avis: 4.1,
      description_longue: `## Notre verdict
Inqom fait partie des acteurs français qui ont misé tôt sur l'automatisation de la production plutôt que sur la seule saisie. L'intérêt se joue en fin de dossier : ce qui reste à faire quand les écritures sont passées — les contrôles, les incohérences, les pièces manquantes. C'est le moment où un cabinet perd le plus de temps, et celui où l'automatisation se voit le mieux.

## Points forts
- Automatisation poussée au-delà de la saisie, jusqu'aux contrôles
- Éditeur français, aligné sur les obligations locales
- Se connecte aux outils de capture agnostiques du marché
- Positionnement clair sur la production de cabinet

## Points faibles
- Tarification sur devis
- Marché en forte consolidation : la trajectoire des éditeurs indépendants est incertaine
- Suppose de revoir l'organisation du dossier pour tirer le gain
- Moins visible que les têtes d'affiche du secteur

## Idéal pour
Les cabinets qui ont déjà réglé la collecte de pièces et cherchent le gain suivant, là où le collaborateur passe ses dernières heures : la révision.`,
    },
    {
      id: `fulll`,
      nom: `Fulll`,
      categorie: `Plateforme comptable`,
      prix: `Sur devis`,
      description_courte: `Un socle de production français de plus, retenu ici parce qu'il figure parmi ceux que les outils de capture savent tous alimenter.`,
      lien_affiliation: `https://exemple-affiliation.com/go/fulll`,
      score_avis: 4.0,
      description_longue: `## Notre verdict
Fulll appartient au petit groupe de socles de production que les outils de capture du marché français prennent en charge par défaut — ce qui, en pratique, compte autant que la liste de fonctions. Un cabinet qui choisit son logiciel de production choisit surtout ce à quoi il pourra le brancher pendant dix ans. Sur ce critère-là, Fulll est un choix sûr, sans être le plus spectaculaire.

## Points forts
- Reconnu par les principaux outils de capture de pièces français
- Éditeur français, suivi réglementaire assuré
- Approche en ligne, sans parc logiciel à maintenir
- Alternative crédible aux deux ou trois éditeurs dominants

## Points faibles
- Aucun tarif public
- Moins mis en avant que les leaders du marché, documentation moins abondante
- Le changement de socle reste un projet lourd, quel que soit l'éditeur
- L'apport propre de l'IA est moins différenciant que chez les spécialistes

## Idéal pour
Les cabinets qui veulent sortir du duopole des grands éditeurs sans se couper de l'écosystème d'outils qui gravite autour.`,
    },
  ],

  juridique: [
    {
      id: `spellbook`,
      nom: `Spellbook`,
      categorie: `Rédaction de contrats`,
      prix: `Sur devis — à partir d'environ 100 $/mois`,
      description_courte: `L'assistant de rédaction contractuelle qui vit dans Word : clauses proposées, risques signalés, sans changer d'outil.`,
      lien_affiliation: `https://exemple-affiliation.com/go/spellbook`,
      score_avis: 4.4,
      description_longue: `## Notre verdict
Spellbook a fait le bon pari : le juriste rédige dans Word et n'en sortira pas. L'assistant s'y installe, propose des clauses manquantes, signale les stipulations inhabituellement favorables à la partie adverse et rédige une révision à partir d'une consigne en langage courant. L'adoption est immédiate parce qu'il n'y a rien à apprendre ni aucun document à transférer ailleurs.

## Points forts
- Intégré à Word : aucun changement d'habitude de travail
- Repère les clauses manquantes par rapport aux usages du type de contrat
- Marque les stipulations déséquilibrées, avec la reformulation proposée
- Apprend des modèles du cabinet pour rester dans son style

## Points faibles
- Entraîné d'abord sur le droit anglo-saxon : à manier avec prudence en droit français
- Toute proposition demande une relecture, la responsabilité restant entière
- Le transfert de documents confidentiels chez un tiers appelle une vérification contractuelle

## Idéal pour
Les cabinets d'affaires et juristes d'entreprise qui rédigent et révisent des contrats toute la journée dans un traitement de texte.`,
    },
    {
      id: `predictice`,
      nom: `Predictice`,
      categorie: `Jurisprudence`,
      prix: `Sur devis`,
      description_courte: `La recherche et l'analyse de jurisprudence françaises, avec les tendances chiffrées par juridiction et par type de litige.`,
      lien_affiliation: `https://exemple-affiliation.com/go/predictice`,
      score_avis: 4.3,
      description_longue: `## Notre verdict
Predictice apporte au dossier français ce qu'aucune base classique ne donne : la statistique. Sur un contentieux prud'homal, l'outil montre la distribution des indemnités accordées, les écarts entre cours d'appel et les arguments qui reviennent dans les décisions favorables. Ce n'est pas une prédiction du résultat, c'est un ordre de grandeur défendable devant un client qui demande combien il peut espérer.

## Points forts
- Statistiques par juridiction et par type de litige, chiffrées et sourcées
- Recherche en langage naturel sur un fonds jurisprudentiel français complet
- Analyse d'une pièce ou de conclusions adverses avec remontée des décisions voisines
- Argument concret pour cadrer les attentes d'un client

## Points faibles
- Une statistique ne dit rien du dossier particulier, et le client l'entend souvent autrement
- Certaines matières restent trop peu pourvues en décisions publiées
- Coût par utilisateur significatif pour une petite structure

## Idéal pour
Les avocats en contentieux de masse — social, dommage corporel, baux — qui doivent chiffrer une espérance de gain avant d'engager une procédure.`,
    },
    {
      id: `juro`,
      nom: `Juro`,
      categorie: `Gestion contractuelle`,
      prix: `Sur devis`,
      description_courte: `Le contrat de bout en bout : rédaction, négociation, signature et échéances suivies, sans repasser par la pièce jointe.`,
      lien_affiliation: `https://exemple-affiliation.com/go/juro`,
      score_avis: 4.2,
      description_longue: `## Notre verdict
Juro remplace le cycle de vie contractuel par pièces jointes — dix versions d'un même document dans autant de boîtes mail — par un espace unique où le contrat se rédige, se négocie, se signe et se surveille. La partie intelligente résume les écarts entre versions, extrait les engagements et alerte sur les échéances de renouvellement, celles que tout le monde découvre trop tard.

## Points forts
- Un seul document vivant, du modèle à la signature
- Résumé automatique des modifications proposées par la partie adverse
- Alertes sur les échéances et les reconductions tacites
- Modèles en libre service pour les équipes opérationnelles, sous contrôle juridique

## Points faibles
- Adapté aux contrats répétitifs, moins aux opérations sur mesure
- Bascule des contrats existants longue et rarement complète
- Suppose que les équipes commerciales acceptent de quitter le traitement de texte

## Idéal pour
Les directions juridiques de croissance dont le volume de contrats standards explose et qui deviennent le point de blocage de l'entreprise.`,
    },
    {
      id: `ironclad`,
      nom: `Ironclad`,
      categorie: `Gestion contractuelle`,
      prix: `Sur devis`,
      description_courte: `La plateforme contractuelle des grandes organisations : circuits d'approbation, référentiel unique et analyse du portefeuille.`,
      lien_affiliation: `https://exemple-affiliation.com/go/ironclad`,
      score_avis: 4.1,
      description_longue: `## Notre verdict
Ironclad vise l'échelle : des milliers de contrats, des dizaines d'approbateurs et des règles d'engagement qui varient selon le montant, le pays et le type d'accord. L'assistant y sert à extraire les données du portefeuille, à répondre à des questions sur ce que l'entreprise a signé et à automatiser les circuits. C'est de l'outillage de direction juridique structurée, pas un assistant de rédaction.

## Points forts
- Circuits d'approbation modélisables finement, sans développement
- Référentiel unique interrogeable : on sait enfin ce qui a été signé
- Extraction structurée des engagements sur tout le portefeuille
- Intégrations solides avec les outils commerciaux et financiers

## Points faibles
- Projet de déploiement lourd, à compter en trimestres
- Coût réservé aux grandes organisations
- Rigidité perçue par les équipes commerciales au début

## Idéal pour
Les directions juridiques de groupes internationaux qui ne savent plus combien de contrats sont en cours ni ce qu'ils engagent.`,
    },
    {
      id: `lexis-plus-ai`,
      nom: `Lexis+ AI`,
      categorie: `Recherche juridique`,
      prix: `Sur devis`,
      description_courte: `La recherche juridique adossée à un fonds éditorial vérifié, avec des réponses rédigées et systématiquement référencées.`,
      lien_affiliation: `https://exemple-affiliation.com/go/lexis-plus-ai`,
      score_avis: 4.2,
      description_longue: `## Notre verdict
L'argument de Lexis+ AI est celui de la source : les réponses s'appuient sur un fonds éditorial contrôlé, et chaque affirmation renvoie à un document consultable. Sur une matière où une citation inventée peut coûter une sanction disciplinaire, cette contrainte de traçabilité vaut plus que l'élégance de la rédaction. L'outil produit aussi des trames d'argumentaire et des synthèses de dossier.

## Points forts
- Réponses systématiquement rattachées à une source consultable
- Fonds éditorial et doctrine intégrés, pas seulement la jurisprudence brute
- Synthèses de dossier et trames d'argumentation dans le même environnement
- Éditeur établi, avec les garanties contractuelles qui vont avec

## Points faibles
- Fonds français moins complet que celui des acteurs spécialisés locaux
- Abonnement onéreux, indexé sur le nombre d'utilisateurs
- Interface héritée d'un outil documentaire ancien, moins fluide que les nouveaux venus

## Idéal pour
Les cabinets déjà abonnés à l'écosystème LexisNexis, qui veulent une recherche augmentée sans changer de fournisseur documentaire.`,
    },
    {
      id: `ordalie`,
      nom: `Ordalie`,
      categorie: `Assistant juridique`,
      prix: `Gratuit (10 requêtes/semaine), puis à partir de 46 € HT/mois`,
      description_courte: `L'IA juridique entraînée sur le droit français, hébergée en France, au tarif d'un avocat seul et non d'un cabinet d'affaires.`,
      lien_affiliation: `https://exemple-affiliation.com/go/ordalie`,
      score_avis: 4.4,
      description_longue: `## Notre verdict
La plupart des IA juridiques sérieuses se vendent au cabinet, par contrat annuel, à des montants qui excluent d'emblée l'avocat installé seul. Ordalie prend le problème par l'autre bout : un palier gratuit permanent, un abonnement à deux chiffres, aucun engagement long. Les modèles sont entraînés sur le droit français et l'hébergement est en France sous certification ISO 27001 — deux points qui, en 2026, ne sont plus des arguments commerciaux mais des conditions d'exercice. Partenariat officiel avec le Barreau de Paris depuis 2024.

## Points forts
- Palier gratuit permanent : dix requêtes par semaine, de quoi se faire un avis réel
- Modèles entraînés spécifiquement sur le droit français, pas traduits de l'anglais
- Hébergement en France, certification ISO 27001
- Extraction, océrisation, analyse de jurisprudence et génération de clauses dans un seul outil
- Essai complet de quatorze jours, sans engagement

## Points faibles
- Aucune intégration native avec les logiciels de gestion de cabinet : le va-et-vient reste manuel
- Ni facturation ni agenda automatisés — ce n'est pas un outil de gestion
- Les tarifs annoncés varient selon les sources : à confirmer au moment de souscrire
- L'analyse prédictive est annoncée pour 2026, elle n'est pas encore là

## Idéal pour
L'avocat seul, le jeune confrère qui s'installe et les cabinets de deux ou trois personnes, qui veulent une IA juridique française sans engager le budget d'un grand cabinet.`,
    },
    {
      id: `jimini-ai`,
      nom: `Jimini AI`,
      categorie: `Analyse de contrats`,
      prix: `Sur devis`,
      description_courte: `La revue de contrat par une IA française à hébergement de santé certifié, adossée à un partenariat avec le Barreau de Paris.`,
      lien_affiliation: `https://exemple-affiliation.com/go/jimini-ai`,
      score_avis: 4.3,
      description_longue: `## Notre verdict
Jimini s'est fait une place sur la revue de contrats en misant sur ce que les grands acteurs anglophones ne peuvent pas offrir : un hébergement souverain certifié et un ancrage professionnel local. Le partenariat avec le Barreau de Paris, qui a ouvert un accès gratuit de trois mois aux cabinets de un à vingt avocats, en dit long sur le positionnement — se faire adopter par les petites structures plutôt que conquérir les cabinets d'affaires. Fondée en 2023 à Paris.

## Points forts
- Hébergement souverain certifié, argument décisif sur des données clients sensibles
- Spécialisation revue de contrat, plutôt qu'un assistant généraliste dilué
- Partenariat avec le Barreau de Paris, avec accès d'essai pour les petits cabinets
- Éditeur français, interlocuteur joignable dans le même fuseau

## Points faibles
- Aucun tarif public : il faut passer par un devis
- Jeune éditeur, moins de recul que les acteurs installés
- Périmètre contractuel : ne remplace pas un outil de recherche jurisprudentielle
- Le marché se consolide vite, et l'indépendance des petits acteurs n'est jamais acquise

## Idéal pour
Les cabinets et directions juridiques qui traitent du contrat en volume et pour qui la localisation des données n'est pas négociable.`,
    },
    {
      id: `genia-l`,
      nom: `GenIA-L (Lefebvre Dalloz)`,
      categorie: `Recherche juridique`,
      prix: `À partir d'environ 250 € HT/mois par utilisateur`,
      description_courte: `L'assistant qui ne répond que sur le fonds documentaire Dalloz et Francis Lefebvre — jamais sur ce qu'un modèle croit savoir.`,
      lien_affiliation: `https://exemple-affiliation.com/go/genia-l`,
      score_avis: 4.4,
      description_longue: `## Notre verdict
La faiblesse structurelle d'une IA généraliste en droit est qu'elle produit des références plausibles. GenIA-L répond au problème par la contrainte : l'assistant ne puise que dans le fonds propriétaire de l'éditeur — Dalloz, Francis Lefebvre, Éditions Législatives — et rien d'autre. On échange de la couverture contre de la fiabilité, ce qui est le bon sens du métier. Lancé en mars 2024, complété fin 2025 par un module de dépôt de documents et d'aide à la rédaction.

## Points forts
- Réponses adossées à un fonds documentaire de référence, vérifiable
- Continuité avec des sources que la profession utilise déjà quotidiennement
- Module d'aide à la rédaction et de dépôt de documents depuis fin 2025
- Éditeur établi de longue date : pérennité rarement en cause

## Points faibles
- Tarif élevé pour un praticien seul, à partir d'environ 250 € HT par mois
- Enfermé dans un fonds propriétaire : ce qui n'y est pas n'existe pas pour l'assistant
- Suppose un abonnement à l'écosystème de l'éditeur pour tirer la pleine valeur
- Moins agile que les jeunes acteurs sur les fonctions récentes

## Idéal pour
Les cabinets et directions juridiques déjà installés dans l'écosystème Lefebvre Dalloz, qui veulent une recherche augmentée sans jamais quitter des sources qu'ils peuvent citer.`,
    },
    {
      id: `legora`,
      nom: `Legora`,
      categorie: `Assistant juridique`,
      prix: `Sur devis — environ 3 000 $/utilisateur/an, minimum dix postes`,
      description_courte: `L'assistant collaboratif qui a percé chez les grands cabinets européens, vendu par lots de dix postes minimum.`,
      lien_affiliation: `https://exemple-affiliation.com/go/legora`,
      score_avis: 4.2,
      description_longue: `## Notre verdict
Legora s'est imposé en quelques années comme l'alternative européenne aux assistants juridiques américains, avec une approche collaborative : le travail se fait à plusieurs sur les mêmes documents, revues et tableaux d'analyse. Le modèle commercial ne laisse aucune ambiguïté sur la cible — un plancher de dix postes et un engagement annuel écartent d'emblée les petites structures. Les montants ne sont pas publiés : ceux qui circulent viennent d'acheteurs et de rapports de marché.

## Points forts
- Pensé pour le travail à plusieurs sur un même dossier, pas pour l'usage solitaire
- Adoption documentée dans de grands cabinets européens
- Tableaux d'analyse comparée de documents, utiles en due diligence
- Alternative européenne crédible aux plateformes américaines

## Points faibles
- Plancher de dix postes : inaccessible en dessous d'une certaine taille
- Tarif non public, et les estimations varient du simple au double selon les sources
- Frais de mise en œuvre et de formation en supplément
- Engagement annuel, peu compatible avec un essai prudent

## Idéal pour
Les cabinets d'au moins dix juristes qui travaillent à plusieurs sur des dossiers documentaires lourds, et qui veulent un éditeur européen.`,
    },
    {
      id: `cocounsel`,
      nom: `CoCounsel (Thomson Reuters)`,
      categorie: `Assistant juridique`,
      prix: `Sur devis`,
      description_courte: `L'assistant juridique adossé au fonds Thomson Reuters, taillé pour les tâches longues : revue de pièces, synthèse, recherche.`,
      lien_affiliation: `https://exemple-affiliation.com/go/cocounsel`,
      score_avis: 4.1,
      description_longue: `## Notre verdict
Né chez Casetext puis passé sous pavillon Thomson Reuters, CoCounsel est l'un des rares assistants juridiques à avoir été éprouvé à grande échelle avant la vague générative actuelle. Sa force est le travail de fond : revue de lots de pièces, synthèse de dépositions, préparation de recherche — les tâches qui mangent des soirées entières. Sa limite pour un praticien français est franche : le fonds documentaire et les usages visés sont d'abord ceux du droit américain.

## Points forts
- Adossé à un fonds documentaire et à un éditeur de premier plan
- Efficace sur les tâches longues et répétitives plutôt que sur la seule question ponctuelle
- Recul d'usage supérieur à la plupart des concurrents
- Intégré à un écosystème professionnel déjà en place dans beaucoup de structures

## Points faibles
- Orientation nette vers le droit américain : la pertinence chute sur des questions de droit français
- Aucun tarif public, contrat négocié
- Suppose l'écosystème de l'éditeur pour être rentable
- Peu adapté à un cabinet français qui ne traite pas de dossiers internationaux

## Idéal pour
Les structures qui traitent des dossiers de droit américain ou internationaux, et qui cherchent à absorber de gros volumes de pièces sans y passer les nuits.`,
    },
  ],

  education: [
    {
      id: `brisk-teaching`,
      nom: `Brisk Teaching`,
      categorie: `Évaluation`,
      prix: `Freemium — à partir de 10 $/mois`,
      description_courte: `Les retours sur copie rédigés directement dans le document de l'élève, et l'historique de rédaction qui montre comment il a écrit.`,
      lien_affiliation: `https://exemple-affiliation.com/go/brisk-teaching`,
      score_avis: 4.5,
      description_longue: `## Notre verdict
Brisk s'installe dans le navigateur et travaille là où sont les copies. Il rédige un retour argumenté sur un devoir, selon les critères de la grille, et propose une note motivée que l'enseignant ajuste. Sa fonction la plus utile est ailleurs : rejouer l'historique de rédaction d'un document partagé, qui montre si le texte a été écrit ou collé d'un bloc. La question du travail personnel se règle par une observation, pas par un soupçon.

## Points forts
- Retours rédigés selon la grille d'évaluation fournie, pas selon un standard générique
- Rejeu de l'historique de rédaction : une réponse mesurable au copier-coller
- Fonctionne dans les outils de travail déjà utilisés en classe
- Version gratuite généreuse, adoptée massivement par les enseignants

## Points faibles
- Dépend d'un environnement de documents partagés en ligne
- Les retours doivent être relus : le ton passe parfois à côté de l'élève
- Interface et exemples calibrés sur les usages nord-américains

## Idéal pour
Les enseignants qui corrigent des copies rédigées en ligne et passent leurs soirées à écrire des appréciations individualisées.`,
    },
    {
      id: `curipod`,
      nom: `Curipod`,
      categorie: `Activités interactives`,
      prix: `Freemium — à partir de 10 $/mois`,
      description_courte: `Une séance interactive complète générée à partir d'un sujet : questions, sondages, nuages de mots et débats, projetables tout de suite.`,
      lien_affiliation: `https://exemple-affiliation.com/go/curipod`,
      score_avis: 4.3,
      description_longue: `## Notre verdict
Curipod produit en une minute ce qu'on met une heure à préparer : une séance interactive où les élèves répondent depuis leur appareil — question ouverte, sondage, nuage de mots, prise de position à défendre. L'enseignant garde la main sur le déroulé et voit les réponses arriver en direct, ce qui transforme le cours magistral en séance où chacun a dû se prononcer.

## Points forts
- Séance complète générée à partir d'un simple sujet et d'un niveau
- Participation de toute la classe, y compris les élèves qui ne lèvent jamais la main
- Réponses visibles en direct : les malentendus se voient immédiatement
- Prise en main en dix minutes, sans formation

## Points faibles
- Suppose un appareil connecté par élève ou par binôme
- Les contenus générés demandent une relecture disciplinaire
- La version gratuite limite le nombre de séances enregistrées

## Idéal pour
Les enseignants du secondaire qui veulent réveiller une classe passive sans y consacrer une heure de préparation par séance.`,
    },
    {
      id: `twee`,
      nom: `Twee`,
      categorie: `Langues vivantes`,
      prix: `Freemium — à partir de 10 $/mois`,
      description_courte: `La boîte à outils du professeur de langues : exercices, dialogues, questions de compréhension bâtis autour d'une vidéo ou d'un texte.`,
      lien_affiliation: `https://exemple-affiliation.com/go/twee`,
      score_avis: 4.4,
      description_longue: `## Notre verdict
Twee est conçu pour une seule discipline et cela se voit : à partir d'une vidéo en ligne, d'un texte ou d'un simple thème, il produit des questions de compréhension orale, des textes à trous, des listes lexicales, des amorces de discussion et des dialogues calibrés par niveau du cadre européen. Ce que le professeur de langues fabrique à la main chaque semaine se prépare en quelques minutes.

## Points forts
- Génération à partir d'une vidéo en ligne, avec la transcription exploitée
- Calibrage explicite par niveau du cadre européen de référence
- Couvre l'oral, l'écrit, le lexique et la grammaire dans un même outil
- Version gratuite suffisante pour un usage hebdomadaire raisonnable

## Points faibles
- Centré sur l'anglais, plus léger sur les autres langues
- Les exercices générés se ressemblent si l'on ne varie pas les consignes
- Aucune gestion de classe ni de suivi des élèves

## Idéal pour
Les professeurs de langues qui construisent leurs supports à partir de documents authentiques et refont ce travail chaque semaine.`,
    },
    {
      id: `gamma`,
      nom: `Gamma`,
      categorie: `Supports de cours`,
      prix: `Freemium — à partir de 10 $/mois`,
      description_courte: `Le support de présentation mis en forme tout seul : on écrit le plan, la mise en page suit sans qu'on y touche.`,
      lien_affiliation: `https://exemple-affiliation.com/go/gamma`,
      score_avis: 4.5,
      description_longue: `## Notre verdict
Gamma supprime l'étape qui décourage : la mise en page. On donne un plan, un document ou un thème, et l'outil produit un support structuré, illustré et cohérent, qui reste modifiable bloc par bloc. Le résultat se projette, se partage en ligne ou s'exporte. Pour un enseignant ou un formateur, c'est deux heures de mise en forme récupérées par séquence.

## Points forts
- Mise en page automatique qui tient debout, sans travail de gabarit
- Génération à partir d'un document existant : un cours rédigé devient un support
- Support consultable en ligne, avec un suivi de ce qui a été vu
- Export vers les formats de présentation habituels

## Points faibles
- L'esthétique par défaut est reconnaissable d'un support à l'autre
- Les illustrations générées demandent souvent un remplacement
- La formule gratuite marque les documents et limite les crédits

## Idéal pour
Les formateurs et enseignants qui produisent beaucoup de supports et passent plus de temps à les mettre en forme qu'à les écrire.`,
    },
    {
      id: `schoolai`,
      nom: `SchoolAI`,
      categorie: `Tutorat`,
      prix: `Freemium — sur devis pour un établissement`,
      description_courte: `Des espaces d'échange encadrés pour les élèves, dont l'enseignant voit tout : ce qui est demandé, ce qui bloque, ce qui dérape.`,
      lien_affiliation: `https://exemple-affiliation.com/go/schoolai`,
      score_avis: 4.2,
      description_longue: `## Notre verdict
Laisser des élèves dialoguer librement avec une intelligence artificielle est un problème de responsabilité avant d'être un problème pédagogique. SchoolAI crée des espaces cadrés par l'enseignant, sur un objectif précis, dont il garde la visibilité complète : chaque échange est consultable, et les signaux inquiétants sont remontés. C'est ce qui rend l'usage défendable devant une direction et devant des familles.

## Points forts
- Visibilité complète de l'enseignant sur les échanges de la classe
- Espaces cadrés par objectif : l'outil ne sort pas du sujet de la séance
- Remontée des signaux de détresse et des usages problématiques
- Tableau de bord des blocages, élève par élève

## Points faibles
- Contenus et programmes alignés sur le système éducatif américain
- Le cadre réglementaire européen sur les données des mineurs demande une vérification préalable
- L'établissement doit trancher une politique d'usage avant tout déploiement

## Idéal pour
Les établissements qui veulent autoriser un usage encadré plutôt que d'interdire un outil que les élèves utilisent déjà en dehors du cours.`,
    },
  ],

  restauration: [
    {
      id: `zenchef`,
      nom: `Zenchef`,
      categorie: `Réservation`,
      prix: `À partir de 100 €/mois`,
      description_courte: `Le carnet de réservation français qui remplit les creux tout seul : optimisation des tables, rappels, relances des habitués.`,
      lien_affiliation: `https://exemple-affiliation.com/go/zenchef`,
      score_avis: 4.3,
      description_longue: `## Notre verdict
Zenchef gère la réservation sans commission par couvert, ce qui change l'équation économique face aux plateformes. Sa partie intelligente travaille sur le plan de salle — quelle table pour quel groupe, à quelle heure, pour maximiser le nombre de services — et sur la relance des clients qui ne sont pas revenus depuis trois mois. Deux couverts récupérés par service suffisent à payer l'abonnement.

## Points forts
- Aucune commission par couvert, contrairement aux places de marché
- Optimisation du plan de salle et des créneaux de rotation
- Relances et rappels automatiques : moins de tables réservées et vides
- Solution française, avec un support qui répond dans la langue du restaurateur

## Points faibles
- Abonnement fixe, à assumer même sur un mois creux
- Ne remplace pas la visibilité d'une place de marché sur la clientèle de passage
- Le paramétrage du plan de salle demande un temps de mise en route

## Idéal pour
Les établissements qui vivent d'une clientèle d'habitués et veulent réduire leur dépendance aux plateformes qui prélèvent sur chaque couvert.`,
    },
    {
      id: `popmenu`,
      nom: `Popmenu`,
      categorie: `Marketing & tendances`,
      prix: `À partir de 150 $/mois`,
      description_courte: `Le site, la carte interactive et le marketing dans un seul outil, avec les réponses aux avis rédigées automatiquement.`,
      lien_affiliation: `https://exemple-affiliation.com/go/popmenu`,
      score_avis: 4.1,
      description_longue: `## Notre verdict
Popmenu part d'un constat simple : la carte est la page la plus consultée d'un restaurant, et presque toujours un PDF illisible sur téléphone. L'outil en fait une page interactive, où chaque plat a ses photos et ses avis, et se sert de ces données pour alimenter le marketing — courriels, messages texte, publications, réponses aux avis en ligne rédigées dans le ton de la maison.

## Points forts
- Carte interactive et référençable, là où un PDF n'apporte aucun trafic
- Réponses aux avis rédigées automatiquement, ce que personne ne fait sérieusement
- Courriels et messages texte déclenchés sur le comportement réel des clients
- Site, carte, réservation et marketing dans un même abonnement

## Points faibles
- Facturation mensuelle élevée pour un établissement indépendant
- Fonctionnalités calibrées pour le marché américain
- Migrer un site existant vers leur plateforme est un engagement de long terme

## Idéal pour
Les restaurants et petites chaînes dont la présence en ligne se limite à une carte en PDF et à une page sociale mise à jour de loin en loin.`,
    },
    {
      id: `nory`,
      nom: `Nory`,
      categorie: `Prévision & planning`,
      prix: `Sur devis`,
      description_courte: `La prévision des ventes qui pilote le planning et les commandes : le bon nombre de personnes en salle, le bon volume en cuisine.`,
      lien_affiliation: `https://exemple-affiliation.com/go/nory`,
      score_avis: 4.4,
      description_longue: `## Notre verdict
Les deux postes qui font ou défont la marge d'un restaurant sont la masse salariale et la matière. Nory prévoit les ventes à l'heure près en croisant historique, météo, événements locaux et jours fériés, puis en déduit le planning et les commandes. Les établissements équipés parlent couramment de plusieurs points de marge récupérés — non pas en coupant, mais en cessant de sur-staffer les services calmes.

## Points forts
- Prévision à l'heure, pas à la journée : le planning colle enfin au flux réel
- Planning proposé automatiquement, dans le respect des contraintes de contrats
- Commandes fournisseurs calées sur les ventes prévues
- Comparaison entre établissements pour les groupes multi-sites

## Points faibles
- Exige plusieurs mois d'historique de caisse propre avant d'être fiable
- Une ouverture ou un changement de carte fait perdre en précision
- Modèle économique orienté groupes et chaînes

## Idéal pour
Les groupes de restauration dont la masse salariale dérive service après service, sans que personne ne sache dire de combien ni pourquoi.`,
    },
    {
      id: `tenzo`,
      nom: `Tenzo`,
      categorie: `Pilotage`,
      prix: `À partir de 100 £/mois par établissement`,
      description_courte: `Tous les chiffres du restaurant réunis dans un tableau de bord, avec l'alerte envoyée quand quelque chose sort de l'ordinaire.`,
      lien_affiliation: `https://exemple-affiliation.com/go/tenzo`,
      score_avis: 4.2,
      description_longue: `## Notre verdict
Tenzo agrège la caisse, le planning, les stocks et les avis en ligne dans un même tableau de bord, et surtout envoie une alerte quand un indicateur décroche — coût matière qui grimpe, ticket moyen qui baisse, note d'avis qui chute sur un établissement. C'est le passage du reporting hebdomadaire que personne ne lit au signal qui arrive au moment où l'on peut encore agir.

## Points forts
- Connecte les logiciels de caisse et de planning déjà en place
- Alertes envoyées sur téléphone, plutôt qu'un rapport à aller consulter
- Comparaison entre établissements d'un même groupe, sur des bases homogènes
- Prévision de ventes correcte pour un outil de pilotage généraliste

## Points faibles
- Sans données de caisse propres, les indicateurs mentent
- Facturé par établissement : le coût grimpe vite sur un réseau
- Moins fin que les outils spécialisés sur le planning et la matière

## Idéal pour
Les gérants de plusieurs établissements qui découvrent les mauvais chiffres en fin de mois, quand il n'y a plus rien à corriger.`,
    },
    {
      id: `marketman`,
      nom: `MarketMan`,
      categorie: `Achats & stocks`,
      prix: `À partir de 200 $/mois`,
      description_courte: `Les achats, les stocks et le coût réel de chaque plat suivis en continu, factures fournisseurs lues automatiquement.`,
      lien_affiliation: `https://exemple-affiliation.com/go/marketman`,
      score_avis: 4.0,
      description_longue: `## Notre verdict
MarketMan lit les factures fournisseurs, met à jour les prix d'achat et recalcule le coût de revient de chaque plat au fil des hausses. Dans un contexte où les prix bougent tous les mois, c'est la seule façon de savoir qu'un plat vedette est passé sous le seuil de rentabilité sans que personne ne s'en aperçoive. Les commandes se déclenchent ensuite sur les seuils réels de consommation.

## Points forts
- Coût de revient recalculé automatiquement à chaque variation de prix d'achat
- Factures fournisseurs lues et rapprochées des bons de livraison
- Commandes proposées sur la base des consommations constatées
- Détection des écarts entre livré et facturé, poste où l'on perd sans le voir

## Points faibles
- Le paramétrage initial des fiches techniques est un travail long et ingrat
- Sans inventaires réguliers, les stocks théoriques dérivent vite
- Tarif difficile à absorber pour un établissement unique

## Idéal pour
Les restaurants et groupes dont le coût matière dérive et qui n'ont aucune fiche technique à jour pour comprendre où part la marge.`,
    },
  ],

  sante: [
    {
      id: `abridge`,
      nom: `Abridge`,
      categorie: `Compte rendu de consultation`,
      prix: `Sur devis (établissements)`,
      description_courte: `La consultation transcrite et structurée en note clinique, chaque phrase reliée au moment de l'enregistrement dont elle provient.`,
      lien_affiliation: `https://exemple-affiliation.com/go/abridge`,
      score_avis: 4.5,
      description_longue: `## Notre verdict
Abridge se distingue sur un point qui compte en santé : chaque élément de la note produite renvoie au passage exact de l'échange dont il est tiré. Le praticien qui doute d'une posologie retrouve la phrase en un clic, au lieu d'accorder une confiance aveugle à un résumé. C'est ce lien de traçabilité qui a permis un déploiement large en établissement.

## Points forts
- Traçabilité de chaque affirmation vers le moment enregistré correspondant
- Note structurée poussée directement dans le dossier patient informatisé
- Prise en charge du dialogue à plusieurs voix, patient et accompagnant
- Déploiements hospitaliers documentés, avec des mesures de temps gagné

## Points faibles
- Vendu aux établissements : inaccessible à un cabinet de ville isolé
- Prise en charge du français en retrait de celle de l'anglais
- Consentement du patient et hébergement des données à instruire avant tout usage

## Idéal pour
Les établissements et grands groupes de soins qui veulent réduire le temps de documentation clinique sans changer de dossier patient.`,
    },
    {
      id: `dax-copilot`,
      nom: `DAX Copilot`,
      categorie: `Compte rendu de consultation`,
      prix: `Sur devis (établissements)`,
      description_courte: `L'assistant de documentation clinique de Microsoft et Nuance, intégré au dossier patient déjà en place.`,
      lien_affiliation: `https://exemple-affiliation.com/go/dax-copilot`,
      score_avis: 4.3,
      description_longue: `## Notre verdict
DAX Copilot rédige la note de consultation à partir de l'échange, et son atout principal est l'intégration : dans les établissements équipés des dossiers patients majeurs, la note apparaît directement au bon endroit, sans copier-coller. Nuance travaille la reconnaissance vocale médicale depuis vingt ans, et cela s'entend sur la terminologie et les abréviations cliniques.

## Points forts
- Intégration native aux principaux dossiers patients informatisés
- Reconnaissance du vocabulaire médical héritée de vingt ans de dictée
- Adossé à un éditeur avec les garanties contractuelles attendues en santé
- Notes adaptées par spécialité, pas un gabarit unique

## Points faibles
- Achat d'établissement, avec un cycle de décision long
- Couverture francophone plus récente que l'anglophone
- Nécessite un environnement Microsoft déjà en place pour être pleinement utile

## Idéal pour
Les hôpitaux et cliniques déjà engagés dans l'écosystème Microsoft, qui cherchent à réduire la charge de documentation de leurs praticiens.`,
    },
    {
      id: `gleamer`,
      nom: `Gleamer`,
      categorie: `Imagerie médicale`,
      prix: `Sur devis`,
      description_courte: `La détection des fractures sur radiographie, en seconde lecture : ce que l'œil laisse passer en fin de garde.`,
      lien_affiliation: `https://exemple-affiliation.com/go/gleamer`,
      score_avis: 4.4,
      description_longue: `## Notre verdict
Gleamer, éditeur français, a d'abord traité un problème précis et fréquent : les fractures manquées sur radiographie standard, particulièrement aux urgences et en fin de garde. L'outil signale les zones suspectes en seconde lecture, avec des performances validées cliniquement. La gamme s'est étendue au thorax et à la mesure osseuse, mais c'est le module de traumatologie qui a fait sa réputation.

## Points forts
- Performances validées cliniquement et marquage médical européen
- Seconde lecture immédiate, particulièrement utile en garde et aux urgences
- S'insère dans le système d'archivage sans changer les habitudes de lecture
- Éditeur français, avec un hébergement de données conforme au cadre local

## Points faibles
- Les faux positifs demandent un temps de vérification qu'il faut accepter
- Chaque module se négocie séparément, le périmètre monte vite en coût
- Achat d'établissement, hors de portée d'un cabinet isolé

## Idéal pour
Les services d'urgence et les cabinets de radiologie de garde, où la fatigue de fin de nuit est un facteur de risque documenté.`,
    },
    {
      id: `lifen`,
      nom: `Lifen`,
      categorie: `Courriers médicaux`,
      prix: `Sur devis`,
      description_courte: `Le courrier médical envoyé au bon confrère par le bon canal, sans secrétariat qui cherche une adresse ni fax qui bloque.`,
      lien_affiliation: `https://exemple-affiliation.com/go/lifen`,
      score_avis: 4.3,
      description_longue: `## Notre verdict
Lifen s'attaque à une plaie administrative française : le compte rendu qui n'arrive pas au médecin traitant. L'outil identifie automatiquement le destinataire dans l'annuaire santé, choisit le canal disponible — messagerie sécurisée, dossier partagé, courrier papier en dernier recours — et trace l'envoi. Ce n'est pas spectaculaire, c'est simplement le poste où un secrétariat perd le plus de temps.

## Points forts
- Identification automatique du destinataire dans l'annuaire national
- Choix du canal d'envoi géré tout seul, papier compris si nécessaire
- Traçabilité complète des envois, opposable en cas de litige
- Intégration aux logiciels hospitaliers français

## Points faibles
- Utile surtout dans le contexte réglementaire français
- Déploiement à mener avec la direction des systèmes d'information
- L'annuaire national comporte des données obsolètes qui ressortent

## Idéal pour
Les établissements et cabinets de groupe dont les secrétariats passent leurs journées à chercher des adresses de confrères et à relancer des envois.`,
    },
    {
      id: `therapixel`,
      nom: `Therapixel`,
      categorie: `Imagerie médicale`,
      prix: `Sur devis`,
      description_courte: `La seconde lecture en dépistage du cancer du sein, sur des performances mesurées lors de comparaisons internationales.`,
      lien_affiliation: `https://exemple-affiliation.com/go/therapixel`,
      score_avis: 4.2,
      description_longue: `## Notre verdict
Therapixel s'est fait connaître en se classant en tête d'une comparaison internationale sur la lecture de mammographies. L'outil assiste la seconde lecture du dépistage organisé, poste où la double lecture humaine est obligatoire et où la démographie médicale rend cette obligation difficile à tenir. Le radiologue garde évidemment la décision : l'outil trie et signale.

## Points forts
- Performances établies sur des jeux de données de comparaison publics
- Répond à une tension réelle de démographie médicale sur le dépistage organisé
- Marquage médical européen et éditeur français
- S'intègre aux stations de lecture existantes

## Points faibles
- Périmètre volontairement étroit : la mammographie et rien d'autre
- Cadre du dépistage organisé strictement encadré, l'usage se négocie institutionnellement
- Achat de structure, sans version d'essai possible

## Idéal pour
Les centres de radiologie et structures de gestion du dépistage organisé, confrontés à la raréfaction des lecteurs disponibles.`,
    },
    {
      id: `heidi-health`,
      nom: `Heidi Health`,
      categorie: `Compte rendu de consultation`,
      prix: `Gratuit, puis environ 150 $/mois par praticien`,
      description_courte: `Le compte rendu rédigé pendant que la consultation se déroule, avec un palier gratuit qui suffit pour se faire un avis.`,
      lien_affiliation: `https://exemple-affiliation.com/go/heidi-health`,
      score_avis: 4.4,
      description_longue: `## Notre verdict
Heidi est l'un des rares assistants de consultation qu'on peut essayer sérieusement sans engager un euro : le palier gratuit couvre les consultations et la dictée sans limite de nombre. C'est décisif dans un métier où l'on ne change pas d'outil sur une démonstration commerciale. Le rebrand de février 2026 a fait passer l'abonnement praticien d'environ 99 à 150 $ par mois, et il faut le savoir avant de bâtir une habitude dessus.

## Points forts
- Palier gratuit réellement utilisable : consultations et dictée sans plafond
- Modèles de note personnalisables, adaptés à une spécialité précise
- Interface pensée pour être ouverte pendant l'échange, pas après
- Essai de quatorze jours sur l'offre payante, sans engagement

## Points faibles
- Le renvoi automatique vers le dossier patient n'est pas inclus dans l'offre praticien : la note se recopie à la main
- Les fonctions avancées du palier gratuit sont limitées à dix actions par mois
- Hausse tarifaire de 50 % en 2026, sur un outil qu'on adopte pour des années
- Pas d'ancrage français : l'accompagnement et les intégrations visent d'abord le monde anglophone

## Idéal pour
Le praticien qui veut éprouver un assistant de consultation sur ses vraies journées avant de payer, et qui accepte de recopier la note dans son logiciel métier.`,
    },
    {
      id: `freed-ai`,
      nom: `Freed`,
      categorie: `Compte rendu de consultation`,
      prix: `39 à 119 $/mois par praticien`,
      description_courte: `L'assistant de consultation au tarif le plus bas du marché, avec des paliers affichés publiquement — ce qui est rare ici.`,
      lien_affiliation: `https://exemple-affiliation.com/go/freed-ai`,
      score_avis: 4.2,
      description_longue: `## Notre verdict
Freed fait deux choses que ses concurrents évitent : il affiche ses prix, et il commence à 39 $. Dans un secteur où presque tous les tarifs passent par un rendez-vous commercial, c'est en soi un argument — on sait ce qu'on paiera avant d'avoir donné son numéro. Le palier d'entrée plafonne à quarante comptes rendus par mois, ce qui ne tient pas une activité à temps plein : la vraie comparaison se fait sur l'offre à 79 $, sans limite.

## Points forts
- Tarifs publics et lisibles, trois paliers, sans passage obligé par un commercial
- Palier à 79 $/mois sans limite de comptes rendus, taillé pour une activité quotidienne
- Essai de sept jours sans carte bancaire
- Le palier haut ajoute le renvoi vers le dossier patient et la proposition de codage

## Points faibles
- Le palier d'entrée à 39 $ plafonne à quarante notes : la plupart des praticiens le dépasseront
- Le renvoi vers le dossier patient n'arrive qu'à 119 $
- Outil conçu pour le système de santé américain, codage compris
- Pas d'hébergement de données de santé en France à ce jour

## Idéal pour
Le praticien seul qui veut un tarif connu d'avance et sans négociation, et qui documente en anglais ou accepte de relire une note en français produite par un outil anglophone.`,
    },
    {
      id: `suki-ai`,
      nom: `Suki`,
      categorie: `Compte rendu de consultation`,
      prix: `Environ 299 à 399 $/mois par praticien (tarif non public)`,
      description_courte: `L'assistant vocal qui documente et exécute : la note se dicte, mais les commandes aussi.`,
      lien_affiliation: `https://exemple-affiliation.com/go/suki-ai`,
      score_avis: 4.1,
      description_longue: `## Notre verdict
Suki ne se contente pas d'écouter la consultation : il obéit à la voix. Chercher un antécédent, préparer une ordonnance, remplir une rubrique du dossier se demandent à haute voix, sans lâcher le patient des yeux. C'est ce qui le sépare des simples rédacteurs de compte rendu — et ce qui justifie un tarif deux à trois fois supérieur. Encore faut-il que le logiciel métier soit de ceux qu'il sait piloter, ce qui reste rare hors des grands éditeurs américains.

## Points forts
- Commandes vocales au-delà de la dictée : navigation et actions dans le dossier
- Couverture large en spécialités, y compris chirurgicales
- Intégration profonde avec les dossiers patients des grands éditeurs
- Conçu pour l'usage en présence du patient, sans écran interposé

## Points faibles
- Le plus cher de sa catégorie, et le tarif n'est pas publié : il faut passer par un rendez-vous commercial
- Les montants qui circulent viennent de revendeurs, pas de l'éditeur : à confirmer au devis
- Contrat annuel par praticien, peu adapté à un essai individuel
- L'intérêt s'effondre si le logiciel métier n'est pas intégré : c'est la première question à poser

## Idéal pour
Les structures déjà équipées d'un dossier patient que Suki sait piloter, et qui cherchent à supprimer l'écran de la consultation plutôt qu'à seulement gagner du temps de frappe.`,
    },
    {
      id: `milvue`,
      nom: `Milvue`,
      categorie: `Imagerie médicale`,
      prix: `Sur devis (structures)`,
      description_courte: `La radiographie relue en quelques secondes sur sept pathologies osseuses et pulmonaires, dans le flux de travail existant.`,
      lien_affiliation: `https://exemple-affiliation.com/go/milvue`,
      score_avis: 4.4,
      description_longue: `## Notre verdict
Milvue est française, et cela se voit dans la façon dont elle se pose : pas de station séparée, pas de second écran à consulter, l'analyse arrive dans l'outil de lecture déjà en place. Deux modules déployables indépendamment — l'un pour les urgences, l'autre pour la lecture experte — couvrent sept pathologies osseuses et pulmonaires et les mesures ostéo-articulaires associées. Le réseau coopératif Vidi, plus de mille radiologues, l'a référencée pour ses centres : c'est le genre de choix qui vaut plus qu'une plaquette.

## Points forts
- Éditeur français, interlocuteur et hébergement dans le même cadre réglementaire que vous
- S'insère dans les stations de lecture existantes, sans changer les habitudes
- Deux modules séparables : urgences ou lecture experte, selon le besoin réel
- Référencée par un réseau coopératif de plus de soixante centres

## Points faibles
- Périmètre assumé : radiologie conventionnelle, os et poumon, rien au-delà
- Aucun tarif public, achat de structure : ni essai individuel ni décision rapide
- L'installation suppose un projet avec l'informatique de l'établissement
- Un radiologue seul en cabinet n'est pas la cible

## Idéal pour
Les services d'urgences et les centres de radiologie conventionnelle qui veulent sécuriser la première lecture aux heures creuses, sans remplacer leur chaîne de travail.`,
    },
    {
      id: `synapse-medicine`,
      nom: `Synapse Medicine`,
      categorie: `Information médicament`,
      prix: `Sur devis`,
      description_courte: `La question médicamenteuse tranchée sur les sources officielles — ANSM, HAS, base publique — et non sur ce qu'un modèle a retenu.`,
      lien_affiliation: `https://exemple-affiliation.com/go/synapse-medicine`,
      score_avis: 4.5,
      description_longue: `## Notre verdict
Sur le médicament, une réponse plausible est plus dangereuse qu'une absence de réponse. Synapse tranche ce problème par la source : posologies, contre-indications, interactions et effets indésirables sont adossés à l'ANSM, à la HAS et à la base publique du médicament, mis à jour en continu, plutôt qu'à la mémoire d'un modèle. L'éditeur est français, travaille avec des centres hospitalo-universitaires, et son assistant a été déployé sur Santé.fr — trois signes qu'on ne fabrique pas.

## Points forts
- Réponses adossées à des sources officielles françaises, traçables et datées
- Éditeur indépendant, sans lien avec un laboratoire
- Logiciel d'aide à la prescription complet, au-delà de la simple recherche
- Se connecte à l'écosystème français, notamment aux plateformes de documents de santé

## Points faibles
- Pas de tarif public : le déploiement se négocie
- Pensé d'abord pour l'établissement et le cabinet équipé, moins pour l'usage ponctuel
- Périmètre strictement médicamenteux : ce n'est pas un assistant de consultation
- La richesse de l'outil demande un temps de prise en main réel

## Idéal pour
Le prescripteur qui refuse d'arbitrer une interaction sur une réponse non sourcée, et les établissements qui veulent sécuriser la prise en charge médicamenteuse de bout en bout.`,
    },
  ],

  ecomm: [
    {
      id: `shopify-magic`,
      nom: `Shopify Magic`,
      categorie: `Fiches produits`,
      prix: `Inclus dans les offres Shopify`,
      description_courte: `Les fiches produits, les courriels et les réponses au support rédigés dans la boutique, sans abonnement supplémentaire.`,
      lien_affiliation: `https://exemple-affiliation.com/go/shopify-magic`,
      score_avis: 4.2,
      description_longue: `## Notre verdict
Shopify Magic n'est pas le plus puissant des outils de rédaction, il est simplement inclus et déjà branché sur le catalogue. Description de produit à partir de quelques caractéristiques, objet de courriel, réponse au support, texte de page d'accueil : tout se rédige sans quitter l'administration de la boutique et sans ajouter une ligne d'abonnement. Pour un catalogue de trois cents références à écrire, cela suffit largement.

## Points forts
- Inclus dans l'abonnement : aucun arbitrage budgétaire à faire
- Branché sur le catalogue, donc sur les vraies caractéristiques des produits
- Couvre fiches produits, courriels et support dans le même endroit
- Aucune configuration : la fonction est là où l'on travaille déjà

## Points faibles
- Textes plus plats que ceux des outils de rédaction spécialisés
- Réservé aux boutiques hébergées chez Shopify
- Le français est correct mais générique, à retoucher sur les produits à forte marge

## Idéal pour
Les boutiques Shopify avec un gros catalogue à décrire et aucun budget pour un abonnement de rédaction supplémentaire.`,
    },
    {
      id: `jasper`,
      nom: `Jasper`,
      categorie: `Rédaction marketing`,
      prix: `À partir de 40 $/mois`,
      description_courte: `La plateforme de contenu de marque : une voix éditoriale définie une fois, tenue sur tous les canaux et par toute l'équipe.`,
      lien_affiliation: `https://exemple-affiliation.com/go/jasper`,
      score_avis: 4.2,
      description_longue: `## Notre verdict
L'intérêt de Jasper n'est pas de rédiger — beaucoup d'outils rédigent — mais de tenir une voix de marque définie une fois, avec ses termes interdits, ses formulations et son positionnement, sur tous les contenus produits par toute l'équipe. Sur une marque qui publie des dizaines de textes par semaine par plusieurs mains, c'est la seule façon d'éviter que le ton dérive d'un canal à l'autre.

## Points forts
- Voix de marque et interdits lexicaux appliqués à chaque génération
- Campagnes déclinées d'un coup sur tous les canaux, à partir d'un même brief
- Espaces de travail collaboratifs avec modèles partagés
- Bibliothèque de gabarits éprouvés pour le commerce en ligne

## Points faibles
- Coût significatif au regard des assistants généralistes
- La configuration de la voix de marque demande un vrai travail préalable
- Sans relecture, le résultat reste identifiable comme automatique

## Idéal pour
Les marques et équipes marketing de plusieurs personnes qui publient beaucoup et dont le ton part dans toutes les directions.`,
    },
    {
      id: `triple-whale`,
      nom: `Triple Whale`,
      categorie: `Analyse & attribution`,
      prix: `À partir de 100 $/mois`,
      description_courte: `Le tableau de bord qui dit d'où vient réellement chaque commande et ce que rapporte chaque euro de publicité.`,
      lien_affiliation: `https://exemple-affiliation.com/go/triple-whale`,
      score_avis: 4.3,
      description_longue: `## Notre verdict
Depuis la fin du suivi publicitaire généralisé, les régies déclarent chacune avoir généré les mêmes ventes et la somme dépasse le chiffre d'affaires réel. Triple Whale reconstruit l'attribution à partir des données de la boutique elle-même, et rend une marge par campagne plutôt qu'un coût par clic. Les décisions d'arbitrage budgétaire cessent d'être des paris.

## Points forts
- Attribution reconstruite côté boutique, indépendante des déclarations des régies
- Marge réelle par campagne, coûts de produit et d'expédition compris
- Assistant qui répond en langage courant sur les chiffres de la boutique
- Application mobile consultée quotidiennement, ce qui fait qu'elle sert

## Points faibles
- Aucune attribution n'est exacte : c'est un modèle, pas une vérité
- Facturation liée au chiffre d'affaires, qui grimpe avec la croissance
- Utile seulement au-delà d'un certain volume de dépense publicitaire

## Idéal pour
Les boutiques qui dépensent plusieurs milliers d'euros par mois en acquisition et arbitrent encore sur les chiffres déclarés par les régies.`,
    },
    {
      id: `rebuy`,
      nom: `Rebuy`,
      categorie: `Personnalisation`,
      prix: `À partir de 100 $/mois`,
      description_courte: `Les recommandations, les ventes complémentaires et le panier intelligent, réglés sur ce que les clients achètent réellement ensemble.`,
      lien_affiliation: `https://exemple-affiliation.com/go/rebuy`,
      score_avis: 4.3,
      description_longue: `## Notre verdict
Rebuy travaille le panier moyen, levier le plus rentable d'une boutique parce qu'il ne coûte pas d'acquisition. Recommandations sur la fiche produit, ventes complémentaires dans le panier, offre au moment du paiement, relance après achat : chaque emplacement est testé en continu contre une variante. Les boutiques équipées mesurent couramment plusieurs points de panier moyen supplémentaires.

## Points forts
- Recommandations construites sur le comportement d'achat réel de la boutique
- Test comparatif intégré sur chaque emplacement : le gain est mesuré, pas supposé
- Couvre tout le parcours, de la fiche produit à la relance après achat
- Mise en place sans développement sur les plateformes courantes

## Points faibles
- Facturation indexée sur le chiffre d'affaires généré, qui devient lourde à l'échelle
- Un catalogue trop petit ne donne pas de matière aux recommandations
- Le trop-plein d'offres dégrade le parcours si personne ne surveille

## Idéal pour
Les boutiques dont le coût d'acquisition monte et qui doivent chercher la croissance dans le panier moyen plutôt que dans le trafic.`,
    },
    {
      id: `octane-ai`,
      nom: `Octane AI`,
      categorie: `Personnalisation`,
      prix: `À partir de 50 $/mois`,
      description_courte: `Le questionnaire qui recommande le bon produit et collecte, au passage, les données clients qui alimenteront les relances.`,
      lien_affiliation: `https://exemple-affiliation.com/go/octane-ai`,
      score_avis: 4.1,
      description_longue: `## Notre verdict
Sur un catalogue où le client ne sait pas quoi choisir — cosmétique, complément, matériel technique — le questionnaire de recommandation transforme mieux que n'importe quelle page catégorie. Octane AI construit ces parcours sans développement, en tire une recommandation argumentée, et enregistre les réponses comme autant de critères de segmentation pour les relances suivantes.

## Points forts
- Taux de transformation nettement supérieur à une navigation par catégorie
- Réponses conservées comme données de segmentation exploitables ensuite
- Construction du parcours sans développement, en quelques heures
- Se branche sur les outils de relance courants

## Points faibles
- Sans catalogue à choix complexe, l'outil n'apporte rien
- Un questionnaire trop long fait chuter le taux d'achèvement
- Il faut du trafic pour que le gain mesuré soit significatif

## Idéal pour
Les boutiques de cosmétique, de nutrition ou de matériel technique dont les clients hésitent entre des références qu'ils ne savent pas départager.`,
    },
  ],

  architecture: [
    {
      id: `arko-ai`,
      nom: `ArkoAI`,
      categorie: `Rendu IA`,
      prix: `Freemium — à partir de 25 $/mois`,
      description_courte: `Le rendu généré depuis SketchUp, Revit ou Rhino en quelques secondes, sans quitter le logiciel de conception.`,
      lien_affiliation: `https://exemple-affiliation.com/go/arko-ai`,
      score_avis: 4.2,
      description_longue: `## Notre verdict
ArkoAI est l'outil qu'on ouvre en réunion : la vue de travail devient une image d'ambiance pendant que le client parle, et l'on essaie trois matériaux en direct. Il est moins fidèle à la géométrie que les solutions les plus rigoureuses, mais il est plus rapide et sa formule gratuite permet à une agence de juger sans engagement. C'est un outil d'exploration, pas de production finale.

## Points forts
- Extensions pour SketchUp, Revit, Rhino et Archicad
- Rendu en quelques secondes, utilisable en direct devant un client
- Formule gratuite honnête pour évaluer sur un projet réel
- Bibliothèque de styles qui évite d'avoir à rédiger une consigne

## Points faibles
- Géométrie parfois réinterprétée : à vérifier avant de montrer
- Qualité inférieure aux solutions de rendu classiques sur les images finales
- Le système de crédits s'épuise vite en phase de recherche

## Idéal pour
Les agences en phase d'esquisse qui veulent tester des ambiances devant le client plutôt que de repartir avec une liste de questions.`,
    },
    {
      id: `promeai`,
      nom: `PromeAI`,
      categorie: `Esquisse`,
      prix: `Freemium — à partir de 10 $/mois`,
      description_courte: `Le croquis à main levée transformé en image d'ambiance : la ligne dessinée reste, le reste est habillé.`,
      lien_affiliation: `https://exemple-affiliation.com/go/promeai`,
      score_avis: 4.0,
      description_longue: `## Notre verdict
PromeAI part du dessin plutôt que du modèle : un croquis, une élévation, un plan masse au trait deviennent une image rendue qui conserve les lignes tracées. C'est l'outil de la phase la plus amont, celle où le projet n'est pas modélisé et où l'on cherche une intention. Le contrôle sur la géométrie est meilleur qu'avec un générateur d'images généraliste, sans exiger de maquette.

## Points forts
- Fidélité aux lignes du croquis, contrairement aux générateurs généralistes
- Aucune maquette requise : utilisable dès la première esquisse
- Nombreux styles de rendu, du croquis aquarellé au photoréaliste
- Tarif accessible à une petite agence ou à un étudiant

## Points faibles
- La cohérence entre deux images d'une même série reste difficile à tenir
- Aucune connexion aux logiciels de conception
- Interface encombrée de fonctions sans rapport avec l'architecture

## Idéal pour
Les architectes et maîtres d'œuvre en phase de recherche, qui veulent montrer une intention avant que quoi que ce soit ne soit modélisé.`,
    },
    {
      id: `maket`,
      nom: `Maket`,
      categorie: `Conception générative`,
      prix: `Freemium — à partir de 20 $/mois`,
      description_courte: `Des dizaines de plans de maison générés à partir des contraintes du terrain et du programme, comparables entre eux.`,
      lien_affiliation: `https://exemple-affiliation.com/go/maket`,
      score_avis: 3.9,
      description_longue: `## Notre verdict
Maket vise le logement individuel et le petit collectif : on décrit le terrain, le programme et quelques préférences, l'outil sort des dizaines de plans de distribution à comparer. La qualité architecturale n'est pas au rendez-vous — ce sont des plans corrects, pas des projets — mais comme base de discussion avec un client indécis, cela évite trois allers-retours d'esquisse gratuite.

## Points forts
- Génération rapide de nombreuses variantes de distribution
- Assistant sur les règles d'urbanisme, utile en dégrossissage
- Tarif accessible à un maître d'œuvre indépendant
- Formule gratuite pour juger sur un cas réel

## Points faibles
- Plans corrects mais sans intention architecturale
- Réglementation américaine par défaut : à ne pas prendre pour argent comptant en France
- Limité au logement, inutile sur tout autre programme

## Idéal pour
Les maîtres d'œuvre et constructeurs de maisons individuelles qui produisent beaucoup d'esquisses gratuites avant de signer un contrat.`,
    },
    {
      id: `lookx-ai`,
      nom: `LookX AI`,
      categorie: `Rendu IA`,
      prix: `Freemium — à partir de 20 $/mois`,
      description_courte: `Les rendus d'ambiance appuyés sur des modèles entraînés par style architectural, avec la cohérence d'une série à tenir.`,
      lien_affiliation: `https://exemple-affiliation.com/go/lookx-ai`,
      score_avis: 4.0,
      description_longue: `## Notre verdict
LookX se distingue par ses modèles entraînés sur des corpus architecturaux identifiés, ce qui donne des rendus stylistiquement cohérents plutôt qu'un collage d'influences. Une agence peut aussi entraîner un modèle sur son propre travail, et retrouver son écriture d'une planche à l'autre — le vrai problème des images générées en concours, où l'hétérogénéité se voit immédiatement.

## Points forts
- Modèles par style architectural, plus cohérents qu'un générateur généraliste
- Entraînement possible sur les images de l'agence, pour tenir une écriture
- Traite l'extérieur, l'intérieur et le paysage
- Formule gratuite pour évaluer avant d'engager

## Points faibles
- Génération à partir d'images, sans lien avec les logiciels de conception
- L'entraînement d'un modèle propre demande un corpus conséquent
- Résultats inégaux sur les programmes techniques

## Idéal pour
Les agences qui rendent des concours et dont les planches perdent en force parce que les images ne se ressemblent pas entre elles.`,
    },
    {
      id: `autodesk-forma`,
      nom: `Autodesk Forma`,
      categorie: `Faisabilité`,
      prix: `Sur devis — abonnement Autodesk`,
      description_courte: `L'étude d'implantation avec les analyses environnementales en direct : ensoleillement, vent, bruit, dès l'esquisse de masse.`,
      lien_affiliation: `https://exemple-affiliation.com/go/autodesk-forma`,
      score_avis: 4.2,
      description_longue: `## Notre verdict
Forma déplace les analyses environnementales là où elles servent : au moment où l'on pose les volumes, et non trois mois plus tard quand plus rien ne peut bouger. Ensoleillement, vent, bruit, micro-climat se recalculent en quelques secondes à chaque modification de masse. Pour un projet urbain soumis à des exigences environnementales, c'est ce qui permet d'arbitrer avant de figer.

## Points forts
- Analyses environnementales quasi instantanées en phase amont
- Contexte urbain réel importé automatiquement
- Continuité avec Revit et l'écosystème Autodesk déjà en place
- Génération et comparaison de variantes d'implantation

## Points faibles
- Suppose un abonnement Autodesk, coûteux hors de cet écosystème
- Les analyses sont indicatives et ne remplacent pas une étude réglementaire
- Couverture de contexte urbain inégale selon les villes françaises

## Idéal pour
Les agences d'urbanisme et les équipes de projet urbain qui doivent justifier leurs choix d'implantation sur des critères environnementaux.`,
    },
  ],

  generaliste: [
    {
      id: `gemini`,
      nom: `Gemini`,
      categorie: `Rédaction`,
      prix: `Freemium — à partir de 22 €/mois`,
      description_courte: `L'assistant de Google, branché sur la messagerie, les documents et le tableur que l'entreprise utilise déjà.`,
      lien_affiliation: `https://exemple-affiliation.com/go/gemini`,
      score_avis: 4.4,
      description_longue: `## Notre verdict
La force de Gemini n'est pas d'être le meilleur rédacteur, c'est d'être là où le travail se fait déjà : dans la boîte mail, dans le document partagé, dans le tableur. Résumer un fil de discussion de trente messages, rédiger une réponse en s'appuyant sur les pièces jointes, remplir une colonne de tableur à partir d'une consigne — autant de gestes que l'on ne fait pas si l'outil est dans un autre onglet.

## Points forts
- Intégré à la messagerie, aux documents et au tableur de l'espace de travail
- Traite le texte, l'image, l'audio et la vidéo dans le même échange
- Très grande fenêtre de contexte, y compris sur les formules payantes d'entrée
- Recherche web intégrée, avec des réponses à jour

## Points faibles
- Les intégrations les plus utiles supposent un abonnement professionnel complet
- Ton par défaut plus scolaire que les concurrents sur les textes longs
- Les fonctions évoluent vite, ce qui déroute les utilisateurs occasionnels

## Idéal pour
Les entreprises déjà installées dans l'espace de travail Google, qui veulent un usage quotidien sans changer d'outil ni de réflexe.`,
    },
    {
      id: `heygen`,
      nom: `HeyGen`,
      categorie: `Création Vidéo`,
      prix: `Freemium — à partir de 29 $/mois`,
      description_courte: `La vidéo présentée par un avatar, et surtout le doublage qui traduit une vidéo existante en gardant la voix et les lèvres synchronisées.`,
      lien_affiliation: `https://exemple-affiliation.com/go/heygen`,
      score_avis: 4.4,
      description_longue: `## Notre verdict
HeyGen est le plus convaincant des générateurs de vidéo à avatar, mais sa fonction décisive est ailleurs : le doublage d'une vidéo existante dans une autre langue, en conservant le timbre de l'orateur et en resynchronisant les lèvres. Une vidéo tournée une fois devient une vidéo dans huit langues, ce qui change l'économie de la formation et du support en entreprise internationale.

## Points forts
- Doublage multilingue avec conservation de la voix et synchronisation labiale
- Avatar personnel entraîné à partir de quelques minutes d'enregistrement
- Rendu nettement au-dessus de la moyenne des générateurs d'avatars
- Formule gratuite pour juger du résultat avant de payer

## Points faibles
- L'avatar reste identifiable comme synthétique sur les formats longs
- Le clonage de voix et d'apparence exige un consentement explicite et écrit
- Le système de crédits part vite dès que l'on produit sérieusement

## Idéal pour
Les équipes de formation et de communication interne qui doivent servir plusieurs langues sans retourner ni refaire doubler chaque vidéo.`,
    },
    {
      id: `suno`,
      nom: `Suno`,
      categorie: `Audio & Voix`,
      prix: `Freemium — à partir de 10 $/mois`,
      description_courte: `La musique originale générée à la demande : un habillage sonore libre de droits, dans le style et la durée voulus.`,
      lien_affiliation: `https://exemple-affiliation.com/go/suno`,
      score_avis: 4.3,
      description_longue: `## Notre verdict
Suno produit des morceaux complets à partir d'une description, avec voix chantée si on le demande. Pour un habillage de format court, une musique d'attente ou un fond de vidéo de marque, cela remplace les banques de musique où tout le monde puise les mêmes titres. La formule payante donne les droits d'usage commercial, ce qui est le point qui décide réellement d'un abonnement.

## Points forts
- Morceaux complets et cohérents, pas seulement des boucles
- Droits d'usage commercial sur les formules payantes
- Durée et style pilotables, ce qui évite le montage acrobatique
- Version gratuite suffisante pour juger de la qualité

## Points faibles
- Les paroles générées demandent presque toujours une réécriture
- Le cadre juridique de ces générations reste discuté : lire les conditions
- Les mixages manquent de dynamique face à une production professionnelle

## Idéal pour
Les créateurs de formats courts, les podcasteurs et les équipes marketing qui veulent un habillage sonore qui ne ressemble pas à celui du voisin.`,
    },
    {
      id: `napkin-ai`,
      nom: `Napkin AI`,
      categorie: `Design`,
      prix: `Freemium — à partir de 10 $/mois`,
      description_courte: `Le texte transformé en schéma : un paragraphe devient un diagramme modifiable, sans ouvrir un logiciel de dessin.`,
      lien_affiliation: `https://exemple-affiliation.com/go/napkin-ai`,
      score_avis: 4.4,
      description_longue: `## Notre verdict
Un schéma explique mieux qu'un paragraphe, mais personne n'ouvre un logiciel de dessin vectoriel pour illustrer une note interne. Napkin lit le texte, propose plusieurs représentations visuelles — chronologie, cycle, comparaison, entonnoir — et rend un schéma vectoriel modifiable élément par élément. Le résultat est propre, sobre, et prêt à coller dans un document ou une présentation.

## Points forts
- Plusieurs représentations proposées pour un même texte, au choix
- Schémas vectoriels réellement modifiables, pas des images figées
- Rendu sobre qui passe dans un document professionnel sans retouche
- Version gratuite largement suffisante pour un usage régulier

## Points faibles
- Types de schémas limités à un catalogue : rien de vraiment sur mesure
- Les textes très denses donnent des schémas confus
- Les fonctions collaboratives restent minces

## Idéal pour
Tous ceux qui rédigent des notes, des rapports ou des supports et illustrent tout par des listes à puces faute de savoir dessiner.`,
    },
    {
      id: `zapier-agents`,
      nom: `Zapier Agents`,
      categorie: `Productivité`,
      prix: `Freemium — à partir de 30 $/mois`,
      description_courte: `Des agents qui agissent dans les huit mille outils déjà connectés à Zapier : lire, décider, écrire, prévenir.`,
      lien_affiliation: `https://exemple-affiliation.com/go/zapier-agents`,
      score_avis: 4.2,
      description_longue: `## Notre verdict
Un assistant qui rédige a peu de valeur ; un assistant qui agit dans les outils de l'entreprise en a beaucoup. Zapier Agents s'appuie sur le plus large catalogue de connexions du marché pour exécuter des tâches réelles : qualifier un formulaire entrant, créer la fiche dans le logiciel commercial, prévenir la bonne personne, rédiger la réponse. C'est de l'automatisation qui sait décider, là où les scénarios classiques suivaient une règle rigide.

## Points forts
- Le catalogue de connexions le plus large, sans développement
- L'agent décide selon le contenu, là où un scénario classique suivait une règle fixe
- Se construit en langage courant, sans compétence technique
- Historique d'exécution consultable, indispensable pour corriger un comportement

## Points faibles
- Les coûts grimpent vite avec le nombre de tâches exécutées
- Un agent mal cadré agit dans de vrais systèmes : le bac à sable est indispensable
- Le diagnostic d'un enchaînement raté reste laborieux

## Idéal pour
Les petites structures sans équipe technique, dont les processus reposent sur des copier-coller entre cinq outils différents.`,
    },
  ],
};

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    main();
  } catch (erreur) {
    console.error(erreur.message);
    process.exit(1);
  }
}
