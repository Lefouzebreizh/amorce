# Bilan — pourquoi tester le bot conversationnel a pris deux sessions et cinq allers-retours

Écrit le 10/09/2026, à la demande explicite du propriétaire, après le correctif
de la barre de recherche (PR #847, fusionnée) et l'implémentation du « une
seule barre, un seul bot » (en cours de vérification à l'écriture de ce
fichier — **non confirmée en conditions réelles**, voir tout en bas).

Méthode : chaque horodatage ci-dessous vient d'une source vérifiable — les
journaux Supabase (`function_logs`), les métadonnées Vercel, les horodatages
GitHub des PR, ou l'horloge visible sur les captures d'écran du téléphone
(heure française, UTC+2). Quand la précision manque, c'est écrit « estimé »,
pas donné comme mesuré.

---

## 1. La fonction serveur n'avait jamais reçu le nouveau code (session du 09/09, avant celle-ci)

**Ce qui s'est passé** : la PR #844 (09/09/2026, 21:44 UTC) a réécrit
`supabase/functions/assistant-coffre/index.ts` pour lui ajouter le champ
`actions` (classer/supprimer). Elle a été fusionnée sur `main`, Vercel a
redéployé le front — mais personne n'a redéployé la fonction Supabase
elle-même. Elle est restée en version 3 (déployée le 06/09/2026 à 18:19 UTC)
pendant que le dépôt annonçait la fonctionnalité comme livrée. Écart : **trois
jours**. Corrigé en fin de session précédente par un redéploiement manuel
(version 5, 09/09/2026 22:00 UTC) — vérifié dans cette session-ci via
`get_edge_function`, contenu comparé caractère pour caractère à `main`.

**Coût** : au moins une session entière de travail (PR #839, #842, #844,
#845) livrée avec l'annonce implicite que le bot savait agir, alors que le
serveur qui répondait réellement aux questions n'avait jamais vu ce code.

**Pourquoi non détecté plus tôt** : rien dans le dépôt ne signale qu'un
fichier sous `supabase/functions/` a changé sans être redéployé. Le front
Next.js se redéploie automatiquement à chaque fusion (Vercel + Git), ce qui
crée une fausse impression de symétrie : « la PR est fusionnée, c'est en
ligne ». Ce n'est vrai que pour une moitié du dépôt.

**Déviation par rapport à la priorité annoncée** : aucune identifiée dans
cette étape — c'est la découverte qui a *motivé* la priorité donnée au début
de cette session-ci (« ta première tâche n'est pas de coder, c'est de me
guider pour tester »).

**Ce qui, dans le processus, a permis que ça traîne** : aucune vérification
automatique ni aucun rappel n'existe pour ce cas précis. La vérification
« build vert obligatoire avant toute poussée » (CLAUDE.md §10) ne couvre que
le code, jamais l'état d'un service externe qu'aucune poussée ne touche.

**Règle proposée pour CLAUDE.md** (section 4, sous `licence-serveur/` ou une
nouvelle entrée pour `le-coffre/`) :
> Après avoir fusionné une PR qui modifie un fichier sous
> `supabase/functions/**`, vérifier explicitement — via `get_edge_function`,
> jamais en se fiant à la fusion GitHub — que la version déployée porte bien
> le contenu fusionné. Une fusion sur `main` ne déploie **jamais** une
> fonction serveur Supabase, contrairement au front sur Vercel : ce sont deux
> pipelines indépendants, et un seul des deux se déclenche tout seul.

---

## 2. Première confusion : la commande tapée dans le mauvais champ

**Quand** : ~22:15–22:16 UTC (0:15–0:16 sur le téléphone), captures à l'appui.

**Ce qui s'est passé** : ma première consigne de test ne précisait pas assez
fort la différence entre la barre « Pose une question » du haut (moteur local
sans IA) et le panneau « Demander au coffre » (le vrai chat). Le propriétaire
a tapé sa première commande dans la barre du haut.

**Coût estimé** : un aller-retour complet (mon message de consigne, ses
captures, ma clarification) — de l'ordre de deux à trois minutes de session,
plus le temps de sa manipulation sur le téléphone, non mesuré.

**Pourquoi non détecté plus tôt** : je n'avais pas relu le code de la page
avant de donner la première consigne — je décrivais l'interface de mémoire
(à partir du résumé de la session précédente), pas depuis ce qu'elle affiche
réellement.

**Déviation par rapport à la priorité annoncée** : non — la consigne portait
bien sur le test, comme demandé ; elle était seulement imprécise.

**Ce qui, dans le processus, a permis que ça traîne** : rien dans l'interface
ne distingue visuellement les deux champs à un coup d'œil pressé sur un
écran de téléphone — même style, même position générale.

**Règle proposée pour CLAUDE.md** (section « Anti-blocage » ou une note
propre à ce dépôt) :
> Avant de guider quelqu'un dans une interface qu'on n'a pas soi-même sous
> les yeux, relire le code de l'écran concerné plutôt que de décrire son
> comportement de mémoire — même quand un résumé de session récent semble
> suffire. Un écran se lit sur le fichier, pas sur le souvenir qu'on en a.

---

## 3. Deuxième confusion : tester un cas que le bot est *censé* refuser

**Quand** : 22:19:19–22:21:33 UTC (0:19–0:21 sur le téléphone) — confirmé par
les journaux `function_logs` de `assistant-coffre` (trois cycles
boot/shutdown, aux trois secondes près des trois messages envoyés).

**Ce qui s'est passé** : une fois dans le bon panneau, le propriétaire a
demandé un rangement global (« range tous mes papiers... trie tout le
reste »), puis insisté avec « Fais le ». Le prompt système de la fonction
dit noir sur blanc que face à une demande globale, le bot doit **refuser** de
proposer des actions précises et renvoyer vers le bouton « Trier
automatiquement ». C'est exactement ce qu'il a fait, deux fois. Le
propriétaire en a conclu — raisonnablement, vu ce qu'il voyait — que rien
n'était exécutable, alors que ce cas précis n'était pas censé exécuter quoi
que ce soit par action individuelle.

**Coût estimé** : un tour de test entier « pour rien » du point de vue du
diagnostic (même si l'échange a confirmé que le prompt v5 tournait bien), plus
le temps que j'ai passé ensuite à relire le prompt système pour comprendre
que ce comportement était voulu — de l'ordre de cinq à dix minutes de
session.

**Pourquoi non détecté plus tôt** : ma consigne de test précédente ne
précisait pas qu'une commande devait désigner **un document nommé** pour
avoir une chance de déclencher une action — je ne l'ai découvert qu'en
relisant le prompt système après coup, pas avant de proposer le test.

**Déviation par rapport à la priorité annoncée** : non directement, mais
révèle que je n'avais pas anticipé les cas d'usage possibles avant de lancer
le test — j'ai découvert les règles du bot par ricochet plutôt que de les
lire d'abord.

**Ce qui, dans le processus, a permis que ça traîne** : aucun résumé ni
aucune documentation ne disait, avant cette session, que le bot avait des
règles de routage différentes selon que la demande vise un document précis
ou un lot indéterminé — cette distinction vivait uniquement dans le prompt
système, jamais formulée ailleurs.

**Règle proposée pour CLAUDE.md** :
> Avant de proposer un scénario de test pour une fonctionnalité pilotée par
> un prompt IA, lire le prompt système en entier — pas seulement le code qui
> l'entoure. Un prompt contient des règles de routage et de refus qui ne se
> devinent pas depuis l'interface, et un test qui tombe sur un cas de refus
> volontaire se lit comme un échec alors que c'est un succès.

---

## 4. Fausse piste : le retard d'ingestion des journaux

**Quand** : ~22:16–22:30 UTC, pendant l'investigation qui a suivi le point 3.

**Ce qui s'est passé** : pour vérifier ce que le serveur avait réellement
renvoyé, j'ai interrogé `function_edge_logs` (les requêtes HTTP). Cette
source-là était en retard d'ingestion — plus aucune entrée n'y apparaissait
depuis 21:53 UTC, y compris pour `classer-document` qui avait pourtant
tourné juste avant. `function_logs` (cycle de vie de l'isolat, boot/shutdown),
lui, était à jour. J'ai fini par recouper les deux sources avant de conclure
correctement que c'était un retard d'ingestion et non un vrai silence de la
fonction.

**Coût estimé** : plusieurs appels de requête de journal (recherche du bon
nom de table, plusieurs tentatives avant de trouver `function_edge_logs` vs
`function_logs`) — dix à quinze minutes de session, sans bénéfice direct pour
le propriétaire pendant ce temps.

**Pourquoi non détecté plus tôt** : rien ne signale qu'une source de journal
peut traîner indépendamment d'une autre sur le même projet — je l'ai découvert
en comparant deux sources qui auraient dû converger et ne convergeaient pas.

**Déviation par rapport à la priorité annoncée** : non — ça reste dans le
cadre du diagnostic demandé, mais c'est un temps que le propriétaire n'a pas
vu passer, sans résultat à lui montrer pendant ce temps-là.

**Ce qui, dans le processus, a permis que ça traîne** : aucune règle du dépôt
ne documente que les sources de journaux Supabase peuvent avoir des retards
d'ingestion différents les unes des autres.

**Règle proposée pour CLAUDE.md** (section 7, à côté des autres pièges
d'observabilité) :
> Sur Supabase, les sources de journaux (`function_edge_logs`,
> `function_logs`, `postgres_logs`…) peuvent avoir des retards d'ingestion
> indépendants les uns des autres. Une source vide ne prouve rien tant
> qu'une autre source, sur la même fenêtre de temps, n'est pas elle aussi
> vérifiée à jour — recouper avant de conclure à un silence réel.

---

## 5. Bug réel n°1 : le bouton d'escalade invisible dès qu'un document est trouvé

**Quand découvert** : ~07:48–07:50 UTC le 10/09 (9:48–9:50 sur le téléphone),
corrigé et fusionné le même jour (PR #847, `ae5cb7b`).

**Ce qui s'est passé** : `le-coffre/src/app/coffre/page.tsx` ne montrait le
bouton « Demander à l'assistant » que lorsque la recherche locale ne trouvait
**aucun** document (`nomsTrouves.length === 0`). Une commande en langage
naturel cite presque toujours le nom exact d'un document réel — la recherche
locale « réussissait » donc systématiquement, et le bouton n'apparaissait
jamais, précisément pour les phrases qui en avaient le plus besoin.

**Coût** : deux tours de test consécutifs (les points 2 et celui-ci) où le
propriétaire tapait une commande valide et se retrouvait renvoyé vers une
fiche de document au lieu d'un bot — avec, à chaque fois, la conclusion
« ça ne marche pas », compréhensible mais prématurée.

**Pourquoi non détecté plus tôt** : cette condition existait depuis la
conception initiale de la barre de recherche (avant cette session), et
n'avait jamais été éprouvée avec une vraie commande contenant le nom d'un
document réel — seulement avec des recherches « sans rapport », le cas que
les tests unitaires couvrent.

**Déviation par rapport à la priorité annoncée** : oui, assumée et annoncée
sur le moment — j'ai écrit et fusionné du code (PR #847) avant d'avoir fini
de guider le test, alors que la consigne de départ disait « ta première
tâche n'est pas de coder ». Je l'ai fait en parallèle du test plutôt qu'à sa
place, et je l'ai dit explicitement avant d'agir, mais ça reste un écart par
rapport à l'ordre annoncé.

**Ce qui, dans le processus, a permis que ça traîne** : aucun test, unitaire
ou manuel, ne rejouait le scénario « une commande qui cite le nom exact d'un
document existant » — seul un vrai humain qui tape une vraie phrase l'a fait
apparaître.

**Règle proposée pour CLAUDE.md** :
> Une fonctionnalité de type « recherche qui peut aussi être une commande »
> doit être éprouvée avec des phrases qui **citent le nom exact d'un élément
> réel** — c'est le cas le plus probable en usage réel, et c'est justement
> celui que des tests écrits par l'auteur du code oublient de couvrir.

---

## 6. Bug réel n°2 : le champ de recherche n'écoutait aucun geste d'envoi

**Quand découvert** : ~07:50–07:57 UTC le 10/09 (9:50 sur le téléphone) —
**correctif écrit et vérifié (`tsc`, `eslint`, 113 tests) dans cette session,
mais pas encore poussé ni confirmé en conditions réelles à l'écriture de ce
paragraphe.**

**Ce qui s'est passé** : le champ de recherche était un `<input
type="search">` sans `onKeyDown` ni `onSubmit` — aucun gestionnaire d'envoi.
Sur un clavier Android, l'icône « loupe » en bas à droite est le bouton natif
d'envoi de ce type de champ. Le propriétaire l'a très probablement pressée à
chaque tentative, sans qu'aucun code n'écoute cet événement — silence total,
aucune erreur, aucun signe.

**Coût** : au moins deux tours de test supplémentaires (les points 5 et
celui-ci se chevauchent dans le temps, l'un cachant l'autre) — impossible de
séparer proprement leur coût respectif, ce qui vaut d'être noté comme limite
de ce bilan plutôt que d'inventer un chiffre.

**Pourquoi non détecté plus tôt** : jamais testé avec un vrai clavier mobile
en conditions réelles avant cette session — les 113 tests unitaires du
projet ne simulent aucune interaction clavier ou `submit` sur le DOM, ils
testent la logique pure (`interpreterQuestion`, le chiffrement, les .ics…),
jamais le geste physique qui déclenche cette logique.

**Déviation par rapport à la priorité annoncée** : non — ce correctif a été
annoncé par un menu explicite (§0 bis du dépôt) avant d'être écrit, et le
propriétaire a répondu « go » avant que j'y touche.

**Ce qui, dans le processus, a permis que ça traîne** : aucune vérification
du dépôt ne couvre l'interaction clavier réelle — ni les tests unitaires
(logique pure), ni `npm run build` (compilation), ni une revue de code
n'auraient signalé ce manque, parce qu'un `<input>` sans gestionnaire de
soumission ne casse rien : il reste juste silencieux.

**Règle proposée pour CLAUDE.md** :
> Tout champ de saisie destiné à envoyer une commande (recherche, question,
> chat) doit être testé avec le geste d'envoi natif du clavier mobile —
> Entrée ou la touche dédiée (loupe/« Aller ») — pas seulement à la frappe.
> Un `<input>` sans `<form onSubmit>` ni `onKeyDown` sur Entrée est
> silencieux à l'échec : aucune erreur ne le signale, seul un humain qui
> presse le bouton et ne voit rien se passer le découvre.

---

## 7. La décision « un seul bot » n'était écrite nulle part

**Quand** : formulée explicitement par le propriétaire après les points 5 et
6, une fois que la confusion s'est répétée une troisième fois.

**Ce qui s'est passé** : le code (et donc mon raisonnement, construit dessus)
partait d'une architecture à deux étages assumée : recherche locale gratuite
et instantanée, escalade explicite et payante vers l'IA. C'était une décision
de conception défendable (évite de facturer une faute de frappe), mais
**jamais confrontée** à l'intention réelle du propriétaire, qui voulait une
seule barre agissant comme un seul bot. Ni le code, ni CLAUDE.md, ni aucun
document du dépôt ne tranchaient la question avant qu'il ne le dise en toutes
lettres dans cette session.

**Coût** : la confusion des points 2, 3, 5 et 6 aurait pu se limiter à un
seul aller-retour clair si cette intention avait été écrite quelque part dès
le départ.

**Pourquoi non détecté plus tôt** : parce que personne ne l'avait demandé
avant, et que le code, une fois écrit avec une justification interne
cohérente (« jamais automatique, pour ne pas facturer une simple faute de
frappe »), a l'air d'une décision de produit alors que ce n'en était pas une
— juste un choix technique qui n'avait jamais été soumis à validation.

**Déviation par rapport à la priorité annoncée** : non.

**Ce qui, dans le processus, a permis que ça traîne** : ce dépôt distingue
bien, en théorie (§0 bis), ce qui relève d'une décision de produit à nommer
avant de trancher — mais rien n'avait déclenché cette alarme ici, parce que
la décision avait déjà été prise, silencieusement, au moment d'écrire le
code, des sessions plus tôt.

**Règle proposée pour CLAUDE.md** (section 0 bis, en complément de la règle
« un doublon arrête le geste ») :
> Un choix d'architecture qui change radicalement le comportement perçu par
> l'utilisateur (ici : deux systèmes séparés vs un seul bot unique) est une
> décision de produit, même quand il naît d'une bonne raison technique
> (ici : ne pas facturer une faute de frappe). Il se nomme et se fait
> valider avant d'être codé, pas seulement quand il finit par gêner
> quelqu'un des mois plus tard.

---

## Ce qui reste ouvert à l'écriture de ce fichier

- **Le correctif du point 6 (formulaire d'envoi) n'est pas encore poussé ni
  vérifié en conditions réelles.** `tsc`, `eslint` et les 113 tests
  unitaires sont verts, mais aucun humain ne l'a encore essayé sur un
  téléphone. Ne pas le compter comme « résolu » avant cette preuve-là.
- **La pagination de la vue « Tout »**, signalée comme chantier ouvert dans
  le résumé de la session précédente, n'a pas été commencée dans celle-ci —
  toute l'énergie est partie dans le diagnostic ci-dessus.
- **Aucun chiffrage précis en minutes** n'a été possible pour la plupart des
  points : ce bilan donne des ordres de grandeur à partir d'horodatages
  réels, jamais une mesure directe du temps perdu par le propriétaire lui-même
  sur son téléphone.

## Règles proposées, groupées pour relecture avant ajout à CLAUDE.md

1. Vérifier explicitement qu'une fonction Supabase modifiée a été redéployée
   — une fusion GitHub ne le fait jamais toute seule (point 1).
2. Relire le code d'un écran avant de guider quelqu'un dedans, plutôt que de
   le décrire de mémoire (point 2).
3. Lire un prompt système en entier avant de proposer un scénario de test
   pour la fonctionnalité qu'il pilote (point 3).
4. Recouper au moins deux sources de journaux Supabase avant de conclure à
   un silence réel — leurs retards d'ingestion sont indépendants (point 4).
5. Éprouver toute fonctionnalité « recherche qui peut être une commande »
   avec des phrases citant le nom exact d'un élément réel (point 5).
6. Tester tout champ de saisie destiné à une commande avec le geste d'envoi
   natif du clavier mobile, pas seulement à la frappe (point 6).
7. Nommer et faire valider tout choix d'architecture qui change le
   comportement perçu par l'utilisateur, même né d'une bonne raison
   technique (point 7).
