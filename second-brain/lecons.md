# Leçons

Une entrée par incident réel, avec ce qu'il a coûté. Ce qui n'a coûté à
personne ne s'écrit pas ici : ce fichier vaut par sa densité, pas par sa
longueur.

---

## Une mesure agrégée dit qu'un son est fort, jamais qu'il est bon

*Coût : une nuit, six montages livrés et rejetés.*

Un montage mesuré à −14 LUFS — la cible exacte de TikTok, donc « conforme » —
était quasi muet sur un téléphone. Toute son énergie vivait **sous 400 Hz**, la
limite basse d'un haut-parleur de téléphone. Chaque version repartait avec des
chiffres rassurants et revenait rejetée à l'écoute.

Une moyenne masque un trou, un déséquilibre, une saturation, un silence. Une
image les montre tous en même temps — et une image, ça se lit. D'où
`/voir-le-son`.

**Portée générale :** dès qu'un chiffre dit « conforme » et qu'un humain dit
« mauvais », c'est le chiffre qui a tort sur ce qu'il mesure. Chercher la
représentation qui rend le défaut visible plutôt qu'un second chiffre.

---

## Ce qui compte dans un lot se voit par comparaison, pas isolément

*Coût : un plan écarté qui portait la seule voix utilisable.*

Sur un lot de cinquante-cinq fichiers, trois choses ont été manquées :

- un plan écarté pour une raison d'image était, **au bit près**, le seul à
  porter les vraies répliques — les deux noms n'avaient rien en commun, seule
  l'empreinte le disait ;
- le montage a tourné des heures en 768 × 1344 alors qu'un rendu 1456 × 2544 du
  même plan dormait dans le même dossier ;
- une voix off générée la veille, intacte, attendait au milieu du lot pendant
  qu'on en refabriquait une.

Aucune n'était une erreur de jugement. Toutes étaient des erreurs de **regard** :
personne n'avait tout regardé en même temps. D'où `/trier-les-rushes`.

**Portée générale :** avant de choisir dans un lot, l'inventorier entièrement.
Sur quatre prises du même prompt, l'écart entre la meilleure et la pire atteint
couramment 20 dB — invisible à l'oreille, décisif à l'arrivée.

---

## Une cible de plateforme n'est pas ce que les gens livrent

*Coût : six heures, et huit versions rejetées.*

La cible TikTok est −14 LUFS. Elle est écrite dans la compétence, elle est
juste, et je l'ai visée religieusement toute une nuit pendant que l'auteur
répétait que le son n'allait pas.

Son propre montage du même film, fait dans une autre application, mesurait
**−7,3 LUFS** — deux fois plus fort. Sur la bande qu'un téléphone restitue,
l'écart était de 6,3 dB. Ma version sortait deux fois moins présente dans le
fil, et aucun contrôle ne le signalait puisqu'elle était *conforme*.

**Ce qui a débloqué : mesurer une référence qu'il aime plutôt que suivre une
spécification.** Sept chiffres comparés côte à côte ont donné en une minute ce
que six heures d'itération n'avaient pas trouvé — et deux d'entre eux, le
niveau des noirs (1,6 contre 22,1) et la sonie, expliquaient tout.

**Portée générale :** une norme dit ce qui est admissible, jamais ce qui est
attendu. Quand quelqu'un dit « c'est nul » et que tout est conforme, lui
demander un exemple qu'il trouve réussi, et le mesurer. Un écart chiffré entre
deux fichiers vaut mieux que dix itérations au jugé.

## Un compresseur à attaque rapide mange exactement ce qui fait l'impact

*Coût : trois rendus.*

Un pas de titan à −29 dB restait inaudible malgré un mixage conforme. Le
compresseur du mastering, réglé à 8 ms d'attaque, écrasait la transitoire —
c'est-à-dire la seule partie qu'on perçoit comme un choc.

Supprimé, remplacé par un plateau d'aigus : +4,6 dB sur le rugissement, +3,2 sur
le pas, sans toucher au niveau global.

**Portée générale :** ce qui donne son poids à un son bref est son attaque. Tout
traitement qui la rabote le vide de son effet, quel que soit le niveau affiché.

---

## Livrer vite ne vaut que si l'on a regardé

*Coût : la nuit entière.*

Six versions rendues à la chaîne, chacune vérifiée par une mesure, aucune
regardée. Le défaut se voyait en une seconde sur une image que personne n'avait
tirée.

**Portée générale :** « 80 % d'action » sans regard devient « 80 % de reprises ».
Le contrôle avant livraison ne ralentit pas — il remplace les cinq itérations
suivantes.

---

## Une capacité qui manque se fabrique, elle ne se contourne pas

*Gain : deux compétences en un soir.*

`/voir-le-son` est née parce qu'un son ne pouvait pas s'écouter.
`/trier-les-rushes` parce qu'un lot de cinquante fichiers ne pouvait pas se lire
un par un. Chacune a trouvé, dès son premier usage, un défaut réel que personne
n'avait vu.

**Portée générale :** l'outil manquant coûte une heure ; le contournement répété
coûte toutes les heures suivantes.

---

## Un système qui publie tout seul doit regarder ce qu'il publie

*Coût évité : onze sites cassés pendant une semaine.*

L'auto-pilote du réseau d'annuaires valide ses données avant et après écriture,
puis pousse sur `main`. Sa poussée ne redéclenche aucun workflow — c'est voulu,
sans quoi elle bouclerait. Personne ne relit le diff. Donc rien ne regardait la
page.

Or la validation juge la **structure** : un nom d'outil de soixante-dix
caractères passe les 0 erreur de `valider.js` et déborde la grille sur un écran
de 390 px. Fabriqué exprès pour vérifier, le défaut est bien sorti — rouge au
parcours en navigateur, vert à la validation des données.

**Portée générale :** la question n'est pas « ce qui part est-il valide » mais
« qui regarde ce qui part ». Un contrôle qu'on juge trop lent pour une pull
request — parce qu'on le relancerait sans le lire — devient exactement le bon
contrôle là où personne ne relit rien. Et il se pose **avant** la publication,
pas après : ne rien publier est un incident visible et réversible.

---

## Une durée mesurée en session n'est pas la durée en CI

*Coût : un chiffre faux d'un facteur vingt, écrit dans trois fichiers.*

Le parcours en navigateur du réseau d'annuaires : **315 s** mesurées ici, **16 s**
sur un runner GitHub. J'avais écrit les 315 s dans un commentaire de workflow,
dans un message de commit et dans une compétence — en argument de coût, c'est-à-
dire précisément là où le chiffre sert à décider.

La cause n'est pas la puissance de la machine. Le mandataire de cette session
bloque le CDN des polices : chaque `waitUntil: 'networkidle'` attend l'expiration
de requêtes qui n'aboutiront jamais. La lenteur mesurait le mandataire, pas le
parcours.

**Portée générale :** dès qu'une mesure porte sur du temps et que le code touche
au réseau, elle décrit cet environnement-ci, pas celui qui compte. Ou bien on la
refait là où le code tournera, ou bien on l'écrit avec la condition qui la rend
vraie. Un chiffre nu, dans un argument de coût, se retourne contre la décision
qu'il a servi à prendre.

---

## Un contrôle dont les deux côtés viennent de la même source ne peut pas échouer

*Trouvé une fois par hasard, cherché ensuite exprès.*

`filtres <= cartes` : le nombre de fiches après recherche comparé au nombre
avant. La grille entière satisfait la condition, donc une recherche qui ne
filtre plus rien passait au vert — et le commentaire au-dessus annonçait
pourtant « strictement moins ». Le contrôle existait, s'affichait vert, et ne
pouvait rien attraper.

La lentille qui le trouve, et qu'il suffit de passer sur n'importe quel
parcours : **pour chaque assertion, quel défaut la rendrait rouge ?** Si la
réponse est « aucun », ou si les deux côtés de la comparaison sortent du même
endroit cassé, le contrôle est décoratif.

Passée sur les trois parcours d'Amorce, elle n'a rien rendu — et c'est un
résultat, pas un échec : `apresVignettes === avantVignettes` tiendrait dans le
cas zéro-contre-zéro, mais un `waitForFunction(>= 4)` en amont rend ce cas
impossible ; `score > 0` devient `NaN > 0`, donc faux, si l'étiquette disparaît.
Deux filets qu'on peut cesser de soupçonner.

**Portée générale :** un contrôle vert dit deux choses très différentes — « j'ai
regardé et c'est bon » ou « je n'ai rien regardé ». Rien ne les distingue dans
un rapport de tests, et seul un défaut fabriqué exprès les sépare.

---

## Un niveau conforme et une dynamique nulle s'entendent comme du silence

*Coût : une nuit entière, et huit versions rejetées pour « pas de son ».*

Un montage mesuré à −8,4 LUFS — plus fort que la référence de l'auteur, donc
au-dessus de tout soupçon — s'entendait comme s'il n'y avait rien. La mesure
qui le disait n'était pas la sonie mais la **plage de dynamique : LRA 2,1 LU**.
L'ouverture, les voix et le rugissement final sortaient au même niveau à un
décibel près. Sans écart, l'oreille cesse de distinguer et n'entend plus qu'une
bouillie constante ; le niveau moyen, lui, reste parfait.

La cause tenait à un lit sonore posé **en continu** sous tous les plans. Le
retirer, et ne le laisser revenir que par touches courtes, a rendu LRA 6,8.

Deuxième piège, et il s'est refermé aussitôt : en comblant un creux de sept
décibels dans le bloc de foule, LRA est retombé de 6,8 à 3,5. **On avait
rebouché le trou en supprimant la dynamique qui le rendait nécessaire.** Un
creux doit rester un creux ; il doit seulement cesser d'être un silence.

**Portée générale :** dès que quelqu'un dit « on n'entend rien » et que la sonie
est conforme, lire LRA avant tout le reste. En dessous de 3 LU il n'y a plus de
film, quel que soit le niveau. Et un limiteur ne rend pas plus fort : au-delà de
deux décibels de gain, il reprend en dynamique ce qu'il donne en niveau —
mesuré ici, +2 dB n'achetaient que 0,6 LUFS et coûtaient 0,8 LU.

---

## Transcrire les pistes règle en une minute ce que le calage ne règle jamais

*Coût : plusieurs sessions à recaler une voix qui n'aurait pas dû être là.*

« Il y a un mélange », « c'est mal synchronisé », « ce ne sont pas les bonnes
paroles » : trois remarques traitées comme des problèmes de calage, sans succès.

Transcrites côte à côte, la voix off générée et le son natif du plan disaient
**mot pour mot la même phrase** — « Warning! Sector 99 is collapsing. The cyber
hydra titan awakens ». Ce n'était pas un défaut de synchronisation, c'était un
doublon. Aucune quantité de recalage ne l'aurait résolu.

La même transcription a révélé qu'un plan mis à zéro « pour cause de double
voix » portait en réalité une réplique **différente**, jamais entendue, qui
manquait au film.

**Portée générale :** devant un défaut de son qui porte de la parole, comparer
les **textes** avant les formes d'onde. Une transcription coûte une minute et
tranche entre un problème de calage et un problème de contenu — deux choses
qu'aucune mesure de signal ne distingue.

---

## La capacité déclarée impossible l'était dans le mauvais cadrage

*Coût : trois sessions à répéter « synchronisation labiale impossible ».*

`torch` absent, `huggingface.co` et `api.sync.so` refusés : aucun modèle de
re-synchronisation labiale ne tourne ici. Le constat était exact, et la
conclusion fausse — parce que la question posée était « comment caler une voix
sur des lèvres » alors qu'elle aurait dû être « pourquoi cette voix n'est-elle
pas celle du plan ».

Les rushes générés **parlent déjà**, avec leur propre son. Un plan monté avec sa
piste native est synchrone par construction : il n'y a rien à recaler. La voix
off plaquée était la cause du problème, pas son remède.

**Portée générale :** avant de déclarer une capacité indisponible, vérifier
qu'on ne cherche pas à refabriquer une chose que le matériau contient déjà.
« L'outil manque » et « je m'y prends à l'envers » se ressemblent beaucoup vus
de l'intérieur.
## Une compétence ne se mesure pas contre un modèle nu, mais contre le dépôt

*Huit agents lancés exprès pour trancher, et le résultat est un résultat nul.*

Deux compétences fraîchement écrites — `api-tierce-verifiee` et
`dependance-indisponible` — mises à l'épreuve sur quatre tâches, chacune jouée
deux fois : une fois avec la compétence, une fois sans. Les compétences avaient
été retirées du dossier pour que les témoins ne les voient pas, et lues par
chemin explicite du côté « avec ».

Le critère central était vérifiable sans jugement : **les symboles empruntés au
SDK existent-ils dans le paquet publié ?** Le piège était réel — le SDK Deepgram
7.x est généré par Fern et n'a plus aucun des noms de la v3 (`DeepgramError`,
`PrerecordedOptions` : tous absents), donc un code écrit de mémoire plante à
l'import.

**Les deux côtés ont réussi.** Avec comme sans, les agents ont téléchargé le
paquet, relevé les vraies classes, découvert que clé invalide et quota
remontent la même `ApiError` nue, et que les pannes réseau traversent en
`httpx.RequestError` sans dériver d'`OSError`. Zéro symbole inventé de part et
d'autre.

Coût mesuré de la compétence, lui, bien réel : **+10 % de jetons, +23 % de
durée** en moyenne sur les quatre tâches.

L'explication tient en une phrase, et c'est elle qui vaut : **le témoin n'est
pas un modèle nu, c'est un modèle qui lit `CLAUDE.md`.** Une compétence qui ne
fait que redire la culture déjà écrite du dépôt ne peut pas se distinguer d'un
témoin qui l'a lue. Ce qu'elle mesure alors n'est pas « est-ce que ça aide »,
mais « est-ce que ça aide *en plus de ce qui est déjà là* » — et la réponse est
souvent non.

**Portée générale :** avant d'écrire une compétence, se demander ce qu'elle dit
que `CLAUDE.md` ne dit pas. Si la réponse tient en une phrase, cette phrase va
dans `CLAUDE.md`, pas dans un fichier de plus.

## Un instrument de mesure se vérifie avant son verdict

*Corollaire du précédent, trouvé en se prenant les pieds dedans.*

Le premier passage du correcteur automatique annonçait des écarts nets. Aucun
n'a survécu à l'inspection :

- « pas de mode de contrôle préalable » — le témoin en avait un, nommé
  `--verifier` ; l'expression régulière cherchait `--check` ;
- « pas éprouvé sans la dépendance » — le fichier s'appelait
  `verifier_erreurs.py` et portait treize provocations d'erreurs ;
- « symbole inexistant dans le SDK » — c'étaient les exceptions métier que
  l'agent **définit lui-même**, plus `httpx.RequestError` cherché dans le
  mauvais paquet, plus `ModuleNotFoundError`, oublié de la liste des primitives ;
- un dernier `X` fantôme venait d'une chaîne d'affichage, `"utiliser stripe.X"`.

Quatre familles de faux positifs, et le verdict initial était entièrement faux
— dans le sens flatteur pour l'hypothèse qu'on testait, ce qui est le pire des
sens.

**Portée générale :** un correcteur écrit par celui qui espère un résultat doit
être éprouvé sur un cas dont on connaît la réponse avant qu'on croie ce qu'il
dit. La question à lui poser est la même que pour un test : **quel défaut le
rendrait rouge ?** Ici, la bonne épreuve était de le passer sur une sortie
connue pour être correcte, et de vérifier qu'il ne trouve rien.

---

## Une suite verte en session ne dit rien de la CI

`pepites` et `kdp` sont tombés le même jour sur le même défaut, à six minutes
d'intervalle, sans que rien ne les relie : `ModuleNotFoundError` en intégration
continue, sur des suites vertes en session.

La cause est structurelle. Le hook de démarrage installe ce dont les projets ont
besoin pour **tourner** ; la CI installe `.github/requirements-tests.txt`, qui
est ce que les **tests** atteignent. Les deux listes ne sont pas la même, et
c'est voulu — l'une ferait passer la vérification de quinze secondes à plusieurs
minutes. Mais un projet neuf qui apporte une dépendance la déclare naturellement
dans son `requirements.txt` et dans le hook, jamais dans la troisième liste. Le
manque est alors invisible partout où l'on travaille, et visible seulement là où
personne ne regarde avant d'avoir poussé.

**Le geste qui l'attrape avant la CI**, et qui coûte trente secondes :

```sh
python3 -m venv /tmp/vierge
/tmp/vierge/bin/python -m pip install -r .github/requirements-tests.txt
/tmp/vierge/bin/python -m unittest discover -s <projet>/tests
```

Ce n'est pas une simulation de la CI, c'est la CI : même liste, même commande.
Lancé après coup ce jour-là, il a rendu les deux défauts d'un coup — dont un
qui tenait `main` au rouge et, avec lui, toutes les PR ouvertes.

**Portée générale, et c'est là qu'est la leçon :** une vérification ne vaut que
par l'environnement où elle tourne. Un poste de travail accumule ce que les
sessions précédentes y ont installé, et devient un menteur d'autant plus
convaincant qu'il est vert. Chaque fois qu'une machine propre exécutera le code,
il faut avoir essayé sur une machine propre — la question n'est jamais « est-ce
que ça passe ? » mais « ça passe *avec quoi installé* ? ».

---

## Ce qui donne sa taille à une créature est sa tenue, pas son attaque

*Coût : trois livraisons, et « on n'entend pas le dragon » répété deux fois.*

Un souffle de dragon mesuré à −15,5 dB sur la bande d'un téléphone — au niveau
du rugissement final, donc réputé bon — restait inaudible. Découpé seconde par
seconde, le même fichier disait autre chose : **attaque −12,9 dB, corps −21,6,
fin −30,3.** Les prises de bibliothèque font deux secondes et vident toute leur
énergie en sept dixièmes. Posé sous un plan de trois secondes, un tel son ne
s'entend pas comme une bête mais comme un coup suivi d'un trou.

Trois prises superposées et décalées sur un grondement harmonique tiennent
maintenant les trois secondes à moins de huit décibels d'écart.

**Portée générale :** une moyenne sur un bruitage entier cache sa forme. Devant
un son qui « ne s'entend pas » alors que son niveau est bon, le découper en
tranches avant toute autre chose — c'est la tenue qu'on mesure, pas le pic. Et
ce qui vaut pour une créature vaut pour une nappe, une ambiance, un moteur :
tout ce qui doit durer.

---

## Un plan magnifique qui casse la continuité coûte plus qu'il ne rapporte

*Coût : trois remontages, dont deux pour garder un plan qu'il fallait couper.*

Deux rushes portaient un druide au visage cyan, un troisième un druide au visage
magenta. Étalonnés, l'écart de chroma est tombé de neuf à trois points — et ils
restaient deux personnages. Le spectateur ne voyait pas un étalonnage
approximatif, il voyait quelqu'un d'autre arriver et couper la réplique en cours.

Le plan sacrifié était le plus spectaculaire du lot : la foudre planétaire. Le
garder a coûté deux allers-retours ; le couper a rendu au film sa continuité,
et accessoirement sa durée cible.

**Portée générale :** la continuité d'un personnage ne se rattrape pas à
l'étalonnage. Quand deux prises ne montrent pas le même visage, aucun réglage
de couleur ne les réconcilie — il faut en choisir une. Le critère n'est pas
« lequel est le plus beau » mais « lequel porte ce que le film doit dire » :
ici, celui dont la réplique était presque entière dans son propre rush.

---

## On ne rend pas un grave audible : on cherche la prise qui a déjà de l'aigu

*Coût : cinq rendus, et un « des bruits bizarres » qui disait vrai.*

Un grondement de créature synthétisé — pile d'harmoniques modulée en amplitude —
tenait parfaitement le niveau et sonnait faux. Le spectrogramme le montrait
d'un coup d'œil : **des bandes horizontales parallèles**, un peigne. À l'oreille,
un orgue, pas une gorge. Désaccorder les rangs de 1,4 % n'a rien changé.

L'issue évidente — retirer la synthèse, n'empiler que des enregistrements — a
supprimé le peigne et rendu la créature **inaudible sur téléphone** : les prises
graves d'une bibliothèque sont du grave *pur*. Et les saturer pour leur
fabriquer des harmoniques recrée exactement le même peigne, puisqu'un grondement
basse fréquence est lui-même presque harmonique. Les deux chemins mènent au même
mur, pour la même raison.

Ce qui a débloqué : mesurer les prises **une par une au-dessus de 400 Hz, sans
traitement**. Une seule du lot portait du vrai aigu — −15,6 dB nativement, quand
les « colossal mecha dragon » plafonnaient à −28. C'est elle, déclinée
(transposée vers le bas, vers le haut, ralentie), qui fait le son ; les prises
graves ne servent plus qu'au poids, filtrées sous 400 Hz.

Résultat : **−13,0 / −12,4 / −12,8 / −13,4 dB** sur trois secondes, contre onze
décibels d'affaissement par toutes les autres méthodes.

**Portée générale :** aucun traitement ne fabrique une bande de fréquences qui
n'est pas dans la source. Devant un son qui doit exister sur un petit
haut-parleur, la première question n'est pas « comment le remonter » mais
« laquelle de mes prises a déjà quelque chose là-haut ». Et un défaut décrit
comme « bizarre » plutôt que « faible » désigne presque toujours une régularité
que l'oreille entend comme artificielle — elle se voit sur un spectrogramme en
une seconde, et sur aucun chiffre.

---

## Combler un trou et écraser la dynamique sont le même geste mal dosé

*Coût : trois itérations, chacune corrigeant la précédente.*

Un trou réel — le son tombant à −50 dB sur la bande d'un téléphone entre deux
plans — a été comblé en remontant tout le bloc au niveau des voix. Le trou a
disparu et LRA est tombé de 4,9 à 2,4 : le bloc de foule sortait désormais
**plus fort que la réplique du druide**, ce qui est faux dramatiquement autant
que techniquement.

La correction ne s'est faite proprement qu'en écrivant la cible bloc par bloc
avant de toucher un seul réglage — ouverture basse, voix au-dessus de la foule,
créature au-dessus de tout — puis en calculant le gain de chaque piste par
`cible − mesure`, au lieu de tâtonner.

**Portée générale :** un mixage se règle par une table de cibles relatives
écrite d'avance, pas par retouches successives. Trois itérations au jugé
avaient produit trois défauts différents ; une table et une soustraction ont
donné le bon résultat du premier coup.
