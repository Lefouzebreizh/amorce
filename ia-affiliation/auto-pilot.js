#!/usr/bin/env node
/**
 * Auto-pilote de contenu — Radar IA
 *
 * Le site n'a ni base de données ni back-office : son catalogue *est*
 * `outils.json`. Publier un nouvel avis revient donc à ajouter un objet dans ce
 * fichier et à le committer. Ce script fait exactement cela, une fiche à la
 * fois, à partir d'un vivier écrit en dur plus bas.
 *
 * Trois décisions expliquent la forme du code :
 *
 * 1. **Une seule fiche par exécution.** Un site qui gagne quinze avis d'un coup
 *    puis plus rien pendant un mois n'envoie aucun signal de fraîcheur à Google,
 *    et casse la promesse tenue au visiteur en tête de page. Une fiche tous les
 *    deux jours, c'est un mois de publications régulières avec ce vivier.
 * 2. **Le choix est déterministe** (le premier absent du vivier, dans l'ordre
 *    d'écriture), et non tiré au sort : deux exécutions concurrentes ou un
 *    workflow rejoué produisent alors le même résultat, et l'ordre de parution
 *    se relit dans le code.
 * 3. **L'écriture est atomique** : fichier temporaire puis renommage. Une
 *    coupure au milieu d'un `writeFile` laisserait un `outils.json` tronqué,
 *    c'est-à-dire un site entièrement vide — le seul incident vraiment coûteux
 *    dans une chaîne qui tourne sans personne pour la regarder.
 *
 * Sortie : code 0 tant que le fichier reste valide, y compris quand le vivier
 * est épuisé. Un vivier vide n'est pas une panne, et faire rougir l'intégration
 * continue tous les deux jours apprendrait surtout à ne plus la lire.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const FICHIER = path.join(__dirname, 'outils.json');
const DOSSIER_VIVIER = path.join(__dirname, 'vivier');

// En dessous de ce seuil, publier tous les deux jours ne tient plus une
// semaine. L'alerte sort dans le journal du workflow, seul endroit qu'on
// regarde quand la chaîne tourne sans personne.
const SEUIL_ALERTE = 3;

/* ────────────────────────────────────────────────────────────────────────────
   Le vivier. Quinze fiches prêtes à publier, dans leur ordre de parution.
   `date_ajout` est volontairement absente : elle est posée à l'injection, sinon
   toutes les fiches sortiraient datées du jour où ce fichier a été écrit.
   ──────────────────────────────────────────────────────────────────────────── */
const BACKLOG = [
  {
    id: 'claude',
    nom: 'Claude',
    categorie: 'Rédaction',
    prix: 'Freemium — à partir de 20$/mois',
    description_courte: "L'assistant qui tient un document de cent pages en tête et écrit dans votre voix.",
    description_longue: "Claude s'est imposé chez les professionnels de l'écrit pour deux raisons : une fenêtre de contexte énorme, qui lui permet d'avaler un rapport entier, un contrat ou une base documentaire avant de répondre, et un style d'écriture nettement moins stéréotypé que la moyenne. On lui confie une analyse de trois cents pages de conditions générales, un audit de code, ou la réécriture d'une note de synthèse dans le ton d'une maison — et le résultat demande moins de retouches qu'ailleurs.\n\n### Points forts\n- Traitement de documents très longs sans perdre le fil ni inventer la fin.\n- Style d'écriture naturel, particulièrement en français.\n- Excellent sur le code et les tâches d'analyse structurée.\n- Consignes durables : on lui fixe une charte une fois, il la tient sur toute la conversation.\n\n### Points faibles\n- Pas de génération d'images.\n- Prudent au point d'ajouter des réserves dont un texte commercial n'a pas besoin.\n- Les quotas de la formule gratuite se heurtent vite à un usage professionnel soutenu.\n\n### Idéal pour\n- Les métiers du droit, du conseil et de la finance qui vivent dans les documents longs.\n- Les développeurs qui veulent un binôme capable de lire tout un dépôt.\n- Les rédacteurs qui refusent le style « intelligence artificielle » reconnaissable en trois lignes.",
    lien_affiliation: 'https://exemple-affiliation.com/claude'
  },
  {
    id: 'perplexity',
    nom: 'Perplexity',
    categorie: 'Recherche',
    prix: 'Freemium — à partir de 20$/mois',
    description_courte: 'Le moteur de recherche qui répond en citant ses sources, au lieu de vous rendre dix onglets.',
    description_longue: "Perplexity remplace la recherche classique là où l'on cherchait une réponse et non une liste de liens : veille concurrentielle, étude de marché rapide, vérification d'un chiffre, recherche réglementaire. Chaque affirmation est accompagnée de sa source cliquable, ce qui permet de vérifier en dix secondes au lieu de faire confiance. Le mode approfondi enchaîne plusieurs dizaines de recherches et rend une note structurée, exportable, qui tient lieu de premier état des lieux sur un sujet inconnu.\n\n### Points forts\n- Sources systématiquement citées : la vérification devient possible, donc le travail devient publiable.\n- Informations à jour, contrairement aux modèles limités à leur date d'entraînement.\n- Recherche approfondie qui produit un vrai rapport en quelques minutes.\n- Espaces de travail pour regrouper les recherches d'un même dossier.\n\n### Points faibles\n- La qualité de la réponse dépend de celle des pages trouvées : sur un sujet mal couvert, il reprend les approximations du web.\n- Moins bon qu'un assistant généraliste pour rédiger un texte long.\n- La formule gratuite limite le nombre de recherches avancées par jour.\n\n### Idéal pour\n- Les consultants et analystes qui doivent se rendre crédibles sur un secteur en une journée.\n- Les journalistes, chargés de veille et responsables produit.\n- Toute personne qui a besoin d'un chiffre juste, avec sa source, tout de suite.",
    lien_affiliation: 'https://exemple-affiliation.com/perplexity'
  },
  {
    id: 'descript',
    nom: 'Descript',
    categorie: 'Vidéo',
    prix: 'Freemium — à partir de 19$/mois',
    description_courte: 'Montez votre vidéo en supprimant des mots dans un texte, comme dans un traitement de texte.',
    description_longue: "Descript renverse le montage : il transcrit la vidéo, affiche le texte, et supprimer une phrase dans ce texte supprime le passage correspondant à l'image. Pour un contenu parlé — interview, formation, podcast filmé, démonstration produit — c'est la façon la plus rapide de tailler un rush d'une heure. Les fonctions de nettoyage automatique retirent les « euh », les silences et les répétitions en un clic, et la correction de la parole permet de rectifier un mot mal prononcé sans reprendre l'enregistrement.\n\n### Points forts\n- Montage par le texte : dix fois plus rapide que la timeline sur du contenu parlé.\n- Suppression automatique des hésitations et des blancs, avec un rendu naturel.\n- Sous-titres et extraits verticaux générés pour les réseaux sociaux.\n- Enregistrement d'écran et de caméra intégré : tout se fait au même endroit.\n\n### Points faibles\n- Inadapté au montage créatif image par image ou aux effets complexes.\n- La transcription française est bonne mais demande une relecture sur le vocabulaire métier.\n- L'application est gourmande sur une machine peu récente.\n\n### Idéal pour\n- Les formateurs, coachs et consultants qui publient de la vidéo pédagogique chaque semaine.\n- Les podcasteurs qui veulent une version vidéo sans doubler le temps de production.\n- Les équipes marketing qui découpent un webinaire en douze extraits sociaux.",
    lien_affiliation: 'https://exemple-affiliation.com/descript'
  },
  {
    id: 'canva-magic-studio',
    nom: 'Canva Magic Studio',
    categorie: 'Design',
    prix: 'Freemium — à partir de 12$/mois',
    description_courte: "Toute la panoplie graphique d'une agence, utilisable sans savoir dessiner.",
    description_longue: "Canva a intégré l'IA là où elle sert vraiment : effacer un objet d'une photo, détourer un produit, redimensionner une affiche en douze formats sans tout recomposer, écrire les textes d'une présentation à partir d'un simple sujet. Pour une petite structure sans graphiste, c'est l'outil qui couvre le plus de besoins réels — réseaux sociaux, documents commerciaux, présentations, supports imprimés — avec une charte de marque qui verrouille couleurs et polices pour que personne ne parte en roue libre.\n\n### Points forts\n- Redimensionnement automatique d'un visuel vers tous les formats de publication.\n- Retouche photo accessible : effacement d'objet, détourage, extension du cadre.\n- Kit de marque partagé : logos, couleurs et polices imposés à toute l'équipe.\n- Bibliothèque de modèles considérable, avec des gabarits déjà aux bonnes dimensions.\n\n### Points faibles\n- Les modèles sont très utilisés : sans personnalisation, on reconnaît immédiatement du Canva.\n- Les fonctions IA consomment des crédits mensuels vite épuisés.\n- Trop limité pour un travail typographique ou une identité visuelle sur mesure.\n\n### Idéal pour\n- Les TPE, artisans et indépendants qui n'ont ni graphiste ni budget d'agence.\n- Les équipes marketing qui produisent beaucoup de déclinaisons d'un même visuel.\n- Les formateurs qui veulent des supports propres sans apprendre un logiciel de PAO.",
    lien_affiliation: 'https://exemple-affiliation.com/canva'
  },
  {
    id: 'synthesia',
    nom: 'Synthesia',
    categorie: 'Vidéo',
    prix: 'À partir de 29$/mois',
    description_courte: 'Une vidéo de formation avec présentateur à l’écran, produite à partir d’un script écrit.',
    description_longue: "Synthesia fabrique des vidéos avec un présentateur de synthèse qui lit votre texte, dans plus de cent trente langues. L'usage qui justifie l'abonnement n'est pas la nouveauté technique mais la maintenance : quand une procédure change, on modifie une phrase du script et on régénère la vidéo, au lieu de reconvoquer un comédien, un studio et un monteur. Pour un catalogue de formation interne ou une documentation produit multilingue, l'économie se compte en dizaines de milliers d'euros par an.\n\n### Points forts\n- Mise à jour d'une vidéo par simple modification du texte.\n- Plus de cent trente langues, avec un doublage cohérent d'une version à l'autre.\n- Avatars personnalisés à l'image d'un dirigeant ou d'un formateur maison.\n- Modèles pensés pour la formation en entreprise et l'accueil des nouveaux arrivants.\n\n### Points faibles\n- Le résultat reste identifiable comme une vidéo de synthèse : à proscrire pour un message émotionnel.\n- Tarif orienté entreprise, difficile à justifier pour un usage occasionnel.\n- Les gestes et les regards manquent de variété sur une vidéo de plus de trois minutes.\n\n### Idéal pour\n- Les services formation et RH qui entretiennent un catalogue de modules.\n- Les éditeurs de logiciels qui documentent en vidéo dans plusieurs langues.\n- Les entreprises internationales qui diffusent la même consigne à dix pays.",
    lien_affiliation: 'https://exemple-affiliation.com/synthesia'
  },
  {
    id: 'heygen',
    nom: 'HeyGen',
    categorie: 'Vidéo',
    prix: 'Freemium — à partir de 24$/mois',
    description_courte: 'Traduisez votre vidéo dans dix langues, avec votre voix et vos lèvres synchronisées.',
    description_longue: "HeyGen s'est fait connaître par une fonction spectaculaire et réellement utile : le doublage qui conserve votre timbre de voix et resynchronise le mouvement des lèvres sur la langue cible. Une vidéo tournée en français devient une vidéo anglaise, espagnole ou allemande crédible, sans réenregistrement. Le reste de la plateforme couvre les avatars parlants, y compris un clone de vous-même filmé une fois et réutilisable pour des centaines de messages personnalisés.\n\n### Points forts\n- Doublage avec synchronisation labiale : le résultat ne ressemble pas à une voix plaquée.\n- Clone vidéo personnel obtenu à partir de quelques minutes de tournage.\n- Vidéos personnalisées en série à partir d'un tableur de prospects.\n- Prise en main immédiate, sans compétence de montage.\n\n### Points faibles\n- Les crédits vidéo partent vite dès qu'on multiplie les langues.\n- Les mouvements du buste restent limités sur les avatars les plus économiques.\n- Le clonage d'une personne exige un cadre juridique clair : consentement écrit, usage borné.\n\n### Idéal pour\n- Les créateurs et formateurs qui veulent ouvrir un marché à l'international sans retourner.\n- Les équipes commerciales qui envoient des messages vidéo nominatifs à grande échelle.\n- Les marques qui diffusent une même campagne dans plusieurs pays.",
    lien_affiliation: 'https://exemple-affiliation.com/heygen'
  },
  {
    id: 'jasper',
    nom: 'Jasper',
    categorie: 'Rédaction',
    prix: 'À partir de 39$/mois',
    description_courte: "L'IA de rédaction qui apprend la voix de votre marque et la tient sur toute une campagne.",
    description_longue: "Jasper vise les équipes marketing plutôt que l'utilisateur isolé. Sa valeur tient dans la voix de marque : on lui fournit des exemples de textes existants, il en déduit un ton, un vocabulaire et des interdits, puis les applique à toutes les productions — pages de vente, e-mails, publicités, fiches produit. Les campagnes permettent de générer d'un coup l'ensemble des déclinaisons d'un même message, ce qu'un assistant généraliste oblige à demander pièce par pièce.\n\n### Points forts\n- Voix de marque paramétrable, réellement respectée d'un texte à l'autre.\n- Génération d'une campagne complète à partir d'un brief unique.\n- Modèles éprouvés pour les formats commerciaux et publicitaires.\n- Gestion d'équipe : rôles, validation, bibliothèque partagée.\n\n### Points faibles\n- Nettement plus cher qu'un assistant généraliste aux capacités brutes comparables.\n- Beaucoup de fonctions font double emploi avec ChatGPT bien configuré.\n- Le rendu en français demande plus de retouches qu'en anglais.\n\n### Idéal pour\n- Les équipes marketing de cinq personnes ou plus qui publient chaque semaine.\n- Les agences qui gèrent plusieurs marques et doivent cloisonner les tons.\n- Les e-commerçants qui rédigent des centaines de fiches produit cohérentes.",
    lien_affiliation: 'https://exemple-affiliation.com/jasper'
  },
  {
    id: 'grammarly',
    nom: 'Grammarly',
    categorie: 'Rédaction',
    prix: 'Freemium — à partir de 12$/mois',
    description_courte: 'Le correcteur qui relit tout ce que vous écrivez, partout, avant que le client ne le lise.',
    description_longue: "Grammarly ne rédige pas à votre place : il se place derrière vous, dans le navigateur, la messagerie et le traitement de texte, et corrige au fil de la frappe. Sur l'anglais professionnel, c'est l'outil de référence — grammaire, clarté, ton, concision, et une détection du ton perçu qui évite l'e-mail involontairement sec. Les versions payantes ajoutent la reformulation complète d'un paragraphe et la cohérence de style à l'échelle d'une équipe.\n\n### Points forts\n- Correction en contexte dans presque toutes les applications, sans copier-coller.\n- Analyse du ton : l'outil signale un message perçu comme brusque avant l'envoi.\n- Reformulation pour raccourcir ou clarifier sans perdre le sens.\n- Guide de style d'entreprise pour uniformiser les écrits d'une équipe.\n\n### Points faibles\n- Le français reste secondaire : l'outil brille en anglais, beaucoup moins ici.\n- L'extension analyse le texte saisi, ce qui demande un examen sérieux avant tout usage sur des données confidentielles.\n- Les suggestions gomment parfois les partis pris stylistiques volontaires.\n\n### Idéal pour\n- Les professionnels qui travaillent quotidiennement en anglais.\n- Les équipes support et commerciales dont chaque message engage l'image de la maison.\n- Les non-anglophones qui doivent écrire avec assurance à l'international.",
    lien_affiliation: 'https://exemple-affiliation.com/grammarly'
  },
  {
    id: 'zapier',
    nom: 'Zapier',
    categorie: 'Automatisation',
    prix: 'Freemium — à partir de 20$/mois',
    description_courte: 'Reliez vos huit mille applications entre elles et supprimez la ressaisie, sans écrire de code.',
    description_longue: "Zapier est la colle qui manque entre les outils d'une petite entreprise : un formulaire rempli crée une fiche dans le CRM, envoie une facture, prévient l'équipe et planifie une relance, sans qu'aucune main humaine ne recopie quoi que ce soit. Les étapes d'IA intégrées permettent en plus de classer un message entrant, d'en extraire les informations utiles ou de rédiger une réponse — ce qui transforme un automatisme rigide en un automatisme capable de lire du texte libre.\n\n### Points forts\n- Le plus grand catalogue de connecteurs du marché, de loin.\n- Construction visuelle : un scénario utile se monte en une demi-heure.\n- Étapes d'IA pour trier, extraire et rédiger à l'intérieur du flux.\n- Historique d'exécution lisible, indispensable pour comprendre un incident.\n\n### Points faibles\n- La facturation à la tâche devient coûteuse sur les volumes importants.\n- Les logiques conditionnelles complexes sont plus lourdes à écrire qu'ailleurs.\n- Une automatisation mal conçue peut propager une erreur très vite et partout.\n\n### Idéal pour\n- Les indépendants et TPE qui perdent des heures en copier-coller entre outils.\n- Les équipes commerciales qui veulent un suivi de prospect sans oubli.\n- Quiconque veut automatiser sans dépendre d'un développeur.",
    lien_affiliation: 'https://exemple-affiliation.com/zapier'
  },
  {
    id: 'make',
    nom: 'Make',
    categorie: 'Automatisation',
    prix: 'Freemium — à partir de 9$/mois',
    description_courte: "L'automatisation visuelle pour les scénarios que Zapier ne sait plus tenir.",
    description_longue: "Make s'adresse à ceux qui ont dépassé la simple chaîne « si ceci, alors cela ». Son éditeur visuel affiche le flux comme un schéma : branches conditionnelles, boucles, agrégations, reprises sur erreur, appels d'API personnalisés. Pour un coût souvent inférieur à celui de son concurrent sur les gros volumes, on y construit de véritables petits systèmes — synchronisation de bases, traitement de fichiers en lot, orchestration d'appels à des modèles d'IA — sans quitter l'interface.\n\n### Points forts\n- Logique avancée : branches, itérations, agrégation, gestion des erreurs.\n- Tarification au volume nettement plus douce sur les gros usages.\n- Module HTTP générique : toute API se branche, même sans connecteur officiel.\n- Visualisation du flux qui rend un scénario complexe compréhensible d'un coup d'œil.\n\n### Points faibles\n- Courbe d'apprentissage réelle : la première journée est frustrante.\n- Moins de connecteurs prêts à l'emploi que Zapier sur les outils de niche.\n- Le débogage d'un scénario à trente modules demande de la méthode.\n\n### Idéal pour\n- Les profils techniques qui veulent la puissance sans écrire de serveur.\n- Les agences qui industrialisent les mêmes traitements pour plusieurs clients.\n- Les structures dont le volume rend Zapier trop cher.",
    lien_affiliation: 'https://exemple-affiliation.com/make'
  },
  {
    id: 'framer',
    nom: 'Framer',
    categorie: 'Design',
    prix: 'Freemium — à partir de 10$/mois',
    description_courte: 'Un site vitrine professionnel en ligne dans l’après-midi, sans développeur.',
    description_longue: "Framer occupe la place laissée vide entre l'outil de maquette et le constructeur de site : on y dessine comme dans un logiciel de design, et ce que l'on dessine est le site publié, avec ses animations et ses points de rupture. La génération assistée produit une première structure de page à partir d'une description, que l'on retravaille ensuite au pixel. Les performances mesurées et le rendu mobile sont nettement au-dessus de ce que produisent les constructeurs par blocs.\n\n### Points forts\n- Liberté de mise en page réelle, sans se battre contre des gabarits.\n- Animations et interactions soignées, sans une ligne de code.\n- Rendu mobile et vitesse de chargement excellents par défaut.\n- Publication en un clic, avec nom de domaine personnalisé.\n\n### Points faibles\n- Vite limité dès qu'il faut une vraie application avec comptes et base de données.\n- Le référencement demande d'être configuré à la main, page par page.\n- L'abonnement se paie par site : un portefeuille de projets coûte cher.\n\n### Idéal pour\n- Les indépendants et studios qui veulent un site vitrine irréprochable rapidement.\n- Les fondateurs qui testent une page de vente avant d'investir dans du développement.\n- Les designers qui veulent livrer le site plutôt que la maquette.",
    lien_affiliation: 'https://exemple-affiliation.com/framer'
  },
  {
    id: 'gamma',
    nom: 'Gamma',
    categorie: 'Productivité',
    prix: 'Freemium — à partir de 10$/mois',
    description_courte: 'Une présentation présentable en trois minutes, à partir d’un simple plan.',
    description_longue: "Gamma supprime la partie du travail que personne n'aime : la mise en page des diapositives. On donne un sujet ou un plan, il produit une présentation structurée, illustrée et cohérente, que l'on ajuste ensuite bloc par bloc. Le format n'est pas figé en 16/9 : chaque page s'adapte à son contenu, se partage comme une page web, se lit correctement sur téléphone, et s'exporte en PowerPoint ou en PDF quand le client l'exige.\n\n### Points forts\n- Passage du plan à une présentation propre en quelques minutes.\n- Mise en page automatique qui reste lisible quoi qu'on ajoute.\n- Partage par lien, avec statistiques de consultation.\n- Export PowerPoint et PDF pour s'intégrer aux usages existants.\n\n### Points faibles\n- L'esthétique des modèles se reconnaît d'une présentation à l'autre.\n- Le contrôle fin de la mise en page reste inférieur à celui d'un logiciel dédié.\n- L'export PowerPoint perd une partie des mises en forme les plus travaillées.\n\n### Idéal pour\n- Les consultants et commerciaux qui produisent des supports à la chaîne.\n- Les formateurs qui refont leurs slides à chaque session.\n- Les fondateurs qui itèrent sur un dossier d'investisseurs.",
    lien_affiliation: 'https://exemple-affiliation.com/gamma'
  },
  {
    id: 'otter-ai',
    nom: 'Otter.ai',
    categorie: 'Productivité',
    prix: 'Freemium — à partir de 17$/mois',
    description_courte: 'Le collègue qui prend les notes de toutes vos réunions et en sort les décisions.',
    description_longue: "Otter.ai se connecte à l'agenda, rejoint les visioconférences, transcrit ce qui se dit et rend un compte rendu structuré : résumé, points abordés, décisions, actions avec leur responsable. La recherche plein texte sur des mois d'historique transforme les réunions passées en base de connaissances consultable, ce qui règle une bonne partie des désaccords sur « ce qui avait été dit ». Le vrai gain n'est pas la transcription, c'est de pouvoir écouter au lieu d'écrire.\n\n### Points forts\n- Participation automatique aux réunions planifiées, sans y penser.\n- Extraction des actions et des responsables, pas seulement un mur de texte.\n- Recherche dans l'ensemble de l'historique des réunions.\n- Partage et annotation collaborative du compte rendu.\n\n### Points faibles\n- Le français est nettement moins bien traité que l'anglais.\n- La distinction des intervenants se perd dans les réunions à huit personnes.\n- Faire enregistrer une réunion suppose d'en informer les participants : à cadrer avant, pas après.\n\n### Idéal pour\n- Les chefs de projet qui enchaînent six réunions par jour.\n- Les équipes commerciales qui doivent tracer chaque échange client.\n- Les organisations dont les décisions se prennent à l'oral et se perdent aussitôt.",
    lien_affiliation: 'https://exemple-affiliation.com/otter'
  },
  {
    id: 'suno',
    nom: 'Suno',
    categorie: 'Audio',
    prix: 'Freemium — à partir de 10$/mois',
    description_courte: 'Une musique originale et libre de droits, écrite pour votre vidéo, en deux minutes.',
    description_longue: "Suno compose des morceaux complets — instrumentation, structure, voix chantée si on le souhaite — à partir d'une description d'ambiance et, au besoin, de paroles fournies. Pour un professionnel de la vidéo ou du podcast, l'intérêt est direct : une musique qui n'existe nulle part ailleurs, calée sur la durée voulue, sans négocier de licence ni craindre une réclamation de droits d'auteur sur une plateforme.\n\n### Points forts\n- Morceaux complets et cohérents dès les premiers essais.\n- Contrôle du genre, de l'ambiance et de la durée par simple description.\n- Paroles personnalisées : jingles de marque, génériques, formats humoristiques.\n- Licence commerciale incluse dans les formules payantes.\n\n### Points faibles\n- La qualité de production reste en dessous d'un morceau réellement mixé.\n- Peu de contrôle fin sur l'arrangement : on relance plutôt qu'on ne corrige.\n- Le cadre juridique du secteur bouge encore : lire les conditions d'usage avant une campagne payante.\n\n### Idéal pour\n- Les monteurs et créateurs de formats courts lassés des bibliothèques musicales.\n- Les podcasteurs qui veulent un générique à eux.\n- Les commerces et marques cherchant un jingle sans budget de studio.",
    lien_affiliation: 'https://exemple-affiliation.com/suno'
  },
  {
    id: 'adobe-firefly',
    nom: 'Adobe Firefly',
    categorie: 'Design',
    prix: 'Freemium — à partir de 10$/mois',
    description_courte: "La génération d'images entraînée sur des contenus sous licence, utilisable en clientèle sans arrière-pensée.",
    description_longue: "L'argument de Firefly n'est pas esthétique, il est juridique : le modèle est entraîné sur la banque d'images d'Adobe et des contenus du domaine public, et l'éditeur accompagne son usage commercial d'un engagement d'indemnisation pour ses clients entreprise. Pour une agence qui livre à un client final, cette différence pèse plus lourd qu'un rendu un peu plus flatteur. S'y ajoute l'intégration native dans Photoshop et Illustrator : remplissage génératif, extension de cadre et vectorisation directement dans l'outil de production.\n\n### Points forts\n- Origine des données d'entraînement documentée, avec couverture juridique côté entreprise.\n- Intégré à Photoshop et Illustrator : aucune rupture dans la chaîne de production.\n- Remplissage génératif d'une zone sélectionnée, la fonction la plus utilisée au quotidien.\n- Génération d'effets de texte et de motifs vectoriels réellement exploitables.\n\n### Points faibles\n- Rendu photographique en retrait face aux meilleurs générateurs du marché.\n- Filtres de contenu stricts qui bloquent des demandes parfaitement légitimes.\n- Les crédits génératifs sont rapidement consommés dans une journée de production.\n\n### Idéal pour\n- Les agences et studios qui livrent des visuels à des clients exigeants sur les droits.\n- Les graphistes déjà installés dans la suite Adobe.\n- Les services communication d'entreprises qui doivent justifier l'origine de chaque image.",
    lien_affiliation: 'https://exemple-affiliation.com/firefly'
  }
];

/* ── Utilitaires ─────────────────────────────────────────────────────────── */

/**
 * Fiches supplémentaires déposées dans `vivier/`, un fichier JSON par outil
 * (ou un tableau d'outils dans un même fichier).
 *
 * Le tableau ci-dessus suffit à trente jours de publication ; au trente et
 * unième, il faut le rallonger. Éditer un fichier de mille lignes depuis un
 * téléphone pour ajouter une fiche est le genre de friction qui fait qu'on ne
 * le fait pas — et un site qui cesse de publier meurt en silence. Déposer un
 * petit fichier dans un dossier, en revanche, se fait n'importe où, et
 * `nouvelle-fiche.mjs` en écrit le squelette.
 *
 * Les fiches du dossier passent après celles du code : l'ordre de parution
 * déjà décidé ne bouge pas quand on rallonge la file.
 */
function chargerVivier() {
  if (!fs.existsSync(DOSSIER_VIVIER)) { return []; }
  const fiches = [];
  fs.readdirSync(DOSSIER_VIVIER)
    .filter((nom) => nom.endsWith('.json'))
    .sort()
    .forEach((nom) => {
      const chemin = path.join(DOSSIER_VIVIER, nom);
      let contenu;
      try {
        contenu = JSON.parse(fs.readFileSync(chemin, 'utf8'));
      } catch (e) {
        throw new Error('vivier/' + nom + ' est illisible : ' + e.message);
      }
      const lot = Array.isArray(contenu) ? contenu : [contenu];
      lot.forEach((fiche) => {
        if (!fiche || typeof fiche.id !== 'string' || !fiche.id) {
          throw new Error('vivier/' + nom + ' contient une fiche sans identifiant.');
        }
        fiches.push(fiche);
      });
    });
  return fiches;
}

// Une fiche fabriquée par `nouvelle-fiche.mjs` et laissée en l'état ne doit
// jamais partir en ligne : la chaîne publie sans relecture humaine, donc c'est
// ici, et nulle part ailleurs, qu'on peut encore l'arrêter.
function incomplete(fiche) {
  return Object.values(fiche).some(
    (valeur) => typeof valeur === 'string' && valeur.includes('À COMPLÉTER')
  );
}

function dateDuJour() {
  const maintenant = new Date();
  const mois = String(maintenant.getMonth() + 1).padStart(2, '0');
  const jour = String(maintenant.getDate()).padStart(2, '0');
  return maintenant.getFullYear() + '-' + mois + '-' + jour;
}

function lireCatalogue() {
  if (!fs.existsSync(FICHIER)) {
    console.log('· Aucun outils.json : un catalogue vide est créé.');
    return [];
  }
  const brut = fs.readFileSync(FICHIER, 'utf8');
  let donnees;
  try {
    donnees = JSON.parse(brut);
  } catch (e) {
    throw new Error(
      'outils.json est illisible (' + e.message + '). ' +
      "Rien n'a été écrit : corrigez le fichier avant de relancer."
    );
  }
  if (!Array.isArray(donnees)) {
    throw new Error('outils.json doit contenir un tableau, pas un ' + typeof donnees + '.');
  }
  return donnees;
}

// Écriture atomique : le renommage est instantané pour le système de fichiers,
// donc `outils.json` est soit l'ancien, soit le nouveau, jamais un demi-fichier.
function ecrireCatalogue(catalogue) {
  const temporaire = FICHIER + '.tmp';
  fs.writeFileSync(temporaire, JSON.stringify(catalogue, null, 2) + '\n', 'utf8');
  JSON.parse(fs.readFileSync(temporaire, 'utf8')); // relecture de contrôle
  fs.renameSync(temporaire, FICHIER);
}

/* ── Programme principal ─────────────────────────────────────────────────── */

function main() {
  console.log('── Auto-pilote de contenu — Radar IA');

  const catalogue = lireCatalogue();
  const dejaLa = new Set(catalogue.map((o) => String(o && o.id)));
  const vus = new Set();
  const vivier = BACKLOG.concat(chargerVivier()).filter((o) => {
    // Une même fiche présente dans le code et dans le dossier serait publiée
    // deux fois sous deux dates : on ne garde que la première rencontrée.
    if (vus.has(o.id)) { return false; }
    vus.add(o.id);
    return true;
  });
  const publiables = vivier.filter((o) => !dejaLa.has(o.id));
  const restants = publiables.filter((o) => !incomplete(o));
  const enChantier = publiables.length - restants.length;

  console.log('· Catalogue actuel  : ' + catalogue.length + ' outil(s)');
  console.log('· Vivier disponible : ' + restants.length + ' fiche(s) prête(s)');
  if (enChantier > 0) {
    console.log('· ' + enChantier + ' fiche(s) encore marquée(s) « À COMPLÉTER » : gardée(s) hors ligne.');
  }

  if (restants.length === 0) {
    console.log('· Vivier épuisé : rien à publier aujourd\'hui, le catalogue reste inchangé.');
    console.log("· Ajoutez des fiches dans le tableau BACKLOG d'auto-pilot.js pour relancer la machine.");
    return;
  }

  const choisi = Object.assign({}, restants[0], { date_ajout: dateDuJour() });
  catalogue.push(choisi);
  ecrireCatalogue(catalogue);

  console.log('· Publié : ' + choisi.nom + ' (' + choisi.categorie + ') — ' + choisi.date_ajout);
  console.log('· Nouveau total : ' + catalogue.length + ' outil(s)');

  const reste = restants.length - 1;
  console.log('· Restera ensuite ' + reste + ' fiche(s) au vivier, soit ' + (reste * 2) + ' jours.');
  if (reste <= SEUIL_ALERTE) {
    console.log('');
    console.log('⚠ Vivier presque vide. Rallongez-le avant la panne sèche :');
    console.log('  node nouvelle-fiche.mjs "Nom de l\'outil" Categorie');
  }
}

if (require.main === module) {
  try {
    main();
  } catch (e) {
    console.error('✗ Auto-pilote interrompu : ' + e.message);
    process.exit(1);
  }
}

// Exporté pour `verifier.mjs`, qui contrôle les fiches en attente avec les
// mêmes règles que celles déjà publiées — une fiche fautive doit être signalée
// avant sa parution, pas le matin où elle sort.
module.exports = { BACKLOG, chargerVivier, dateDuJour };
