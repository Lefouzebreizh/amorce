# Service privé de lecture — intégration en attente

`credit_service.py` prépare le compteur et le devis sans lancer de serveur HTTP,
sans créer de compte, sans attribution ni dépense de crédits. Aucun tarif de
production n'est fourni. Les profils présents dans les tests sont fictifs.

## Identité existante à réutiliser

`comptes-serveur/src/index.ts` vérifie déjà le jeton de session à l'aide de
`ouvrir` dans `jetons.ts`, puis l'existence du compte. Cet environnement utilise
TypeScript et D1, tandis que le registre du pilote Phare est privé en Python et
SQLite. Ce lot ne duplique pas les jetons HMAC et ne fusionne pas les deux
monnaies. Aucun raccord de confiance entre ces environnements n'est livré.

L'adaptateur futur doit vérifier la session avec ce mécanisme existant, vérifier
le compte, puis résoudre son identifiant stable côté serveur. Il fournit ce
résolveur au constructeur de `CreditReadService`. Ne jamais utiliser un champ
`account` ou `compteId` fourni par le navigateur comme résolveur, et ne jamais
exposer directement cet objet à une passerelle générique RPC.

## Contrat du service

- `balance(authentication_context)` retourne les crédits attribués, réservés,
  consommés et disponibles dans une transaction cohérente pour le seul compte
  vérifié. Les réservations libérées ne réduisent plus le solde.
- `quote(authentication_context, profile)` retourne coût, version du catalogue,
  solde et statut `ready`, `insufficient_credits` ou `unavailable`. Un profil
  inconnu ou non livré reste indisponible, quel que soit le solde.
- Le catalogue est copié puis figé à la construction. Les tarifs sont des
  entiers positifs et la disponibilité est explicitement booléenne.
- Un devis ne réserve rien et ne constitue jamais une autorisation d'exécution.
  Le lancement doit relire le tarif serveur, vérifier que TOUTES les dimensions
  du travail correspondent au profil (durée, qualité, nombre de variantes,
  plans...), puis employer `Ledger.reserve` atomiquement avant le fournisseur.
- La réponse ne contient ni identifiant interne de compte ni secret, et conserve
  le signal d'accès aux fichiers existants en cas de crédits insuffisants.

Ne pas brancher `canRequestProduction` directement sur le worker : c'est une
indication d'interface instantanée susceptible de changer dans un autre onglet.
La réservation du worker reste l'autorité avant la dépense.

## Vérification et limites

`python3 -m unittest discover -s scripts/phare-production -p 'test_*.py'`

18 tests passent sur le lot complet dans l'environnement Linux isolé : notamment
refus de faux contextes d'identité, isolation des comptes, distinction des états,
lecture après changement de solde, catalogue non modifiable et refus de capacités
indisponibles. Aucun test fournisseur, paiement, connexion réelle, interface ou
déploiement. La connexion de l'adaptateur, l'interface, le catalogue commercial
et la facturation restent à intégrer avant activation.
