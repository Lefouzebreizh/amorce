# Exigence visuelle et qualité Lefouzèbreizh

À appliquer à **tous les projets du dépôt**, déjà en cours comme futurs, à chaque création, évolution ou correction d’interface visible. Le niveau de finition attendu est celui du Lefouzèbreizh Studio : haut de gamme, moderne, soigné et immédiatement compréhensible. Cette exigence porte sur chaque produit ; elle ne signifie pas que tous doivent avoir la même palette, la même composition ou les mêmes visuels.

## Direction artistique propre à chaque produit

- Donner à chaque projet une identité reconnaissable, cohérente avec son public, son usage et les choix déjà validés. Le Studio fixe le niveau de qualité, pas un modèle d’écran à recopier.
- Construire une véritable composition : hiérarchie typographique, espaces respirables, grilles maîtrisées, rythme entre les sections, surfaces travaillées et prochaine action évidente.
- Choisir une palette courte avec des rôles clairs et des contrastes vérifiés. Le turquoise `#40E0D0` et le violet `#7C3AED` font partie des repères de la marque, mais ne sont pas imposés à tous les produits. Ne pas imposer un fond sombre : choisir l’ambiance qui sert le mieux le produit. Pour une expérience apaisante ou personnelle, privilégier une interface claire et chaleureuse si elle améliore le confort.
- Créer un visuel signature pertinent : scène 3D, illustration, photographie, mouvement ou matière seulement si cela raconte le produit et aide à s’y projeter. Préserver les visuels déjà validés — notamment la scène marine 3D du Tiroir Secret — sauf demande contraire.
- S’inspirer réellement de références adaptées sur Pinterest et MotionSite AI. Examiner les exemples visuels, noter les URL et les idées retenues, puis produire une interprétation originale. Ne pas prétendre avoir consulté une référence inaccessible ; ne jamais copier son identité, ses textes ou ses éléments propriétaires.
- Donner une vraie qualité aux interactions : états de survol visibles sans déplacer le contenu, focus clavier net, retours tactiles équivalents, transitions rapides et utiles. Respecter `prefers-reduced-motion`, la lisibilité et les performances sur mobile.

Une retouche cosmétique — image remplacée, couleur changée ou halo ajouté — ne suffit pas à satisfaire cette exigence quand la page a besoin d’une refonte. Les applications doivent être aussi abouties que les vitrines : les fonctions utiles sont visibles, les consignes compréhensibles, et les données ou modes de démonstration clairement identifiés.

## Contrôle fonctionnel obligatoire

Avant de présenter ou publier une modification, vérifier le rendu réel et chaque parcours touché :

- Parcourir **chaque bouton, lien, champ, menu et action** : confirmer sa destination ou son effet, les états de chargement, de succès et d’erreur, et vérifier qu’aucun contrôle ne reste inactif ou ne mène au mauvais endroit.
- Tester la saisie et l’envoi au clavier, au clic et au toucher ; vérifier les états désactivés et leurs explications. Pour une démo, préciser ce qui est fictif et ce qui ne peut pas être envoyé.
- Contrôler les parcours concernés en petit écran, tablette et grand écran, ainsi que le focus visible, les contrastes, les débordements et la réduction des animations.
- Exécuter les tests, le typage, le lint et la compilation prévus par le projet. Inspecter l’aperçu correspondant au commit livré. Un build réussi ne prouve pas que les boutons fonctionnent ou que le rendu est agréable.
- Corriger tout défaut bloquant découvert puis refaire les vérifications concernées. Ne jamais annoncer une fonction testée si elle n’a pas été réellement testée. Si un contrôle est impossible ou un test échoue, le signaler et garder la livraison en cours jusqu’à résolution.

## À refuser

- Une interface générique qui pourrait appartenir à n’importe quel projet du Studio.
- Une accumulation de cartes, de dégradés, de halos, de verre ou d’animations sans fonction claire.
- Un bouton décoratif, une action simulée présentée comme réelle, un lien cassé ou une fonction annoncée mais absente.
- Une scène ou un effet qui gêne les tâches, ralentit le site, masque le texte ou casse l’affichage mobile.
- Une régression sur un visuel, un parcours ou un comportement déjà validé.
