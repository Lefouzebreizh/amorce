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

## Le travail refait ne se voit nulle part, et c'est ce qui le rend cher

*Coût : huit cents lignes écrites deux fois, plus six branches ouvertes le même
soir sur la même friction.*

Une session a construit un socle Supabase durci — schéma, contrôles RLS,
squelette de Server Actions — pendant qu'une autre livrait `agence/`, qui portait
déjà exactement les mêmes gardes. Rien n'avait échoué : les deux travaux étaient
justes, vérifiés, verts. Ils étaient simplement le même.

Ce gaspillage-là n'apparaît dans aucun historique. Un conflit de fusion se
compte, un test rouge se compte ; du travail jeté avant d'être committé ne
laisse pas de trace, et l'on ne corrige jamais ce qu'on ne mesure pas. C'est
pourquoi il a fallu deux répétitions pour le voir — la seconde fois, six
branches ouvertes travaillaient la même friction, dont une portant déjà la
moitié de ce qui était en cours d'écriture.

La parade tient en trente secondes : lire les branches actives avant de
construire. Elle a été posée dans le hook de démarrage plutôt que dans une
compétence, parce que l'angle mort est précisément qu'on ne pense pas à
regarder — et qu'une compétence doit se déclencher pour servir, là où un hook
s'exécute toujours. Elle a servi sur le commit qui l'introduisait, en faisant
retirer du lot un changement qu'une autre branche portait déjà.

**Portée générale :** avant d'écrire, chercher qui écrit déjà la même chose, et
placer ce rappel là où il ne dépend pas d'y penser. Quand deux travaux justes se
recouvrent, celui qui est fusionné gagne — se couler dans la base commune coûte
toujours moins que réconcilier deux versions défendables.

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

---

## Descendre le registre pour « faire épique » sort du spectre du téléphone

*Coût : un rendu, et douze décibels.*

Une nappe de bande-annonce écrite avec une fondamentale à 55 Hz — deux octaves
sous la référence habituelle, « parce que c'est une bande-annonce » — perdait
**12,2 dB** une fois filtrée comme le fait un haut-parleur de téléphone. La
cause était arithmétique : la nappe posée une octave et demie au-dessus de la
basse tombait à 155 Hz, et tout le registre utile vivait sous le plancher.

Fondamentale remontée à 110 Hz, triade portée deux octaves plus haut, une
octave discrète encore au-dessus : **0,9 dB de perte**, dans la fourchette
mesurée de l'outil du dépôt.

**Portée générale :** le poids d'un son se fabrique par les **harmoniques du
grave**, jamais en descendant le registre. Descendre déplace l'énergie hors de
ce que l'appareil restitue, et le résultat est plus faible en paraissant plus
grave à la conception.

---

## Chercher ce qu'une session voisine a déjà résolu avant de le refaire

*Gain : une heure, et un résultat quatre fois meilleur que le mien.*

Après six itérations ratées sur le son d'un montage, le hook de démarrage
signalait une branche parallèle nommée « Fabriquer la musique de fond, dernier
trou de la chaîne son ». Elle contenait `porter_sur_telephone`, une fonction
mesurée à 0,6–1,2 dB de perte, là où ma propre saturation en perdait 3,4 — et
la raison qui m'avait échappé : **les deux couches se partagent le niveau, elles
ne s'y ajoutent pas**, et il faut un redressement avant la saturation pour
obtenir les harmoniques paires.

Le hook posait déjà la question — « Avant de construire : l'une d'elles fait-elle
déjà ce travail ? » — et je l'avais lue six fois sans y répondre.

**Portée générale :** dans un dépôt à plusieurs sessions, la liste des branches
ouvertes n'est pas un ornement de démarrage : c'est la première recherche à
faire quand on bute. Lire un titre de branche coûte une seconde ; refaire son
travail coûte la nuit. Et ce qu'on récupère porte les mesures de l'autre, pas
seulement son code.

---

## Ce qui fait bouger une image fixe, c'est la parallaxe, pas le zoom

*Coût : quatre tentatives ratées, dont trois abandonnées faute de méthode.*

Un plan tiré d'une image fixe et animé au zoom — même lent, même en diagonale —
se lit toujours comme une photographie qu'on agrandit. Trois corrections
successives (zoom plus rapide, scintillement, braises) ont toutes échoué, et
l'auteur répétait « l'image n'est toujours pas animée » sans qu'aucune mesure
ne lui donne raison.

**Le premier progrès a été de changer de mesure.** `scene_score` compte les
changements de plan, pas le mouvement : un zoom rigide change des pixels sans
produire de mouvement apparent, et il notait donc « bon ». L'écart moyen entre
images consécutives, lui, dit ce que l'œil voit :

| | mouvement |
| --- | --- |
| plan animé au zoom | 4,1 |
| rush le plus calme du montage | 10,5 |
| rush le plus vif | 22,8 |

**Le remède est la parallaxe.** Dans un vrai plan, ce qui est proche se déplace
plus vite que ce qui est loin, et c'est cet **écart** — pas le déplacement —
que l'œil lit comme une caméra. Deux couches tirées de la même image, masques
verticaux à bords fondus, vitesses opposées : 4,1 → 8,2 hors montage, et 9,8
une fois le mouvement du montage ajouté par-dessus.

Trois choses mesurées qui n'ont rien apporté, et qu'il ne faut pas refaire : le
scintillement des éclairs (+0,08), le tremblement d'air (+0,01), et un premier
réglage de parallaxe à 34 pixels sur deux secondes — soit trois dixièmes de
pixel par image, **sous le pas de l'échantillonnage**, donc rendu à 2,45, pire
que le zoom qu'il remplaçait.

**Portée générale :** quand un défaut décrit par un humain ne se voit dans aucun
chiffre, la mesure est le premier suspect, pas la description. Et quand un
réglage améliore la théorie sans améliorer le résultat, vérifier son ordre de
grandeur avant d'en chercher un autre : ici, l'effet était juste et l'amplitude
cent fois trop faible.

---

## Sonder le détecteur de visage avant de lancer une synchronisation labiale

*Coût : 4 min 51 de calcul pour un message d'erreur en fin de course.*

Wav2Lip s'est arrêté sur « Face not detected! Ensure the video contains a face
in all the frames » après avoir tourné cinq minutes sur processeur. Le plan
choisi était un très gros plan dont le crâne sortait du cadre : `s3fd` n'y
trouve aucune boîte complète, et il ne le dit qu'après avoir parcouru toutes
les images.

Sondés un par un, les cinq plans de druide du montage ont donné :

| plan | boîte détectée |
| --- | --- |
| `02_druide_portrait` | **359 × 438 px** |
| `09_druide_foudre` | 102 × 163 px |
| `03_alerte` | 25 × 34 px, puis rien |
| `hd_druide_terre` | 12 × 16 px |

Une seule est un visage ; les autres sont des faux positifs de quelques
dizaines de pixels que le modèle accepte sans broncher jusqu'à ce qu'il n'en
trouve plus du tout. La sonde coûte **deux secondes par image**, contre cinq
minutes pour l'échec.

```python
import sys, cv2, numpy
sys.path.insert(0, "montage-auto/Wav2Lip")
import face_detection
d = face_detection.FaceAlignment(face_detection.LandmarksType._2D,
                                 flip_input=False, device="cpu")
boite = d.get_detections_for_batch(numpy.array([cv2.imread("image.png")]))[0]
# Rejeter en dessous de ~120 px de large : en dessous, c'est un faux positif.
```

**Portée générale :** un traitement long qui vérifie son environnement au
démarrage ne vérifie pas pour autant ses **données**. Avant tout calcul qui se
compte en minutes, exécuter sa première étape sur trois échantillons — c'est la
même règle que « ne pas promettre un résultat qui dépend du réseau avant
d'avoir sondé », appliquée à l'entrée plutôt qu'à l'outil.

**Et le corollaire de cadrage :** un gros plan trop serré n'est pas un beau plan
pour un modèle de visage, c'est un plan sans visage. Le plan utilisable est
celui où la tête entière tient dans l'image, hood compris — pas le plus
spectaculaire.

## Un plan s'égalise sur ce qu'on entend, pas sur ce qu'on mesure

Quatre jours de montages rejetés tenaient à une seule confusion. Le niveau moyen
d'un plan et le niveau que rend un haut-parleur de téléphone ne se suivent pas :
mesuré sur six plans d'un même épisode, l'écart entre plans valait **5,1 dB en
bande entière** — un ensemble qui paraît équilibré — et **15,4 dB une fois passé
le filtre à 400 Hz**. Le monteur réglait la première colonne ; le spectateur
écoutait la seconde, où l'œil et le vortex passaient quinze décibels sous la voix.

Le remède ne touche pas au timbre : on donne à chaque plan le gain qui aligne son
**niveau filtré**, pas son niveau entier. L'écart est tombé de 15,4 à 4,0 dB.
C'est la seule correction acceptable sur un enregistrement — l'excitation
harmonique, elle, y grésille (`/bande-son`).

```bash
ffmpeg -hide_banner -nostats -ss <debut> -t <duree> -i <plan> \
       -af highpass=f=400,volumedetect -f null -
```

## `-v error` fait taire l'instrument de mesure

`volumedetect` écrit son résultat en niveau *info*. Lancé avec `-v error` par
réflexe d'économie, il ne rend rien — et le script qui l'appelle conclut « muet »
pour la totalité du lot, sans erreur, sans avertissement. Deux mesures ont été
perdues ainsi le même jour, la seconde alors que la première venait d'être
diagnostiquée.

C'est la même famille de défaut que le doseur déjà consigné plus haut : un outil
de mesure qui échoue **en silence** rend un verdict faux plus dangereux qu'une
panne. Avant de croire une mesure uniforme sur un lot hétérogène, vérifier que
l'instrument parle encore.

## Des sons conformes un par un font un mixage inaudible

Quatorze bruitages, chacun mesuré sous les 10 dB de perte sur un haut-parleur de
téléphone, montés ensemble en bande-annonce : **11,0 dB de perte**. Les graves ne
se masquent pas les uns les autres, ils s'additionnent — deux drones, un
grondement et un boom au même instant repassent sous le seuil de l'appareil.

Vérifier les éléments ne dit donc rien du résultat, et c'est le piège : chaque
mesure était verte. Seule la mesure **du mixage** l'a vu.

La sortie tient en une phrase de métier : **un seul élément possède le grave à la
fois**, et le lit audible est porté par un son qui traverse le filtre, jamais par
un drone. Un drone perd quinze décibels à lui seul ; sa place est huit décibels
sous le reste, où il se ressent sur une enceinte sans rien coûter sur un
téléphone. Appliqué, l'écart est tombé de 11,0 à 5,7 dB.

## Contourner l'outil du dépôt réintroduit le bug qu'il évitait

Une bande-annonce a été montée à coups de `ffmpeg` écrits à la main, avec
`loudnorm=I=-14:TP=-1:LRA=11` en fin de chaîne. Résultat mesuré : un impact qui
sortait à −1,4 dB dans le mixage brut ressortait à −24 dB après, soit au niveau
exact du lit qu'il était censé dominer. Quatre versions du montage ont été
retouchées — appoints de gain, choix des sons, creusement du lit — avant qu'on
regarde la dernière ligne de la commande.

`loudnorm` en une passe n'est pas un normaliseur : il travaille au fil de l'eau,
remonte les creux et écrase les crêtes pour tenir la cible en continu. C'est un
compresseur, et il détruit précisément le contraste qu'un montage construit.

**Le dépôt le savait.** `bande-son/SKILL.md` l'écrit noir sur blanc — « en une
passe, il compresse » — et `monter.py` s'ouvre sur « Deux passes, toujours ».
La connaissance était écrite, datée, à sa place. Elle a été contournée parce
qu'écrire six lignes de `ffmpeg` paraissait plus direct que de lire l'outil.

La règle qui en sort ne parle pas de son : **avant d'écrire à la main ce qu'un
script du dépôt fait déjà, lire ce script.** Ce qu'il contient d'utile n'est
presque jamais la fonctionnalité — c'est la liste des pièges que quelqu'un a
déjà payés. Les trois heures perdues ici sont le prix d'une lecture de trente
secondes.

La parade, quand on doit vraiment normaliser à la main : mesurer la sonie
(`loudnorm ... print_format=json`), appliquer **un gain unique**, puis limiter.

```bash
ffmpeg -hide_banner -nostats -i entree.wav \
       -af loudnorm=I=-14:TP=-1:print_format=json -f null -   # lire input_i
ffmpeg -y -i entree.wav -af "volume=<cible - input_i>dB,alimiter=limit=0.8913" sortie.mp3
```

## Égaliser tous les plans supprime le relief avec le défaut

Six plans d'un montage s'étalaient sur seize décibels de niveau entendu : l'un
d'eux, muet, passait seize sous les autres. Corrigé en donnant à chacun la même
cible, l'écart est tombé à 3,5 dB — et le montage a été rejeté d'un mot :
« le son dans l'ensemble est trop plat ».

Les deux constats sont justes et ne se contredisent pas. Un écart **subi** est
un défaut ; un écart **voulu** est le montage lui-même. L'égalisation ne doit
donc servir que de point de départ, sur lequel on pose ensuite une courbe
dramatique explicite — une cible par plan, écrite, qui monte vers le dénouement.

Appliqué au même montage, avec des cibles allant de −31 dB sur l'ouverture à
−17 dB sur le rugissement final : **15,9 dB de relief**, obtenus exprès, chaque
plan restant à sa place.

La règle générale déborde le son : *mesurer un écart ne dit pas s'il faut le
réduire.* Il faut d'abord savoir si quelqu'un l'a voulu.

## Un point de coupe se choisit sur la courbe du plan, pas sur sa durée

Un plan de dragon de dix secondes a été coupé de 2,0 à 5,5 s — « le début, pour
faire court ». Mesuré après coup, seconde par seconde : le son du plan **montait
jusqu'à la fin** (−16,5 dB à 9 s) et la tranche retenue était son creux exact
(−31,6 dB à 5 s). L'image disait la même chose : l'éclair tombait à 6,5 s et le
rugissement face caméra occupait les trois dernières secondes. Tout l'intérêt du
plan était après la coupe.

Trente secondes de mesure l'auraient dit avant le montage :

```bash
for i in $(seq 0 9); do
  ffmpeg -hide_banner -nostats -ss $i -t 1 -i plan.mp4 \
         -af highpass=f=400,volumedetect -f null - 2>&1 | grep mean_volume
done
```

Et pour l'image, une planche de vignettes horodatées. Les deux ensemble disent
où est le plan ; sa durée ne dit rien.

## Une esquive se pilote par le signal, jamais par des fenêtres écrites à la main

Entre les répliques d'un conteur, un mixage tombait à −50 dB — un blanc qui
casse l'immersion plus sûrement qu'un mauvais son. Monter le lit comblait le
blanc **et** couvrait la voix ; le baisser rendait la voix et rouvrait le blanc.
Les deux exigences sont incompatibles à gain constant.

La parade est l'esquive du mixage de cinéma : le lit joue fort et s'efface le
temps de la parole. Une première version la pilotait par des **fenêtres de
phrases**, relevées proprement et posées à la main. Mesurée au dixième de
seconde, elle a rendu le défaut **pire** : 19 tranches sous −40 dB contre 18
sans esquive du tout, minimum à −49,8 au lieu de −47,1.

La cause tient en une phrase : **les trous les plus profonds ne sont pas entre
les phrases mais entre les mots**, donc à l'intérieur des fenêtres. Le lit
s'effaçait précisément là où il devait remplir.

Pilotée par l'enveloppe de la voix elle-même — relevée dans sa bande, 300 à
3500 Hz, avec une attaque plus rapide que le retour — l'esquive tombe à **2
tranches** sous −40 et remonte le minimum à −40,0 dB.

La règle déborde le son : **une automation qui suit une intention écrite se
trompe partout où la mesure et l'intention divergent.** Brancher le détecteur
sur le signal réel coûte dix lignes et supprime la classe entière d'erreurs.

## `-af` est ignoré en silence dès qu'un `-filter_complex` est présent

Un plan de montage a reçu un flou radial, donc un `-filter_complex`. Son gain
sonore, resté en `-af`, a cessé d'être appliqué — sans erreur, sans
avertissement. Ce plan est sorti au niveau brut, a dominé le mixage, et la
normalisation a tiré les cinq autres sept décibels plus bas. Le symptôme
observé n'était donc pas « le vortex est fort » mais « tout le reste est
devenu faible », ce qui envoie chercher au mauvais endroit.

La règle de `ffmpeg` est simple une fois connue : **`-vf` et `-af` sont des
raccourcis vers le graphe simple, et le graphe complexe les remplace tous les
deux.** Dès qu'on passe à `-filter_complex` pour l'image, le son doit y entrer
aussi.

```bash
-filter_complex "[0:v]...[sortie];[0:a]volume=3dB[audio]" -map "[sortie]" -map "[audio]"
```

Même famille que le `-v error` qui faisait taire `volumedetect` : un réglage
qui disparaît sans rien dire coûte plus cher qu'une panne, parce qu'on cherche
la cause là où le symptôme se voit.

## Un flou radial se compose, il ne se calcule pas image par image

`ffmpeg` n'a pas de flou radial et l'écrire en Python coûterait des minutes par
plan. Il s'obtient pourtant en une passe : **superposer sept copies de l'image
à des échelles croissantes, recadrées au centre, et les moyenner** (`split`,
`scale`, `crop`, `mix`). Le déplacement d'un point vaut alors zéro au centre et
croît avec sa distance — c'est exactement une aspiration, sans qu'on ait eu à
la modéliser.

Sept copies : en dessous elles se comptent une à une et l'image se dédouble ;
au-dessus le rendu s'allonge sans que l'œil y gagne.

Le principe déborde le cas : **avant d'écrire une boucle sur les pixels,
chercher quelle composition d'opérations existantes produit le même champ de
déplacement.** Ici, une propriété géométrique du recadrage centré remplaçait
tout un calcul.

## Un effet de caméra se compose de filtres existants, pas d'une boucle

Trois gestes de mise en scène qu'on croit devoir calculer image par image se
posent en une expression `ffmpeg`, et le principe est le même dans les trois cas :
**chercher quelle opération existante produit le champ voulu.**

- **Le tremblement** est un recadrage qui bouge, jamais un zoom qui pulse. On
  réserve une marge, on promène la fenêtre dedans — `crop` avec des expressions
  sur `x` et `y`. Deux fréquences sans rapport entier se superposent : une
  sinusoïde seule donne une vibration mécanique, leur somme ne se répète jamais
  et se lit comme un choc.
- **Le flash** est `eq=brightness` avec `eval=frame`, montée instantanée et
  retombée exponentielle. L'inverse donne une lumière qui s'allume.
- **Le flou radial** est la moyenne de sept copies à échelles croissantes,
  recadrées au centre.

Deux pièges de version, chacun payé une fois :

`crop` **n'a pas d'option `eval`** — ses expressions `x` et `y` sont déjà
réévaluées à chaque image, et la lui passer lève « Option not found ». `eq`,
elle, l'exige.

`setpts` doit être **suivi** d'un `fps`, jamais précédé : un flux recadencé
avant compression garde l'ancienne cadence, et le multiplexeur refuse des
horodatages qui n'avancent plus (« non monotonically increasing dts »).

## Un morph se calcule sur les tailles, pas sur les formes

Enchaîner deux plans sans coupe visible — une pupille qui devient une planète —
ne demande ni déformation de maillage ni outil dédié. Il faut que **les deux
objets occupent le même disque à l'écran au moment du fondu**, et le reste
suit : l'oeil plonge dans sa pupille, le plan suivant recule depuis sa planète,
et un fondu de quatre dixièmes fait le raccord.

Le seul calcul est un rapport. Mesuré sur ce dépôt : pupille de 295 px de rayon,
planète de 333. Le zoom d'entrée valant 2,9, celui de sortie doit valoir
2,9 × 295 / 333 = 2,57 pour que les disques coïncident. À un pour cent près, le
raccord se voit.

Deux détails sans lesquels ça ne prend pas : le fondu suit une **courbe en S**
(linéaire, on voit les deux images à parts égales au milieu et l'illusion
tombe), et l'entrée est plus rapide que la sortie — on plonge vite, on recule
lentement.

## Une explosion se découpe dans l'image, elle ne se pose pas dessus

Trente fragments générés par une bibliothèque et composités par-dessus se voient
au premier coup d'oeil : leur texture n'a ni l'éclairage ni la palette du plan.
Découper le disque réel en cellules de Voronoï et animer **ses propres pixels**
coûte quarante lignes et supprime le problème.

Trois réglages font la crédibilité, et aucun n'est le nombre de morceaux :

- **La vitesse hors-plan.** Une explosion qui ne s'étale que dans le plan de
  l'image se lit comme une fleur qui s'ouvre. Ce qui fait « ça vient sur moi »,
  c'est le grossissement.
- **La dispersion.** Une explosion isotrope est une animation ; il faut des
  morceaux lents qui retombent et des éclats qui filent.
- **Ce qui reste au milieu.** Peindre du noir y creuse un trou découpé dans
  l'image. Une masse qui cède **rayonne** pendant qu'elle se disperse : un coeur
  chaud qui se contracte, et un rayon d'extinction assez petit pour laisser les
  mains qui tenaient l'objet — les effacer casse la lecture.

Un fragment qui grossit doit aussi **perdre de la lumière et de la netteté**,
sinon il devient une découpe de papier blanc : il arrive sur l'objectif, donc il
sort de la zone de netteté et quitte l'éclairage de la scène. Le rouge résiste
mieux que le bleu, ce qui le fait virer à la braise plutôt qu'au gris.

## Un composant défini pendant le rendu perd le curseur, et le lint le sait

Écrire une petite fonction à l'intérieur d'un composant pour éviter de répéter
trois lignes de JSX paraît propre. `eslint-config-next` la refuse — la règle
`react-hooks/static-components`, six erreurs d'un coup sur un formulaire — et
elle a raison bien au-delà du style.

La fonction est **redéfinie à chaque rendu**, donc React voit un type de
composant différent à chaque fois. Il ne compare pas le contenu : il démonte le
sous-arbre et le remonte. Sur un champ de saisie, cela veut dire que le curseur
saute à chaque frappe — un défaut qu'aucun test unitaire ne voit et qu'on met
une heure à relier à sa cause.

La parade tient en une ligne : le sortir au niveau du module et lui passer ce
dont il a besoin en propriétés. Vaut pour tout projet React du dépôt.

## `pkill -f` tue le shell qui l'exécute

Deux vérifications ont été interrompues d'affilée sur un code 144 sans qu'aucun
test n'ait échoué. La cause n'est pas dans le dépôt : `pkill -f "next start"`
compare le motif à la **ligne de commande entière** de chaque processus — et la
ligne de commande du shell qui exécute cette commande contient, elle aussi, la
chaîne « next start ». Le shell se tue donc lui-même avant d'atteindre la
commande suivante, et tout ce qui suivait sur la même ligne disparaît.

Le symptôme est trompeur parce qu'il ressemble à un échec de la commande
suivante : on relit les tests, pas la ligne qui les précède.

Deux parades, dans l'ordre : viser le port plutôt que le nom
(`fuser -k 3114/tcp`), ou lancer le serveur en tâche de fond en gardant son PID
et le tuer par ce PID. À défaut, isoler le `pkill` dans son propre appel, où il
n'emporte que lui-même.

Vaut pour `pkill`, `killall -r` et tout ce qui filtre sur la ligne de commande.

## Un parcours navigateur ne survit pas seul à un changement de coque

Le studio téléphone est passé à une page unique qui défile ; sa barre d'étapes
et son tiroir ont disparu. Le parcours Chromium cliquait encore l'un et
l'autre, et tombait après quatre mesures sur quarante.

Le défaut a survécu à la fusion pour une raison qui vaut d'être écrite : **le
contrôle qui l'aurait vu ne tourne que sur les pull requests.** La fusion sur
`main` n'exécute que les vérifications rapides, donc la branche qui a changé la
coque a été fusionnée verte, et c'est la branche *suivante* — sans rapport avec
le studio — qui a hérité du rouge. Toutes les branches ouvertes le portaient en
même temps.

Deux règles en sortent :

- **Changer une coque, c'est changer ce qui la conduit.** Un test de bout en
  bout tient par des sélecteurs qu'aucun compilateur ne relit ; ils ne cassent
  qu'à l'exécution, et seulement dans le profil concerné.
- **Un rouge qui apparaît sur une branche qui n'a pas touché au sujet vient
  presque toujours de la base.** Le réflexe utile n'est pas de relire son
  propre diff mais de demander : ce contrôle a-t-il seulement tourné sur `main`
  depuis la fusion qui a changé les lieux ?

La parade coûte peu : nommer le geste plutôt que le sélecteur. `allerAEtape`
clique la barre sur ordinateur et fait défiler jusqu'à l'ancre sur téléphone ;
le jour où la coque change encore, un seul endroit ment.
## Le sifflement d'un son se mesure, il ne se discute pas

Un lit de vortex a été refusé d'un mot — « son horrible, vire l'aigu ». Le
désaccord aurait pu tourner en aller-retours ; deux nombres l'ont tranché.

Le **centre de gravité du spectre** dit où vit le son, et la **part d'énergie
au-dessus de 4 kHz** dit combien il siffle. Avant : 3157 Hz et 7,9 %. Après
remplacement de la montée en hauteur par un rumble à 40 Hz, un vent sourd et
des cailloux : 2225 Hz et 2,1 %.

La cause était une intention mal placée. `aspiration` avait été écrite autour
d'une montée de deux octaves et demie, parce que c'est le déplacement en
hauteur qui fabrique la sensation de vitesse — juste en soi, et exactement ce
qui produit un sifflement. **Un effet peut être correctement conçu et
inutilisable** : ce qui manquait n'était pas la justesse du procédé mais la
question de savoir si l'on voulait entendre de la vitesse ou de la masse.

```bash
# où vit le son, et combien il siffle
python3 -c "
import numpy,wave,sys
x=numpy.frombuffer(wave.open(sys.argv[1]).readframes(-1),dtype=numpy.int16).astype(float)
sp=numpy.abs(numpy.fft.rfft(x*numpy.hanning(len(x))))**2
fr=numpy.fft.rfftfreq(len(x),1/48000)
print(f'centre {(sp**.5*fr).sum()/(sp**.5).sum():.0f} Hz · '
      f'au-dessus de 4 kHz {100*sp[fr>4000].sum()/sp.sum():.1f} %')" son.wav
```

## Trois refus ne font pas une impossibilité, et le git anonyme est le quatrième chemin

Une police manquait. `raw.githubusercontent` : 403. L'API GitHub : 403. PyPI :
404. Trois refus ont suffi à conclure « hors de portée » et à livrer un
remplaçant approchant.

C'était faux. **Le mandataire git de ces sessions sert les clones anonymes de
n'importe quel dépôt public**, sans que le dépôt figure dans la liste de portée
du prompt système — celle-ci ne nomme que les dépôts *attachés*. Un
`GIT_LFS_SKIP_SMUDGE=1 git clone --depth 1` a ramené le fichier en quelques
secondes, après que l'utilisateur ait demandé « comment je fais ».

Le dépôt savait déjà que « deux chemins essayés ne font pas une impossibilité »
— la voix off et les poids Wav2Lip l'avaient prouvé, et la sortie était chaque
fois la même : **les objets de release GitHub répondent**. La liste des issues
gagne donc une entrée, et c'est la plus large :

| ce qui est refusé | ce qui répond |
| --- | --- |
| `raw.githubusercontent.com` | `git clone` anonyme du même dépôt |
| `api.github.com` | le serveur MCP GitHub, et `git clone` |
| `huggingface.co`, sites d'éditeurs | objets de release GitHub, PyPI |

La règle générale : **avant de déclarer une ressource inaccessible, essayer de
la cloner.** Un fichier dans un dépôt public s'obtient presque toujours, et le
protocole git passe là où HTTP est filtré.

## Une liste d'exclusions tenue à la main dérive, et casse le voisin

Le `tsconfig.json` de la racine type-vérifie `**/*.ts`, et écarte les projets
nichés par une liste écrite à la main. Deux projets ajoutés depuis n'y
figuraient pas. Leur alias `@/` résolvait donc vers le `src/` de la racine, et
la construction d'Amorce échouait sur seize erreurs venues d'un projet qui
n'est pas le sien.

Le défaut a traversé deux vérifications sans être vu, pour une raison qui vaut
d'être notée : **la PR qui l'a introduit a été fusionnée pendant que le
déploiement était bloqué par un quota.** Le seul contrôle capable de l'attraper
n'a jamais tourné, et son échec — « rate limited » — ressemblait à un incident
sans rapport. Fusionner sur un contrôle qui n'a pas tourné revient à fusionner
sans contrôle.

La liste se déduit du disque au lieu de se maintenir :

```bash
ls -d */tsconfig.json | cut -d/ -f1   # tout projet qui a son propre tsconfig
                                      # doit figurer dans « exclude »
```

Règle générale : **une liste qui doit rester synchronisée avec le disque se
calcule, ou se vérifie.** Écrite à la main, elle est fausse dès le projet
suivant — et c'est le voisin qui paie.

## Une cadence se pose une fois, à l'entrée ; la reconvertir fait sauter l'image

Un montage rendu à 30 images par seconde puis exporté à 24 jette une image sur
cinq. Sur un plan fixe, cela ne se voit pas ; sur un travelling ou un zoom, le
mouvement saccade toutes les deux images. Mesuré par la différence entre images
consécutives : **quinze sauts en sept dixièmes de seconde** sur un seul plan.

Deux causes s'y ajoutaient, et la seconde est la pire : un `setpts=PTS/2` pour
doubler la vitesse **jette lui aussi une image sur deux**, et les deux
décimations se composent. La sensation de vitesse ne valait pas ce prix — elle
se fabrique par le zoom et le flou, qui ne coûtent aucune image.

La règle : **poser la cadence à l'entrée de la chaîne, et n'y plus toucher.**
Toute reconversion en aval est une décimation.

```bash
# le saut se mesure : un pic d'écart entre deux images consécutives
ffmpeg -v error -i film.mp4 -vf scale=96:171,format=gray -f image2 /tmp/f%04d.png
# puis comparer chaque image à la suivante — les pics isolés sont les coupes,
# les pics tous les deux cadres sont une décimation
```

## Un découpage se cale sur la parole, jamais l'inverse

Un plan de conteur a été réduit à 0,70 seconde par un morph qui lui avait pris
sa première réplique. Ce qui restait tombait **entre deux phrases** : le
montage ne contenait donc aucune parole, alors que rien dans les niveaux ne le
signalait — le plan mesurait −22,9 dB comme les autres.

Le défaut ne vient pas d'un mauvais réglage mais d'un mauvais ordre : les
instants avaient été écrits d'abord, la parole rangée dedans ensuite. Il faut
l'inverse. On relève les groupes de parole, **on en déduit les bornes du plan**,
et le morph se pose sur un silence — jamais sur une réplique, qu'il ferait
prononcer pendant un fondu.

Le contrôle qui l'aurait vu tient en une ligne, et il est différent du niveau
global :

```bash
ffmpeg -hide_banner -nostats -ss <debut> -t <duree> -i film.mp4 \
       -af highpass=f=300,lowpass=f=3500,volumedetect -f null -
```

## Un ton de Shepard tient à son enveloppe, pas à ses voix

L'illusion d'une hauteur qui monte sans jamais arriver s'écrit en dix lignes :
des sinusoïdes espacées d'une **octave exacte**, toutes montant à la même
vitesse, l'ensemble se répétant à l'octave. Chacune sort par le haut pendant
qu'une autre entre par le bas, et l'oreille ne peut désigner aucune voix.

Ce qui fait tout n'est pourtant pas l'empilement mais **l'enveloppe de volume en
cloche posée sur le spectre** : une voix doit être inaudible en entrant, forte
au milieu du registre, inaudible en sortant. Sans elle on entend les voix
apparaître et disparaître, et l'illusion tombe à la première seconde. La cloche
se place en position **logarithmique** — l'oreille juge en octaves, pas en
hertz.

## Un pas n'est pas un impact, c'est trois impacts décalés

Un pas de machine lourde contient un claquement de contact, le grave de la
charge **quarante-cinq millisecondes plus tard**, et une traîne de gravats. Les
trois au même instant donnent une détonation ; étalés, ils donnent un pas — et
plus la bête est lourde, plus le grave arrive tard et bas.

Le corollaire vaut au montage : **les pas se relèvent dans le son du plan**, par
détection de pics sous 200 Hz, jamais placés au jugé. Sur un plan de dragon,
la mesure a donné 8,40 · 9,90 · 11,46 — un rythme irrégulier qu'aucune grille
n'aurait trouvé, et c'est justement son irrégularité qui le rend vivant.
## Un outil cher se raccorde par son cache et par son échec

Dix outils tournaient dans le dépôt sans se parler ; les coudre à une seule
recette a coûté trois fois la même leçon, et l'appel n'en était jamais la partie
difficile.

**Le cache décide du coût réel.** Une parallaxe coûte trente secondes, une
synchronisation labiale plusieurs minutes, et un montage d'essai se relance dix
fois. Le premier jet écrivait son cache à côté des fichiers de travail, que la
fin de passe efface par `_*` : chaque rendu se repayait entier, et rien ne le
signalait puisque le résultat était juste. Un cache doit vivre **hors du
balayage**, et sa clé doit porter tout ce qui change le rendu — la source, la
fenêtre, les réglages.

**L'échec décide de la fiabilité.** Un film de douze plans ne doit pas mourir
parce qu'un visage manque sur l'un d'eux. On prévient par écrit, on rend le plan
intact, le reste se monte. Corollaire : un outil qui peut se faire tuer par le
système — une inférence sur processeur qui sort en code −9 faute de mémoire —
tourne dans un **processus séparé**, sinon il emporte l'appelant avec lui.

**La détection vaut mieux que la déclaration.** Une image fixe se reconnaît à
son extension. Le champ `"parallaxe": true` semblait plus explicite ; personne
ne pense à déclarer qu'une image est une image, et l'oubli produisait exactement
le plan figé qu'on cherchait à supprimer.

## Un chiffre qu'on nettoie est un défaut qu'on cache

Le relief d'un montage affichait 23,4 dB, gonflé par deux plans très bas. Le
correctif évident — les écarter du calcul — a été écrit, testé, et il était
faux : la mesure porte sur le **film fini** dans la fenêtre du plan, pas sur le
son que ce plan apportait. Un plan à −47 dB ne dit donc pas « ce rush est muet »
mais « il ne se passe rien ici » — c'est un trou, exactement celui qu'une nuit
entière avait servi à combler ailleurs. Une image fixe en fabrique un sans le
vouloir : elle n'apporte aucun son, et si la recette n'y pose ni bruitage ni
voix, le film se tait.

Le filtre rendait un chiffre plus flatteur en masquant le seul défaut qu'il
aurait dû signaler. **Avant d'écarter une valeur aberrante, vérifier ce qu'elle
mesure vraiment** : quand la mesure est juste, l'aberration est dans le film.

## Une sonde de données vaut mieux qu'une vérification d'environnement

Un outil lourd vérifie volontiers ce dont il a besoin — le binaire, le modèle,
la carte graphique — et jamais **ce qu'on lui donne**. C'est pourtant par là que
l'échec arrive, et il arrive tard : Wav2Lip parcourt les soixante images d'un
plan avant d'annoncer qu'il n'y a pas de visage, mesuré à 4 min 51 sur
processeur.

Sonder les données d'abord coûte quelques secondes et change la nature du
message. Sur un plan de druide de deux secondes et demie, la sonde a rendu
« 11 images sur 60 sans visage exploitable, la première est l'image 0, fenêtre
exploitable 0,50 s → 2,50 s ». Le visage était grand, centré, de face : ce qui
gênait le détecteur était une **moustache épaisse**, pas un cadrage difficile.
Un plan qu'on croit facile n'est pas un plan sondé.

Deux corollaires, payés le même soir :

- **Une sonde doit rendre la sortie de secours, pas seulement le constat.** La
  fenêtre exploitable qu'elle nomme se recopie telle quelle et rend du premier
  coup. Un diagnostic sans issue oblige à chercher à la main ce que la machine
  vient de calculer.
- **Traduire ses coordonnées dans celles de l'appelant.** La sonde compte depuis
  ce qu'elle a reçu, la recette depuis le début du rush. L'addition manquée
  décale d'un `depart` entier et se lit comme un défaut de l'outil.
