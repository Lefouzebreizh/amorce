# Validation d'un achat test — preuve exigée avant ouverture

Cette feuille interdit de confondre code vert et vente prête. La PR peut rester
en brouillon tant que les cases « preuve externe » ne sont pas remplies.

## Déjà vérifié sur la branche

- [x] Tests Python complets : 56 tests réussis après installation de Playwright.
- [x] Serveur Checkout : tests hors réseau réussis et typage gardé par la CI.
- [x] Un paiement non confirmé ne crée pas de commande.
- [x] Une session Stripe rejouée ne crée pas deux commandes.
- [x] Un rapport modifié après relecture ne peut pas être envoyé.
- [x] Une URL de redirection autre que `https://checkout.stripe.com` est refusée.
- [x] La page garde le bouton désactivé tant que le serveur n'est pas configuré.

## Configuration pilote recommandée

- Offre : une URL publique, vues ordinateur et mobile, six catégories,
  recommandations prioritaires et rapport HTML relu.
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
- [ ] Worker Checkout configuré avec clé test, prix test, webhook test, origines,
  URLs de succès/annulation et réception HTTPS persistante.
- [ ] Achat avec une carte Stripe de test ; conserver l'identifiant `cs_test_…`.
- [ ] Webhook signé reçu, commande écrite une seule fois dans SQLite.
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
