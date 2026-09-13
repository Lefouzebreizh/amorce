# Audit de référence préparatoire — notre page de vente

Établi le 12 septembre 2026 à partir de la branche `codex/audit-qualite`.
Objet : `audit-landing/site/index.html`, son exemple de rapport et le parcours
préparé dans ce dossier. Lecture du code et des textes, tests locaux.
**Aucune observation visuelle, mesure de conversion ou preuve de vente.**
Ce document doit être complété par des captures réelles avant d'être présenté
comme un exemple d'audit visuel client. Les impacts ci-dessous sont des hypothèses.

## Verdict

Le service proposé est compréhensible, mais la page ne démontre pas encore
la qualité du travail vendu. La commande est volontairement fermée. L'enjeu
immédiat est de montrer une recommandation utile et vérifiable avant de
chercher à augmenter le trafic ou d'arrêter le tarif.

## Trois priorités

### 1. Montrer la correction, pas seulement une note

Preuve : section `.exemple`, aperçu composé des notes « Preuve sociale 3/10 »
et « Appel à l'action 5/10 ». Le lien mène à un exemple fictif.

Observation : cet aperçu décrit la forme du rapport, mais ne donne pas au
visiteur un exemple de décision concrète qu'il pourra prendre après lecture.
Hypothèse : une personne qui hésite à acheter ne peut pas encore distinguer
le service d'un commentaire générique produit par un assistant IA.

Correction proposée : une capture réelle, un constat localisé, la proposition
de réécriture et sa justification. Indiquer « proposition à tester », pas
« amélioration prouvée ». Garder le rapport complet accessible pour apprécier
la profondeur du travail. Aucun faux client ni témoignage inventé.

Critère d'acceptation : un lecteur extérieur peut identifier la zone en cause,
expliquer la correction et retrouver la preuve dans le rapport complet.

### 2. Faire une promesse que le processus peut tenir

Preuves : nom « Audit de page de vente en 24h », description de livraison HTML
sur la page ; `livraison.py` prépare une pièce jointe HTML ; les captures et
la livraison complète n'ont pas été exercées depuis cette session.

Observation : la promesse de délai reste affichée sans mesure complète. Le
format de livraison existe en code, mais sa réception et son ouverture chez
un client ne sont pas prouvées.

Correction proposée pour la phase pilote : annoncer une ouverture prochaine,
puis ne rétablir un délai garanti qu'après mesure de capture, analyse,
relecture et remise. À l'ouverture, préciser quand le délai commence et ce
qui se passe si la page est inaccessible.

Texte candidat, à utiliser seulement une fois le contenu réellement disponible :
« Recevez un rapport illustré : les points qui prêtent à confusion, des
propositions de correction et les priorités à tester sur votre page. »

Critère d'acceptation : un parcours de commande test aboutit à un rapport relu,
reçu puis ouvert sur téléphone et ordinateur ; les heures sont consignées.

### 3. Rendre l'offre décidable avant le paiement

Preuves : section `#tarif` sans montant ; pied de page limité au nom du service.

Observation : le prix est indécis et aucun contact commercial n'est affiché.
C'est cohérent avec une vente fermée, insuffisant pour une ouverture.

Correction proposée : avant activation, afficher le montant total, ce qui est
inclus, le périmètre (une URL, appareils examinés, pages accessibles sans
connexion), les exclusions, un contact réel et le traitement d'une commande
impossible à réaliser. Ces informations doivent correspondre au service opéré.
Ne pas inventer de politique de remboursement ou d'identité commerciale.

Critère d'acceptation : le lecteur sait ce qu'il achète et à quel prix avant
son premier clic vers le paiement.

## Ce qui mérite d'être conservé

- Les six catégories rendent le contenu attendu facile à parcourir.
- L'exemple est désormais explicitement identifié comme fictif.
- La promesse ne prétend plus mesurer où les visiteurs abandonnent.
- La commande fermée est annoncée avant tout paiement.

Ces observations portent sur le contenu, pas sur la qualité du rendu graphique.

## Vérifications restant à effectuer

Captures ordinateur et mobile ; lien de l'exemple ; lecture et accessibilité
du formulaire ; page réelle difficile à capturer ; rapport effectivement relu ;
pièce jointe reçue et ouverte ; statut fournisseur rapproché du registre.
L'absence de panne dans des tests unitaires ne remplace aucun de ces contrôles.

## Expérience commerciale proposée

Avant de prospecter, produire un audit visuel réel et mesurer séparément le
temps machine, la relecture et le support. Faire examiner le livrable à une
personne extérieure : quelle correction appliquerait-elle, et pourquoi ?
Ensuite seulement tester une offre payante avec un petit nombre de clients.
Objectif de trois commandes : seuil de décision interne, pas validation
statistique du marché. Aucun prospect n'a été contacté pour cette expérience.

Feuille de mesure par audit : coût API réellement facturé, temps de capture,
temps d'analyse, temps humain, frais de paiement, acquisition attribuable,
éventuelle reprise ou remboursement, prix encaissé. Ne pas utiliser le temps
passé à développer le logiciel comme coût variable d'un rapport.

Calcul interne : contribution avant charges fixes et fiscalité = prix encaissé
moins frais de paiement, API, acquisition et valeur du temps humain. Un prix
ne peut être retenu sur la seule différence entre prix de vente et jetons IA.
Toutes ces mesures restent à collecter ; aucune rentabilité n'est démontrée.
