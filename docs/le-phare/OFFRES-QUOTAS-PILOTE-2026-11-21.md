# Offre hybride — pilote non activé

Décision autorisée dans la conversation du 21 novembre : gratuit utile pour écrire,
organiser, préparer paroles/scénarios et récupérer ses fichiers ; petit essai de
production musique/vidéo puis offre Création avec enveloppe et recharges choisies.
Le quota suspend les nouvelles générations concernées, jamais tout le Phare.
Pas de prix, nombre de crédits, renouvellement ni durée d'essai publiés ici.
L'essai connecté doit être distinct du socle local sans compte ni transfert.

## Code livré dans cette branche

- `scripts/phare-production/credits.py` : registre SQLite persistant, crédits
  attribués par événement idempotent, réservations atomiques et isolation par compte.
- `worker.py` : contrôle avant fournisseur derrière
  `PHARE_CREATION_QUOTAS_ENABLED=true`. Les garde-fous de budget existants restent.
- Le conteneur embarque le registre. Aucune activation/dépense/déploiement exécuté.
- Échec fournisseur ou délai dépassé : réservation maintenue pour réconciliation
  par opérateur. Une réservation maintenue n'est pas une dette supplémentaire.
  Seul un opérateur peut la libérer après vérification ; ne jamais la libérer
  automatiquement après un timeout. Le pilote ne facture aucune recharge automatique.
- L'identifiant de production lie le compte, le tarif et l'empreinte du plan +
  dossier de sortie. Une production consommée ne se relance pas sous le même ID.

## Configuration privée, réservée au serveur

`PHARE_CREDITS_DB` doit viser une base sur disque local persistant, accessible au
seul utilisateur du worker. SQLite n'est pas destiné ici à plusieurs machines ni
à un partage réseau. `PHARE_JOB_CREDIT_UNITS` est un entier positif décidé par un
ordonnanceur de confiance pour ce travail ; ce n'est pas un coût fournisseur ni
un tarif client. `--credit-account` vient de l'identité vérifiée, `--credit-job`
est un identifiant stable fourni par le serveur. Ne jamais exposer ces options
comme des champs libres du navigateur.

Les méthodes `grant` et `finish(..., 'released')` sont privées : aucun endpoint
public n'est ajouté. Une attribution de crédits doit provenir d'un événement de
paiement vérifié ou d'une décision opérateur, jamais d'une déclaration client.
Le registre ne gère pas encore annulation d'abonnement, expiration, remboursements
ou recharges commerciales : ne pas ouvrir la vente avant ce raccord.

## Prérequis avant activation

1. Retrouver la version actuellement utilisée sur Windows et sur le serveur.
   Cette branche part de `codex/phare-parcours-portables-20261115`, commit
   `8d157ce74ac0a084373df9565b25dd45e674d6c5`, pas d'une copie récente du Cocon.
2. Raccorder authentification, offre et catalogue de prix côté serveur. Ne pas
   confondre l'ancienne licence Amorce à achat unique avec une offre Phare.
3. Afficher solde et coût avant confirmation, garder l'accès gratuit aux projets.
4. Ajouter le catalogue de capacités et l'écran de choix d'offre dans la version
   réellement livrée, en marquant indisponibles les fonctions non raccordées.
5. Couvrir les lancements distants alternatifs : le flag de ce worker ne prouve
   pas que tout autre point d'entrée utilise le registre.
6. Mesurer coûts réels, marges, support et limites fournisseur ; tarifs du devis
   historique du 11 novembre non revérifiés. Ne pas en déduire une enveloppe rentable.
7. Raccorder facturation en mode test, vérifier webhooks et parcours d'annulation,
   puis faire une recette réelle sans fournisseur payant avant mise en service.
8. Conserver les droits acquis et établir la durée de conservation des médias
   distants ; pas d'effacement silencieux après expiration.

## Vérification

`python3 -m unittest discover -s scripts/phare-production -p 'test_*.py'`

Cas couverts : concurrence, double attribution, reprise, solde insuffisant,
isolation entre comptes, réservations incertaines, valeurs invalides et refus du
worker avant tout appel fournisseur lorsque le compte n'a pas de crédits.
Pas de génération fournisseur, paiement, interface ou conteneur déployé testé.

Sources de comparaison consultées le 21 novembre :
- https://suno.com/pricing
- https://help.runwayml.com/hc/en-us/articles/50404627334547-Free-plan-details
- https://www.capcut.com/pricing

Suno : crédits gratuits renouvelés et capacités payantes distinctes. Runway :
crédits découverte uniques. CapCut : outils de base gratuits et offre premium.
Ces exemples ne garantissent pas la conversion des utilisateurs du Phare.

### Essai privé du paiement unique de l'application

Depuis `scripts/phare-production`, `checkout_pilote.py` permet à l'opérateur de
préparer une session Stripe en mode test pour un compte fictif et de vérifier
ensuite le règlement directement auprès de Stripe. Le minimum de 1 000 centimes
et la suggestion de 2 000 centimes reprennent l'hypothèse de lancement du
19 novembre pour cet essai uniquement. Le montant se choisit avant Checkout.
La commande renvoie une URL et un identifiant de session. Réutiliser le même
UUID et les mêmes paramètres lors d'une reprise.

    python checkout_pilote.py --compte compte-essai --produit PRODUIT_TEST commander --commande UUID --centimes 1000 --retour https://example.org/merci
    python checkout_pilote.py --compte compte-essai --produit PRODUIT_TEST verifier --session SESSION_TEST --base-test achats-test.sqlite

Renseigner le véritable produit test et la page de retour du pilote avant un
essai réseau. La clé se fournit via STRIPE_TEST_SECRET_KEY. La vérification
inscrit un droit simulé dans une base de recette uniquement. La commande de vérification ne livre pas de fichier. Le pilote n'attribue aucun crédit de production. Les entrées
opérateur doivent être remplacées par un compte authentifié et un catalogue
serveur avant une intégration publique. Aucun branchement sur la licence Amorce.

Une commande de recette correspond à une seule session payée. Une seconde
session payée pour le même UUID déclenche un conflit à examiner avant toute
remise supplémentaire. L'opérateur peut revérifier la première session autant
de fois que nécessaire. Pour une base de recette créée avant ce contrôle,
revérifier les anciennes sessions pour associer leurs UUID aux accès existants.

Une fois la session vérifiée, la commande opérateur `livrer` lit le registre
de test, contrôle l'association session/compte/produit et copie les octets
uniquement si leur SHA-256 correspond au manifeste privé de l'édition.
Le fichier de destination doit être nouveau et sur un volume permettant les
liens physiques. La remise prend un verrou bref sur le registre au moment de créer le fichier final.

    python checkout_pilote.py --compte compte-essai --produit PRODUIT_TEST livrer --session SESSION_TEST --base-test achats-test.sqlite --manifeste edition-test.json --destination recu.txt

Le manifeste et son fichier sont choisis par l'opérateur. Un exemple de recette
synthétique se trouve dans `fixtures/edition-test` à côté du script. Son produit
fictif permet au test automatisé d'exercer la remise locale. Pour un essai avec
Stripe test, préparer à part un manifeste avec l'identifiant de son produit
de test et le fichier correspondant. Le compte est saisi par l'opérateur.
Le compte authentifié, le suivi automatique des remboursements, l'archive installable
et sa distribution au client restent à raccorder avant toute vente.

Relancer `verifier` pour relire le montant remboursé du dernier débit Stripe
de test. Dès qu'un remboursement intégral est constaté, les remises suivantes
sont bloquées, y compris après une réponse antérieure rejouée. Dans ce pilote
uniquement, un remboursement partiel conserve l'accès. Une copie déjà remise
reste sur le disque du destinataire. Les bases plus anciennes doivent repasser
par `verifier` avant une livraison. La commande ne déclenche aucun
remboursement. Une mise à jour automatique par événement fournisseur et la
politique commerciale définitive restent à intégrer.

### Télécharger dans un navigateur pendant la recette locale

    python checkout_pilote.py --compte compte-essai --produit PRODUIT_TEST telecharger --session SESSION_TEST --base-test achats-test.sqlite --manifeste edition-test.json

Après la vérification du paiement test, cette commande démarre une remise
unique sur la boucle locale du poste. Ouvrir l'adresse affichée, puis saisir
le compte fictif et le mot de passe temporaire du terminal dans la boîte du
navigateur. Le serveur relit le droit et l'empreinte avant de retourner le
fichier, puis s'arrête à l'issue du transfert. L'accès expire après cinq
minutes. Le mot de passe est réservé à ce transfert de recette ; il ne
constitue pas la connexion permanente du client. L'essai automatisé lance la
commande complète dans un autre processus, télécharge une véritable archive
ZIP synthétique et relit ses fichiers. Il vérifie aussi les refus pour un
autre compte et pour un client sans identifiants.
