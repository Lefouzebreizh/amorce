# Montage fidèle et automatisation

## Correction livrée dans ce lot

Le montage express prélevait environ 2,1 secondes au début de chaque vidéo,
appliquait des mouvements et transitions selon le rang du plan, et préparait
des textes. Sur les vidéos de créatures, cela pouvait retirer toute la
révélation finale. Un test imposait même un mouvement supplémentaire partout.

Le comportement par défaut conserve désormais toutes les vidéos importées,
dans leur ordre et à leur vitesse d'origine. Les raccords sont francs, sans
chevauchement des pistes des rushes, sans bruitage ni texte ajouté. Un projet
neuf commence avec le rendu naturel ; un étalonnage déjà choisi est conservé.

Le panneau d'import propose séparément les prélèvements courts, les effets
visuels, les bruitages sur plans déclarés muets et la trame de textes. Le mode
court reste heuristique : il ne détecte pas les moments forts. Les anciens
contrôles d'habillage couvrent explicitement ces options, tandis que huit
régressions protègent le nouveau comportement par défaut.

## Preuves et limites

- 351 tests unitaires passent localement, sans test sauté ; typage, lint du
  lot et compilation de production réussis. Ces résultats ne jugent pas la
  qualité artistique.
- Le parcours navigateur comprend désormais un export de conservation des
  quatre rushes synthétiques, avant le parcours historique avec habillage.
  Il contrôle la durée de 15 secondes et la présence des pistes image et son.
- Le workflow conserve les captures et exports même lorsqu'il réussit.
- À la rédaction, le parcours modifié n'a pas encore été exécuté sur GitHub.
  Le navigateur de cette session refuse l'adresse locale avec
  `ERR_BLOCKED_BY_CLIENT`. Aucun résultat navigateur réussi n'est présumé.
- La publication de la branche `codex/amorce-preserver-rushes` a été refusée
  par le contrôle automatique d'approbation : il demande une autorisation
  explicite avant cet envoi vers GitHub. Le correctif reste enregistré
  localement et disponible en patch ; aucune publication réussie n'est annoncée.
- Aucune génération payante ni changement de fournisseur n'est inclus.
- La vidéo de zèbre précédemment montrée a été montée avec des outils externes.
  Elle ne constitue pas une preuve d'export par Amorce.

## Automatiser après validation du film de référence

La recette doit être extraite du projet réellement validé, et non déduite d'une
note interne ou d'un nombre de tests. La validation doit couvrir l'image et le
son sur la durée entière. La recette devra porter :

1. Les rôles des médias : invocation, symbole, vortex, créature, éventuelle voix.
2. Pour chaque plan, les entrées/sorties, vitesses, raccords et cadrages acceptés.
3. Les pistes sonores et leur origine, les niveaux, fondus et événements précis.
4. Les textes approuvés, les zones de placement et les formats de sortie.
5. La version du moteur et le fichier de référence utilisé pour la validation.

Le pipeline cible suivra : préparation des médias, validation des fichiers,
application de la recette, aperçu, export, contrôles techniques, revue du film.
Une entrée trop courte, un média absent, une incohérence audio ou un export
illisible devront bloquer ce traitement avec une explication exploitable. Une
recette ne doit jamais remplacer silencieusement une scène ou générer à nouveau
un média en consommant le budget sans décision explicite.

Cette automatisation complète reste à implémenter et à éprouver. La reprise
locale existante dans `src/lib/persistence.ts` conserve un projet, mais ce
n'est pas encore un système de recettes ni une sauvegarde durable. L'intégration
MiniMax reste soumise au fournisseur unique et au plafond de 20 $ par mois
consignés dans `inbox/amorce.md`. La publication automatique n'est pas activée.
