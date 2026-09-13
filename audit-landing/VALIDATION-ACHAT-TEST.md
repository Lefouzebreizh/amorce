# Validation d'un achat test — preuve exigée avant ouverture

Cette feuille interdit de confondre code vert et vente prête. La PR peut rester
en brouillon tant que les cases « preuve externe » ne sont pas remplies.

## Déjà vérifié sur la branche

- [x] Tests Python hors navigateur réussis ; résultats et commit à conserver
  dans la PR. Installer Playwright n'équivaut pas à exécuter des captures.
- [x] Serveur Checkout : tests hors réseau réussis et typage gardé par la CI.
- [x] Un paiement non confirmé ne crée pas de commande.
- [x] Une session Stripe rejouée ne crée pas deux commandes.
- [x] Un rapport modifié après relecture ne peut pas être envoyé.
- [x] Une URL de redirection autre que `https://checkout.stripe.com` est refusée.
- [x] La page garde le bouton désactivé tant que le serveur n'est pas configuré.

## Pipeline de validation

1. Vérifier le code et les régressions localement, puis dans GitHub Actions.
2. Publier les fichiers HTML bruts du commit contrôlé en Preview, vérifier
   l'accueil et le rapport fictif sur ordinateur et téléphone.
3. Déployer les entrées HTTP et le registre persistant, configurer uniquement
   les services de test, puis effectuer une commande complète.
4. Conserver les preuves externes ci-dessous avant toute ouverture.

La coordination du développement peut être automatisée avec des sous-agents.
Elle ne remplace ni les droits d'accès aux services, ni les données réelles du
vendeur, ni la relecture nominative du rapport exigée par le pilote.

Blocage d'aperçu observé le 13/09/2026 : le déploiement dédié affichait du
Base64 ; le dépôt contient du HTML brut. La tentative d'envoi des deux fichiers
avec `encoding: "utf-8"` et `target: "preview"` a été refusée par Vercel (403,
permission de créer un aperçu de `amorce-pr953-audit-landing`). Il faut rétablir
ce droit puis republier. Aucun changement de domaine ni promotion en production
n'est requis pour cette correction.

## Configuration pilote recommandée

- Offre réalisable par le moteur actuel : une URL publique, vues ordinateur
  (1440 × 900), six catégories,
  recommandations prioritaires et rapport HTML relu.
- Capture mobile d'une URL commandée : non implémentée. L'ajouter et la vérifier
  avant de l'inclure dans l'offre ; ne pas la confondre avec la lecture du
  rapport HTML sur téléphone.
- Prix pilote conseillé : **49 € TTC**, à confirmer selon le régime fiscal et
  à afficher seulement avec l'identité du vendeur, le contact et les conditions.
- Capacité initiale : trois commandes pilotes au maximum.
- Délai : ne pas promettre « 24 h » avant une mesure complète ; annoncer le
  délai confirmé sur la page de paiement.
- Exclusions : espaces connectés, refonte ou développement, mesure réelle de
  conversion, garantie de résultat.

## Preuves externes encore obligatoires

- [ ] Déploiement de la landing et captures réelles ordinateur + mobile.
- [ ] Produit et prix créés dans Stripe **mode test**.
- [ ] Serveur HTTP Checkout démarré avec clé test, prix test, webhook test, origines,
  URLs de succès/annulation et réception HTTPS persistante.
- [ ] Achat avec une carte Stripe de test ; conserver l'identifiant `cs_test_…`.
- [ ] Webhook signé reçu, commande écrite une seule fois dans SQLite.
- [ ] Processus Chromium isolé des services internes et des métadonnées cloud ;
  résolution et filtrage réseau vérifiés sur l'hébergement réel.
- [ ] Capture réelle de l'URL commandée, analyse et rapport HTML produits.
- [ ] Rapport relu puis approuvé nominativement.
- [ ] Courriel Resend réellement accepté, reçu et pièce jointe ouverte sur
  téléphone et ordinateur.
- [ ] Annulation Checkout vérifiée sans commande enregistrée.
- [ ] Échec contrôlé vérifié : réception indisponible => webhook 503 et aucune
  commande perdue.
- [ ] Prix, identité du vendeur, contact, périmètre et conditions affichés avant
  le premier clic de paiement.

## Verdict de lancement

Tant qu'une case externe manque : **prêt pour intégration, pas prêt pour une
vente réelle**. Quand toutes les cases sont prouvées avec leurs identifiants et
horodatages : passage possible à un pilote limité, puis seulement au mode live.
