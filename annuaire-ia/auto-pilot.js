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
    })
    /* Les niches en pause sortent ici, et c'est l'effet qui compte le plus :
       l'auto-pilote cesse d'y puiser. La réserve entière se reporte sur les
       niches restées actives, ce qui multiplie d'autant leur autonomie avant
       la prochaine réalimentation. */
    .filter(({ base }) => base?.niche?.actif !== false);
}

function publierUnOutil({ fichier, base }) {
  const reserve = BACKLOG[base.niche.id] ?? [];
  const enLigne = new Set(base.outils.map((o) => o.id));
  const candidats = reserve.filter((o) => !enLigne.has(o.id));

  if (reserve.length === 0) return { etat: 'sans-reserve' };
  if (candidats.length === 0) return { etat: 'epuisee' };

  /* Tant que la niche compte plus d'outils « sur devis » que de libre-service,
     on publie d'abord ceux qui peuvent rapporter. Un outil vendu par un
     commercial n'a pas de programme d'affiliation : trois niches sur onze
     étaient dans ce cas au lancement, et le site le mieux référencé du monde
     ne rapporte rien s'il ne pointe que vers des devis. La règle est ici,
     dans le tirage, plutôt que dans une consigne à se rappeler. */
  const estDevis = (o) => /sur devis/i.test(String(o.prix ?? ''));
  const devisEnLigne = base.outils.filter(estDevis).length;
  const prioritaires = candidats.filter((o) => !estDevis(o));
  const urne = devisEnLigne * 2 > base.outils.length && prioritaires.length ? prioritaires : candidats;

  const choisi = urne[Math.floor(Math.random() * urne.length)];
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
    {
      id: `styldod`,
      nom: `Styldod`,
      categorie: `Home staging`,
      prix: `À partir de 16 $ par visuel, sans abonnement`,
      description_courte: `Le home staging virtuel facturé à l'image, avec retouche illimitée jusqu'à ce que le rendu convienne.`,
      lien_affiliation: `https://exemple-affiliation.com/go/styldod`,
      score_avis: 4.2,
      description_longue: `## Notre verdict
Là où les outils entièrement automatiques sortent un résultat en trente secondes qu'il faut parfois relancer dix fois, Styldod combine génération et reprise humaine : on commande une image, on demande des ajustements, on paie à l'unité. Pour une agence qui traite deux ou trois mandats vides par mois, la facture reste dérisoire face à un abonnement mensuel jamais amorti.

## Points forts
- Facturation à l'image : aucun abonnement à amortir sur un mois creux
- Retouches illimitées incluses jusqu'à validation du rendu
- Suppression du mobilier existant, rénovation virtuelle et détourage au même endroit
- Rendus plus propres que les générateurs entièrement automatiques sur les pièces complexes

## Points faibles
- Délai de quelques heures là où l'automatique répond en secondes
- Le coût grimpe vite si l'on veut décliner tout un portefeuille
- Interface et support en anglais uniquement

## Idéal pour
Les agences qui sortent quelques mandats vides par mois et veulent un visuel irréprochable sans engagement mensuel.`,
    },
    {
      id: `collov-ai`,
      nom: `Collov AI`,
      categorie: `Home staging`,
      prix: `Freemium — à partir de 20 $/mois`,
      description_courte: `Le réaménagement d'une pièce en une trentaine de styles, avec la structure du bien conservée.`,
      lien_affiliation: `https://exemple-affiliation.com/go/collov-ai`,
      score_avis: 4.1,
      description_longue: `## Notre verdict
Collov s'adresse d'abord aux professionnels de la décoration, ce qui se voit dans la qualité des ambiances proposées : les styles sont cohérents, meublés avec du mobilier plausible plutôt qu'avec des objets impossibles. La formule gratuite suffit à juger sur un vrai mandat avant d'engager quoi que ce soit.

## Points forts
- Une trentaine de styles cohérents, du scandinave au bord de mer
- Murs, sols et ouvertures conservés : la pièce reste reconnaissable
- Version gratuite réellement utilisable pour un premier essai
- Traitement par lot pour décliner une même pièce en plusieurs ambiances

## Points faibles
- Les très grandes pièces ouvertes demandent souvent plusieurs essais
- Le mobilier proposé n'est pas achetable en France, ce qui limite l'usage commercial
- La mention du caractère virtuel de l'aménagement reste à votre charge

## Idéal pour
Les négociateurs qui publient eux-mêmes leurs annonces et veulent tester deux ou trois ambiances avant de choisir la photo de couverture.`,
    },
    {
      id: `homestyler`,
      nom: `Homestyler`,
      categorie: `Plan & 3D`,
      prix: `Freemium — à partir de 20 $/mois`,
      description_courte: `Le plan d'aménagement en 3D dessiné en quelques minutes, à partir d'un plan coté ou d'une photo.`,
      lien_affiliation: `https://exemple-affiliation.com/go/homestyler`,
      score_avis: 4.0,
      description_longue: `## Notre verdict
Un acheteur qui ne se projette pas dans un bien à rénover ne fait pas d'offre. Homestyler permet de dessiner en une demi-heure la distribution possible d'un plateau, meublée et texturée, et d'en sortir des vues 3D à joindre à l'annonce. Ce n'est pas de l'architecture, c'est un argument de vente que personne d'autre ne met dans son dossier.

## Points forts
- Prise en main en une heure, sans compétence en dessin technique
- Rendus 3D et vues aériennes exportables directement
- Bibliothèque de mobilier très fournie, avec dimensions réelles
- Formule gratuite suffisante pour un ou deux projets par mois

## Points faibles
- Le rendu reste en deçà des outils d'architecture professionnels
- Rien n'est aux normes : c'est illustratif, jamais un plan de travaux
- Le travail de saisie du plan reste manuel et prend du temps

## Idéal pour
Les mandats sur biens à rénover ou à redistribuer, où le frein à l'offre est l'incapacité de l'acheteur à imaginer autre chose que l'existant.`,
    },
    {
      id: `bombbomb`,
      nom: `BombBomb`,
      categorie: `Prospection`,
      prix: `À partir de 39 $/mois`,
      description_courte: `Le courriel de prospection remplacé par une vidéo personnelle, avec le suivi de qui l'a vraiment regardée.`,
      lien_affiliation: `https://exemple-affiliation.com/go/bombbomb`,
      score_avis: 4.0,
      description_longue: `## Notre verdict
Un message de prospection écrit se noie ; une vidéo de quarante secondes où l'on voit le visage du négociateur ouvre nettement plus. BombBomb enregistre, héberge et insère la vidéo dans le courriel, puis dit qui l'a ouverte, regardée, et jusqu'où. L'aide à la rédaction et les modèles font le reste du travail répétitif.

## Points forts
- Taux d'ouverture et de réponse très supérieurs au courriel texte en prospection
- Suivi précis des visionnages : on sait qui relancer et quand
- Enregistrement depuis le téléphone, entre deux visites
- S'intègre aux principaux logiciels de gestion de contacts

## Points faibles
- Il faut accepter de se filmer, ce qui écarte une partie des utilisateurs
- Facturé par utilisateur : une équipe de cinq revient cher
- Pensé pour le marché américain, sans localisation française

## Idéal pour
Les négociateurs qui prospectent par courriel et n'obtiennent plus de réponse, et les équipes qui veulent se distinguer sur un secteur saturé.`,
    },
    {
      id: `chatbase`,
      nom: `Chatbase`,
      categorie: `Capture de contacts`,
      prix: `Freemium — à partir de 40 $/mois`,
      description_courte: `Un assistant posé sur le site de l'agence, nourri de vos annonces, qui répond la nuit et laisse le numéro du visiteur.`,
      lien_affiliation: `https://exemple-affiliation.com/go/chatbase`,
      score_avis: 4.3,
      description_longue: `## Notre verdict
La majorité des visiteurs d'un site d'agence arrivent le soir et repartent sans laisser de trace. Chatbase installe en une heure un assistant entraîné sur vos propres pages — annonces, honoraires, secteurs — qui répond aux questions courantes et récupère un contact avant que le visiteur ne reparte. Aucune compétence technique, un extrait de code à coller.

## Points forts
- Entraîné sur vos pages et vos documents : il répond juste, pas en général
- Installation en une heure, une ligne de code à coller sur le site
- Récupération du contact intégrée, poussée vers le courriel ou le logiciel de gestion
- Journal complet des conversations : on découvre ce que les visiteurs demandent vraiment

## Points faibles
- Un assistant mal cadré invente : les honoraires et les mentions légales se verrouillent à la main
- Facturé au volume de messages, imprévisible sur un pic de trafic
- Il faut réentraîner à chaque changement de catalogue

## Idéal pour
Les agences dont le site reçoit du trafic le soir et le week-end sans que personne ne soit là pour répondre.`,
    },
    {
      id: `hektor`,
      nom: `Hektor`,
      categorie: `CRM & pilotage`,
      prix: `Environ 70 à 150 €/mois selon les modules`,
      description_courte: `Le logiciel d'agence le plus répandu de France, avec l'IA posée dans le flux de travail plutôt que dans un onglet séparé.`,
      lien_affiliation: `https://exemple-affiliation.com/go/hektor`,
      score_avis: 4.3,
      description_longue: `## Notre verdict
Sur ce métier, l'IA utile n'est pas arrivée par des outils à part : elle est entrée dans le logiciel où l'agent passe déjà ses journées. Hektor, édité par La Boîte Immo, revendique huit mille cinq cents agences et quinze ans d'existence — c'est la position d'où l'on peut se permettre d'automatiser sans que personne n'ait à changer d'habitude. Les fonctions génératives servent d'abord la rédaction et le suivi des contacts, là où le temps se perd vraiment.

## Points forts
- Parc installé considérable : formation, entraide et intégrations abondantes
- IA intégrée au flux de travail existant, sans outil supplémentaire à ouvrir
- Tarification modulaire, on ne paie que les briques utilisées
- Éditeur français, au fait des obligations d'affichage et de mandat

## Points faibles
- Le prix grimpe vite à mesure que les modules s'ajoutent
- Modularité qui rend la comparaison difficile avec des offres tout compris
- Un parc ancien s'accompagne d'un héritage d'interface
- Changer de CRM immobilier reste un déménagement, pas une bascule

## Idéal pour
Les agences qui veulent de l'IA sans projet ni nouvel outil, directement là où leurs mandats et leurs contacts sont déjà rangés.`,
    },
    {
      id: `netty`,
      nom: `Netty`,
      categorie: `CRM & pilotage`,
      prix: `À partir de 89 €/mois, site web inclus`,
      description_courte: `Le logiciel d'agence qui inclut le site vitrine dans l'abonnement, avec quinze jours d'essai et un tarif affiché.`,
      lien_affiliation: `https://exemple-affiliation.com/go/netty`,
      score_avis: 4.1,
      description_longue: `## Notre verdict
Netty joue la lisibilité là où ses concurrents jouent la modularité : un tarif affiché, le site internet de l'agence compris dans l'abonnement, quinze jours pour se décider. Pour une agence de deux à dix personnes qui ne veut pas piloter deux prestataires, c'est un argument concret. En contrepartie, ses fonctions d'IA sont plus légères que celles des concurrents qui en ont fait leur axe.

## Points forts
- Tarif public et lisible, sans devis préalable
- Site web de l'agence inclus : un prestataire de moins
- Essai gratuit de quinze jours, engagement limité
- Interface simple, prise en main rapide pour une petite équipe

## Points faibles
- Fonctions d'IA plus limitées que chez les concurrents qui en ont fait leur axe
- Le confort du tout-en-un se paie en souplesse si l'agence grandit
- Moins d'intégrations tierces que les acteurs à large parc
- Le site inclus contraint la liberté éditoriale de l'agence

## Idéal pour
Les agences de deux à dix personnes qui veulent un outil clair et un site web, sans négocier ni empiler les modules.`,
    },
    {
      id: `apimo`,
      nom: `Apimo`,
      categorie: `CRM & pilotage`,
      prix: `Sur devis`,
      description_courte: `Un des rares logiciels d'agence à IA native, taillé pour les réseaux et les agences qui travaillent à l'international.`,
      lien_affiliation: `https://exemple-affiliation.com/go/apimo`,
      score_avis: 4.1,
      description_longue: `## Notre verdict
Apimo figure dans le petit groupe de logiciels immobiliers français dont l'IA est native plutôt qu'ajoutée après coup — la distinction se sent à l'usage, quand l'automatisation n'oblige pas à sortir de l'écran courant. Sa particularité est l'ouverture vers l'international, avec une diffusion multilingue qui sert les agences travaillant avec une clientèle étrangère : littoral, montagne, grandes villes.

## Points forts
- IA native, intégrée au fonctionnement plutôt que greffée
- Diffusion multilingue, utile sur les marchés à clientèle étrangère
- Adapté aux réseaux et aux agences multi-sites
- Ouverture technique vers les portails et les outils tiers

## Points faibles
- Aucun tarif public : comparaison impossible sans devis
- Richesse fonctionnelle qui suppose un temps de paramétrage
- Surdimensionné pour une agence indépendante à un seul point de vente
- La courbe d'apprentissage est plus raide que chez les offres simples

## Idéal pour
Les réseaux, les agences multi-sites et celles dont une part des acquéreurs vient de l'étranger.`,
    },
    {
      id: `prospeneo`,
      nom: `Prospeneo`,
      categorie: `CRM & pilotage`,
      prix: `Sur devis`,
      description_courte: `Un logiciel d'agence à IA native, cité aux côtés des acteurs installés sans en avoir le parc — ni les habitudes.`,
      lien_affiliation: `https://exemple-affiliation.com/go/prospeneo`,
      score_avis: 4.0,
      description_longue: `## Notre verdict
Prospeneo appartient à la courte liste des logiciels immobiliers français dont l'IA est native. C'est un choix d'outsider : moins de parc installé que les leaders, donc moins d'héritage d'interface et de compromis techniques, mais aussi moins de recul et un écosystème d'intégrations plus étroit. Ce compromis vaut d'être examiné par une agence qui monte son organisation plutôt que par une qui la migre.

## Points forts
- IA pensée dans le produit dès l'origine, sans couche ajoutée
- Éditeur plus récent, moins d'héritage technique à porter
- Approche adaptée à une agence qui construit son organisation
- Interlocuteur accessible, ce que les grands parcs ne permettent plus

## Points faibles
- Aucun tarif public
- Parc installé restreint : peu d'entraide, peu de retours d'expérience publics
- Écosystème d'intégrations plus étroit que celui des leaders
- Le pari sur un éditeur jeune n'est jamais neutre sur un outil central

## Idéal pour
Les agences qui s'équipent pour la première fois, ou celles prêtes à échanger la sécurité d'un grand parc contre un outil plus moderne.`,
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
    {
      id: `fieldwire`,
      nom: `Fieldwire`,
      categorie: `Suivi de chantier`,
      prix: `Freemium — à partir de 39 $/mois par utilisateur`,
      description_courte: `Les plans, les tâches et les réserves dans la poche de chaque compagnon, hors ligne compris.`,
      lien_affiliation: `https://exemple-affiliation.com/go/fieldwire`,
      score_avis: 4.4,
      description_longue: `## Notre verdict
Fieldwire fait ce que la plupart des outils de chantier promettent sans le tenir : être réellement utilisé par les gens qui sont sur le chantier. Plans à jour dans le téléphone, tâche épinglée à un endroit précis, photo, hors ligne au sous-sol. La formule gratuite couvre trois utilisateurs et un chantier, ce qui suffit à juger sans réunion d'achat.

## Points forts
- Formule gratuite réellement utilisable : trois utilisateurs, un chantier
- Fonctionne hors ligne, ce qui est la réalité d'un sous-sol ou d'un dernier étage
- Version de plan toujours à jour : plus personne ne travaille sur l'indice précédent
- Adopté par les compagnons, pas seulement par l'encadrement

## Points faibles
- Facturé par utilisateur : équiper tout le monde chiffre vite
- Le module de planning reste basique face aux logiciels dédiés
- Pas d'analyse d'avancement automatique : c'est de la saisie assistée

## Idéal pour
Les entreprises de second œuvre et les conducteurs de travaux qui relèvent encore leurs réserves sur carnet et retapent le soir.`,
    },
    {
      id: `buildertrend`,
      nom: `Buildertrend`,
      categorie: `Gestion d’entreprise`,
      prix: `À partir de 199 $/mois`,
      description_courte: `Devis, planning, achats, facturation et espace client dans un seul outil, pour une entreprise de moins de cinquante personnes.`,
      lien_affiliation: `https://exemple-affiliation.com/go/buildertrend`,
      score_avis: 4.1,
      description_longue: `## Notre verdict
Le vrai coût d'une entreprise de bâtiment de taille moyenne n'est pas sur le chantier, il est dans les allers-retours : un client qui appelle pour savoir où en est le chantier, un devis modifié trois fois, une facture oubliée. Buildertrend rassemble tout et donne au client son propre accès, ce qui coupe la moitié des appels.

## Points forts
- Espace client autonome : le maître d'ouvrage voit l'avancement sans téléphoner
- Du devis à la facture dans le même outil, sans ressaisie
- Rédaction assistée des comptes rendus et des courriers de chantier
- Application mobile complète, utilisable depuis le chantier

## Points faibles
- Abonnement mensuel élevé pour une petite structure
- Conçu pour le marché nord-américain : la TVA et les mentions françaises demandent des contournements
- Le déploiement complet demande plusieurs semaines de mise en route

## Idéal pour
Les entreprises générales et constructeurs de maisons individuelles de dix à cinquante personnes qui pilotent encore au tableur et au téléphone.`,
    },
    {
      id: `houzz-pro`,
      nom: `Houzz Pro`,
      categorie: `Gestion d’entreprise`,
      prix: `À partir de 85 $/mois`,
      description_courte: `La vitrine, les devis et le suivi de chantier réunis, avec la visualisation 3D pour faire signer le client.`,
      lien_affiliation: `https://exemple-affiliation.com/go/houzz-pro`,
      score_avis: 4.0,
      description_longue: `## Notre verdict
Houzz Pro tire son intérêt d'un endroit inattendu : il apporte des contacts en même temps que l'outil de gestion. Pour un artisan ou un maître d'œuvre, la vitrine, le devis chiffré, la visualisation 3D de la pièce rénovée et le suivi de chantier tiennent dans un seul abonnement, et la 3D est ce qui fait signer un client hésitant.

## Points forts
- Apporte du contact entrant, ce qu'aucun autre outil de gestion ne fait
- Visualisation 3D de la rénovation intégrée au devis
- Devis, factures et suivi de chantier dans le même endroit
- Tarif accessible à un artisan seul ou à une petite équipe

## Points faibles
- L'apport de contacts est très inégal hors des grandes villes américaines
- Moins profond que les outils spécialisés sur chaque fonction
- Le catalogue produits est inutilisable depuis la France

## Idéal pour
Les artisans, décorateurs et maîtres d'œuvre qui cherchent autant des chantiers qu'un outil pour les gérer.`,
    },
    {
      id: `bluebeam`,
      nom: `Bluebeam Revu`,
      categorie: `Plans & documents`,
      prix: `À partir de 260 $ par an`,
      description_courte: `Le standard du plan annoté en PDF : mesures, calques, comparaison d'indices et travail à plusieurs sur le même document.`,
      lien_affiliation: `https://exemple-affiliation.com/go/bluebeam`,
      score_avis: 4.5,
      description_longue: `## Notre verdict
Bluebeam est l'outil que tout le monde finit par avoir, parce que le PDF reste la monnaie d'échange du bâtiment. Mesures à l'échelle, comptages, superposition de deux indices pour voir ce qui a changé, annotations partagées en direct : c'est le couteau suisse du dossier de plans, et la comparaison automatique d'indices vaut à elle seule le prix.

## Points forts
- Comparaison automatique de deux indices de plan : ce qui a changé saute aux yeux
- Mesures, surfaces et comptages directement sur le PDF, à l'échelle
- Sessions partagées : plusieurs personnes annotent le même plan en direct
- Licence annuelle, sans abonnement mensuel qui court

## Points faibles
- Interface dense, héritée de vingt ans d'ajouts successifs
- Windows d'abord : la version pour tablette est en retrait
- Aucune reconnaissance automatique : c'est de l'outillage manuel très puissant

## Idéal pour
Les économistes, conducteurs de travaux et bureaux d'études qui vivent dans les dossiers de plans PDF.`,
    },
    {
      id: `knowify`,
      nom: `Knowify`,
      categorie: `Chiffrage & rentabilité`,
      prix: `À partir de 99 $/mois`,
      description_courte: `Le chiffrage relié à la réalité du chantier : on voit en direct si l'affaire tient encore sa marge.`,
      lien_affiliation: `https://exemple-affiliation.com/go/knowify`,
      score_avis: 4.0,
      description_longue: `## Notre verdict
Une entreprise du bâtiment découvre trop souvent à la clôture qu'un chantier a perdu de l'argent. Knowify relie le devis, les heures pointées et les achats, et affiche l'écart au fil de l'eau. Ce n'est pas spectaculaire ; c'est le seul moyen de corriger pendant qu'il en est encore temps, plutôt que d'en tirer une leçon trois mois après.

## Points forts
- Marge suivie en direct par chantier, pas découverte à la clôture
- Pointage des heures depuis le téléphone, rattaché au bon poste
- Devis structurés par lots, réutilisables d'une affaire à l'autre
- Facturation à l'avancement gérée nativement

## Points faibles
- Suppose un pointage discipliné : sans les heures, l'outil ne dit rien
- Comptabilité et paie américaines : l'export vers un cabinet français demande un travail
- Interface austère, sans effort de séduction

## Idéal pour
Les entreprises de dix à trente compagnons qui savent qu'un chantier sur cinq perd de l'argent sans savoir lequel.`,
    },
    {
      id: `finalcad`,
      nom: `Finalcad`,
      categorie: `Réserves & qualité`,
      prix: `Sur devis`,
      description_courte: `Les réserves relevées sur le plan depuis le téléphone, et l'historique complet de l'opération à la livraison.`,
      lien_affiliation: `https://exemple-affiliation.com/go/finalcad`,
      score_avis: 4.3,
      description_longue: `## Notre verdict
Éditeur parisien fondé en 2011, Finalcad a compris avant les autres que le point de collecte des données de chantier n'est pas le bureau mais la poche du conducteur de travaux. Tout se relève sur le plan depuis le téléphone, y compris hors réseau, et remonte ensuite. La partie automatisée sert surtout à extraire l'information utile des maquettes et des plans pour la remettre entre les mains des équipes de terrain.

## Points forts
- Relevé sur plan depuis le mobile, utilisable en zone sans réseau
- Éditeur français avec deux cents personnes et quinze ans de terrain
- Extraction automatique de données depuis les maquettes et plans 2D
- Historique complet de l'opération, exploitable à la réception

## Points faibles
- Aucun tarif public : déploiement négocié
- Le bénéfice suppose que toutes les entreprises jouent le jeu — c'est le vrai obstacle
- Fonctionnalités riches, donc paramétrage initial à prévoir
- Recouvre en partie ce que font les grandes plateformes généralistes

## Idéal pour
Les entreprises générales et maîtres d'œuvre qui veulent que les réserves cessent de vivre sur des tirages papier annotés.`,
    },
    {
      id: `kairnial`,
      nom: `Kairnial`,
      categorie: `Suivi de chantier`,
      prix: `Sur devis`,
      description_courte: `La collaboration sur maquette 2D et 3D pour les grosses opérations, choisie par les majors du bâtiment français.`,
      lien_affiliation: `https://exemple-affiliation.com/go/kairnial`,
      score_avis: 4.2,
      description_longue: `## Notre verdict
Kairnial vise franchement le haut du marché : les opérations où la maquette numérique est un livrable contractuel et où des dizaines d'intervenants doivent travailler sur le même modèle. Bouygues, Eiffage et Suez figurent parmi ses clients, ce qui en dit long sur le type de projet auquel il est taillé. La contrepartie est mécanique — sur un chantier de trois entreprises, la moitié des fonctions ne servira jamais.

## Points forts
- Collaboration sur maquettes 2D et 3D depuis n'importe quel appareil
- Couvre toutes les phases du cycle, de la conception à l'exploitation
- Éprouvé chez les majors françaises du bâtiment
- Gestion documentaire à la hauteur des exigences contractuelles des grosses opérations

## Points faibles
- Surdimensionné, et donc trop cher, pour une entreprise de taille moyenne
- Aucun tarif public
- Suppose une maquette numérique déjà en place et tenue à jour
- Déploiement long, qui relève du projet d'entreprise

## Idéal pour
Les grandes opérations avec maquette numérique contractuelle et de nombreux intervenants à coordonner sur le même modèle.`,
    },
    {
      id: `bulldozair`,
      nom: `BulldozAIR`,
      categorie: `Réserves & qualité`,
      prix: `Sur devis`,
      description_courte: `Le suivi visuel de chantier pour les équipes de terrain, sans le poids d'une plateforme de major.`,
      lien_affiliation: `https://exemple-affiliation.com/go/bulldozair`,
      score_avis: 4.1,
      description_longue: `## Notre verdict
BulldozAIR occupe le créneau que les plateformes lourdes laissent vide : une équipe qui veut relever, photographier et suivre l'avancement sans conduire un projet informatique. L'outil s'adapte à tous les corps d'état plutôt que de se spécialiser, ce qui en fait un choix raisonnable pour une entreprise qui intervient sur des chantiers de nature variable.

## Points forts
- Prise en main rapide par des équipes de terrain non informaticiennes
- Suivi visuel de l'avancement, photo à l'appui
- S'adapte à tous les corps d'état, sans paramétrage métier lourd
- Éditeur français, échelle humaine

## Points faibles
- Aucun tarif public
- Moins outillé que les plateformes des majors sur la gestion documentaire
- Périmètre volontairement limité au terrain
- Peu adapté aux opérations à maquette numérique contractuelle

## Idéal pour
Les entreprises de taille moyenne qui veulent structurer le suivi de chantier sans embarquer une plateforme conçue pour des opérations à cent millions.`,
    },
    {
      id: `procore`,
      nom: `Procore`,
      categorie: `Suivi de chantier`,
      prix: `Sur devis`,
      description_courte: `La plateforme de gestion de construction la plus déployée au monde, avec une couche d'automatisation sur les données du chantier.`,
      lien_affiliation: `https://exemple-affiliation.com/go/procore`,
      score_avis: 4.0,
      description_longue: `## Notre verdict
Procore est l'acteur de référence à l'échelle internationale, et cela se traduit surtout par l'étendue : gestion financière, documents, qualité, sécurité et planning dans un même ensemble. Pour une entreprise française, la question n'est pas la qualité de l'outil mais l'adéquation — les usages et le vocabulaire viennent du marché nord-américain, et l'écart se paie en temps de paramétrage.

## Points forts
- Périmètre fonctionnel très large, du financier au terrain
- Écosystème d'intégrations sans équivalent
- Recul d'usage considérable, sur tous types d'ouvrages
- Automatisation appuyée sur un volume de données de chantier rare

## Points faibles
- Conçu pour le marché nord-américain : vocabulaire et pratiques à traduire
- Coût élevé, et tarification par volume d'activité
- Déploiement lourd, rarement rentable sous une certaine taille
- Accompagnement en français inégal selon les modules

## Idéal pour
Les entreprises qui travaillent à l'international ou qui cherchent une plateforme unique plutôt qu'un assemblage d'outils spécialisés.`,
    },
    {
      id: `autodesk-construction-cloud`,
      nom: `Autodesk Construction Cloud`,
      categorie: `Suivi de chantier`,
      prix: `Sur devis`,
      description_courte: `La continuité entre la conception et le chantier, pour ceux qui travaillent déjà sous Revit.`,
      lien_affiliation: `https://exemple-affiliation.com/go/autodesk-construction-cloud`,
      score_avis: 4.1,
      description_longue: `## Notre verdict
L'argument tient en une phrase : si la maquette est faite sous Revit, la chaîne de chantier qui la prolonge sans rupture de format vaut mieux qu'une autre, même excellente. Autodesk Construction Cloud joue exactement là, avec des fonctions d'analyse qui signalent les risques et les écarts avant qu'ils ne deviennent des reprises. L'enfermement dans l'écosystème est le prix à payer, et il est réel.

## Points forts
- Continuité sans rupture depuis la conception sous Revit
- Analyse automatique des risques et des écarts d'exécution
- Modules cohérents entre eux, du plan à la réception
- Éditeur pérenne, feuille de route lisible

## Points faibles
- Enfermement marqué dans l'écosystème Autodesk
- Aucun tarif public, et abonnements qui s'accumulent
- Peu d'intérêt si la conception ne passe pas par Revit
- Poids fonctionnel disproportionné pour de petites opérations

## Idéal pour
Les maîtres d'œuvre et entreprises dont la conception est déjà sous Revit, et qui perdent du temps à convertir des formats entre le bureau et le chantier.`,
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
    {
      id: `manatal`,
      nom: `Manatal`,
      categorie: `Sourcing`,
      prix: `À partir de 19 $/mois par utilisateur`,
      description_courte: `Le logiciel de recrutement qui enrichit chaque candidature avec les profils publics et note l’adéquation au poste.`,
      lien_affiliation: `https://exemple-affiliation.com/go/manatal`,
      score_avis: 4.3,
      description_longue: `## Notre verdict
Manatal est l’un des rares logiciels de suivi des candidatures à tarif accessible qui fasse réellement quelque chose d’intelligent : à partir d’un CV, il retrouve les profils publics du candidat, complète la fiche et propose une note d’adéquation à l’offre. Pour un cabinet de deux personnes, c’est le niveau d’outillage qu’avaient les grands groupes il y a cinq ans.

## Points forts
- Enrichissement automatique des profils depuis les réseaux publics
- Note d’adéquation candidat/poste, avec les critères qui la justifient
- Tarif par utilisateur assumable par un cabinet de deux ou trois personnes
- Page carrière et diffusion multi-plateformes incluses

## Points faibles
- La note d’adéquation reste une aide au tri, jamais une décision
- Enrichissement moins riche sur les profils français que sur les anglophones
- Le support répond en anglais, sur des horaires asiatiques

## Idéal pour
Les cabinets de recrutement et PME qui gèrent encore leurs candidatures dans une boîte mail et un tableur.`,
    },
    {
      id: `workable`,
      nom: `Workable`,
      categorie: `Sourcing`,
      prix: `À partir de 189 $/mois`,
      description_courte: `La diffusion d’offres sur deux cents sites, le vivier de quatre cents millions de profils et le tri assisté, en libre-service.`,
      lien_affiliation: `https://exemple-affiliation.com/go/workable`,
      score_avis: 4.2,
      description_longue: `## Notre verdict
Workable a le mérite d’être complet et de s’acheter en ligne sans passer par un commercial. Diffusion en un clic, base de profils à contacter directement, rédaction d’offres assistée, entretiens structurés : c’est la plateforme qu’on prend quand on recrute régulièrement mais qu’on n’a pas d’équipe recrutement dédiée pour piloter un projet lourd.

## Points forts
- Achat et mise en service en libre-service, sans cycle commercial
- Diffusion automatique sur les principaux sites d’emploi
- Vivier de profils intégré, avec prise de contact directe
- Trames d’entretien structuré et grilles d’évaluation fournies

## Points faibles
- Tarif d’entrée élevé pour une structure qui recrute deux fois par an
- Le vivier est nettement plus riche en anglophone
- Les fonctions les plus utiles sont réservées aux formules hautes

## Idéal pour
Les entreprises de cinquante à cinq cents salariés qui recrutent en continu sans service recrutement constitué.`,
    },
    {
      id: `breezy-hr`,
      nom: `Breezy HR`,
      categorie: `Présélection`,
      prix: `Freemium — à partir de 189 $/mois`,
      description_courte: `Le recrutement en tableau visuel, avec entretiens vidéo différés et questionnaires de présélection inclus.`,
      lien_affiliation: `https://exemple-affiliation.com/go/breezy-hr`,
      score_avis: 4.1,
      description_longue: `## Notre verdict
Breezy présente le recrutement comme un tableau que l’on fait glisser, ce qui suffit à faire adopter l’outil par des managers qui n’ouvriront jamais un logiciel RH. Les questionnaires éliminatoires et l’entretien vidéo différé sont inclus dès les formules basses, là où d’autres les facturent en supplément. La formule gratuite couvre un poste ouvert en permanence.

## Points forts
- Formule gratuite permanente pour un poste ouvert : idéal pour juger
- Tableau visuel adopté sans formation par les managers opérationnels
- Questionnaires de présélection et entretien vidéo différé inclus
- Rédaction d’offres et résumés de candidature assistés

## Points faibles
- Le tarif grimpe fortement dès qu’on ouvre plusieurs postes
- Moins puissant que les grandes plateformes sur le sourcing actif
- Interface uniquement en anglais

## Idéal pour
Les PME et startups qui ouvrent deux ou trois postes à la fois et veulent impliquer les managers dans le tri.`,
    },
    {
      id: `hireflix`,
      nom: `Hireflix`,
      categorie: `Présélection`,
      prix: `À partir de 75 $/mois`,
      description_courte: `L’entretien vidéo différé sans engagement : le candidat répond quand il veut, le recruteur visionne en accéléré.`,
      lien_affiliation: `https://exemple-affiliation.com/go/hireflix`,
      score_avis: 4.2,
      description_longue: `## Notre verdict
Hireflix fait une seule chose et la vend au prix d’un abonnement logiciel plutôt qu’au prix d’une plateforme d’entreprise. On enregistre ses questions, le candidat répond en vidéo à son rythme, le recruteur visionne en accéléré et partage un lien au manager. Sur vingt candidatures, la présélection passe d’une semaine de créneaux téléphoniques à une soirée.

## Points forts
- Prix d’un logiciel, pas d’une plateforme d’entreprise
- Aucune limite d’entretiens sur les formules payantes
- Partage par lien : le manager donne son avis sans compte à créer
- Se branche sur les principaux logiciels de suivi des candidatures

## Points faibles
- L’entretien différé fait abandonner une partie des candidats qualifiés
- Aucune analyse automatique, et c’est un choix assumé de l’éditeur
- Rien d’autre que l’entretien vidéo : ce n’est pas un outil de gestion

## Idéal pour
Les recruteurs qui perdent leurs journées en présélections téléphoniques de sept minutes.`,
    },
    {
      id: `fetcher`,
      nom: `Fetcher`,
      categorie: `Sourcing`,
      prix: `À partir de 549 $/mois`,
      description_courte: `Le sourcing délégué à la machine : elle cherche, qualifie et envoie les séquences de contact, vous validez.`,
      lien_affiliation: `https://exemple-affiliation.com/go/fetcher`,
      score_avis: 4.0,
      description_longue: `## Notre verdict
Fetcher inverse la charge : au lieu de chercher des profils, on décrit le poste et l’outil apporte chaque semaine une liste qualifiée, avec les séquences de courriels déjà prêtes. Le recruteur passe son temps à valider ou écarter, ce qui affine le modèle. Sur un poste technique en tension, c’est la différence entre dix approches par semaine et cent.

## Points forts
- Le vivier arrive tout seul chaque semaine, sans requête à écrire
- Séquences de contact automatiques, avec relances
- Le modèle apprend des profils validés et écartés
- Statistiques de diversité du vivier, utiles pour élargir un recrutement

## Points faibles
- Tarif d’entrée qui suppose un volume de recrutement réel
- Couverture bien meilleure sur les profils nord-américains
- Un mauvais cadrage initial fait remonter des profils hors sujet pendant des semaines

## Idéal pour
Les équipes recrutement qui ont épuisé leurs viviers habituels sur des postes techniques en tension.`,
    },
    {
      id: `flatchr`,
      nom: `Flatchr`,
      categorie: `Présélection`,
      prix: `Sur devis — moins de 200 €/mois pour une PME`,
      description_courte: `Le tri des candidatures classé par pertinence, hébergé en France, à un tarif qui tient pour une entreprise de vingt personnes.`,
      lien_affiliation: `https://exemple-affiliation.com/go/flatchr`,
      score_avis: 4.3,
      description_longue: `## Notre verdict
Flatchr fait partie des rares outils de recrutement à IA dont le tarif reste compatible avec une PME : autour de deux cents euros par mois pour une entreprise d'une vingtaine de salariés, hébergement en France compris. Son module de correspondance identifie et hiérarchise les candidatures pertinentes, sans jamais trancher — la décision reste aux mains du recruteur et du manager, et c'est la seule position tenable dans un domaine où l'automatisation du refus est juridiquement et humainement risquée.

## Points forts
- Hébergement en France, argument devenu structurant sur des données de candidats
- Correspondance qui hiérarchise sans décider : le recruteur garde la main
- Tarif compatible avec une PME, là où les plateformes internationales décrochent
- Interface en français, accompagnement local

## Points faibles
- Aucun tarif public affiché : passage par un devis
- Moins outillé que les plateformes internationales sur les gros volumes
- La qualité du tri dépend directement de la qualité des offres publiées
- Écosystème d'intégrations plus restreint

## Idéal pour
Les PME et ETI qui recrutent régulièrement sans service dédié, et pour qui l'hébergement des données de candidats en France n'est pas négociable.`,
    },
    {
      id: `taleez`,
      nom: `Taleez`,
      categorie: `Présélection`,
      prix: `Sur devis`,
      description_courte: `L'outil de recrutement simple et français, pensé pour une équipe qui n'a pas de service RH dédié.`,
      lien_affiliation: `https://exemple-affiliation.com/go/taleez`,
      score_avis: 4.1,
      description_longue: `## Notre verdict
Taleez mise sur la simplicité plutôt que sur la profondeur fonctionnelle, ce qui est exactement ce que cherche une entreprise dont le recrutement est porté par un dirigeant ou un office manager entre deux autres tâches. Les fonctions automatisées servent le tri et la diffusion multi-plateformes, sans imposer d'apprendre un métier. Hébergement en France.

## Points forts
- Prise en main rapide, sans formation ni paramétrage lourd
- Diffusion multi-plateformes des offres depuis un seul endroit
- Hébergement français, interface et support en français
- Bon rapport fonctions-prix pour une petite structure

## Points faibles
- Fonctions d'IA plus légères que chez les concurrents qui en ont fait leur axe
- Aucun tarif public
- Atteint ses limites sur des recrutements en volume ou très spécialisés
- Peu d'automatisation au-delà du tri et de la diffusion

## Idéal pour
Les petites structures où le recrutement est une tâche parmi d'autres, et qui veulent arrêter de gérer les candidatures dans une boîte mail.`,
    },
    {
      id: `beetween`,
      nom: `Beetween`,
      categorie: `Sourcing`,
      prix: `Sur devis`,
      description_courte: `La lecture automatique des CV poussée plus loin que la moyenne, pour des candidatures qui arrivent dans tous les formats.`,
      lien_affiliation: `https://exemple-affiliation.com/go/beetween`,
      score_avis: 4.1,
      description_longue: `## Notre verdict
Le point fort de Beetween est l'analyse automatique des CV : extraire proprement l'expérience, les compétences et les coordonnées d'un document mal structuré est un problème plus difficile qu'il n'y paraît, et c'est là que la plupart des outils perdent de l'information. Pour une entreprise qui reçoit des candidatures en PDF, en Word et en captures d'écran, c'est le maillon qui détermine la qualité de tout le reste.

## Points forts
- Analyse automatique des CV parmi les plus abouties du marché français
- Récupère l'information même sur des documents mal structurés
- Éditeur français, hébergement local
- Adapté aux entreprises multi-sites et aux réseaux

## Points faibles
- Aucun tarif public
- Positionnement plus outillé, donc plus long à prendre en main que les offres simples
- Le confort de l'analyse automatique masque parfois des erreurs d'extraction à relire
- Moins visible que les leaders internationaux

## Idéal pour
Les entreprises qui reçoivent des candidatures en volume et dans des formats disparates, et qui veulent cesser de ressaisir.`,
    },
    {
      id: `lucca`,
      nom: `Lucca`,
      categorie: `Analyse RH`,
      prix: `Sur devis`,
      description_courte: `La suite RH française — congés, entretiens, rémunération — avec l'automatisation posée sur les données déjà présentes.`,
      lien_affiliation: `https://exemple-affiliation.com/go/lucca`,
      score_avis: 4.2,
      description_longue: `## Notre verdict
Lucca n'est pas un outil d'IA, c'est une suite RH française dans laquelle l'automatisation s'est installée là où les données étaient déjà : absences, entretiens, rémunération, notes de frais. C'est une différence de nature avec les outils de recrutement — ici, la valeur vient de ce que l'entreprise possède déjà et n'exploite pas. Pour un service RH qui veut cesser de reconstruire les mêmes tableaux chaque trimestre, c'est le bon angle.

## Points forts
- Modules qui couvrent le quotidien RH, pas seulement le recrutement
- Automatisation appuyée sur les données déjà saisies dans l'entreprise
- Éditeur français, conformité au droit du travail local
- Adoption large, écosystème d'intégrations fourni

## Points faibles
- Aucun tarif public, facturation par module et par salarié
- Le coût grimpe avec le nombre de modules activés
- Ne couvre pas le recrutement en profondeur : à compléter par un outil dédié
- Projet de déploiement, pas une souscription

## Idéal pour
Les services RH constitués qui veulent exploiter leurs propres données plutôt qu'acheter une brique d'IA de plus.`,
    },
    {
      id: `smartrecruiters`,
      nom: `SmartRecruiters`,
      categorie: `Sourcing`,
      prix: `Sur devis`,
      description_courte: `La plateforme de recrutement des grandes organisations, avec les fonctions d'IA les plus abouties du marché.`,
      lien_affiliation: `https://exemple-affiliation.com/go/smartrecruiters`,
      score_avis: 4.0,
      description_longue: `## Notre verdict
SmartRecruiters figure parmi les plateformes les plus avancées sur l'automatisation du recrutement, et cela se paie de la manière habituelle : un périmètre conçu pour des organisations qui recrutent par centaines, avec la lourdeur qui va avec. Pour une entreprise française de taille moyenne, la vraie question n'est pas la puissance de l'outil mais le rapport entre ce qu'il permet et ce qui sera réellement utilisé.

## Points forts
- Fonctions d'automatisation parmi les plus abouties du marché
- Conçu pour le recrutement en volume et multi-pays
- Écosystème d'intégrations très large
- Recul d'usage important chez de grands employeurs

## Points faibles
- Surdimensionné et coûteux sous une certaine taille
- Hébergement et traitement des données à examiner de près selon les besoins
- Déploiement long, qui mobilise une équipe projet
- Interface et accompagnement pensés d'abord pour l'anglais

## Idéal pour
Les grandes organisations qui recrutent en volume, sur plusieurs pays, et disposent d'une équipe pour porter le déploiement.`,
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
      id: `ramp`,
      nom: `Ramp`,
      categorie: `Notes de frais`,
      prix: `Gratuit — les revenus viennent de l’interchange bancaire`,
      description_courte: `Les cartes d’entreprise, les dépenses et les justificatifs rapprochés tout seuls, sans abonnement.`,
      lien_affiliation: `https://exemple-affiliation.com/go/ramp`,
      score_avis: 4.5,
      description_longue: `## Notre verdict
Ramp est l’anomalie du secteur : la plateforme est gratuite, financée par la commission d’interchange sur les cartes. Chaque dépense est rapprochée de son justificatif, les règles de politique interne sont appliquées à la volée, et les abonnements dormants sont signalés. Une direction financière y trouve en général plusieurs milliers d’euros de dépenses oubliées le premier mois.

## Points forts
- Aucun abonnement : le modèle repose sur les cartes, pas sur une licence
- Rapprochement automatique dépense / justificatif, avec relance du salarié
- Détection des abonnements dormants et des doublons de fournisseurs
- Export propre vers les principaux logiciels comptables

## Points faibles
- Disponible aux États-Unis d’abord : la couverture européenne reste partielle
- Suppose d’adopter leurs cartes, donc de changer de banque de fonctionnement
- L’intégration avec un cabinet français demande un travail d’export

## Idéal pour
Les entreprises en croissance dont les dépenses partent dans tous les sens et qui n’ont aucune visibilité avant la clôture.`,
    },
    {
      id: `expensify`,
      nom: `Expensify`,
      categorie: `Notes de frais`,
      prix: `Freemium — à partir de 5 $/mois par utilisateur`,
      description_courte: `Le justificatif photographié, lu et transformé en note de frais avant même d’avoir quitté le restaurant.`,
      lien_affiliation: `https://exemple-affiliation.com/go/expensify`,
      score_avis: 4.2,
      description_longue: `## Notre verdict
Expensify est l’outil qui a rendu la note de frais supportable : on photographie le ticket, la lecture automatique en tire le montant, la date et le marchand, la note se crée seule et part en validation. Le rapprochement avec la carte bancaire d’entreprise ferme la boucle. Simple, éprouvé, et gratuit jusqu’à vingt-cinq notes par mois.

## Points forts
- Lecture des tickets fiable, y compris froissés et photographiés de travers
- Formule gratuite jusqu’à vingt-cinq notes par mois
- Rapprochement automatique avec les cartes d’entreprise
- Application mobile parmi les plus abouties du secteur

## Points faibles
- Le tarif par utilisateur pèse dans une entreprise où tout le monde note des frais
- Les règles de politique interne sont moins fines que chez les spécialistes
- Support en anglais uniquement

## Idéal pour
Les entreprises de dix à cent salariés dont les notes de frais arrivent en retard, en vrac, et se traitent à la main.`,
    },
    {
      id: `docyt`,
      nom: `Docyt`,
      categorie: `Extraction de documents`,
      prix: `À partir de 50 $/mois`,
      description_courte: `La comptabilité tenue en continu : factures lues, écritures proposées, rapprochement bancaire quotidien.`,
      lien_affiliation: `https://exemple-affiliation.com/go/docyt`,
      score_avis: 4.0,
      description_longue: `## Notre verdict
Docyt vise le point d’équilibre entre le simple lecteur de factures et la plateforme complète : les documents sont lus, catégorisés selon l’historique du dossier, et les écritures poussées dans le logiciel comptable existant. Le cabinet garde son outil de production, le client obtient des chiffres à jour toute l’année plutôt qu’une fois par trimestre.

## Points forts
- Se greffe sur le logiciel comptable en place, sans migration
- Catégorisation qui apprend de l’historique du dossier
- Rapprochement bancaire quotidien plutôt que trimestriel
- Tableaux de bord de gestion pour le client final

## Points faibles
- Pensé pour le plan comptable américain : la TVA française demande du paramétrage
- La mise en route d’un dossier prend plusieurs semaines
- Peu de références en France, support en anglais

## Idéal pour
Les cabinets qui veulent vendre du suivi mensuel plutôt que de la production trimestrielle, sans changer d’outil.`,
    },
    {
      id: `keeper`,
      nom: `Keeper`,
      categorie: `Révision`,
      prix: `À partir de 8 $/mois par dossier`,
      description_courte: `La liste des questions à poser au client, générée toute seule, et le portail où il répond.`,
      lien_affiliation: `https://exemple-affiliation.com/go/keeper`,
      score_avis: 4.3,
      description_longue: `## Notre verdict
Keeper attaque le seul goulot d’étranglement réel d’un cabinet : les opérations non identifiées dont seul le client connaît la nature. L’outil repère les écritures douteuses, formule la question, la pose au client dans un portail clair, et relance. Le collaborateur reprend un dossier où les réponses sont déjà là, et le tarif au dossier reste dérisoire.

## Points forts
- Questions au client générées automatiquement à partir des anomalies
- Portail simple, que les clients utilisent réellement
- Relances automatiques : le cabinet cesse d’être l’huissier de son dossier
- Tarif au dossier, très bas, sans engagement

## Points faibles
- Connecté d’abord aux logiciels anglo-saxons dominants
- Ne fait pas de production comptable : c’est un outil de révision
- Les clients qui ne répondaient pas au téléphone ne répondent pas plus au portail

## Idéal pour
Les cabinets dont les clôtures traînent des semaines faute de réponses clients.`,
    },
    {
      id: `fyle`,
      nom: `Fyle`,
      categorie: `Notes de frais`,
      prix: `À partir de 8 $/mois par utilisateur`,
      description_courte: `Le justificatif envoyé par message texte ou courriel, sans application à installer ni salarié à former.`,
      lien_affiliation: `https://exemple-affiliation.com/go/fyle`,
      score_avis: 4.1,
      description_longue: `## Notre verdict
L’échec de la plupart des outils de notes de frais est humain : les salariés n’installent pas l’application. Fyle contourne le problème — on transfère le courriel du reçu, ou on envoie une photo par message texte, et la note se crée. L’alerte en temps réel sur la carte bancaire réclame le justificatif dans la minute qui suit l’achat.

## Points forts
- Aucune application à installer : courriel ou message texte suffisent
- Alerte en temps réel sur la carte, le justificatif est réclamé dans la minute
- Règles de politique interne vérifiées à la saisie, pas à la validation
- S’intègre aux principaux logiciels comptables

## Points faibles
- Tarif par utilisateur qui grimpe avec l’effectif
- Fonctions de reporting en retrait des grands acteurs
- Documentation et support en anglais

## Idéal pour
Les entreprises dont les salariés ne rendent jamais leurs justificatifs et où l’application dédiée a déjà échoué.`,
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
      id: `clio`,
      nom: `Clio`,
      categorie: `Gestion de cabinet`,
      prix: `À partir de 49 $/mois par utilisateur`,
      description_courte: `La gestion de cabinet de référence, avec l’assistant qui résume un dossier et rédige un courrier depuis les pièces.`,
      lien_affiliation: `https://exemple-affiliation.com/go/clio`,
      score_avis: 4.4,
      description_longue: `## Notre verdict
Clio est ce que la plupart des cabinets anglo-saxons utilisent pour tenir dossiers, temps et facturation, et son assistant travaille sur les données du cabinet plutôt que dans le vide : résumé d’un dossier volumineux, brouillon de courrier appuyé sur les pièces, recherche en langage courant dans les archives. L’abonnement se prend en ligne, sans passer par un commercial.

## Points forts
- Assistant branché sur les dossiers réels du cabinet, pas sur un corpus général
- Dossiers, temps passé, facturation et paiement dans un seul outil
- Achat en libre-service, tarif par utilisateur lisible
- Portail client sécurisé pour l’échange de pièces

## Points faibles
- Conçu pour le droit anglo-saxon : la facturation à l’acte française demande des contournements
- Le coût par utilisateur pèse dans un cabinet de plus de dix personnes
- Aucune base jurisprudentielle française intégrée

## Idéal pour
Les cabinets qui tiennent encore leurs dossiers dans des dossiers réseau et leur temps dans un tableur.`,
    },
    {
      id: `gavel`,
      nom: `Gavel`,
      categorie: `Automatisation de documents`,
      prix: `À partir de 83 $/mois`,
      description_courte: `Le modèle d’acte transformé en questionnaire : on répond, le document sort rempli et cohérent.`,
      lien_affiliation: `https://exemple-affiliation.com/go/gavel`,
      score_avis: 4.2,
      description_longue: `## Notre verdict
Un cabinet qui produit vingt fois le même type d’acte perd un temps considérable à copier, coller et oublier une occurrence sur trois. Gavel transforme un modèle en questionnaire : on répond aux questions, le document sort complet, avec les clauses conditionnelles au bon endroit. Le questionnaire peut même être ouvert au client, qui remplit lui-même.

## Points forts
- Le modèle se construit à partir d’un document Word existant, sans langage à apprendre
- Clauses conditionnelles gérées proprement, sans oubli d’occurrence
- Questionnaire ouvrable au client : la collecte d’informations cesse d’être un aller-retour
- Rentabilise un acte répétitif dès la dixième occurrence

## Points faibles
- Sans acte répétitif à automatiser, l’outil ne sert à rien
- La mise en place d’un premier modèle demande une demi-journée
- Interface en anglais, sans support français

## Idéal pour
Les cabinets et services juridiques qui produisent en série des baux, des statuts, des transactions ou des contrats de travail.`,
    },
    {
      id: `genie-ai`,
      nom: `Genie AI`,
      categorie: `Rédaction de contrats`,
      prix: `Freemium — à partir de 49 $/mois`,
      description_courte: `La bibliothèque de modèles de contrats commentés, avec l’assistant de rédaction et de relecture greffé dans Word.`,
      lien_affiliation: `https://exemple-affiliation.com/go/genie-ai`,
      score_avis: 4.1,
      description_longue: `## Notre verdict
Genie combine deux choses rarement réunies : une bibliothèque ouverte de modèles de contrats réels, et un assistant qui rédige ou relit dans Word en s’appuyant dessus. Pour une petite structure sans bibliothèque interne, c’est un point de départ crédible plutôt qu’une page blanche, et la relecture signale les clauses manquantes par rapport aux usages du type de contrat.

## Points forts
- Bibliothèque de modèles réels, commentés, consultable gratuitement
- Assistant intégré à Word : rien à changer dans les habitudes
- Relecture qui signale les clauses absentes ou déséquilibrées
- Formule gratuite suffisante pour juger sur un contrat

## Points faibles
- Modèles de droit anglais : à ne jamais reprendre tels quels en droit français
- La responsabilité de la relecture reste entière, l’outil ne conseille pas
- Fonctions collaboratives limitées face aux plateformes contractuelles

## Idéal pour
Les juristes d’entreprise isolés et les petits cabinets qui repartent d’une page blanche à chaque contrat.`,
    },
    {
      id: `robin-ai`,
      nom: `Robin AI`,
      categorie: `Analyse de contrats`,
      prix: `À partir de 89 $/mois`,
      description_courte: `La relecture de contrat qui explique chaque clause en français courant et propose la reformulation.`,
      lien_affiliation: `https://exemple-affiliation.com/go/robin-ai`,
      score_avis: 4.0,
      description_longue: `## Notre verdict
Robin s’est fait connaître sur la revue contractuelle de masse en entreprise, mais sa formule d’entrée est achetable en ligne et vise le contrat isolé : on dépose un accord reçu, l’outil explique chaque clause en langage clair, signale ce qui s’écarte du marché et propose une reformulation à renvoyer. C’est un second regard à quatre-vingt-dix euros plutôt qu’à quatre cents.

## Points forts
- Explication clause par clause en langage clair, utile face à un client non juriste
- Signale les stipulations qui s’écartent des usages du marché
- Reformulation proposée, prête à être envoyée en contre-proposition
- Formule d’entrée en libre-service, sans engagement annuel

## Points faibles
- Entraîné d’abord sur le droit anglais : prudence sur les contrats français
- Le dépôt d’un contrat confidentiel chez un tiers demande une vérification préalable
- Aucune valeur de conseil : c’est une aide à la lecture

## Idéal pour
Les juristes d’entreprise et avocats qui reçoivent des contrats rédigés par la partie adverse et n’ont pas le temps de tout éplucher.`,
    },
    {
      id: `patentpal`,
      nom: `PatentPal`,
      categorie: `Propriété intellectuelle`,
      prix: `À partir de 100 $/mois`,
      description_courte: `La rédaction des parties formelles d’une demande de brevet, générées à partir des revendications.`,
      lien_affiliation: `https://exemple-affiliation.com/go/patentpal`,
      score_avis: 4.0,
      description_longue: `## Notre verdict
Une demande de brevet contient une part considérable de texte formel : description des figures, résumé, reformulations des revendications. PatentPal génère ces sections à partir des revendications, dans le format attendu, et laisse au conseil le seul travail qui compte — la stratégie de protection. Le gain se compte en heures facturables récupérées par dossier.

## Points forts
- Génère les sections formelles à partir des seules revendications
- Respecte les formats attendus par les offices
- Export direct vers Word, prêt à relire
- Abonnement mensuel en libre-service, résiliable

## Points faibles
- Périmètre étroit : uniquement la rédaction de brevets
- Formats calés sur l’office américain, adaptation nécessaire ailleurs
- Toute génération demande une relecture attentive du conseil

## Idéal pour
Les conseils en propriété industrielle et cabinets de brevets qui passent des heures sur des sections dont la valeur ajoutée est nulle.`,
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
    {
      id: `quizizz-ai`,
      nom: `Quizizz`,
      categorie: `Activités interactives`,
      prix: `Freemium — à partir de 8 $/mois`,
      description_courte: `Le quiz de classe généré à partir d’un support, joué en direct ou en autonomie, corrigé tout seul.`,
      lien_affiliation: `https://exemple-affiliation.com/go/quizizz-ai`,
      score_avis: 4.4,
      description_longue: `## Notre verdict
Quizizz est déjà dans des millions de classes ; ses fonctions génératives ont supprimé la partie fastidieuse — écrire les questions. On dépose un texte, un chapitre ou un lien, l’outil propose des questions avec des distracteurs plausibles, et le rendu ludique fait participer des élèves qui ne lèvent jamais la main.

## Points forts
- Questions générées à partir de vos propres supports, pas d’une banque générique
- Distracteurs plausibles : le quiz évalue au lieu de se deviner
- Correction et statistiques automatiques, élève par élève
- Formule gratuite très généreuse, adoptée mondialement

## Points faibles
- Les questions générées demandent une relecture disciplinaire
- Le format ludique ne convient pas à toutes les évaluations
- Suppose un appareil connecté par élève ou par binôme

## Idéal pour
Les enseignants qui veulent une évaluation formative rapide sans passer une soirée à écrire vingt questions.`,
    },
    {
      id: `kahoot`,
      nom: `Kahoot!`,
      categorie: `Activités interactives`,
      prix: `Freemium — à partir de 4 $/mois`,
      description_courte: `Le quiz en direct que toute une classe connaît déjà, avec les questions écrites par la machine.`,
      lien_affiliation: `https://exemple-affiliation.com/go/kahoot`,
      score_avis: 4.2,
      description_longue: `## Notre verdict
Kahoot n’a rien à prouver côté engagement : le format est entré dans les mœurs scolaires. Le générateur de questions en fait un outil de préparation et non plus seulement d’animation — on colle un texte, on obtient une session complète. C’est le moyen le plus rapide de réveiller une classe en fin de journée.

## Points forts
- Format connu de tous : aucune explication à donner aux élèves
- Questions générées à partir d’un texte, d’un document ou d’un sujet
- Rapports de participation exportables pour le suivi
- Tarif enseignant très bas, formule gratuite fonctionnelle

## Points faibles
- Fonctions génératives réservées aux formules payantes
- L’aspect compétitif ne convient pas à toutes les classes
- Peu adapté aux questions ouvertes et au raisonnement long

## Idéal pour
Les enseignants qui veulent réviser un chapitre en dix minutes sans préparer la séance la veille.`,
    },
    {
      id: `eduaide-ai`,
      nom: `Eduaide.ai`,
      categorie: `Préparation de cours`,
      prix: `Freemium — à partir de 10 $/mois`,
      description_courte: `Une centaine de générateurs pédagogiques, alignables sur un référentiel de compétences donné.`,
      lien_affiliation: `https://exemple-affiliation.com/go/eduaide-ai`,
      score_avis: 4.3,
      description_longue: `## Notre verdict
Eduaide se distingue par la finesse de ses générateurs : plus de cent types de ressources — séquence, consigne différenciée, question de discussion, grille d’évaluation — et surtout la possibilité de tout aligner sur un référentiel de compétences fourni. C’est ce qui le rend transposable hors du système américain, contrairement à ses concurrents.

## Points forts
- Plus de cent générateurs, chacun avec sa trame propre
- Alignement possible sur un référentiel de compétences que l’on fournit
- Espace de travail qui conserve et réorganise les ressources produites
- Formule gratuite suffisante pour un usage hebdomadaire

## Points faibles
- Interface dense : trouver le bon générateur demande un temps d’adaptation
- Le rendu français est correct mais moins nuancé que l’anglais
- Toute ressource demande une relecture disciplinaire

## Idéal pour
Les enseignants et formateurs qui travaillent par compétences et refont chaque année les mêmes supports.`,
    },
    {
      id: `padlet`,
      nom: `Padlet`,
      categorie: `Supports de cours`,
      prix: `Freemium — à partir de 7 $/mois`,
      description_courte: `Le mur collaboratif que les élèves alimentent, avec la génération de contenus et d’images intégrée.`,
      lien_affiliation: `https://exemple-affiliation.com/go/padlet`,
      score_avis: 4.2,
      description_longue: `## Notre verdict
Padlet est devenu un réflexe : un mur, un lien, et trente élèves déposent leurs contributions sans compte à créer. Les fonctions génératives ajoutent le montage du support — plan de leçon, images d’illustration, cartes mentales — directement dans le mur. C’est l’outil du travail de groupe qui ne demande aucune logistique.

## Points forts
- Aucun compte élève nécessaire : un lien suffit
- Contributions en direct, visibles de toute la classe
- Génération d’images et de plans intégrée au mur
- Formule gratuite pour trois murs, largement suffisante pour essayer

## Points faibles
- Les fonctions génératives sont réservées aux formules payantes
- Sans cadre posé, le mur devient vite illisible
- L’hébergement des contributions d’élèves demande une vérification côté établissement

## Idéal pour
Les enseignants qui font travailler en groupe et perdent un quart d’heure à chaque séance en logistique de connexion.`,
    },
    {
      id: `classpoint-ai`,
      nom: `ClassPoint`,
      categorie: `Supports de cours`,
      prix: `Freemium — à partir de 8 $/mois`,
      description_courte: `L’interactivité greffée directement dans PowerPoint, sans changer d’outil ni refaire ses diapositives.`,
      lien_affiliation: `https://exemple-affiliation.com/go/classpoint-ai`,
      score_avis: 4.1,
      description_longue: `## Notre verdict
La plupart des enseignants ont déjà leurs supports, en PowerPoint, et ne les referont pas. ClassPoint s’y installe : depuis une diapositive existante, il génère des questions, lance un vote, récupère les réponses des élèves, annote en direct. Zéro migration, ce qui est la seule raison pour laquelle un outil de ce type finit par être utilisé.

## Points forts
- Fonctionne dans PowerPoint : aucun support à refaire
- Questions générées à partir du contenu de la diapositive affichée
- Réponses des élèves collectées en direct, sans quitter la présentation
- Formule gratuite fonctionnelle pour un usage régulier

## Points faibles
- Windows et PowerPoint obligatoires : rien pour Google Slides
- Les questions générées restent de surface sur un contenu complexe
- Suppose un appareil connecté par élève

## Idéal pour
Les enseignants et formateurs qui ont des années de diapositives et refusent, à juste titre, de tout refaire.`,
    },
    {
      id: `nolej`,
      nom: `Nolej`,
      categorie: `Supports de cours`,
      prix: `Palier gratuit, puis abonnement`,
      description_courte: `Un document, une vidéo ou un cours transformés en activités interactives — quiz, cartes, résumés — en quelques minutes.`,
      lien_affiliation: `https://exemple-affiliation.com/go/nolej`,
      score_avis: 4.2,
      description_longue: `## Notre verdict
La matière ne manque jamais à un enseignant : ce qui manque, c'est le temps de la transformer en activités. Nolej part d'un support existant — document, vidéo, page — et en tire un ensemble d'activités interactives exportables vers les plateformes d'apprentissage courantes. L'éditeur est européen, ce qui pèse quand les productions concernent des élèves. Le résultat demande une relecture, mais il part d'un brouillon complet plutôt que d'une page blanche.

## Points forts
- Part d'un support déjà écrit plutôt que d'une consigne à rédiger
- Exporte vers les plateformes d'apprentissage standard du marché
- Produit plusieurs types d'activités d'un seul document
- Palier gratuit permettant d'évaluer sur un vrai cours

## Points faibles
- Les activités générées demandent une relecture pédagogique systématique
- La qualité dépend étroitement de celle du document de départ
- Moins pertinent pour les disciplines très formelles
- Interface pensée d'abord pour l'anglais

## Idéal pour
Les enseignants et formateurs qui ont déjà leurs supports et veulent les rendre interactifs sans y consacrer leurs soirées.`,
    },
    {
      id: `kwyk`,
      nom: `Kwyk`,
      categorie: `Différenciation`,
      prix: `Abonnement établissement ou famille`,
      description_courte: `Les exercices de mathématiques générés et corrigés automatiquement, alignés sur les programmes français.`,
      lien_affiliation: `https://exemple-affiliation.com/go/kwyk`,
      score_avis: 4.2,
      description_longue: `## Notre verdict
Kwyk a une qualité que peu d'outils partagent : il est construit sur les programmes français, pas traduit depuis un système scolaire étranger. Les exercices sont générés avec des valeurs différentes pour chaque élève, corrigés automatiquement, et le professeur voit qui bloque et où. Sur une classe de trente, c'est la différence entre supposer et savoir.

## Points forts
- Aligné sur les programmes français, du collège au lycée
- Énoncés générés avec des valeurs différentes par élève
- Correction automatique et suivi individuel des blocages
- Utilisé en établissement comme à la maison

## Points faibles
- Périmètre mathématique : rien pour les autres disciplines
- Le suivi ne vaut que si les élèves font réellement les exercices
- La correction automatique ne juge pas le raisonnement écrit
- Abonnement à la charge de l'établissement ou des familles

## Idéal pour
Les professeurs de mathématiques qui veulent donner du travail différencié sans multiplier par trente le temps de correction.`,
    },
    {
      id: `lalilo`,
      nom: `Lalilo`,
      categorie: `Tutorat`,
      prix: `Abonnement établissement`,
      description_courte: `L'accompagnement individuel de la lecture au primaire, avec le relevé de ce qui bloque pour chaque élève.`,
      lien_affiliation: `https://exemple-affiliation.com/go/lalilo`,
      score_avis: 4.3,
      description_longue: `## Notre verdict
Au primaire, l'écart entre les élèves sur la lecture se creuse vite, et un professeur seul devant vingt-cinq enfants ne peut pas écouter chacun lire assez souvent. Lalilo prend cette tâche-là : exercices adaptés au niveau réel de chaque élève, et surtout un relevé qui dit au professeur qui bute sur quel son. Née en France, la plateforme s'est étendue depuis à d'autres pays.

## Points forts
- Adapte le travail au niveau réel de chaque élève, sans intervention
- Relevé précis des difficultés, exploitable en classe
- Conçue au départ pour le français et l'école primaire
- Utilisée en établissement, avec un cadre d'usage établi

## Points faibles
- Périmètre étroit : lecture et primaire, rien au-delà
- Ne remplace pas l'écoute directe d'un enfant qui lit
- Suppose un accès individuel aux écrans en classe
- Abonnement porté par l'établissement

## Idéal pour
Les professeurs des écoles qui veulent savoir précisément où en est chaque élève en lecture, plutôt que de le deviner.`,
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
    {
      id: `owner-com`,
      nom: `Owner`,
      categorie: `Marketing & tendances`,
      prix: `À partir de 99 $/mois`,
      description_courte: `Le site, la commande en direct et le marketing du restaurant, pour cesser de laisser un tiers du chiffre aux plateformes.`,
      lien_affiliation: `https://exemple-affiliation.com/go/owner-com`,
      score_avis: 4.3,
      description_longue: `## Notre verdict
Owner s’attaque au sujet qui fâche : la commission prélevée par les plateformes de livraison. L’outil monte un site de commande à la marque du restaurant, l’optimise pour la recherche locale, et relance automatiquement les clients par courriel et message texte. L’objectif affiché est de basculer une part des commandes en direct.

## Points forts
- Commande en direct, sans commission de plateforme
- Site optimisé pour la recherche locale, ce que peu de restaurants ont
- Relances automatiques des clients qui ne sont pas revenus
- Mise en service prise en charge, sans travail technique du restaurateur

## Points faibles
- Abonnement mensuel réel, à amortir sur le volume récupéré
- Ne remplace pas la visibilité des plateformes sur la clientèle de passage
- Marché américain d’abord, avec les habitudes de commande correspondantes

## Idéal pour
Les restaurants qui font du volume en livraison et voient partir un tiers de leur chiffre en commissions.`,
    },
    {
      id: `7shifts`,
      nom: `7shifts`,
      categorie: `Prévision & planning`,
      prix: `Freemium — à partir de 35 $/mois par établissement`,
      description_courte: `Le planning d’équipe calé sur les ventes prévues, avec les échanges de postes gérés par l’équipe elle-même.`,
      lien_affiliation: `https://exemple-affiliation.com/go/7shifts`,
      score_avis: 4.4,
      description_longue: `## Notre verdict
Le planning est le poste où un restaurant gagne ou perd sa marge, et celui que personne n’a le temps de refaire. 7shifts prévoit les ventes à l’heure, propose le planning correspondant, et laisse l’équipe gérer ses échanges depuis son téléphone. La formule gratuite couvre un établissement et une trentaine de personnes.

## Points forts
- Formule gratuite pour un établissement, rare dans cette catégorie
- Prévision des ventes à l’heure, qui pilote le nombre de personnes en salle
- Échanges de postes gérés par l’équipe, sans passer par le gérant
- Coût de main-d’œuvre suivi en pourcentage du chiffre, en direct

## Points faibles
- Le droit du travail français n’est pas pris en charge nativement
- La prévision demande plusieurs mois d’historique de caisse pour valoir quelque chose
- Les modules avancés font grimper l’abonnement rapidement

## Idéal pour
Les restaurants dont le planning se fait le dimanche soir sur un tableur et coûte deux points de marge chaque mois.`,
    },
    {
      id: `marginedge`,
      nom: `MarginEdge`,
      categorie: `Achats & stocks`,
      prix: `À partir de 330 $/mois par établissement`,
      description_courte: `Les factures fournisseurs lues à la ligne, et le coût de chaque plat recalculé toutes les nuits.`,
      lien_affiliation: `https://exemple-affiliation.com/go/marginedge`,
      score_avis: 4.2,
      description_longue: `## Notre verdict
MarginEdge lit les factures fournisseurs jusqu’au détail de chaque ligne, ce qui permet de suivre le prix réel de chaque ingrédient au jour le jour, et de voir immédiatement qu’un plat vedette est passé sous le seuil de rentabilité. C’est le poste où la marge fuit sans que personne ne le voie, et le seul chiffre qui le montre.

## Points forts
- Lecture des factures à la ligne, pas seulement du total
- Coût de revient de chaque plat recalculé chaque nuit
- Alerte sur les hausses de prix fournisseurs
- Commande fournisseurs depuis le même outil

## Points faibles
- Abonnement élevé pour un établissement unique
- La saisie initiale des fiches techniques est un travail long et ingrat
- Réseau de fournisseurs pensé pour le marché américain

## Idéal pour
Les restaurants et petits groupes dont le coût matière dérive sans que les fiches techniques soient à jour.`,
    },
    {
      id: `jolt`,
      nom: `Jolt`,
      categorie: `Pilotage`,
      prix: `À partir d’environ 100 $/mois par établissement`,
      description_courte: `Les listes de contrôle d’ouverture et de fermeture, les températures et les tâches, prouvées et horodatées.`,
      lien_affiliation: `https://exemple-affiliation.com/go/jolt`,
      score_avis: 4.0,
      description_longue: `## Notre verdict
Jolt remplace le classeur d’hygiène et les listes affichées en cuisine par des contrôles horodatés avec photo. En cas de contrôle sanitaire, la traçabilité est immédiate ; au quotidien, le gérant sait ce qui a été fait sans être sur place. Les étiquettes de date de péremption imprimées à la demande suppriment une non-conformité classique.

## Points forts
- Traçabilité horodatée et photographiée, opposable en contrôle
- Le gérant voit à distance ce qui a été fait, et par qui
- Étiquetage des dates de péremption imprimé à la demande
- Adopté facilement par les équipes, y compris saisonnières

## Points faibles
- Matériel à prévoir : tablette et imprimante d’étiquettes
- Le paramétrage des listes demande une vraie mise à plat des procédures
- Pensé pour la réglementation américaine, à adapter aux obligations françaises

## Idéal pour
Les groupes multi-sites et les établissements à fort renouvellement d’équipe, où les procédures ne tiennent que si elles sont vérifiables.`,
    },
    {
      id: `menu-tiger`,
      nom: `MenuTiger`,
      categorie: `Réservation`,
      prix: `Freemium — à partir de 19 $/mois`,
      description_courte: `La carte en code-barres à scanner, modifiable en une minute, avec la commande à table et les statistiques de plats.`,
      lien_affiliation: `https://exemple-affiliation.com/go/menu-tiger`,
      score_avis: 4.0,
      description_longue: `## Notre verdict
La carte figée en PDF est le plus mauvais choix qu’un restaurant puisse faire : illisible sur téléphone, invisible pour Google, impossible à corriger un jour de rupture. MenuTiger la remplace par une carte web scannable, modifiable en une minute, qui prend les commandes à table et dit quels plats sont réellement consultés.

## Points forts
- Carte modifiable en une minute, y compris en plein service
- Commande et paiement à table, sans application à installer pour le client
- Statistiques de consultation : on voit quels plats attirent l’œil
- Formule gratuite pour un établissement et une carte

## Points faibles
- Le code-barres à scanner reste diversement apprécié de la clientèle
- Les fonctions de commande sont réservées aux formules payantes
- Ne remplace pas un logiciel de caisse

## Idéal pour
Les restaurants dont la carte est encore un PDF illisible sur téléphone, et qui la réimpriment à chaque changement de prix.`,
    },
    {
      id: `malou`,
      nom: `Malou`,
      categorie: `Visibilité & avis`,
      prix: `Sur devis`,
      description_courte: `La visibilité locale du restaurant tenue sur cinquante plateformes — y compris désormais dans les réponses des IA.`,
      lien_affiliation: `https://exemple-affiliation.com/go/malou`,
      score_avis: 4.4,
      description_longue: `## Notre verdict
Malou a vu venir un basculement que beaucoup de restaurateurs subissent encore : la question « où manger ce soir » ne se pose plus seulement à Google, elle se pose à ChatGPT, à Gemini et aux résumés générés en haut des résultats. La plateforme travaille donc la visibilité locale classique — fiche Google, avis, réseaux, une cinquantaine de plateformes — et la visibilité dans les moteurs génératifs, avec un agent entraîné sur les problématiques du secteur. Française, et pensée pour les groupes multi-sites.

## Points forts
- Traite la visibilité dans les réponses générées, pas seulement le référencement classique
- Une cinquantaine de plateformes tenues depuis un seul endroit
- Gestion des avis intégrée, avec réponses assistées
- Conçue pour les groupes de plusieurs établissements

## Points faibles
- Aucun tarif public
- Pensée pour les groupes : un établissement seul paiera pour des fonctions qu'il n'utilisera pas
- La visibilité dans les moteurs génératifs reste un terrain mouvant
- Suppose que quelqu'un s'occupe réellement du sujet dans l'entreprise

## Idéal pour
Les groupes de trois à cinquante établissements dont la clientèle se décide en ligne, et qui veulent exister aussi dans les réponses des assistants.`,
    },
    {
      id: `innovorder`,
      nom: `Innovorder`,
      categorie: `Pilotage`,
      prix: `Sur devis`,
      description_courte: `La caisse, la commande en ligne et les bornes réunies, avec l'analyse des ventes qui en découle.`,
      lien_affiliation: `https://exemple-affiliation.com/go/innovorder`,
      score_avis: 4.1,
      description_longue: `## Notre verdict
Innovorder est un éditeur français qui a construit son offre autour du point le plus stratégique du restaurant : l'encaissement et la prise de commande. Les données d'exploitation qui en sortent — ce qui se vend, à quelle heure, avec quoi — valent bien plus que ce qu'un tableur en fera jamais. La valeur n'est donc pas dans une couche d'IA affichée, mais dans le fait de rassembler en un point ce que la plupart des établissements éparpillent entre trois prestataires.

## Points forts
- Caisse, commande en ligne et bornes dans un même ensemble
- Analyse des ventes assise sur des données de première main
- Éditeur français, conformité fiscale et accompagnement local
- Adapté à la restauration rapide comme à la restauration collective

## Points faibles
- Aucun tarif public, matériel à prévoir en plus
- Changer de caisse est le changement le plus risqué d'un restaurant
- Périmètre large, dont une partie sera inutile selon le format
- Ce n'est pas un outil d'IA au sens strict : l'automatisation sert l'exploitation

## Idéal pour
Les établissements qui veulent réunir encaissement et commande en ligne chez un seul prestataire français, et exploiter enfin leurs chiffres.`,
    },
    {
      id: `sunday`,
      nom: `Sunday`,
      categorie: `Pilotage`,
      prix: `Commission sur les paiements`,
      description_courte: `Le paiement par code à l'écran, qui libère du temps en salle et fait remonter les avis au bon moment.`,
      lien_affiliation: `https://exemple-affiliation.com/go/sunday`,
      score_avis: 4.0,
      description_longue: `## Notre verdict
Sunday attaque un problème que tout restaurateur connaît sans le nommer : le quart d'heure perdu à faire circuler le terminal de paiement au moment où la salle est la plus tendue. Le client règle depuis son téléphone, et l'invitation à laisser un avis arrive dans la foulée — c'est-à-dire au moment où il est encore satisfait, ce qui change tout sur la note moyenne. Le modèle économique en commission évite l'abonnement, mais il faut le calculer sur son propre volume.

## Points forts
- Supprime la circulation du terminal de paiement au coup de feu
- Demande d'avis déclenchée au bon moment, sans intervention du personnel
- Pas d'abonnement : rémunération à la commission
- Mise en place légère, sans changer de caisse

## Points faibles
- La commission peut coûter plus cher qu'un abonnement sur gros volume
- Suppose une clientèle à l'aise avec le paiement mobile
- Dépend de la qualité du réseau dans la salle
- Périmètre étroit : c'est un complément, pas un système de gestion

## Idéal pour
Les établissements à fort passage où le temps de règlement bride la rotation des tables, et ceux qui veulent remonter leur note d'avis sans le demander à voix haute.`,
    },
    {
      id: `koust`,
      nom: `Koust`,
      categorie: `Gaspillage alimentaire`,
      prix: `Sur devis`,
      description_courte: `Le coût matière suivi fiche par fiche, pour savoir quel plat rapporte vraiment plutôt que de le supposer.`,
      lien_affiliation: `https://exemple-affiliation.com/go/koust`,
      score_avis: 4.1,
      description_longue: `## Notre verdict
La marge d'un restaurant se joue sur des écarts de quelques centimes par portion, multipliés par des milliers de couverts — et presque personne ne les mesure. Koust, éditeur français, tient les fiches techniques, les coûts matière et les stocks pour dire quel plat rapporte réellement une fois les pertes et les variations de prix intégrées. Ce n'est pas séduisant, c'est ce qui décide de la rentabilité.

## Points forts
- Coût matière calculé au plat, pertes comprises
- Suivi des stocks et des inventaires relié aux fiches techniques
- Éditeur français, adapté aux pratiques et aux fournisseurs locaux
- Met en évidence les plats qui coûtent plus qu'ils ne rapportent

## Points faibles
- Aucun tarif public
- Exige une rigueur de saisie que toutes les cuisines n'ont pas
- Le bénéfice n'apparaît qu'après plusieurs semaines de données
- Peu utile sans fiches techniques réellement tenues

## Idéal pour
Les restaurants dont la carte est large et la marge incertaine, et qui veulent trancher sur des chiffres plutôt qu'à l'intuition.`,
    },
    {
      id: `guestonline`,
      nom: `Guestonline`,
      categorie: `Téléphone & réservations`,
      prix: `Sur devis`,
      description_courte: `La réservation et le plan de salle tenus par un éditeur français, sans commission par couvert.`,
      lien_affiliation: `https://exemple-affiliation.com/go/guestonline`,
      score_avis: 4.0,
      description_longue: `## Notre verdict
Le sujet de la réservation n'est pas technique, il est économique : la plupart des grandes plateformes se rémunèrent au couvert apporté, ce qui revient à louer sa propre clientèle. Guestonline, éditeur français, propose l'inverse — un outil que le restaurant paie et dont il garde les données clients. Le plan de salle, les rappels automatiques et la limitation des tables non honorées font le reste.

## Points forts
- Pas de commission par couvert : le fichier client reste au restaurant
- Plan de salle et gestion des services intégrés
- Rappels automatiques, qui réduisent les tables non honorées
- Éditeur français, support dans la langue et le fuseau

## Points faibles
- Aucun tarif public
- N'apporte pas de clientèle nouvelle, contrairement aux grandes plateformes
- Suppose que le restaurant sache déjà remplir sa salle
- Moins de visibilité que les places de marché de la réservation

## Idéal pour
Les établissements qui remplissent déjà leur salle et refusent de payer une commission sur des clients qui seraient venus de toute façon.`,
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
      prix: `Freemium — à partir de 99 $/mois`,
      description_courte: `L’assistant de consultation avec une formule gratuite réellement utilisable : l’observation se rédige pendant qu’on écoute.`,
      lien_affiliation: `https://exemple-affiliation.com/go/heidi-health`,
      score_avis: 4.5,
      description_longue: `## Notre verdict
Heidi occupe une place rare : un assistant de documentation clinique dont la version gratuite couvre un usage quotidien normal. La consultation est transcrite, l’observation structurée selon le modèle du praticien, et les courriers d’adressage se rédigent dans la foulée. Pour un médecin libéral qui veut juger avant d’engager un abonnement, c’est le seul point d’entrée sans friction.

## Points forts
- Formule gratuite qui couvre un usage quotidien, pas une démonstration
- Modèles d’observation personnalisables par spécialité
- Courriers d’adressage et ordonnances rédigés dans la foulée
- Fonctionne dans le navigateur, sans installation

## Points faibles
- Le consentement du patient à l’enregistrement doit être recueilli à chaque consultation
- L’hébergement des données de santé est à vérifier au regard du cadre français
- Le français est correct mais moins abouti que l’anglais sur les termes rares

## Idéal pour
Les médecins libéraux qui veulent essayer un assistant de consultation sans engager un abonnement à trois chiffres.`,
    },
    {
      id: `freed`,
      nom: `Freed`,
      categorie: `Compte rendu de consultation`,
      prix: `À partir de 99 $/mois`,
      description_courte: `L’assistant de documentation pensé pour le praticien seul : on lance, on parle, la note est prête à la fin.`,
      lien_affiliation: `https://exemple-affiliation.com/go/freed`,
      score_avis: 4.3,
      description_longue: `## Notre verdict
Freed a été conçu par et pour des cliniciens en exercice, ce qui se voit à la simplicité : un bouton, aucune configuration, et une note qui apprend le style du praticien au fil des corrections. Pas de projet, pas d’intégration à négocier — c’est un abonnement individuel qu’on prend le matin et qu’on utilise l’après-midi.

## Points forts
- Aucune configuration : utilisable dès la première consultation
- Apprend le style de rédaction du praticien à partir des corrections
- Abonnement individuel en libre-service, résiliable à tout moment
- Essai gratuit sur plusieurs consultations avant tout engagement

## Points faibles
- Aucune intégration au dossier patient : la note se copie à la main
- Optimisé pour l’anglais américain, le français reste secondaire
- Le cadre réglementaire européen sur les données de santé demande une vérification préalable

## Idéal pour
Le praticien seul, sans service informatique, qui veut arrêter de finir ses journées par une heure de rédaction.`,
    },
    {
      id: `consensus`,
      nom: `Consensus`,
      categorie: `Recherche & veille`,
      prix: `Freemium — à partir de 12 $/mois`,
      description_courte: `La question clinique posée en français, la réponse tirée des publications scientifiques avec le niveau de preuve.`,
      lien_affiliation: `https://exemple-affiliation.com/go/consensus`,
      score_avis: 4.4,
      description_longue: `## Notre verdict
Consensus interroge deux cents millions d’articles scientifiques et rend, pour une question donnée, ce que dit réellement la littérature : proportion d’études favorables, qualité des travaux, citations à l’appui. Pour tenir à jour sa pratique sans y consacrer ses soirées, c’est l’outil qui transforme une heure de lecture en trois minutes de vérification.

## Points forts
- Réponses appuyées sur des publications réelles, jamais inventées
- Indication du niveau de preuve et du consensus entre études
- Version gratuite largement suffisante pour un usage hebdomadaire
- Utile bien au-delà de la médecine : toute question de recherche

## Points faibles
- Ne remplace pas la lecture d’un article : c’est une porte d’entrée
- Ne couvre que ce qui est publié et indexé
- Interface et résumés en anglais

## Idéal pour
Les praticiens et internes qui veulent vérifier ce que dit la littérature sur une question précise, entre deux consultations.`,
    },
    {
      id: `elicit`,
      nom: `Elicit`,
      categorie: `Recherche & veille`,
      prix: `Freemium — à partir de 12 $/mois`,
      description_courte: `La revue de littérature semi-automatisée : cent articles lus, résumés et rangés dans un tableau comparatif.`,
      lien_affiliation: `https://exemple-affiliation.com/go/elicit`,
      score_avis: 4.3,
      description_longue: `## Notre verdict
Elicit fait le travail ingrat d’une revue de littérature : trouver les articles pertinents, en extraire la population, la méthode, les effectifs et les résultats, et ranger le tout dans un tableau comparable ligne à ligne. Ce qui demandait deux semaines à un interne se ramène à une après-midi de vérification — la vérification restant indispensable.

## Points forts
- Extraction structurée des données de chaque article, en tableau
- Sélection des articles pertinents à partir d’une question en langage courant
- Export du tableau, exploitable dans un travail publiable
- Formule gratuite suffisante pour une première revue

## Points faibles
- Chaque extraction doit être recoupée avec l’article : les erreurs existent
- Couvre mal la littérature non anglophone
- Le crédit gratuit s’épuise vite sur une revue sérieuse

## Idéal pour
Les internes, chefs de clinique et praticiens hospitaliers qui doivent produire une revue de littérature sans y passer un mois.`,
    },
    {
      id: `glass-health`,
      nom: `Glass Health`,
      categorie: `Aide au raisonnement`,
      prix: `Freemium — à partir de 30 $/mois`,
      description_courte: `Le tableau clinique saisi en une phrase, et le diagnostic différentiel structuré qui revient, avec le plan d’examens.`,
      lien_affiliation: `https://exemple-affiliation.com/go/glass-health`,
      score_avis: 4.1,
      description_longue: `## Notre verdict
Glass ne prétend pas diagnostiquer : il propose un différentiel structuré à partir d’un résumé clinique, et un plan d’exploration cohérent. L’intérêt est le filet — la pathologie rare à laquelle on n’avait pas pensé apparaît dans la liste. C’est un second avis instantané, et l’outil ne cesse de rappeler que la décision reste au clinicien.

## Points forts
- Différentiel structuré, hiérarchisé, avec les arguments pour et contre
- Plan d’examens proposé, cohérent avec les hypothèses
- Rappelle explicitement que la décision reste médicale
- Formule gratuite pour juger sur des cas réels

## Points faibles
- Aucune valeur diagnostique : c’est une aide à la réflexion, rien de plus
- Recommandations calées sur les référentiels américains
- Aucune donnée patient ne doit y être saisie en clair

## Idéal pour
Les urgentistes et généralistes qui veulent un second regard structuré sur un tableau clinique atypique.`,
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
    {
      id: `adcreative-ai`,
      nom: `AdCreative.ai`,
      categorie: `Publicité`,
      prix: `À partir de 39 $/mois`,
      description_courte: `Les visuels publicitaires générés par dizaines, notés sur leur potentiel de conversion avant d’être diffusés.`,
      lien_affiliation: `https://exemple-affiliation.com/go/adcreative-ai`,
      score_avis: 4.2,
      description_longue: `## Notre verdict
Le coût d’acquisition monte parce que les créations s’usent : la même image affichée trois semaines cesse de convertir. AdCreative en produit des dizaines aux formats de chaque régie, à la charte de la marque, et attribue à chacune une note de performance prévue à partir des campagnes passées. On teste dix visuels là où on en produisait un.

## Points forts
- Déclinaison automatique à tous les formats des régies publicitaires
- Note de performance prévue avant diffusion, qui évite de brûler du budget
- Charte de marque respectée : couleurs, police, logo
- Génération de textes d’annonce assortis aux visuels

## Points faibles
- La note de performance reste une estimation, jamais une garantie
- Le système de crédits s’épuise vite dès qu’on itère sérieusement
- Les visuels générés se ressemblent si l’on ne varie pas les consignes

## Idéal pour
Les boutiques qui dépensent en publicité et voient leur coût d’acquisition monter faute de renouveler leurs créations.`,
    },
    {
      id: `postscript`,
      nom: `Postscript`,
      categorie: `E-mailing & CRM`,
      prix: `Freemium — à partir de 100 $/mois`,
      description_courte: `Le message texte marketing fait correctement : segments, scénarios, et une vendeuse virtuelle qui répond aux réponses.`,
      lien_affiliation: `https://exemple-affiliation.com/go/postscript`,
      score_avis: 4.3,
      description_longue: `## Notre verdict
Le message texte a des taux d’ouverture que le courriel n’atteindra jamais, et un potentiel de nuisance équivalent s’il est mal fait. Postscript apporte le cadre : consentement propre, segments comportementaux, scénarios de panier abandonné, et un agent conversationnel qui répond aux réponses des clients au lieu de les laisser dans le vide.

## Points forts
- Taux d’ouverture sans commune mesure avec le courriel
- Agent conversationnel qui traite les réponses des clients
- Segments construits sur le comportement d’achat réel
- Formule gratuite jusqu’à un premier seuil d’envois

## Points faibles
- Le message texte marketing est strictement encadré en Europe : consentement à vérifier
- Facturé à l’envoi : une campagne mal ciblée coûte cher
- Couverture et tarifs pensés pour le marché nord-américain

## Idéal pour
Les boutiques dont la base clients est déjà là et qui n’en tirent qu’une newsletter mensuelle.`,
    },
    {
      id: `yotpo`,
      nom: `Yotpo`,
      categorie: `Preuve sociale`,
      prix: `Freemium — à partir de 15 $/mois`,
      description_courte: `Les avis clients collectés, résumés et affichés là où ils font acheter, avec les photos des clients.`,
      lien_affiliation: `https://exemple-affiliation.com/go/yotpo`,
      score_avis: 4.1,
      description_longue: `## Notre verdict
Une fiche produit sans avis ne convertit pas, et une fiche avec deux cents avis illisibles ne convertit pas davantage. Yotpo collecte les avis par relance automatique, en extrait les points saillants sous forme de synthèse lisible, et affiche les photos envoyées par les clients. Les extraits d’avis remontent aussi dans les résultats de recherche.

## Points forts
- Relance automatique après achat : le volume d’avis décolle réellement
- Synthèse des avis en quelques lignes, plus lue que la liste complète
- Photos clients affichées, ce qui convertit mieux que le texte seul
- Balisage qui fait apparaître les étoiles dans les résultats de recherche

## Points faibles
- Le tarif grimpe fortement avec le nombre de commandes
- Les modules avancés sont facturés séparément
- La modération des avis demande une attention réelle

## Idéal pour
Les boutiques dont les fiches produits n’ont aucun avis, ou des avis que personne ne lit.`,
    },
    {
      id: `zipchat-ai`,
      nom: `Zipchat AI`,
      categorie: `Service client`,
      prix: `À partir de 49 $/mois`,
      description_courte: `L’agent qui vend au lieu de simplement répondre : il conseille un produit, gère l’objection et pousse au panier.`,
      lien_affiliation: `https://exemple-affiliation.com/go/zipchat-ai`,
      score_avis: 4.1,
      description_longue: `## Notre verdict
La plupart des assistants de boutique répondent aux questions de livraison. Zipchat est construit pour vendre : il connaît le catalogue, recommande une référence, traite l’objection sur le prix ou la taille, et propose l’ajout au panier. Le chiffre d’affaires attribué aux conversations est affiché, ce qui rend l’arbitrage simple.

## Points forts
- Conçu pour la vente, pas seulement pour le support
- Chiffre d’affaires attribué aux conversations, mesurable
- Se nourrit du catalogue automatiquement, sans base de connaissances à écrire
- Répond dans plusieurs langues, y compris en français

## Points faibles
- Un agent trop insistant dégrade l’expérience : le ton se règle avec soin
- Facturé au volume de conversations, imprévisible en période de soldes
- Sans catalogue riche, il n’a rien à recommander

## Idéal pour
Les boutiques dont le trafic est correct mais qui transforment mal, faute de conseil au moment de l’hésitation.`,
    },
    {
      id: `prisync`,
      nom: `Prisync`,
      categorie: `Analyse & attribution`,
      prix: `À partir de 99 $/mois`,
      description_courte: `Le prix des concurrents suivi en continu, et le vôtre ajusté automatiquement selon vos règles.`,
      lien_affiliation: `https://exemple-affiliation.com/go/prisync`,
      score_avis: 4.0,
      description_longue: `## Notre verdict
Sur un catalogue de mille références, personne ne peut suivre à la main ce que font trois concurrents. Prisync relève leurs prix plusieurs fois par jour, signale les écarts et peut ajuster les vôtres selon des règles que vous posez — jamais sous la marge minimale. C’est le poste où l’on perd des ventes sans jamais savoir pourquoi.

## Points forts
- Relevé automatique des prix concurrents, plusieurs fois par jour
- Règles de repositionnement avec plancher de marge respecté
- Historique des prix : on voit les cycles promotionnels des concurrents
- Se branche sur les plateformes de commerce courantes

## Points faibles
- Le paramétrage initial des correspondances de produits est fastidieux
- Une guerre des prix automatisée détruit la marge : les règles se posent avec prudence
- Facturé au nombre de références suivies

## Idéal pour
Les boutiques sur des marchés où le prix décide, et qui découvrent leurs pertes de ventes après coup.`,
    },
    {
      id: `iadvize`,
      nom: `iAdvize`,
      categorie: `Service client`,
      prix: `Sur devis`,
      description_courte: `Le conseil en ligne assuré par une IA qui sait passer la main à un humain — et à des clients experts de la marque.`,
      lien_affiliation: `https://exemple-affiliation.com/go/iadvize`,
      score_avis: 4.2,
      description_longue: `## Notre verdict
iAdvize, éditeur français, a construit sa réputation sur une idée que les robots de conversation ignorent : certaines questions d'achat ne se règlent qu'avec quelqu'un qui connaît vraiment le produit. La plateforme combine donc réponse automatique, prise en charge par un conseiller et mise en relation avec des clients experts. Le passage de relais est le point technique le plus délicat de ce métier, et c'est là qu'elle se juge.

## Points forts
- Passage de relais entre automatisation et humain traité comme un sujet en soi
- Mise en relation avec des clients experts, différenciante sur les produits techniques
- Éditeur français, hébergement et conformité européens
- Recul important sur les grandes marques de distribution

## Points faibles
- Aucun tarif public, positionnement grand compte
- Le modèle du client expert demande une communauté à animer
- Surdimensionné pour une petite boutique
- Déploiement qui mobilise des équipes au-delà du service client

## Idéal pour
Les marques dont les produits demandent un vrai conseil avant achat, et qui veulent automatiser sans faire fuir sur les questions qui comptent.`,
    },
    {
      id: `lengow`,
      nom: `Lengow`,
      categorie: `Fiches produits`,
      prix: `Sur devis`,
      description_courte: `Le catalogue produit traduit et adapté automatiquement au format de chaque place de marché.`,
      lien_affiliation: `https://exemple-affiliation.com/go/lengow`,
      score_avis: 4.2,
      description_longue: `## Notre verdict
Vendre sur plusieurs places de marché n'échoue presque jamais sur la stratégie, mais sur la mécanique : chaque plateforme exige ses catégories, ses attributs, ses formats d'image. Lengow, éditeur français, automatise cette transformation à partir d'un catalogue unique, avec enrichissement et traduction des fiches. C'est un travail ingrat que personne ne veut faire à la main, et qui décide pourtant de la visibilité de chaque produit.

## Points forts
- Un catalogue unique décliné automatiquement vers chaque place de marché
- Enrichissement et traduction des fiches produits
- Éditeur français, connaissance fine des places de marché européennes
- Évite la ressaisie, source principale d'erreurs de catalogue

## Points faibles
- Aucun tarif public, facturation liée au volume
- Complexité réelle dès que le catalogue est important
- Ne remplace pas une stratégie de présence : il l'exécute
- Peu justifié sur une ou deux places de marché seulement

## Idéal pour
Les boutiques présentes sur plusieurs places de marché, dont le catalogue dépasse ce qu'une personne peut tenir à jour à la main.`,
    },
    {
      id: `algolia`,
      nom: `Algolia`,
      categorie: `Personnalisation`,
      prix: `Palier gratuit, puis facturation à l'usage`,
      description_courte: `La recherche interne qui comprend l'intention plutôt que les mots exacts — souvent le premier levier de conversion.`,
      lien_affiliation: `https://exemple-affiliation.com/go/algolia`,
      score_avis: 4.4,
      description_longue: `## Notre verdict
Le visiteur qui utilise la recherche interne d'une boutique achète bien plus souvent que les autres — et c'est précisément là que la plupart des sites le perdent, sur une faute de frappe ou un synonyme non prévu. Algolia, société d'origine française, traite la recherche comme un produit à part entière : compréhension de l'intention, tolérance aux fautes, classement adapté au comportement. Le palier gratuit permet de mesurer l'écart avant d'engager quoi que ce soit.

## Points forts
- Compréhension de l'intention plutôt que correspondance de mots
- Tolérance aux fautes de frappe, qui coûtent des ventes chaque jour
- Palier gratuit suffisant pour mesurer le gain sur un vrai catalogue
- Documentation et intégrations parmi les meilleures du secteur

## Points faibles
- Facturation à l'usage : la note grimpe avec le trafic
- Mise en place technique, un développeur est nécessaire
- Le réglage fin du classement demande du temps et des données
- Surdimensionné pour un catalogue de quelques dizaines de références

## Idéal pour
Les boutiques à catalogue large dont une part significative des visiteurs passe par la recherche interne.`,
    },
    {
      id: `nosto`,
      nom: `Nosto`,
      categorie: `Personnalisation`,
      prix: `Sur devis`,
      description_courte: `Les recommandations et les contenus adaptés au comportement de chaque visiteur, sans développement lourd.`,
      lien_affiliation: `https://exemple-affiliation.com/go/nosto`,
      score_avis: 4.0,
      description_longue: `## Notre verdict
Nosto occupe le terrain de la personnalisation clé en main : recommandations de produits, contenus adaptés, tests de variantes, le tout sans écrire de code. C'est ce qui explique son adoption chez des marques sans grande équipe technique. Le revers est classique — on gagne en rapidité de mise en œuvre ce qu'on perd en maîtrise fine, et l'effet sur la conversion mérite d'être mesuré plutôt que cru.

## Points forts
- Personnalisation opérationnelle sans développement
- Recommandations, contenus et tests dans une même plateforme
- Intégrations directes avec les principales solutions de boutique
- Mise en place rapide comparée à un projet interne

## Points faibles
- Aucun tarif public, positionnement moyen et grand compte
- Effet sur la conversion à mesurer sérieusement, promesse générique du secteur
- Peu de maîtrise fine sur la logique de recommandation
- Un outil de plus qui suit les visiteurs : à cadrer côté données personnelles

## Idéal pour
Les boutiques établies sans équipe technique dédiée, qui veulent personnaliser sans lancer un chantier.`,
    },
    {
      id: `botmind`,
      nom: `Botmind`,
      categorie: `Service client`,
      prix: `Sur devis`,
      description_courte: `L'assistant qui traite les demandes répétitives du service client — où est ma commande, comment je retourne — et laisse le reste.`,
      lien_affiliation: `https://exemple-affiliation.com/go/botmind`,
      score_avis: 4.0,
      description_longue: `## Notre verdict
La majorité des sollicitations d'un service client de boutique en ligne se résume à quelques questions répétées mille fois : où en est la commande, comment retourner, quand suis-je remboursé. Botmind, éditeur français, absorbe ce socle et transmet le reste à un conseiller. Le calcul est simple à faire pour n'importe quelle boutique : compter la part de ces trois questions dans le volume total, et en déduire la valeur.

## Points forts
- Cible franchement les demandes répétitives, sans promettre de tout traiter
- Éditeur français, hébergement et support locaux
- Se branche sur les outils de billetterie de service client existants
- Mise en place plus légère que les plateformes de conversation généralistes

## Points faibles
- Aucun tarif public
- Le gain dépend entièrement de la part de demandes répétitives
- Suppose une base de connaissances tenue à jour
- Périmètre plus étroit que les plateformes conversationnelles complètes

## Idéal pour
Les boutiques dont le service client croule sous les mêmes questions de suivi de commande et de retour.`,
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
    {
      id: `d5-render`,
      nom: `D5 Render`,
      categorie: `Rendu IA`,
      prix: `Freemium — à partir de 38 $/mois`,
      description_courte: `Le rendu en temps réel, avec la synchronisation en direct depuis Revit, SketchUp, Rhino ou Archicad.`,
      lien_affiliation: `https://exemple-affiliation.com/go/d5-render`,
      score_avis: 4.5,
      description_longue: `## Notre verdict
D5 a changé l’économie du rendu d’agence : on travaille dans une vue temps réel plutôt que d’attendre un calcul, et la maquette reste synchronisée avec le logiciel de conception. Les fonctions génératives ajoutent les matières, la végétation et l’ambiance sans quitter la scène. La formule gratuite est réellement utilisable, ce qui est rare à ce niveau.

## Points forts
- Rendu en temps réel : plus d’attente de calcul entre deux essais
- Synchronisation en direct avec les logiciels de conception courants
- Bibliothèque de matières et de végétation très fournie
- Formule gratuite qui permet de juger sur un vrai projet

## Points faibles
- Demande une carte graphique correcte : un portable de bureau ne suffit pas
- La courbe d’apprentissage reste réelle pour qui n’a jamais fait de rendu
- L’export vidéo est réservé aux formules payantes

## Idéal pour
Les agences qui sous-traitent encore leurs perspectives et veulent reprendre la main sans embaucher un infographiste.`,
    },
    {
      id: `enscape`,
      nom: `Enscape`,
      categorie: `Rendu IA`,
      prix: `À partir de 58 $/mois`,
      description_courte: `Le rendu temps réel intégré au logiciel de conception, sans jamais exporter la maquette.`,
      lien_affiliation: `https://exemple-affiliation.com/go/enscape`,
      score_avis: 4.4,
      description_longue: `## Notre verdict
Enscape est installé dans un très grand nombre d’agences pour une seule raison : il vit à l’intérieur de Revit ou de SketchUp. On appuie sur un bouton, la fenêtre de rendu s’ouvre sur la vue en cours, et toute modification apparaît instantanément. Le client voit le projet évoluer pendant la réunion, ce qui raccourcit les allers-retours.

## Points forts
- Aucun export : le rendu vit dans le logiciel de conception
- Modifications visibles instantanément, y compris devant le client
- Visites en réalité virtuelle et panoramas partageables par lien
- Standard de fait : les compétences se trouvent facilement

## Points faibles
- Abonnement par utilisateur qui pèse dans une agence de dix personnes
- Moins photoréaliste que les moteurs de rendu spécialisés
- Windows uniquement pour la version complète

## Idéal pour
Les agences qui présentent des projets en réunion et perdent des semaines en allers-retours sur des images figées.`,
    },
    {
      id: `vizcom`,
      nom: `Vizcom`,
      categorie: `Esquisse`,
      prix: `Freemium — à partir de 20 $/mois`,
      description_courte: `Le croquis à main levée transformé en image rendue en quelques secondes, sans perdre le trait d’origine.`,
      lien_affiliation: `https://exemple-affiliation.com/go/vizcom`,
      score_avis: 4.3,
      description_longue: `## Notre verdict
Vizcom vient du design produit et s’applique remarquablement bien à l’architecture en phase amont : on dessine, l’outil habille le trait sans réinventer le volume, et l’on ajuste style et matières en direct. C’est l’outil de la recherche de forme, celui qu’on utilise avant qu’il n’y ait quoi que ce soit à modéliser.

## Points forts
- Le trait dessiné est respecté : ce n’est pas une image générée à côté
- Rendu en quelques secondes, compatible avec une séance de recherche
- Contrôle fin du style et des matières, sans consigne à rédiger
- Formule gratuite pour juger sur ses propres croquis

## Points faibles
- Aucun lien avec les logiciels de conception : tout part d’une image
- La cohérence d’une série d’images reste difficile à tenir
- Le rendu final n’a pas la précision d’un moteur de rendu

## Idéal pour
Les architectes qui dessinent encore à la main en phase de recherche et veulent montrer une intention avant toute modélisation.`,
    },
    {
      id: `spacely-ai`,
      nom: `Spacely AI`,
      categorie: `Rendu IA`,
      prix: `Freemium — à partir de 15 $/mois`,
      description_courte: `Le réaménagement intérieur généré à partir d’une photo ou d’un plan, en une trentaine de styles.`,
      lien_affiliation: `https://exemple-affiliation.com/go/spacely-ai`,
      score_avis: 4.0,
      description_longue: `## Notre verdict
Spacely est l’outil d’appoint : une photo de pièce existante, un style, et l’on obtient en trente secondes une proposition d’aménagement présentable à un client. Ce n’est pas de la conception, c’est un support de discussion — et à quinze dollars par mois, il remplace l’après-midi passée à chercher des références sur des sites de décoration.

## Points forts
- Résultat en trente secondes à partir d’une simple photo
- Une trentaine de styles, du minimaliste au classique
- Génère aussi des vues d’extérieur et de façade
- Tarif très accessible, formule gratuite pour essayer

## Points faibles
- La géométrie de la pièce est parfois réinterprétée : à vérifier
- Rien à voir avec un projet : c’est un support de discussion
- Les résultats demandent souvent plusieurs essais

## Idéal pour
Les maîtres d’œuvre et décorateurs qui doivent proposer trois ambiances à un client dès le premier rendez-vous.`,
    },
    {
      id: `magicplan`,
      nom: `magicplan`,
      categorie: `Faisabilité`,
      prix: `Freemium — à partir de 10 $/mois`,
      description_courte: `Le relevé d’un logement fait au téléphone en marchant, avec le plan coté qui se dessine tout seul.`,
      lien_affiliation: `https://exemple-affiliation.com/go/magicplan`,
      score_avis: 4.2,
      description_longue: `## Notre verdict
Le relevé d’existant est un travail long et sans intérêt intellectuel. magicplan utilise la caméra et les capteurs du téléphone pour produire un plan coté en marchant dans les pièces, avec une précision suffisante pour une étude de faisabilité ou un devis. Le plan s’exporte ensuite vers les logiciels de conception.

## Points forts
- Relevé complet d’un appartement en une vingtaine de minutes, seul
- Plan coté généré automatiquement, exportable en DXF et PDF
- Photos et annotations rattachées aux pièces relevées
- Formule gratuite pour un ou deux projets par mois

## Points faibles
- Précision insuffisante pour un dossier d’exécution : c’est du relevé rapide
- Les téléphones sans capteur de profondeur donnent des résultats inégaux
- Les surfaces vitrées et les miroirs perturbent la mesure

## Idéal pour
Les maîtres d’œuvre, architectes d’intérieur et diagnostiqueurs qui relèvent encore au télémètre et redessinent le soir.`,
    },
    {
      id: `snaptrude`,
      nom: `Snaptrude`,
      categorie: `Esquisse`,
      prix: `Freemium, puis abonnement par utilisateur`,
      description_courte: `L'esquisse dessinée dans le navigateur qui devient un modèle exploitable, sans repasser par la case modélisation.`,
      lien_affiliation: `https://exemple-affiliation.com/go/snaptrude`,
      score_avis: 4.2,
      description_longue: `## Notre verdict
La perte de temps classique de l'agence n'est pas l'esquisse, c'est sa re-saisie : ce qui a été dessiné vite est remodélisé lentement dans l'outil de production. Snaptrude attaque exactement ce point — l'esquisse se fait dans le navigateur, à plusieurs, et sort en modèle exploitable plutôt qu'en image morte. Les surfaces et les métrés suivent au fur et à mesure, ce qui rend la discussion avec le client plus honnête dès les premières minutes.

## Points forts
- Travail à plusieurs dans le navigateur, sans installation
- L'esquisse produit un modèle exploitable, pas seulement une image
- Surfaces et métrés calculés en continu pendant la conception
- Passerelles vers les outils de production courants

## Points faibles
- Ne remplace pas un outil de production sur les phases avancées
- Le travail dans le navigateur montre ses limites sur les projets lourds
- Écosystème plus jeune que celui des éditeurs installés
- Abonnement par utilisateur, qui pèse sur une petite agence

## Idéal pour
Les agences qui perdent du temps entre l'esquisse et la modélisation, et celles qui veulent chiffrer des surfaces devant le client plutôt qu'après.`,
    },
    {
      id: `architechtures`,
      nom: `Architechtures`,
      categorie: `Faisabilité`,
      prix: `Sur devis`,
      description_courte: `Les variantes de projet résidentiel générées à partir des contraintes de la parcelle et du programme, chiffrées d'emblée.`,
      lien_affiliation: `https://exemple-affiliation.com/go/architechtures`,
      score_avis: 4.1,
      description_longue: `## Notre verdict
Sur le logement, la phase de faisabilité consiste à explorer des hypothèses qu'on n'a jamais le temps d'explorer toutes. L'outil renverse la contrainte : on saisit la parcelle, les règles et le programme, il produit des variantes avec leurs surfaces et leurs coûts. La valeur n'est pas dans le projet qu'il propose — un architecte n'en veut pas — mais dans les quinze qu'il permet d'éliminer en une matinée.

## Points forts
- Variantes générées à partir des vraies contraintes de parcelle et de programme
- Chiffrage et surfaces attachés à chaque hypothèse
- Fait gagner la phase où l'on décide sans avoir le temps de comparer
- Sortie exploitable dans les outils de conception

## Points faibles
- Périmètre résidentiel : peu utile hors logement
- Aucun tarif public
- Le rendu formel reste générique : c'est un outil de faisabilité, pas de projet
- Suppose une saisie rigoureuse des règles applicables

## Idéal pour
Les agences et promoteurs qui doivent trancher vite entre plusieurs hypothèses d'implantation sur une parcelle, avec les surfaces et les coûts en face.`,
    },
    {
      id: `hypar`,
      nom: `Hypar`,
      categorie: `Conception générative`,
      prix: `Freemium, puis abonnement`,
      description_courte: `La règle métier de l'agence transformée en générateur réutilisable, plutôt que refaite à la main sur chaque projet.`,
      lien_affiliation: `https://exemple-affiliation.com/go/hypar`,
      score_avis: 4.0,
      description_longue: `## Notre verdict
Hypar s'adresse aux agences qui répètent : mêmes typologies, mêmes règles d'implantation, mêmes gabarits d'un projet à l'autre. Au lieu de refaire, on encode une fois la logique et on la rejoue. C'est plus proche de l'outillage que du dessin, ce qui explique la barrière d'entrée réelle — il faut quelqu'un dans l'agence que la logique ne rebute pas.

## Points forts
- Capitalise le savoir-faire de l'agence au lieu de le refaire à chaque projet
- Générateurs partageables entre projets et entre équipes
- Particulièrement rentable sur les programmes répétitifs
- Palier gratuit pour évaluer l'approche

## Points faibles
- Barrière d'entrée réelle : plus proche de l'outillage que du dessin
- Sans profil un peu technique dans l'agence, l'outil dort
- Peu d'intérêt sur des projets tous singuliers
- Écosystème restreint

## Idéal pour
Les agences qui traitent des programmes répétitifs — logement, bureaux, équipements — et veulent cesser de refaire la même étude.`,
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
    {
      id: `grammarly`,
      nom: `Grammarly`,
      categorie: `Rédaction`,
      prix: `Freemium — à partir de 12 $/mois`,
      description_courte: `La relecture qui vit dans tous vos outils : orthographe, ton, clarté, et la réécriture proposée sur place.`,
      lien_affiliation: `https://exemple-affiliation.com/go/grammarly`,
      score_avis: 4.4,
      description_longue: `## Notre verdict
Grammarly n’écrit pas à votre place, il rattrape ce qui vous échappe — et il le fait partout, dans la messagerie, le traitement de texte, le navigateur, sans qu’on ait à coller son texte quelque part. Le réglage du ton est ce qui a le plus de valeur en usage professionnel : le même message peut sortir ferme, cordial ou neutre.

## Points forts
- Présent dans tous les outils : rien à copier-coller nulle part
- Réglage du ton, précieux sur un courriel délicat
- Excellente prise en charge de l’anglais professionnel
- Formule gratuite déjà très utile au quotidien

## Points faibles
- Le français reste nettement en retrait de l’anglais
- Les suggestions de style lissent parfois une voix personnelle
- L’extension analyse ce que vous écrivez : à écarter des documents confidentiels

## Idéal pour
Ceux qui écrivent en anglais professionnel toute la journée et n’ont personne pour relire avant l’envoi.`,
    },
    {
      id: `otter-ai`,
      nom: `Otter.ai`,
      categorie: `Productivité`,
      prix: `Freemium — à partir de 17 $/mois`,
      description_courte: `La réunion transcrite, résumée, et les décisions extraites — sans que personne n’ait pris de notes.`,
      lien_affiliation: `https://exemple-affiliation.com/go/otter-ai`,
      score_avis: 4.3,
      description_longue: `## Notre verdict
Otter s’invite dans la réunion, la transcrit en direct et rend, à la fin, un résumé avec les points d’action attribués. Le gain n’est pas la transcription — c’est que plus personne ne prend de notes, donc que tout le monde participe. Sur cinq réunions par semaine, cela rend plusieurs heures et supprime le débat sur ce qui avait été décidé.

## Points forts
- Rejoint automatiquement les réunions des principaux outils de visioconférence
- Résumé et points d’action extraits, pas seulement une transcription brute
- Recherche dans l’historique de toutes les réunions passées
- Formule gratuite de plusieurs centaines de minutes par mois

## Points faibles
- Le français est correct mais moins fiable que l’anglais sur les accents marqués
- L’enregistrement d’une réunion demande l’accord explicite des participants
- La distinction des locuteurs se perd quand plusieurs parlent ensemble

## Idéal pour
Les équipes qui sortent des réunions sans compte rendu et rediscutent trois jours plus tard de ce qui avait été décidé.`,
    },
    {
      id: `fathom`,
      nom: `Fathom`,
      categorie: `Productivité`,
      prix: `Freemium — à partir de 19 $/mois`,
      description_courte: `Le preneur de notes de réunion dont la version gratuite est complète, sans limite de minutes.`,
      lien_affiliation: `https://exemple-affiliation.com/go/fathom`,
      score_avis: 4.5,
      description_longue: `## Notre verdict
Fathom a fait un choix rare : la version gratuite est illimitée en durée d’enregistrement et de transcription, avec les résumés. On ne paie que pour les fonctions d’équipe et l’intégration au logiciel commercial. Pour un indépendant ou une petite structure, c’est l’outil de compte rendu qui ne coûte rien et qu’on garde.

## Points forts
- Version gratuite illimitée en minutes, ce qui n’existe presque nulle part
- Résumés disponibles en quelques secondes après la fin de la réunion
- Extraits horodatés partageables, sans envoyer l’enregistrement entier
- Pousse les comptes rendus dans les logiciels commerciaux courants

## Points faibles
- L’accord des participants à l’enregistrement reste obligatoire
- Moins fin que la concurrence sur la distinction des locuteurs en français
- Les fonctions d’équipe sont réservées aux formules payantes

## Idéal pour
Les indépendants et petites équipes qui enchaînent les rendez-vous en visioconférence et n’en gardent aucune trace.`,
    },
    {
      id: `ideogram`,
      nom: `Ideogram`,
      categorie: `Design`,
      prix: `Freemium — à partir de 8 $/mois`,
      description_courte: `Le générateur d’images qui écrit correctement le texte : affiches, logos et visuels avec des mots lisibles.`,
      lien_affiliation: `https://exemple-affiliation.com/go/ideogram`,
      score_avis: 4.3,
      description_longue: `## Notre verdict
Le texte incrusté est le point faible historique des générateurs d’images : slogans déformés, lettres inventées. Ideogram a fait de la typographie sa spécialité, et rend des affiches, des vignettes et des visuels de marque où le texte est lisible du premier coup. Pour tout ce qui porte un mot, il évite la reprise systématique dans un logiciel de mise en page.

## Points forts
- Texte incrusté lisible, ce qui reste rare parmi les générateurs
- Excellent sur les affiches, vignettes et visuels typographiques
- Formule gratuite avec un quota quotidien réellement utilisable
- Contrôle du format et du style sans consigne compliquée

## Points faibles
- Moins photoréaliste que les spécialistes de l’image
- Les typographies exactes d’une marque ne sont pas reproductibles
- Le rendu des mains et des visages reste inférieur à la concurrence

## Idéal pour
Ceux qui fabriquent des visuels portant du texte — vignettes, affiches, publications — et repassent systématiquement par un logiciel de mise en page.`,
    },
    {
      id: `framer`,
      nom: `Framer`,
      categorie: `Productivité`,
      prix: `Freemium — à partir de 5 $/mois`,
      description_courte: `Le site web décrit en une phrase, publié en ligne dans la foulée, sans une ligne de code.`,
      lien_affiliation: `https://exemple-affiliation.com/go/framer`,
      score_avis: 4.2,
      description_longue: `## Notre verdict
Framer a réuni deux mondes qui ne se parlaient pas : la souplesse d’un outil de design et la publication d’un vrai site. On décrit ce qu’on veut, la structure sort, on ajuste au pixel, et l’on publie sur son domaine en un clic. Pour une page de présentation ou un site vitrine, c’est plus rapide que n’importe quel gabarit à remplir.

## Points forts
- Du texte au site publié sans passer par un développeur
- Contrôle réel de la mise en page, contrairement aux gabarits figés
- Hébergement, domaine et statistiques inclus
- Formule gratuite pour publier un premier site

## Points faibles
- Le rendu par défaut est reconnaissable si l’on ne retouche rien
- Les sites très riches en contenu deviennent lourds à maintenir
- Le référencement demande un travail que l’outil ne fait pas à votre place

## Idéal pour
Les indépendants et petites structures qui ont besoin d’un site de présentation crédible cette semaine, pas dans deux mois.`,
    },
    {
      id: `mistral-le-chat`,
      nom: `Mistral Le Chat`,
      categorie: `Rédaction`,
      prix: `Gratuit, puis abonnement`,
      description_courte: `L'assistant conversationnel français, hébergé en Europe, à la hauteur des usages professionnels courants.`,
      lien_affiliation: `https://exemple-affiliation.com/go/mistral-le-chat`,
      score_avis: 4.3,
      description_longue: `## Notre verdict
Pour un professionnel français, l'argument n'est pas seulement la qualité des réponses — les grands modèles se tiennent — mais le fait de travailler avec un éditeur européen dont les modèles tournent sur des serveurs européens. Sur des documents clients, des contrats ou des données internes, c'est ce qui rend l'usage défendable devant un client ou un délégué à la protection des données. Le français y est traité comme une langue de premier rang, pas comme une traduction.

## Points forts
- Éditeur français, traitement des données en Europe
- Le français traité nativement, sans effet de traduction
- Palier gratuit largement suffisant pour un usage quotidien
- Modèles disponibles aussi par interface de programmation, pour aller plus loin

## Points faibles
- Écosystème d'extensions plus restreint que celui des acteurs américains
- Moins de fonctions périphériques que les assistants les plus établis
- Documentation d'usage professionnel encore en construction
- Avance technique qui se joue à quelques mois près sur ce marché

## Idéal pour
Les indépendants et petites équipes qui manipulent des données clients et veulent une réponse claire à la question « où partent mes documents ».`,
    },
    {
      id: `deepl`,
      nom: `DeepL`,
      categorie: `Rédaction`,
      prix: `Gratuit, puis abonnement mensuel`,
      description_courte: `La traduction qui ne se remarque pas, et la réécriture d'un texte dans le registre attendu.`,
      lien_affiliation: `https://exemple-affiliation.com/go/deepl`,
      score_avis: 4.5,
      description_longue: `## Notre verdict
DeepL reste, des années après son apparition, la référence sur un point précis : une traduction qui ne trahit pas son origine automatique. Pour un indépendant qui répond à un client étranger ou traduit une proposition commerciale, c'est la différence entre paraître professionnel et paraître pressé. L'outil de réécriture, moins connu, corrige et ajuste le registre d'un texte français sans le dénaturer. Éditeur allemand, données traitées en Europe.

## Points forts
- Qualité de traduction encore au-dessus des assistants généralistes
- Réécriture et ajustement de registre sur un texte existant
- Éditeur européen, traitement des données en Europe
- Palier gratuit utilisable au quotidien, extensions bureautiques comprises

## Points faibles
- Périmètre volontairement étroit : traduire et reformuler, rien d'autre
- Les documents longs demandent l'abonnement
- Sur les textes très techniques, la relecture d'un spécialiste reste nécessaire
- Le palier gratuit limite la taille des documents

## Idéal pour
Tous ceux qui écrivent à des interlocuteurs étrangers et ne veulent pas que cela se voie.`,
    },
    {
      id: `notebooklm`,
      nom: `NotebookLM`,
      categorie: `Recherche`,
      prix: `Gratuit, offre avancée payante`,
      description_courte: `L'assistant qui ne répond que sur vos propres documents, avec la source de chaque affirmation.`,
      lien_affiliation: `https://exemple-affiliation.com/go/notebooklm`,
      score_avis: 4.3,
      description_longue: `## Notre verdict
La différence avec un assistant généraliste tient en une contrainte : NotebookLM ne répond que sur les documents qu'on lui a donnés, et chaque affirmation renvoie au passage dont elle est tirée. C'est exactement ce qu'il faut pour dépouiller un appel d'offres, un rapport ou trois cents pages de comptes rendus sans risquer une réponse inventée. Le passage en revue reste possible parce que la source est toujours à un clic.

## Points forts
- Répond uniquement sur les documents fournis : pas de réponse inventée hors corpus
- Chaque affirmation renvoie à sa source exacte
- Excellent sur les corpus longs et hétérogènes
- Gratuit dans son usage courant

## Points faibles
- Sans documents, l'outil ne sert à rien : ce n'est pas un assistant général
- Les documents déposés partent chez l'éditeur : à cadrer selon leur sensibilité
- Qualité inégale sur les documents mal océrisés
- Fonctions avancées réservées à l'offre payante

## Idéal pour
Ceux qui doivent tirer une réponse fiable d'un gros dossier — appel d'offres, documentation, archives — et ne peuvent pas se permettre une citation fausse.`,
    },
    {
      id: `fireflies-ai`,
      nom: `Fireflies.ai`,
      categorie: `Productivité`,
      prix: `Palier gratuit, puis abonnement par utilisateur`,
      description_courte: `La réunion transcrite, résumée et découpée en actions, sans que personne n'ait à prendre de notes.`,
      lien_affiliation: `https://exemple-affiliation.com/go/fireflies-ai`,
      score_avis: 4.1,
      description_longue: `## Notre verdict
Le compte rendu de réunion est le travail que tout le monde repousse et que personne ne relit. Fireflies rejoint la visioconférence, transcrit, résume et sort la liste des décisions et des actions. Le gain réel n'est pas le temps de frappe mais la disparition du flou : ce qui a été décidé est écrit, et on cesse de rejouer la même discussion trois semaines plus tard. Prévenir les participants qu'ils sont enregistrés n'est pas une politesse, c'est une obligation.

## Points forts
- Rejoint automatiquement les réunions des principales plateformes
- Résumé et liste d'actions, pas seulement une transcription brute
- Recherche dans l'historique de toutes les réunions passées
- Palier gratuit suffisant pour évaluer sur quelques réunions

## Points faibles
- L'information de l'enregistrement à tous les participants est une obligation
- Précision variable en français, surtout à plusieurs voix
- Les enregistrements partent chez l'éditeur : à cadrer selon la confidentialité
- L'abonnement par utilisateur pèse dès que l'équipe grandit

## Idéal pour
Les équipes qui enchaînent les réunions et perdent les décisions entre deux, à condition d'avoir cadré le sujet de l'enregistrement.`,
    },
    {
      id: `adobe-firefly`,
      nom: `Adobe Firefly`,
      categorie: `Design`,
      prix: `Palier gratuit, inclus dans certains abonnements Creative Cloud`,
      description_courte: `La génération d'images entraînée sur des contenus sous licence — l'argument décisif pour un usage commercial.`,
      lien_affiliation: `https://exemple-affiliation.com/go/adobe-firefly`,
      score_avis: 4.2,
      description_longue: `## Notre verdict
Sur la génération d'images, la question qui compte pour un professionnel n'est pas la beauté du rendu mais le droit de s'en servir. Firefly est entraîné sur des contenus sous licence et de l'imagerie du domaine public, et Adobe assume cette origine — ce qui change tout quand l'image part sur une plaquette client ou une campagne. Le rendu n'est pas toujours le plus spectaculaire du marché ; il est le plus défendable.

## Points forts
- Entraîné sur des contenus sous licence, ce qui sécurise l'usage commercial
- Intégré aux outils Adobe déjà en place dans beaucoup d'ateliers
- Fonctions d'extension et de remplissage utiles au quotidien, au-delà de la génération
- Palier gratuit pour évaluer sans abonnement

## Points faibles
- Rendu parfois en retrait des générateurs les plus avancés
- Système de crédits qui rend le coût réel difficile à anticiper
- Pleine valeur uniquement pour ceux déjà équipés Creative Cloud
- Restrictions de contenu plus strictes que chez les concurrents

## Idéal pour
Ceux dont les images partent chez un client ou en publicité, et qui ne peuvent pas se permettre une incertitude sur les droits.`,
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
