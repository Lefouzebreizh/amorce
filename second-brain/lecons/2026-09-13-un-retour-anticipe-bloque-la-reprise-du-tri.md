# Une reprise se vérifie après le premier passage

Le 13 septembre 2026, la passe IA du Coffre incluait bien les fichiers déjà classés localement dans Images/Papiers, mais trierAutomatiquement quittait la fonction plus tôt lorsque la liste des fichiers sans catégorie était vide. Après un échec technique du premier passage, « Réessayer » ne pouvait donc jamais rejoindre ce filtre pourtant correct.

Mesure sur la fonction extraite de la page, avec stockage et IA simulés : trois scénarios de reprise échouaient avant correction ; les cinq scénarios passent après suppression du retour anticipé et évitement de la sauvegarde initiale quand aucune catégorie locale ne change. Un échec suivi d’une réussite produit deux appels IA simulés et une seule sauvegarde utile. Après trois échecs, le quatrième essai ne soumet plus le fichier.

Le test est dans le-coffre/tests/tri-auto.test.mjs et rejoint npm test. Il exécute la fonction du bouton, pas une copie de sa logique. Il ne valide ni le rendu React, ni la latence réelle, ni le stockage distant. La reprise doit être vérifiée sur son état d’après-échec, pas seulement sur un dossier neuf.
