# Rétrospective — Accord et la reconnaissance de couleurs

**Demandée le 10/09/2026.** Couvre la séance du 03/09 et ses suites jusqu'au
08/09. Écrite depuis les horodatages de `git log` et les relevés conservés, pas
de mémoire.

**Une règle de lecture, avant tout le reste.** Là où une durée n'a pas été
mesurée, il est écrit **non mesuré**. Ce document parle de temps perdu ; en
inventer les chiffres le rendrait exactement aussi faux que les défauts qu'il
recense.

---

## 1. Les problèmes, dans l'ordre

### 1.1 — « Le seuil de 0,70 n'est pas le problème »

**Ce que c'était.** Une affirmation de ma part, posée sur dix photos. Un lot de
seize l'a démentie : le seuil était trop **permissif**.

**Temps perdu :** non mesuré, antérieur au 03/09.

**Pourquoi pas plus tôt.** Une propriété a été énoncée à partir de dix cas et
traitée ensuite comme acquise. Rien dans le processus ne distingue « mesuré sur
dix » de « mesuré ».

### 1.2 — Le « vide net entre 0,59 et 0,82 »

**Ce que c'était.** L'hypothèse fondatrice de la porte, écrite dans la fiche :
les photos de surface et les photos de pièce se sépareraient franchement.
Quarante-sept photos réelles l'ont réfutée — dix faux positifs.

**Temps perdu :** non mesuré. Le coût réel n'est pas le temps, c'est que **trois
statistiques ont été construites sur cette hypothèse** avant qu'elle tombe.

**Pourquoi pas plus tôt.** Le vide avait été mesuré sur dix-sept photos, toutes
du même type. Un corpus homogène produit toujours un vide.

### 1.3 — Un test de non-régression vert sans son correctif

**Ce que c'était.** Le test censé figer la collision entre le déclencheur et le
texte d'aide éprouvait `CadreVisee` **seul**, là où la collision ne peut pas
exister. Il restait vert avec le défaut réintroduit.

**Quand :** écrit puis fusionné, découvert le 03/09 vers 03 h 31 (leçon
« Écrire qu'un test vert peut être vide »).

**Temps perdu :** non mesuré, de l'ordre d'un aller-retour.

**Pourquoi pas plus tôt.** **Personne n'avait lancé le test sans le correctif.**
Un test de non-régression qui n'a jamais été vu rouge ne fige rien.

### 1.4 — Trente-trois frontmatters YAML cassés sur soixante-six

**Ce que c'était.** GitHub signalait **une** erreur sur **un** fichier. La
mesure en a trouvé **33** — la moitié des compétences du dépôt — cassées depuis
des semaines.

**Quand :** signalé par capture d'écran, corrigé et fusionné le 03/09 à 08 h 15
(#638).

**Temps perdu :** la correction elle-même a tenu dans la matinée. Le temps
réellement perdu est **celui pendant lequel 33 compétences étaient illisibles
sans que rien ne le dise** — des semaines, non mesurables précisément.

**Pourquoi pas plus tôt.** Le contrôle de cohérence vérifie qu'une compétence
est **citée**, jamais que son entête **se lit**. Le défaut était invisible pour
le seul outil censé le voir.

### 1.5 — La régénération de table qui fait fuir le guillemet

**Ce que c'était.** Après avoir quoté 33 descriptions d'un coup, la
régénération de la table a mis le guillemet ouvrant en tête de 33 lignes.

**Quand :** même PR, #638.

**Temps perdu :** minutes. **Attrapé en relisant le diff**, par aucun test.

**Pourquoi pas plus tôt.** Aucun outil ne compare l'**apparence** d'une
citation ; le vérificateur était vert. Une correction en masse fabrique une
valeur que le code en aval n'a jamais rencontrée.

### 1.6 — Une baisse de fréquence prise pour une correction

**Ce que c'était.** Le « brun boueux » — la porte qui accepte une scène entière
et en rend une moyenne qui n'est la couleur de rien — est passé de **15 cas sur
17** à **8 sur 32** après l'ajout des seuils de dispersion. Lu comme une
correction. Les huit survivants étaient **le même défaut intact** : huit sujets
sans rapport rendant huit bruns dans **14,8° de teinte**.

**Quand :** découvert le 03/09 à 10 h 43 (#641), à réception des photos.

**Temps perdu :** **plusieurs jours de confiance** dans un seuil qui ne mesure
pas ce qu'on croyait — les seuils datent du 31/08.

**Pourquoi pas plus tôt.** On a compté les cas restants au lieu de **les
regarder**. Le taux descendait ; les huit couleurs côte à côte auraient suffi.

### 1.7 — Quatre pistes construites puis écartées

**Ce que c'était.** Contiguïté, part du nom majoritaire, part portant le nom de
la moyenne, répartition chaud/froid dans le cadre. Toutes plausibles, toutes
mesurées, **aucune ne sépare**.

**Quand :** les trois premières dans la journée du 03/09 ; la quatrième écartée
à **18 h 29** (#668), soit **près de huit heures** après avoir été écrite comme
piste dans une fiche fusionnée à 11 h 42 (#653).

**Temps perdu :** ces huit heures sont la seule durée franchement mesurable du
lot — et elles n'ont été rattrapées que parce que le propriétaire a dit
« reprends ton travail ».

**Pourquoi ça a traîné.** La piste a été **écrite, fusionnée, et laissée**. Le
dépôt n'a aucun endroit qui distingue « idée notée » de « idée à éprouver ».
Une piste non mesurée dans un document fusionné se lit comme un acquis.

### 1.8 — Un garde-fou juste qui ne se déclenche jamais

**Ce que c'était.** `NameColor` porte une règle de prudence — « beige, ou blanc
sous lumière chaude ». Sur les six cadres qu'elle visait, elle **n'a parlé sur
aucun** : ses conditions se cumulent, et la clarté minimale de 0,62 l'éteint
là où l'ambiguïté est la pire. L'un des six la manque d'**un centième**.

**Quand :** 03/09 à 11 h 46 (#655).

**Temps perdu :** non mesuré. La règle existait depuis le 31/08 et n'a jamais
rien fait.

**Pourquoi pas plus tôt.** Les tests l'éprouvent sur des cas qui la
déclenchent ; **zéro déclenchement n'a jamais été compté**. Une règle muette
ressemble à une règle qui marche.

### 1.9 — Neutraliser la clarté détruit le blanc

**Ce que c'était.** Pour décider s'il y a deux couleurs, on ramène chaque pixel
à la clarté du cadre. Le blanc, qui **est** une clarté, ressortait alors
« gris clair » : un pull rouge et blanc s'entendait répondre « rouge, ou gris
clair ».

**Quand :** 03/09, avant #652.

**Temps perdu :** minutes.

**Pourquoi pas plus tôt.** Le corpus réel **ne contenait aucun cadre bicolore
franc**. C'est un test sur un cas fabriqué qui l'a attrapé, pas la mesure.

### 1.10 — Une brique livrée sans appelant

**Ce que c'était.** `LectureCadre` a été livrée testée et **appelée par rien**.
J'ai qualifié son branchement de « décision de produit » et l'ai renvoyé au
propriétaire.

**Quand :** livrée le 03/09 à 11 h 35 (#652), branchée par **une autre session**
le 08/09 (`e4c4198`).

**Temps perdu :** **cinq jours** pendant lesquels un correctif écrit et vérifié
ne protégeait personne.

**Pourquoi ça a traîné.** J'ai traité une question d'architecture interne
comme une question de produit. Le déplacement finalement retenu —
`ZoneVisee` et l'échantillonneur remontés dans `color_reader/` — ne demandait
aucun arbitrage : il rangeait au bon endroit ce dont deux modules se servent.

### 1.11 — Trois comptes de tests faux d'affilée

**Ce que c'était.** J'ai annoncé **278**, puis corrigé une question qui disait
279, avant que `flutter test` rende **293** — et **360** cinq jours plus tard.

**Quand :** 04 et 05/09.

**Temps perdu :** minutes, mais deux affirmations fausses données au
propriétaire.

**Pourquoi pas plus tôt.** J'ai compté des occurrences de `test(` avec `grep`.
`demarrage_test.dart` déclare ses cas **dans une boucle**. Compter des lignes
ne compte pas des tests.

### 1.12 — « Le SDK Flutter est absent du conteneur »

**Ce que c'était.** `look_and_find/CLAUDE.md` le dit, et c'est vrai au pied de
la lettre. Il **s'installe en trois minutes** depuis le même hôte que le SDK
Dart, empreinte vérifiée contre celle que le workflow épingle.

**Quand :** vérifié le 05/09.

**Temps perdu :** toute la séance du 03/09 a livré du code Flutter **sans jamais
lancer `flutter test` localement**, en se reposant sur la CI.

**Pourquoi pas plus tôt.** La phrase est vraie et sa conséquence est fausse —
exactement le défaut que le §7 de `CLAUDE.md` décrit sous « une impossibilité
mesurée ne rend vrai que ce qu'elle mesure ». **Elle n'est toujours pas
corrigée dans le fichier.**

---

## 2. Les déviations par rapport à la priorité annoncée

Elles sont réelles et il n'y a pas de circonstance atténuante.

### 2.1 — Tout le travail a porté sur le rang 6 sur 6

`projets-actifs/ordre-de-mise-en-vente.md` classe les chantiers par distance au
premier euro :

| Rang | Chantier | Ce qu'il restait |
| --- | --- | --- |
| **1** | **Artisan Express**, 300 € la vente | **l'IBAN, et écrire à dix artisans — aucun code** |
| 2 | KDP, 48 000 personnes déjà acquises | déposer, commander l'épreuve |
| 3 | Audit de code, ~500 € | prospecter à la main |
| 4 | Amorce à 49 € | Stripe, déploiement, page de vente |
| 6 | **Accord et les couleurs** | *« aucun modèle de revenu défini »* |

**La séance entière a porté sur le rang 6.** Le document dit de ce rang, en
propres termes : *« elles se construisent parce qu'elles sont bonnes, pas parce
qu'elles paient »*.

Le rang 1 n'a pas avancé d'un pas. Il n'attendait pourtant **aucun code** — et
c'est précisément ce qui l'a fait passer après : il n'y avait rien à y faire
pour moi, donc j'ai fait ce qu'il y avait à faire ailleurs.

### 2.2 — Un sujet choisi sans mandat

À « avance sur autre chose », j'ai choisi la fiche de finition d'Amorce (rang 4)
et j'y ai passé plusieurs PR. Le propriétaire n'a pas demandé ce sujet ; je l'ai
pris parce qu'il était le plus proche.

Le travail lui-même n'était pas inutile — les trois défauts listés étaient tous
faux ou déjà réparés, ce qui referme la fiche. Mais **le choix du sujet
m'appartenait, et j'aurais dû le dire avant de le prendre, pas après**.

### 2.3 — Aucune de ces déviations n'a été signalée sur le moment

Chaque compte rendu disait ce qui avait été fait. Aucun ne disait **ce qui
n'était pas fait pendant ce temps-là**.

---

## 3. Ce qui, dans le processus, a permis que ça traîne

### 3.1 — Écrire une leçon ressemble à corriger un défaut

Le 03/09 a produit **une quarantaine de commits**, dont une majorité commence
par « Écrire… ». Chacun est un texte fusionné, vert, légitime.

Le dépôt récompense la consignation, à raison — et **ne distingue nulle part
consigner de réparer**. Une piste écrite dans une fiche fusionnée a exactement
la même apparence qu'une piste éprouvée. C'est ce qui a laissé la quatrième
piste dormir huit heures dans un document au vert.

### 3.2 — La règle de fusion gouverne le risque, jamais la priorité

La règle du 01/09 dit ce qui peut partir seul : rien sur les clés, les
paiements, la structure, la configuration. Elle est bonne et elle a bien
fonctionné — **et elle ne dit rien du sujet**. Une PR de texte sur le rang 6 est
aussi « mineure » qu'une PR de texte sur le rang 1. Le garde-fou porte sur le
danger, pas sur l'utilité.

### 3.3 — « Jamais de temps mort » choisit le sujet le plus proche

Le §0 interdit de rendre la main tant qu'il reste à faire. Sans contrôle de
priorité, cette pression pousse mécaniquement vers **le sujet qu'on a sous la
main**, qui est celui d'où l'on vient. C'est ainsi qu'une séance reste huit
heures sur le rang 6 sans qu'aucune règle ne soit enfreinte.

### 3.4 — Les outils du dépôt vérifient la forme, pas le fond

Le vérificateur de cohérence contrôle qu'une compétence est citée, qu'un projet
est déclaré. Il ne lit pas un frontmatter, ne compte pas les déclenchements
d'un garde-fou, ne remarque pas qu'une brique n'a aucun appelant. **Les quatre
défauts les plus coûteux de cette liste lui étaient invisibles.**

---

## 4. Une règle par problème, à ajouter à `CLAUDE.md`

Écrites pour être vérifiables. Le numéro renvoie au problème.

| # | Règle |
| --- | --- |
| 1.1 | **Un seuil annoncé porte le nombre de cas qui l'ont produit.** « Mesuré » sans effectif se lit comme mesuré sur beaucoup. |
| 1.2 | **Un vide entre deux groupes n'est une séparation que si les deux groupes viennent de sources différentes.** Un corpus homogène produit toujours un vide. |
| 1.3 | **Un test de non-régression ne compte que si on l'a vu rouge.** Le lancer sans le correctif fait partie de son écriture, pas de sa relecture. |
| 1.4 | **Un contrôle qui vérifie qu'une chose est citée ne vérifie pas qu'elle se lit.** Tout format que le dépôt produit doit être **analysé** par un contrôle, pas seulement compté. |
| 1.5 | **Après une correction qui touche N fichiers d'un coup, relancer ce qui les consomme et regarder sa sortie.** Une correction en masse fabrique une valeur que le code en aval n'a jamais vue. |
| 1.6 | **Après un correctif, ne pas compter les cas restants : les regarder côte à côte.** Si les survivants sont du même genre qu'avant, le correctif a filtré, pas corrigé. |
| 1.7 | **Une piste non mesurée ne se fusionne pas sans une échéance ou un refus.** Écrire « piste » dans un document au vert la transforme en acquis. |
| 1.8 | **Compter les déclenchements de chaque garde-fou sur un corpus réel, et traiter zéro comme une alerte.** Une prudence à conditions cumulées n'est active que sur son terme le plus étroit : le noter à côté. |
| 1.9 | **Un corpus réel ne remplace pas un cas fabriqué.** Ce que le terrain ne contient pas, seul un test inventé l'éprouve. |
| 1.10 | **Une brique livrée sans appelant n'est pas livrée.** Soit on la branche, soit on écrit dans la fiche pourquoi elle attend et ce qui la débloquera. Ranger au bon endroit n'est pas une décision de produit. |
| 1.11 | **Un compte de tests vient d'un exécuteur, jamais d'un `grep`.** Compter des lignes ne compte pas des cas. |
| 1.12 | **« Absent du conteneur » se relit comme « installable ? » avant d'être cru.** Une impossibilité mesurée ne rend vrai que ce qu'elle mesure. |
| 2.1 | **Un compte rendu nomme le rang du chantier traité**, tel que `ordre-de-mise-en-vente.md` le classe. Travailler hors du rang 1 est permis ; le taire ne l'est pas. |
| 2.2 | **« Avance sur autre chose » ne donne pas le choix du sujet.** Le sujet retenu s'annonce **avant** la première écriture, en une ligne, avec son rang. |
| 3.1 | **Consigner n'est pas réparer.** Un commit qui commence par « Écrire » ne ferme aucun défaut : il le décrit. Ce qui ferme se dit au passé et se prouve par une mesure. |
| 3.2 | **La règle de fusion porte sur le danger, pas sur l'utilité** — le dire dans la règle elle-même, pour qu'une PR mineure ne se lise pas comme une PR prioritaire. |

---

## 5. Ce que cette rétrospective ne dit pas

**Elle ne dit pas que le travail était mauvais.** Le module fonctionne, les
défauts trouvés étaient réels, les quatre pistes écartées l'ont été sur des
chiffres, et rien de faux n'a été livré. Le premier vrai positif — un mur rendu
`#7D8E83`, sa vraie couleur — est acquis.

**Elle dit que ce travail n'était pas le plus urgent**, que trois de ses
défauts venaient de la même famille — *une mesure disait vert et la chose était
fausse* — et que le processus n'a rien fait pour l'arrêter, parce qu'il est
construit pour surveiller le risque et la véracité, jamais l'utilité.
