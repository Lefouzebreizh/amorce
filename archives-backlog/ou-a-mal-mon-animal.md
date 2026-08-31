# Où a mal mon animal

> **En pause dès la notation — 27 août 2026.** Ce n'est pas un refus technique :
> la version d'origine est faisable. C'est un refus de ce qu'elle ferait.
> La version réduite, en bas, est écrite et vaut 7/10.

## Pitch (version d'origine)

Indiquer sur une silhouette d'animal l'endroit qui fait mal, décrire les
symptômes, et recevoir des pistes sur ce que ça pourrait être — ou une
orientation vers un vétérinaire quand c'est grave.

## Score de faisabilité — 5/10

| Critère | Note | Justification |
| --- | --- | --- |
| Temps / Effort | 6/10 | Silhouette interactive, arbre de questions, base de correspondances : deux à quatre semaines, et l'essentiel du travail n'est pas du code. |
| Complexité technique | 5/10 | Techniquement modeste. Ce qui manque n'est pas une bibliothèque, **c'est un vétérinaire** pour valider chaque règle — et ça ne s'installe pas. |
| Coût / Rentabilité | 5/10 | Gratuit à faire tourner. Mais aucun revenu en face, et une exposition en responsabilité qu'aucun des trois autres projets ne porte. |
| Alignement | 5/10 | Look & Find identifie des objets pour des acheteurs. Ici le public est quelqu'un d'inquiet pour son animal : autre contrat de confiance, autre exigence. Greffer les deux dilue les deux. |

**Verdict :** aucun critère ne tombe à 3, donc pas de plafond. Le score est
honnêtement 5. **Mais le vrai motif du refus n'est dans aucune colonne**, et il
est plus grave que la note.

## Le danger n'est pas de se tromper — c'est de rassurer

Une torsion d'estomac tue un chien en quelques heures. Une occlusion, un coup de
chaleur, l'ingestion d'un antigel : quelques heures aussi.

Une application qui répond « probablement une indigestion, surveillez cette
nuit » a coûté l'animal — **même en affichant « consultez un vétérinaire » en
bas de l'écran**. Ce n'est pas une hypothèse de juriste : c'est le mécanisme
ordinaire d'un outil de tri. Il produit du soulagement, et le soulagement fait
attendre.

Personne n'installe cette application quand tout va bien. Elle est ouverte à
deux heures du matin par quelqu'un qui cherche une raison de ne pas déranger un
vétérinaire de garde. **Lui en fournir une est le produit.**

`CLAUDE.md` l'écrit : jamais de promesse de guérison, et zéro procédé qui
manipule. Un public qui se sait fragile est exactement celui qu'un faux
apaisement blesse le plus.

## La version qui, elle, passe — 7/10

**Supprimer entièrement le diagnostic.** Ne rien deviner. Garder trois choses
qui ne devinent rien et qui font gagner du temps au vrai soignant :

1. **Les signes qui imposent un vétérinaire maintenant.** Une liste courte,
   écrite par un vétérinaire, sans arbre de décision : ventre dur et gonflé,
   tentatives de vomir à vide, difficulté respiratoire, gencives pâles ou
   bleues, convulsions, ingestion connue d'un toxique. On ne demande rien, on
   montre. La personne reconnaît, ou pas.
2. **Le carnet de symptômes.** Horodaté, photos, vidéo de la démarche, poids,
   ce qu'il a mangé et quand. C'est **ce que le vétérinaire demande toujours et
   que personne n'a sous la main**. Ça ne remplace pas la consultation : ça la
   raccourcit et la rend meilleure.
3. **Les urgences ouvertes maintenant**, autour de soi, avec le numéro. À deux
   heures du matin, c'est la seule information qui compte.

| Critère | Note | Pourquoi ça remonte |
| --- | --- | --- |
| Temps / Effort | 8/10 | Un week-end : trois écrans, aucune logique métier à valider. |
| Complexité technique | 9/10 | Formulaire, photos, annuaire. Rien à apprendre. |
| Coût / Rentabilité | 8/10 | Gratuit, et **aucune exposition** : on n'avance aucun avis. |
| Alignement | 5/10 | Toujours un front distinct — c'est le seul critère qui ne bouge pas. |

**7/10.** Ce n'est pas un lot de consolation : c'est une meilleure application.
Elle est utile là où l'autre était dangereuse, et elle tient en un week-end au
lieu d'un mois.

## Ce qui ferait remonter la version d'origine

Une seule chose, et elle n'est pas technique : **un vétérinaire qui accepte
d'écrire et de signer les règles de tri, et de les revoir**. Sans nom et sans
responsabilité derrière le contenu, la version d'origine ne se fait pas — quel
que soit le temps qu'on y mettrait.

## Questions ouvertes

1. **Connais-tu un vétérinaire prêt à relire du contenu ?** C'est la seule
   réponse qui ouvre la version d'origine.
2. **Chien et chat seulement, ou aussi NAC ?** Les signes d'urgence d'un lapin
   ou d'un furet n'ont rien à voir, et un lapin qui ne mange plus depuis douze
   heures est déjà une urgence.
