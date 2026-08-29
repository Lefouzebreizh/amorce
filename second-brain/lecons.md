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

## Un rejeu de la CI ne voit pas ce que la session a installé

`comme-la-ci.sh` existe pour attraper les tests verts en session et rouges sur
un runner. Il a laissé passer exactement ça, et la raison mérite d'être écrite :
**il rejoue la CI dans la session**, avec un environnement Python vierge — mais
avec les *binaires système* que le hook de démarrage a installés.

Le test tombé appelait `ffmpeg()`. Le hook installe ffmpeg ; le runner ne l'a
pas. Le rejeu était donc vert, la CI rouge, et le rouge est apparu sur `main`
puis sur toutes les branches ouvertes en même temps.

Deux choses en découlent, et la seconde est la plus utile :

- **Un environnement vierge n'est pas une machine vierge.** Isoler les paquets
  Python ne dit rien des exécutables. Tout test qui invoque un binaire externe
  — ffmpeg, ffprobe, un moteur de rendu — est suspect tant qu'on ne l'a pas
  éprouvé avec ce binaire absent.
- **L'épreuve tient en trois lignes et ne demande aucun conteneur** : remplacer
  la fonction qui résout le binaire par une fonction qui lève, puis relancer le
  seul test concerné. Si le test passe, il ne dépendait pas du binaire ; s'il
  tombe, on vient de reproduire le runner sans quitter la session.

Le correctif d'un tel test est presque toujours le même : la doublure était
posée sur `subprocess.run`, alors que la résolution du binaire se fait **avant**,
pour construire la commande. Doubler l'exécution ne suffit pas ; il faut doubler
la résolution.

## Un morph mange du temps : la ligne de temps se relève, elle ne se déduit pas

Quatre plans de 2,2 + 2,8 + 3,2 + 5,2 s ne font pas 13,4 s de film mais **11,3**.
Chaque raccord sans coupe consomme la fin du plan sortant *et* le début de
l'entrant : trois morphs de 0,7 s ont retiré deux secondes.

Ce n'est pas une curiosité d'arithmétique, c'est ce qui décide où tombent les
titres et les bruitages. Calés sur les durées additionnées, le cri du titan et
la carte de fin tombaient **hors du film** — rendus, payés, jamais vus. Rien ne
le signale : le montage sort sans erreur, simplement amputé de sa fin.

**Rendre une première fois, relever les bornes réelles sur le rendu, puis caler
le son et les textes.** Dans l'autre sens on écrit à l'aveugle.

## Le relief d'un montage vient des bruitages, pas des niveaux de plan

Un montage à 4,8 dB d'écart s'entend plat. Le réflexe — creuser les `cible_db`
de chaque plan — a été essayé et **mesuré sans effet** : cibles abaissées de six
décibels, relief inchangé. La couche d'effets écrase les plans.

Ce qui déplace le chiffre est ailleurs : **étager les gains des bruitages**.
Chuchoter à l'ouverture pour que le climax existe. Le même montage, effets
étagés de −6 dB à l'accroche à +5 dB au climax : **10,3 dB de relief**, sans
qu'aucun plan ait bougé.

La règle générale, et elle est contre-intuitive : dans un montage sonorisé,
l'ouverture doit être **plus silencieuse qu'on ne le croit**. Un braam à pleine
puissance sur la première image ne fait pas un début fort — il supprime le
climax, faute d'écart.

## Une apostrophe dans un titre casse ffmpeg, et le message ment

`text='IL S\'EST RÉVEILLÉ'` fait échouer le rendu sur **« No such filter:
'0.25' »** — un nombre qui n'apparaît nulle part dans le texte, et qui sort de
l'expression `alpha` écrite cent caractères plus loin.

La cause : ffmpeg n'interprète **aucune séquence d'échappement à l'intérieur**
d'un argument entre apostrophes simples. Le `\` y est un caractère ordinaire,
la quote referme le champ, et la suite est relue comme des options de filtre.
La seule forme qui marche ferme, insère et rouvre : `'\''`.

Deux enseignements qui dépassent ce bug :

- **Un message d'erreur qui nomme une valeur absente du contenu fautif désigne
  presque toujours une frontière de citation mal fermée.** Chercher le texte
  cité, pas le nombre affiché.
- **Le test de non-régression porte sur la chaîne produite, jamais sur un appel
  à ffmpeg.** Le runner n'a pas le binaire ; un test qui l'exige est vert en
  session et rouge chez tout le monde.
## Un livrable conforme peut être le défaut

Une vidéo sortait à −14 LUFS avec 12 LU de dynamique : les cibles de diffusion,
respectées au dixième. Elle a été refusée plusieurs jours de suite pour « on
n'entend pas assez », et chaque fois la mesure disait qu'elle était bonne.

La norme venait de la télévision, où l'on écoute assis devant des enceintes.
L'appareil réel était un téléphone tenu à bout de bras. **La moitié basse de la
dynamique n'y existe pas**, et le vrai pic à −5,7 dBTP disait que cinq décibels
de marge n'avaient jamais servi.

Ce n'est pas un mauvais réglage : c'est un **bon réglage pour un autre
contexte**. Et c'est le cas le plus difficile à voir, parce que toutes les
vérifications passent — elles vérifient la conformité à la norme, jamais que la
norme est la bonne.

La question à poser avant de mesurer quoi que ce soit : **cette cible vient
d'où, et l'appareil qu'elle suppose est-il celui de l'utilisateur ?** Ici, non,
et personne ne pouvait le voir dans un chiffre. C'est l'auteur qui l'a dit, en
une phrase, après plusieurs jours.

## Entre deux mesures d'un même effet, prendre la moins flatteuse

Le gain d'un traitement sonore mesurait **+8,9 dB** sur le plan le plus fort et
**+5,2 dB** sur le film entier. Les deux étaient exacts ; le premier avait été
annoncé avant vérification.

Aucune des deux mesures n'est fausse, elles ne répondent pas à la même
question — et c'est précisément ce qui rend le choix tentant. Prendre la
seconde n'est pas de la modestie : c'est elle qui décrit ce que la personne
entendra, l'autre ne décrivant qu'un instant.

## Une famille de couleur par épisode, jamais dans le même film

Deux plans mesurés à **192°** et **263°** de teinte — turquoise et violet — ne
se montent pas ensemble. Soixante-et-onze degrés d'écart, et le spectateur
lit deux extraits collés, pas un film. Aucun étalonnage ne rattrape ça sans
détruire l'un des deux.

La sortie n'est pas de choisir : c'est d'en faire **deux épisodes**. Une
famille de couleur par épisode donne au feuilleton une identité par numéro,
et chaque plan garde la sienne.

Le corollaire pratique : une LUT se choisit **contre la teinte du plan**, pas
par habitude. Une `teal_orange` posée sur du violet le tire vers le cyan et
efface précisément ce qui le distinguait. Sur un épisode violet, on garde
l'accord des plans et le grain, et on écarte la LUT.

```bash
python3 .claude/skills/sous-titres-qui-accrochent/scripts/teinte.py plan1.mp4 plan2.mp4
# rend la teinte de chacun, et dit « une seule famille » ou « plusieurs »
```

## Un plan continu ne se découpe pas pour faire du rythme

Un plan de dix secondes portait toute une histoire — le personnage, le
phénomène, la créature — en un seul mouvement. Le découper en morceaux et les
recoller dans l'ordre revient à le rejouer, en ayant détruit sa continuité :
ce qu'il avait de plus rare, et ce qu'aucun montage ne fabrique.

Le rythme se met alors **dessus** et non dedans : poussée d'échelle, secousse
sur l'impact, textes qui arrivent, son qui monte. Le film garde une seule
coupe, et personne ne la cherche.

## Une couleur choisie n'est pas la couleur qui arrive

Un sous-titre écrit `#b4f2ff` — un cyan clair, franc sur le papier — mesurait
**12 % de saturation à l'écran**. Le contour noir et la compression délavent, et
sous 20 % l'oeil lit simplement « blanc ». L'auteur a dit « il n'y a aucune
couleur », et il avait raison contre la constante.

Il faut donc choisir **nettement plus saturé que ce qu'on veut voir**, et le
vérifier sur le rendu, jamais sur la valeur écrite.

Et la mesure elle-même se choisit. Un premier relevé prenait les pixels les
plus **clairs** de la bande — c'est-à-dire les bords anti-aliasés, presque
blancs — et concluait que rien n'avait changé alors que le texte était devenu
franchement cyan. Relevé sur les pixels les plus **saturés**, le vrai chiffre
apparaît : de 2 521 à **13 693 pixels colorés**, cinq fois et demie plus.

Quand une correction évidente à l'oeil ne se voit pas dans la mesure, suspecter
la mesure avant la correction.

## `setpts` ralentit l'image et laisse le son derrière

Un plan de 2 s lu à mi-vitesse rend **4 s d'image pour 2 s d'audio**, et le
reste sort en silence absolu. Mesuré sur un montage : une seconde et demie à
−180 dB en fin de film, que rien ne signalait — ni erreur, ni avertissement, ni
durée de fichier suspecte, puisque le conteneur affiche la durée de la vidéo.

`atempo` remet les deux d'accord, et se pose sur le son **en même temps** que
`setpts` sur l'image. Le piège vaut pour tout ralenti et tout accéléré.

Le contrôle qui l'aurait vu tient en une ligne :

```bash
ffprobe -v error -show_entries stream=codec_type,duration -of csv=p=0 film.mp4
# video et audio doivent afficher la même durée
```

## La cadence annoncée d'un rush n'est pas celle de son mouvement

Un plan généré annonce 30 images par seconde et n'en bouge réellement que 20 :
une image sur deux y est figée d'origine, avec juste assez de bruit d'encodage
pour n'être pas un doublon exact. Rien ne le signale — le fichier est conforme,
`ffprobe` répond 30, et le défaut ne se voit qu'en mouvement rapide.

**La mesure tient en dix lignes** et vaut avant tout montage : décoder en gris
réduit, calculer l'écart moyen entre images consécutives, compter celles qui
tombent sous 20 % de cet écart. Relevé sur un même rush : 20 i/s réels sur un
plan de visage, 24 sur un vortex, 27 sur une créature.

**Et le piège coûte cher : conformer le film à la cadence *annoncée* double la
saccade.** Du 20 i/s rendu à 30 donne une image doublée sur deux ; rendu à 24,
une sur cinq. Mesuré sur le même plan :

| cadence du film | images figées | irrégularité |
| --- | --- | --- |
| 30 i/s | 22 % | 68 % |
| **24 i/s** | **13 %** | **51 %** |

Le réflexe — « la source est à 30, rendons à 30 » — est donc exactement le
mauvais. **On aligne sur le mouvement réel, pas sur l'étiquette.**

Ce qui ne marche pas, et qui a été essayé : `minterpolate` vise une cadence et
ne détecte pas les images figées — sans effet mesurable à 30 comme à 60.
`mpdecimate` ne les attrape pas davantage, les doublons n'étant pas exacts,
même à seuil desserré quatre fois. La seule correction réelle est en amont :
régénérer le plan à la cadence qu'il prétend avoir.
## Un limiteur qui varie son gain s'entend comme une coupure

Un rugissement paraissait « coupé » au moment précis où il éclatait. Aucun trou
dans l'enveloppe, aucune discontinuité : le son était continu. Le défaut était
ailleurs.

Comparé avant et après le master, le gain appliqué **variait de +1,0 à +6,1 dB
selon l'instant**. Ce n'est pas un gain, c'est un limiteur qui pompe : poussé de
cinq décibels, il rend au signal fort ce qu'il retire au signal faible, et cette
respiration s'entend comme un décrochage à chaque crête.

La correction n'est pas de baisser le limiteur mais de **ne pas l'atteindre** :
le gain du master passe de +5 à +2 dB, et le rugissement gagne ses décibels
dans le **mixage** — en baissant le lit de 5 dB autour de lui plutôt qu'en le
poussant. La dynamique du cri remonte de 5,8 à 8,0 dB pour 8,6 avant master.

**Un son n'est pas fort parce qu'on le monte, il est fort parce que le reste se
tait.** Le monter l'envoie dans le limiteur, qui le rend plus petit.

```bash
# le pompage se mesure : comparer l'enveloppe avant et apres le master,
# et regarder l'ECART entre les gains appliques, pas leur moyenne
```

## Un carton de fin sur du noir dit que c'est fini

Une vidéo concurrente terminait sur un carton « le prochain épisode arrive »
posé sur fond noir : **26,2 de luminance** quand le film tournait à 69,8. Deux
secondes et demie de trou visuel, à l'endroit exact où un spectateur décide de
rester ou de partir.

L'idée était bonne — annoncer la suite transforme une vidéo en feuilleton — et
c'est son exécution qui la perdait. Posé sur la **dernière image du film**,
assombrie de moitié et non éteinte, le même carton garde le personnage à
l'écran pendant qu'on lit : 38,2 de luminance, et 1,7 s au lieu de 2,4.

Ce qui vaut d'être retenu déborde le montage : **une bonne idée mal exécutée se
reprend, elle ne se rejette pas.** Mesurer ce qui cloche dans l'exécution coûte
moins cher que de réinventer l'idée.

## « Ça sature » ne veut pas dire que ça écrête

Un rugissement décrit comme saturé, « un bruit de turbine ». Premier réflexe :
chercher l'écrêtage. Mesuré seconde par seconde — **zéro échantillon au-dessus
de 0,985**, facteur de crête entre 11 et 12 dB sur toute la durée. Rien ne
clippait.

Deuxième suspect, l'excitation harmonique : c'est un redresseur suivi d'une
saturation douce, donc de la distorsion par construction. Mesuré aussi — elle
**réduit** le contenu 3-12 kHz au lieu de l'augmenter, et n'ajoute aucun peigne.
Innocente.

Le défaut était ailleurs, et il se lit d'un coup en profil de bandes : au
moment du cri, **toutes** les bandes de 60 Hz à 4 kHz étaient pleines à
+9/+12 dB. Onze sources simultanées, plus 2,6 s de réverbération sur chacune.
C'est du **masquage**, et l'oreille le rapporte comme une saturation parce
qu'elle n'a plus rien à quoi se raccrocher.

Il ne se corrige pas au niveau — le monter l'aggrave. Il se corrige en
**enlevant** : une couche de cri au lieu de deux, le crépitement supprimé, le
lit descendu de 5 dB, la réverbération de 2,6 à 1,8 s. Relief spectral du cri
9,5 → 11,5 dB, et la boue sous 125 Hz de 10,4 à 2,4 dB.

```bash
# le bon relevé n'est pas volumedetect mais le profil par octaves :
# des bandes toutes egales = de la boue, quel que soit le niveau
```

## Un carton fabriqué depuis la dernière image hérite du texte de cette image

Le carton d'annonce de l'épisode suivant est fabriqué à partir de la dernière
image du film — c'est ce qui lui évite le fond noir. Mais cette image portait
encore un titre incrusté, et il s'est retrouvé **figé derrière** les trois
lignes du carton : quatre textes empilés, illisibles.

Rien dans le code ne pouvait le signaler : les deux traitements sont corrects
séparément. C'est leur composition qui produit le défaut, et elle ne se voit
qu'à l'écran.

**Un titre doit s'éteindre avant la dernière image** dès lors qu'on reprend
cette image ailleurs. Ici 0,6 s de marge. Vaut pour toute vignette, toute
miniature, tout carton tiré d'une frame du montage.

## Ce qui ouvre une vidéo se regarde, il ne se traverse pas

L'affiche d'ouverture durait 0,6 s — calibrée pour « dire vite ce qu'on
regarde ». Retour à l'écoute : « on ne voit pas le titre, on ne voit même pas
la beauté de cette image ». Passée à 1,5 s, elle fait son travail.

Le chiffre de départ venait d'une bonne règle appliquée trop loin : sur un
format court, chaque dixième compte. Mais une image qu'on ne peut pas lire ne
coûte pas 0,6 s, elle les **gaspille** — c'est le pire des deux mondes.

## `set -o pipefail` inverse `commande | grep -q`

Un script de vérification annonçait un ffmpeg dépourvu de `drawtext`, de
`libass`, de `libx264` et de `aac` — sur une machine où les quatre étaient
présents et servaient depuis des heures.

`grep -q` sort au **premier** résultat trouvé et ferme le tuyau. La commande
en amont, qui écrit encore, meurt alors en SIGPIPE — statut 141. Avec
`pipefail`, c'est ce 141 que le pipeline rend. **Trouver se lit comme
échouer**, et l'inversion est totale et silencieuse.

La parade tient en une ligne : relever la sortie **une fois** dans une
variable, grepper la variable ensuite.

```bash
LISTE=$("$FF" -hide_banner -filters 2>/dev/null || true)
printf '%s' "$LISTE" | grep -q " drawtext "
```

Vaut pour tout `grep -q`, `head`, `sed -n '1p'` — tout ce qui sort tôt — placé
en aval d'une commande bavarde, dans un script en `pipefail`.

## Un ffmpeg qui encode parfaitement peut ne rien savoir écrire

`pip install imageio-ffmpeg` pose un binaire ffmpeg complet côté codecs et
**dépourvu de `libfreetype` et `libass`**. Il lit, il encode, il filtre — et
`drawtext` y est simplement introuvable. Pas d'avertissement, pas de repli :
le filtre n'existe pas, la commande échoue sur une erreur de syntaxe qui ne
nomme pas la cause.

Quand deux ffmpeg cohabitent, `command -v` rend celui du `PATH`, qui est
souvent le mauvais. **Le binaire système d'abord**, partout et sans exception :
`/usr/bin/ffmpeg` s'il existe, `command -v` ensuite. C'est déjà ce que fait
`monter_episode.ffmpeg()` ; tout script qui trace du texte doit passer par la
même résolution, y compris les scripts de vérification — le mien s'est fait
prendre par sa propre règle.

## Un bruitage « cinéma » peut être du silence sur un téléphone

Seize bruitages arrivent d'un coup, tous étiquetés cinéma : nappes sombres,
subs massifs, énergie ésotérique. Relevé bande par bande avant de câbler quoi
que ce soit, **la moitié avait toute son énergie sous 400 Hz** — la colonne
« part du grave » affichait −0,0 dB par rapport au total.

Un d'eux mesurait **−61,3 dB entendus**. Ce n'est pas un impact discret, c'est
du silence, et aucun gain n'y change rien : on pousse plus fort ce que
l'appareil ne restitue pas, et on mange la marge des sons qui, eux, passent.

L'excitation harmonique les récupère, et le gain est sans commune mesure avec
ce qu'un réglage de volume donnerait :

| fichier | nu | excité | gagné |
| --- | --- | --- | --- |
| sub massif 1 | −61,3 dB | −28,7 | **+32,6** |
| sub massif 2 | −46,8 | −34,1 | +12,7 |
| nappe sombre | −27,4 | −20,6 | +6,7 |
| énergie druide | −20,5 | −17,3 | +3,2 |
| froissement | −20,3 | −20,5 | **−0,2** |

La dernière ligne vaut les autres : sur un son qui vit **déjà** dans le médium,
l'excitation ne rend rien. Elle se réserve au grave, et elle se mesure au lieu
de se supposer — comme la mise en garde « ça grésille sur un enregistrement
réel », qui vaut pour un signal déjà riche en harmoniques et pas pour une nappe
purement grave : rugosité relevée ici, +0,002 à +0,016. Rien.

Plusieurs de ces fichiers décodaient par ailleurs **au-dessus du plein
échelle** (jusqu'à 1,42). Les sommer tels quels écrête avant même le limiteur.

## `-shortest` tronque la vidéo quand c'est l'audio qui est plus court

Remuxer une image intacte avec un nouveau mixage et poser `-shortest` par
réflexe : la vidéo est ressortie **plus courte de 0,2 s**. L'AAC rend un flux
qui ne tombe pas au même endroit que l'image — 21,696 s contre 21,749 — et
`-shortest` a coupé sur le plus court des deux.

Deux dixièmes, soit la dernière ligne du carton de fin. Rien dans les mesures
de son ne pouvait le dire ; c'est le contrôle de durée par flux qui l'attrape,
et c'est pour cela qu'il fait partie des trois relevés avant envoi.

**Un mixage se cale sur la durée du flux VIDÉO**, pas sur celle de l'audio
décodé ni sur celle du conteneur. On complète l'audio par du silence, jamais on
ne raccourcit l'image.

## Un rush porte souvent déjà sa bande son — la doubler la détruit

Une scène de dragon décrite comme « horrible, ça sature complètement, on
n'entend que les éclairs ». Trois versions de rééquilibrage n'y avaient rien
changé, parce que le défaut n'était pas dans les niveaux.

Le spectrogramme l'a montré d'un coup : **six secondes de courbe plate**, −11 à
−14 dB sans un seul événement, sous un voile large bande qui ne s'arrêtait
jamais. Ce voile est ce qu'on entend comme une saturation.

Puis le geste qui a tout renversé : **dessiner le rush seul**. Il portait une
construction complète — arrivée, silence, montée, creux, éclair, rugissement —
et **19,6 dB de dynamique**. Un travail de sound design déjà fait.

Relevé instant par instant, mes accents tombaient tous à côté :

| ce que fait le rush | où j'avais posé mon accent |
| --- | --- |
| l'arrivée | juste |
| le silence de 1,05 s | comblé par des nappes continues |
| son éclair | 1,05 s trop tôt |
| **son rugissement** | mon cri 1,2 s AVANT |

Deux demi-scènes qui se masquaient au lieu d'une. Recalés sur ses instants —
et surtout **rien** dans ses silences — la scène rend 19,0 dB de dynamique
contre 19,6 au rush seul.

**Avant d'ajouter du son sur un plan, dessiner le son qu'il a déjà.** S'il en a
un, on ne le double pas : on le renforce sur ses propres instants, et on se
tait dans ses silences. Un silence dans un rush est une décision, pas un trou.

## Avec `vitesse`, `duree` compte en secondes source

Un plan à `vitesse: 1.8` et `duree: 2.8` ne rend pas 2,8 s : il consomme 2,8 s
de source et en rend **1,56**. À `0.8`, la même `duree` en rend 9,06 — ou moins
si la source s'épuise avant.

Conséquence mesurée : tous les accents du plan suivant posés 1,24 s trop tard,
c'est-à-dire chacun dans le creux de l'événement qu'il devait souligner. Et
rien ne le signale : le montage se rend, la vérification passe, le fichier est
faux.

**On calcule la frise, on n'en suppose rien** — surtout dès qu'un plan change de
vitesse, et surtout quand la source risque de s'épuiser.

## Un carton de fin trop fort n'a l'air fort nulle part

Le carton d'annonce sortait à −17 dB moyen. Écouté seul : correct. Mesuré sur
le film entier : il relevait le plancher au point de faire tomber la plage de
dynamique de **21,4 à 9,8 LU**.

Un carton n'a pas de niveau propre. Il en a un **par rapport au climax** — une
dizaine de décibels dessous. Le juger sur lui-même, c'est juger une virgule
sans la phrase.

## Un son de carton se calcule dans le repère du carton

Six sons posés aux instants absolus du film ressortaient à −45 dB : ils
tombaient hors de la tranche découpée ensuite. La durée annoncée du montage,
celle du flux vidéo et celle du flux audio diffèrent de quelques centièmes, et
cet écart suffit.

**Ce qui est monté à part se calcule à partir de zéro.** Un repère local ne peut
pas se décaler.

## Un analyseur paresseux et un analyseur gourmand passent les mêmes tests

Écrire un lecteur de gros fichier « au fil de l'eau » — générateur, flux, lecture
par morceaux — et le vérifier sur un extrait de dix lignes ne prouve rien. Les
deux versions rendent exactement les mêmes entrées, dans le même ordre, en un
temps identique. Celle qui charge tout en mémoire passe au vert, et le défaut
n'apparaît que sur la machine de quelqu'un d'autre, avec un vrai fichier, sous
la forme d'un processus tué sans message.

**Le seul test qui les sépare donne une source infinie et s'arrête au milieu.**

```ts
let produits = 0
async function* interminable() {
  for (;;) { produits += 1; yield `ligne ${produits}\n` }
}
const vus = []
for await (const entree of analyser(interminable())) {
  vus.push(entree)
  if (vus.length === 3) break
}
assert.ok(produits < 20)   // gourmand : ne se termine jamais
```

Une version gourmande ne rend pas la main — le test ne casse pas, il **pend**,
d'où le délai explicite qui le transforme en échec lisible. La version paresseuse
finit en quelques millisecondes, et l'assertion sur le compteur dit en plus
combien elle a lu d'avance.

Mesuré sur l'analyseur de listes IPTV, où l'écart est de trois ordres de
grandeur : une liste de fournisseur courante pèse de 50 à 400 Mo, et
`await reponse.text()` puis `.split('\n')` en demande deux à trois fois autant —
le texte, puis le tableau — avant la première entrée utilisable.

La même épreuve vaut partout où l'on annonce un traitement en flux : lecture de
journaux, de CSV, de XMLTV, de rushes. **Ce n'est pas le contenu rendu qu'il faut
vérifier, c'est ce que la source a eu le temps de produire.**

---

## Un rapport bâti sur zéro mesure rend le verdict le plus rassurant

Deux fois en deux jours, dans deux projets qui ne se connaissent pas, le même
défaut a failli être livré — et les deux fois il produisait la même chose : un
tableau qui annonce que tout va bien, précisément parce qu'il n'a rien regardé.

Le radar `pepites/` : une coupure réseau interrompait la sonde au cinquième
point d'entrée, et les quatre suivants **disparaissaient du tableau**. Un point
absent se lit comme un point sain.

Le bot `nexuscrypto/` : la mesure du levier comptait les positions liquidées.
Sur un rejeu qui n'avait ouvert aucune position — série trop courte pour les
indicateurs, la stratégie s'abstient —, zéro position liquidée sur zéro
position donnait « levier maximal 10x ». Le chiffre le plus dangereux du
tableau, sorti du vide, présenté comme un feu vert.

**La forme commune :** une conclusion se calcule par un dénombrement, le
dénombrement s'applique à un ensemble vide, et le neutre mathématique de
l'opération est exactement la bonne nouvelle. `aucun échec sur zéro épreuve`
vaut `tout va bien`. `max()` sur les survivants d'une liste vide vaut
`le plus haut`. Rien ne lève, rien ne s'affiche en rouge.

**Le geste, et il tient en une question à se poser avant d'écrire la
conclusion :** *si l'ensemble mesuré était vide, que dirait mon rapport ?* Si
la réponse est rassurante, il manque une branche. « Rien mesuré » n'est pas un
cas particulier à traiter par politesse : c'est un troisième verdict, à côté de
« ça passe » et « ça casse », et il doit être aussi visible que les deux autres.

Un corollaire du même ordre, trouvé dans la foulée : **une mesure qui inclut ce
qui n'est pas exposé flatte.** Le levier était d'abord mesuré sur le recul du
portefeuille, dont l'essentiel dort en liquide — 10x paraissait survivre à un
marché qui s'effondrait de 37 %. Le levier porte sur la position. Vérifier que
le dénominateur d'un ratio est bien la chose qui risque quelque chose.

## `atempo` troue un son dense — les « coupures » d'un ralenti viennent de là

Un rugissement décrit trois fois comme « coupé au milieu ». Deux causes avaient
déjà été trouvées et corrigées — un limiteur qui pompait, des accents mal
calés — et le défaut restait.

La troisième était dans le **ralenti**. `atempo` étire par recouvrement-addition :
sur un signal dense et bruité, les recouvrements se décalent en phase et
creusent des trous périodiques. Mesuré sur le cri ralenti à 0,8 :

| | tremblement de l'enveloppe | tranches sous −9 dB |
| --- | --- | --- |
| le rush nu | 2,4 | 0 / 139 |
| `atempo=0.8` | 3,7 | 4 / 64 |
| `rubberband=tempo=0.8:smoothing=on` | **2,5** | 1 / 174 |

`rubberband` rend l'étirement transparent. Il n'est pas toujours compilé dans
ffmpeg — d'où le repli — mais quand il est là, il n'y a aucune raison de s'en
passer.

**Un défaut qui survit à deux corrections justes a une troisième cause.**
Chercher la suivante plutôt que réajuster les deux premières.

## Un bruitage acheté peut valoir treize décibels de bruitage fabriqué

Le cri de dragon synthétisé ici mesurait **−25 dB entendus** au-dessus de
400 Hz. Un vrai rugissement, envoyé par le propriétaire : **−12,2 dB**, avec sa
forme déjà construite — attaque, tenue, chute — et 2 kHz de contenu là où le
téléphone entend.

Treize décibels d'écart sur l'appareil où la vidéo sera regardée. Aucun réglage
ne rattrape ça, et toute l'ingéniosité mise dans la synthèse ne pesait rien
contre un fichier de trois secondes.

**La synthèse sert à ce qui n'existe pas et à ce qui doit être exact** — un
Shepard, un impact calé à l'image près, une nappe d'une durée donnée. Pour un
cri, un pas, une roche : chercher le vrai d'abord.

## Un silence ponctué reste un silence ; un silence rempli n'en est plus un

Le rush ménageait 1,3 s de calme avant la montée. Fallait-il y mettre les pas
demandés ? Oui — parce que **deux impacts isolés ne remplissent pas un
silence, ils le rendent audible.** Ce qui le détruit, c'est un lit continu.

Mesuré après : la scène passe de 6 dB de dynamique à **23,3**, avec les pas
posés dans le calme et rien qui dure entre eux.

## Un texte se place où le sujet n'est pas, et ça se mesure

Un sous-titre posé à une hauteur fixe finit toujours par tomber sur ce qu'il
ne faut pas cacher : à 42 % de la hauteur il couvrait **la bouche du druide**
pendant qu'il parle, et se retrouvait **dans la gueule du dragon** sur le
carton. Deux fois l'endroit exact que l'œil regarde.

`montage-auto/placer_texte.py` relève l'agitation de chaque bande horizontale
— écart-type des luminances plus une part de la luminance moyenne — et rend la
plus calme **à l'intérieur de la zone sûre** (12–45 %, non négociable).

Le relevé ne suffit pas, et c'est la partie qui compte : sur un visage qui
remplit le cadre, **toute** la zone sûre est du visage. Le choix se fait alors
entre ce qu'on accepte de couvrir. Ici 12,5 % — le texte passe sur les runes du
front, les yeux et la bouche restent libres. Mesuré, puis **regardé**.

## Une image parfaitement immobile se lit comme un blocage

Un carton de fin rapporté comme « ça lag ». Relevé image par image :
**aucune image perdue**, intervalles réguliers à 41,7 ms, cadence exacte.

Le débit, lui, tombait à **0,09 Mb/s** sur les 1,7 dernières secondes. Ce n'est
pas un défaut de lecture, c'est un constat : plus rien ne changeait d'une image
à l'autre. Un carton dont l'animation de texte est finie et dont le fond est une
photo fixe **est** un arrêt sur image, et le spectateur ne le lit pas comme un
choix de réalisation.

Une poussée lente de 8 % suffit : 0,09 → **2,2 Mb/s**, et le carton redevient de
la vidéo.

**Le débit par seconde est la mesure qui dit si une image bouge.** Elle attrape
aussi le contraire — un pic qui fait ramer un téléphone.

```bash
ffprobe -v error -select_streams v -show_entries packet=pts_time,size \
        -of csv=p=0 film.mp4   # puis sommer par seconde
```

## `zoompan` compte ses images par image d'ENTRÉE

Le même `zoompan=…:d=70` posé sur une image bouclée a rendu un fichier de
**230 secondes** au lieu de 2,9. `d` n'est pas la durée de l'effet : c'est le
nombre d'images de sortie produites **pour chaque image d'entrée**. Sur un
`-loop 1` qui en fournit déjà soixante-dix, les deux se multiplient.

Sur une source déjà cadencée, `d=1` — une image dedans, une image dehors — et
l'animation se pilote par `on`, le numéro d'image de sortie.

## Un son congestionné n'est pas un son saturé

Un rugissement décrit comme saturé. Relevé : crête à −1,7 dBFS, **zéro
échantillon au-dessus de 0,95**, facteur de crête 8,8 dB. Rien n'écrête.

Son profil disait le défaut : **400-900 Hz à −5,7 dB quand 2-5 kHz était à
−13**. Toute la masse dans le bas-médium, aucune dent. C'est ce déséquilibre
qu'on entend comme de la saturation, et le monter ne fait qu'aggraver
l'encombrement.

Creusé à 320 Hz (−4 dB), relevé à 1,9 et 3,6 kHz (+5 et +3,5) : 2-5 kHz remonte
de **3,5 dB**, 900-2000 de 3, sans toucher au gain ni à la crête. L'agressivité
d'un cri vit là — et c'est aussi la bande où un haut-parleur de téléphone entend
le mieux.

## Un sous-titre se cale sur la bouche, pas sur le son

0,15 s d'avance sur la parole mesurée paraissait juste, et l'auteur trouvait
encore que « ça arrive trop tard ». La bouche s'**ouvre** avant que le son
sorte, et c'est sur l'image que l'œil cale la synchronisation.

0,30 s d'avance. Un sous-titre qui arrive avec le son arrive après l'image.

## Une fusion résolue « à nous » peut annuler un correctif qu'on vient d'annoncer

Un défaut corrigé, mesuré, livré, documenté — et de retour deux heures plus
tard. Relevé : `git merge origin/main` avait produit un conflit sur le moteur,
résolu par `--ours` sur un fichier que `main` avait **aussi** touché. Le
correctif y est passé à la trappe, silencieusement, et le montage suivant est
reparti avec l'ancien comportement.

Pire : **le correctif n'existait qu'à un seul des deux endroits** qui en avaient
besoin. Le second appel, dans la branche `filter_complex`, n'avait jamais été
corrigé — il attendait le premier plan flouté pour se manifester.

Deux gestes, et ils tiennent en une ligne chacun :

```bash
git diff origin/main -- fichier.py | grep '^-'   # ce que la fusion RETIRE
grep -n "le_symptome" fichier.py                 # combien d'endroits, pas un
```

**Après toute fusion, revérifier que le correctif qu'on a annoncé est encore
là.** Un `--ours` ne dit pas ce qu'il jette.

## Le spectrogramme distingue les causes que le comptage confond

« Ça saccade et il y a une coupure en plein milieu. » Compté : trois tranches
sous le seuil sur cent soixante-quatorze. Rien de concluant — et la correction
tentée sur ce chiffre l'a fait passer à vingt-trois, parce que le lit qu'on
effaçait **remplissait** les creux naturels du cri.

Dessiné, le défaut se lit en une seconde : **une raie verticale pleine bande à
17,90 s**. Franche, sur tout le spectre. Une coupure, pas une modulation.

C'était le raccord film/carton : une couche sonore posée **avant** l'assemblage
est tranchée à la jointure. Elle se pose sur l'image finie.

| ce qu'on voit | ce que c'est |
| --- | --- |
| raie verticale pleine bande | une vraie coupure |
| tremblement régulier de l'enveloppe | un étirement temporel |
| creux large et arrondi | une automation |
| bandes toutes pleines à la fois | du masquage |

**Un compteur de trous ne sépare pas ces quatre-là.** Un vrai rugissement a des
creux naturels ; les supprimer l'abîme.

## Le Chromium de Playwright ne lit aucune vidéo réelle

Cherché une heure pourquoi une lecture HLS parfaitement branchée n'affichait
rien. Ce n'était pas le code : **le Chromium livré avec Playwright est compilé
sans les codecs propriétaires.** Mesuré dans le conteneur, sur le binaire de
`/opt/pw-browsers/chromium` :

| codec | `MediaSource.isTypeSupported` |
| --- | --- |
| H.264 (`avc1.42E01E`) | **false** |
| AAC (`mp4a.40.2`) | **false** |
| VP9 (`vp9`) | true |

`video.canPlayType('video/mp4; …')` rend la chaîne vide, et `canPlayType` pour
HLS natif aussi. Or tout flux IPTV, toute caméra et tout export ffmpeg par
défaut sont en H.264/AAC : **l'image ne s'affichera jamais dans ce navigateur**,
quoi que fasse le code. Chrome, lui, les a — c'est la différence entre le
Chromium libre et le Chrome distribué.

**La parade n'est pas de renoncer à vérifier, c'est de déplacer l'assertion.**
Sans décodeur, on peut encore prouver tout le chemin : que le manifeste est
servi et réécrit, qu'un segment arrive avec son type et son poids, qu'une
adresse non signée est refusée, et surtout que **le lecteur annonce la durée du
média** — 20,0 s pour un flux de 20 s. Il ne peut la connaître qu'en ayant lu le
manifeste entier. Seule l'image reste non vérifiée, et on le dit.

**Piège voisin, même page :** `page.goto(url, { waitUntil: 'networkidle' })`
expire toujours sur une page qui lit un flux. Un lecteur fait du réseau en
continu, par définition — c'est son métier. Trente secondes perdues à chaque
essai, sur une page parfaitement saine. `domcontentloaded` sur ces pages-là.

## Un ralenti sans interpolation duplique une image sur cinq

Une scène rapportée comme « ça sature et ça lague ». Le son ne portait **aucun
échantillon écrêté** et un facteur de crête de 13,1 dB — rien à corriger de ce
côté.

L'image, elle : **29 images figées sur 144**. Une sur cinq, à intervalle
régulier, contre **zéro** sur un plan à vitesse normale. C'est exactement le
rapport qu'un ralenti à 0,8 produit quand ffmpeg tient la cadence en
**dupliquant** au lieu d'interpoler.

`minterpolate` fabrique les images manquantes : **1 sur 144**. Cinq minutes de
rendu pour sept secondes de plan, et c'est le prix.

**L'oreille suit l'œil**, et c'est la partie qui compte. Une image qui saccade
fait juger tout le plan mauvais, son compris. Avant de chercher un défaut de son
sur un plan ralenti, compter ses images figées :

```python
d = [abs(im[i+1] - im[i]).mean() for i in range(len(im)-1)]
figees = sum(1 for x in d if x < 0.30)   # deux images consecutives identiques
```

## Un serveur de test orphelin fait mesurer la version d'avant

Une vérification d'interface rendait quatre défauts d'un coup, dont un sans
rapport avec le changement : une page entière sans feuille de style. Le code
était juste. **Le serveur qui répondait n'était pas celui qu'on venait de
lancer.**

La cause tient en une phrase : `spawn('npm', ['run', 'start'])` engendre un
`next start` **petit-fils**, et tuer le `npm` laisse l'enfant vivant, orphelin,
avec le port. L'exécution suivante n'arrive pas à écouter, ne le dit pas, et
Playwright interroge le serveur d'il y a un quart d'heure — donc le code d'il y
a un quart d'heure. Relevé : `ps` montrait un `next-server` de ppid 1, âgé de
15 minutes, quand le script venait de démarrer.

Trois gestes, et les trois comptent :

1. **Lancer en groupe détaché, tuer le groupe** : `spawn(…, { detached: true })`
   puis `process.kill(-pid, 'SIGTERM')`. Tuer le pid seul ne descend pas.
2. **Refuser de démarrer si le port répond déjà.** Une requête HTTP de 250 ms
   avant de lancer, et un message qui dit quoi faire. Sans ce garde-fou, le
   défaut est invisible : tout paraît fonctionner.
3. **Ne pas détecter par `ss`** : le binaire n'existe pas dans ce conteneur, et
   `ss -ltnp` y rend une sortie vide sans erreur — donc « port libre » alors
   qu'il ne l'est pas. La sonde portable est la requête HTTP ; pour retrouver le
   coupable, `ps -eo pid,args`.

**Piège voisin, même script :** une capture d'écran prise après
`waitUntil: 'domcontentloaded'` montre la page **sans style** — cet événement
n'attend pas la feuille. On croit à une régression de CSS. `waitForLoadState('load')`
avant de photographier.

## Deux versions du même son ne s'additionnent pas, elles battent

Une scène rapportée quatre fois comme « ça sature et le cri coupe au milieu ».
Quatre causes trouvées, corrigées, mesurées — et le symptôme revenait.

La cinquième a résisté parce que **rien n'était défectueux** :

| | mesure |
| --- | --- |
| le fichier source du cri | crête −0,4 dBFS, **zéro** écrêtage, enveloppe intacte |
| le fichier livré, au cri | **zéro** discontinuité entre deux échantillons |
| paliers plats à haut niveau | **zéro** |
| vrai pic inter-échantillon | −1,43 dBTP |

Chaque pièce était juste. C'est leur **somme** qui ne l'était pas : le rush
portait son propre rugissement, étiré par le ralenti à 0,8, et le vrai était
posé par-dessus à sa vitesse naturelle. Deux bêtes qui hurlent en même temps,
décalées — un battement, que l'oreille rapporte comme une saturation et comme
une coupure.

Sur le spectrogramme, la signature est nette : **des stries verticales
irrégulières entre 2 et 10 kHz**, là où un cri unique dessine une nappe dense.

**Quand chaque pièce mesure juste et que l'ensemble sonne faux, chercher ce qui
joue en double.** Et descendre à l'échantillon avant de conclure — c'est le seul
niveau où une vraie coupure laisse une trace qu'aucun autre défaut ne laisse.

## Un fichier texte « cassé » est presque toujours un fichier bien encodé, mal lu

Un `.srt` francophone sur deux vient d'un outil Windows et n'est pas en UTF-8 :
il est en windows-1252, un octet par caractère. Lu comme de l'UTF-8, « L'été »
devient « L'Ã©tÃ© » — ou « L'�t� » selon le décodeur. Le même piège vaut pour
un CSV exporté d'Excel, un `.txt` reçu par courriel, un `.ass` de sous-titres.

**La détection tient en cinq lignes, et l'ordre d'essai fait tout :**

```js
try { return new TextDecoder('utf-8', { fatal: true }).decode(octets) }
catch { return new TextDecoder('windows-1252').decode(octets) }
```

L'UTF-8 en mode `fatal` **lève** sur une séquence invalide : c'est un test, pas
une supposition. L'inverse ne marcherait jamais — windows-1252 accepte
n'importe quelle suite d'octets et ne se plaint pas, donc il « réussirait »
aussi sur un fichier UTF-8, en le massacrant.

Deux compléments mesurés dans ce conteneur : `TextDecoder('windows-1252')`
fonctionne (l'ICU complet est présent, `Intl.DisplayNames` le confirme), et une
marque d'ordre des octets survit au décodage — elle se retire à la main, sans
quoi elle reste collée au premier mot affiché.

## Quand cinq causes sont tombées, c'est l'effet qui est en trop

Le même symptôme — « ça coupe et ça sature » sur un plan — rapporté **cinq
fois**. Cinq causes distinctes trouvées, mesurées, corrigées, chacune réelle :
un limiteur qui pompait, un trou d'air qui mordait sur l'attaque, une couche
tranchée au raccord, un ralenti qui dupliquait une image sur cinq, deux
rugissements qui battaient. Et le symptôme revenait.

Elles avaient une **cause commune** : le ralenti à 0,8. Il obligeait à étirer
l'audio — tout étirement laisse une trace ; à interpoler l'image — sans quoi
une image sur cinq est dupliquée ; et il décalait le cri du rush contre celui
posé par-dessus, d'où le battement.

Retiré, les trois disparaissent d'un coup, et les deux cris tombent exactement
l'un sur l'autre au lieu de se battre.

**Un effet qui coûte cinq allers-retours ne vaut pas ce qu'il apporte.** La
règle des trois essais de ce dépôt vaut pour un bug ; elle vaut aussi pour un
parti pris de réalisation. Au troisième symptôme qui revient sur le même plan,
la question n'est plus « quel réglage » mais « qu'est-ce que j'enlève ».

## Une correction étroite fabrique son propre défaut

Un rugissement congestionné dans le bas-médium, corrigé par +5 dB à 1,9 kHz
avec un Q serré. La congestion partait — et une résonance arrivait : tremblement
de l'enveloppe **4,1** contre **3,7** avec une simple cloche large à 2,4 kHz,
qui fait le même travail.

Sur un signal dense et bruité, une correction étroite s'entend comme une note.
**Corriger large, ou ne pas corriger.**

## Un appareil de salon ne reçoit pas l'image, il va la chercher

Le modèle mental le plus coûteux, quand on branche un Chromecast : croire que
le téléphone lui envoie la vidéo. Il lui envoie une **adresse**, et l'appareil
télécharge le flux lui-même, directement. Trois conséquences, et chacune casse
la diffusion sans message d'erreur — écran noir, retour au menu.

1. **`localhost` désigne celui qui le prononce.** Une adresse
   `http://localhost:3000` donnée à un Chromecast désigne le Chromecast. Il
   faut l'adresse de la machine sur le réseau local — et le plus simple est de
   la déduire de l'adresse **de la page** : si le téléphone est arrivé par
   `http://192.168.1.20:3000`, la télévision doit utiliser la même. Rien à
   configurer côté serveur, ce qui serait faux dès qu'une machine a deux cartes
   réseau.
2. **Ce qu'un navigateur fabrique n'a pas d'adresse.** Une vidéo assemblée par
   Media Source Extensions — hls.js, dash.js — n'existe que dans l'onglet.
   Diffuser oblige à repasser sur la source directe, et à **détruire la
   bibliothèque avant** de poser l'URL : laissée en place, elle reprend la main
   sur l'élément et écrase ce qu'on vient d'écrire.
3. **Un serveur de développement n'écoute que sur `localhost` par défaut.**
   Ni le téléphone ni la télévision ne voient rien tant qu'on n'a pas dit
   `--hostname 0.0.0.0`. Et il faut le dire : à partir de là, tout le wifi peut
   ouvrir l'application.

**Piège de détail, mesuré :** `new URL('http://[::1]:3000/').hostname` rend
`"[::1]"`, **avec les crochets**. Une liste d'adresses locales écrite avec
`'::1'` laisse donc passer l'adresse locale la plus courante des serveurs de
développement, et le contrôle « est-ce joignable de l'extérieur » répond oui à
tort.

## Un outil qui régénère un fichier partagé en supprime ce qu'il n'a pas calculé

Trois mesures de suite sans le moindre effet : changer un gain de +2 à +6 puis
+8 rendait des chiffres **identiques au chiffre près**. C'est le signe qu'on ne
mesure pas ce qu'on croit.

La cause : un script de recalage régénérait le fichier d'automation avec
`"couches": []`. Ce fichier portait aussi les bruitages posés à la main —
effacés en silence à chaque appel. Je mesurais des versions muettes de leurs
couches en croyant régler des niveaux.

**Un chiffre rigoureusement identique après un changement de réglage n'est pas
un résultat, c'est un symptôme.** Le premier réflexe est de vérifier que le
changement a bien atteint le fichier mesuré.

Et la règle qui l'évite : **un outil qui régénère un fichier partagé rend ce
qu'il n'a pas calculé.** Ici les couches sont relues avant écriture et
réinjectées.

## Une coupe vers une image d'une autre nature se lit comme un saut

Toutes les transitions d'un montage sont des coupes franches, et personne ne
les remarque — sauf la dernière, vers un carton de fin : image figée, floutée,
assombrie. Mesuré, c'était **l'écart entre deux images le plus fort du film,
110** quand la médiane du plan tournait autour de 8.

Un fondu de 0,25 s : **13,1**. Ce n'est pas la coupe qui gêne, c'est le
changement de **nature** de l'image — entre deux plans filmés une coupe passe,
vers un carton elle saute.

## Ce qui est écrit en temps source dérive quand la vitesse change

Un flash et une secousse posés à 5,375 s sur un plan ralenti à 0,8 tombaient
juste. Le ralenti retiré, ils sont tombés **1,08 s après** l'événement qu'ils
soulignaient — c'est-à-dire tout à la fin du plan, où un flash se lit comme un
saut d'image.

`flashs` et `tremblements` comptent en temps SOURCE, comme `depart` ; les
effets sonores comptent en temps de FRISE. **Deux repères dans la même recette,
et rien ne le signale.** Ils sont désormais dérivés des mêmes instants de rush
que le reste, par `caler_dragon.py`.

## Du code testé et injoignable passe pour du code livré

Trois fonctions du projet IPTV — l'import d'un panneau Xtream, le chargement
des épisodes d'une série, la lecture des fiches en base — étaient écrites,
commentées, couvertes par des tests verts. **Et appelées par personne.** Aucune
commande, aucun écran, aucune route n'y menait : la moitié des sources que
l'application prétend accepter était inatteignable.

Rien ne le signalait, et c'est le point. Une suite verte prouve qu'une fonction
fait ce qu'elle dit ; elle ne prouve jamais que quelqu'un l'appelle — le test
est justement l'appelant qui masque l'absence des autres. Un compte rendu
honnête sur le code peut donc décrire une fonctionnalité qui n'existe pas pour
l'utilisateur.

**Le contrôle tient en une commande, et il est brutal :**

```bash
grep -rn "maFonction" src/ | grep -v "le fichier qui la définit\|tests/"
```

Zéro résultat : ce n'est pas livré, quoi qu'en disent les tests.

À passer sur chaque fonction exportée d'un lot avant de l'annoncer fini. La
règle générale : **une fonctionnalité n'est livrée que lorsqu'un chemin y mène
depuis l'extérieur** — une commande, un bouton, une route. Le reste est du code
qui compile.

## Un défaut entendu à deux endroits éloignés vient de ce qui les traverse

« Ça sature au dragon, et un peu derrière le druide aussi. » Deux plans séparés
par huit secondes et par tout leur contenu. Leur seul point commun : le
**master**.

Mesuré en rendant deux fois la même chaîne, une fois **avec** le limiteur et une
fois sans, puis en comparant tranche par tranche : le limiteur écrasait
**44 tranches sur 389** de plus d'un décibel — et ses coups les plus forts
tombaient à **6,05 s** et **15,45–16,00 s**. Exactement les deux endroits
rapportés.

La cause : **+4,5 dB de grave à 85 Hz**. Sur un téléphone il ne s'entend pas —
il ne fait qu'y manger la marge, et c'est le limiteur qui rend la facture, sur
tout le reste du mixage. Ramené à +1,5 : **8 tranches**, et le niveau entendu
au-dessus de 400 Hz **gagne** 0,4 dB.

**Quand deux endroits sans rapport présentent le même défaut, arrêter de
regarder les endroits et regarder ce qui les traverse.**

Et la mesure qui tranche : **rendre deux fois, avec et sans le maillon
suspect**, puis comparer. Comparer avant/après master mêle l'égaliseur au
limiteur — un égaliseur donne aussi un gain différent selon le contenu, et
c'est ce qui m'avait fait lire 9,1 dB de « pompage » là où le limiteur n'en
faisait que 3,4.

## Fusionner souvent a un plafond, et il est invisible

La règle de ce dépôt est d'ouvrir la PR et de la fusionner dès qu'un lot tient
debout — c'est ce qui évite les conflits quand plusieurs sessions travaillent en
parallèle. Elle est juste, et elle a un coût que personne n'avait compté.

**Chaque fusion sur `main` déclenche un déploiement.** Le plan gratuit de Vercel
en autorise cent par jour. Mesuré le 29/08 : **154 fusions en vingt-quatre
heures**, donc cinquante-quatre déploiements refusés.

Le message arrive dans un commentaire de PR, jamais dans la conversation :

```
Resource is limited - try again in 24 hours
(more than 100, code: "api-deployments-free-per-day")
```

Et voilà ce que ça coûte, mesuré : le propriétaire a testé pendant deux heures
une version vieille de plusieurs heures. Il rapportait des défauts déjà corrigés,
et chaque « recharge de force » ne servait à rien puisque le serveur ne servait
pas la nouvelle version. Deux heures de travail des deux côtés, sur un défaut
qui n'existait plus.

Trois choses à en tirer :

- **Un correctif fusionné n'est pas un correctif livré.** Tant que le
  déploiement n'a pas abouti, dire « c'est corrigé, recharge » est faux — et
  fait douter la personne de son propre téléphone.
- **Compter les fusions du jour avant d'en promettre l'effet.**
  `git log --oneline --since="24 hours ago" origin/main | wc -l` répond en une
  seconde, et c'est le seul chiffre qui dit si ce qu'on vient de fusionner
  arrivera quelque part.
- **Au-delà du plafond, grouper.** Plusieurs lots dans une seule PR coûtent un
  déploiement au lieu de cinq. C'est le contraire de la règle habituelle, et
  c'est le bon geste ce jour-là seulement.
## Un drapeau ajouté « par précaution » est une panne à retardement

`node:sqlite` a demandé `--experimental-sqlite` sur les premières versions de
Node 22. J'ai donc posé le drapeau dans tous les scripts npm, sans le mesurer.

Vérifié après coup, sur Node 22.22 : **le module s'importe et fonctionne sans
aucun drapeau** — il émet seulement un avertissement. Le drapeau n'apportait
rien. Et il apportait un risque : Node **refuse de démarrer** sur une option
qu'il ne connaît pas (« bad option »), donc le jour où la version suivante
retire le drapeau devenu inutile, l'application ne démarre plus, sur un message
qui ne parle ni de SQLite ni de version. Sur une machine qu'on ne contrôle pas
— celle de quelqu'un qui vient d'installer la dernière LTS — c'est une panne
sans piste.

Le même projet en portait un **second**, `--experimental-strip-types`, et la
mesure a rendu le même verdict : `process.features.typescript` vaut déjà
`"strip"` sans lui dès Node 22.22, et le retrait des types est le défaut à
partir de 23.6. Deux drapeaux posés par prudence, deux fois inutiles, deux
pannes futures évitées de justesse.

**La règle : un drapeau expérimental se mesure avant d'être posé**, et se
remesure quand on change de version.

```bash
node -e "require('node:sqlite')"        # ça passe ? le drapeau est inutile
node --le-drapeau -e ""                 # code 0 ? il est encore accepté
```

Ce qui remplace un drapeau posé au hasard : `engines` dans `package.json`, qui
dit la version minimale réellement éprouvée et fait avertir npm au lieu
d'échouer dix commandes plus loin.

## `git stash pop && git commit` enterre un conflit au lieu de s'arrêter

Une reprise de branche courante — `stash push`, `checkout -B`, `stash pop`,
`add -A`, `commit` — enchaînée par `&&`. Le `pop` a laissé deux fichiers en
conflit, et il **rend malgré tout un code de sortie 0**. Le `&&` a donc passé la
main, `git add -A` a ajouté les marqueurs `<<<<<<<` comme du contenu ordinaire,
et le commit est parti avec eux. Poussé.

Rien ne l'a signalé : ni le `&&`, ni `git status` après coup (l'arbre est propre,
les marqueurs sont *commités*), ni la barrière de vérification — elle avait
tourné **avant** la reprise, sur un arbre alors sain. Le seul indice tenait dans
une phrase noyée dans la sortie : « The stash entry is kept in case you need it
again », qui veut dire « ça s'est mal passé ».

**La parade tient en une ligne, entre le `pop` et le `commit` :**

```bash
git diff --name-only --diff-filter=U   # non vide = conflit à résoudre
```

Et deux règles qui en découlent :

- **Ne jamais chaîner `stash pop` avec `add -A` par `&&`.** Le code de sortie ne
  dit pas ce qu'on croit ; c'est la liste des fichiers en conflit qui le dit.
- **Relancer la vérification APRÈS la reprise de branche**, pas avant. Une
  barrière verte sur l'arbre d'avant ne prouve rien sur celui qu'on pousse.

## Le HTML préconstruit de Next n'est pas une page servable

Un quota d'hébergeur épuisé, une page de vente à mettre en ligne le soir même,
et une idée qui paraît évidente : `next build` écrit déjà
`.next/server/app/index.html`, il suffirait de le servir en statique.

**Il s'affiche parfaitement et il est mort.** Mesuré dans Chromium, servi depuis
un sous-dossier comme le ferait GitHub Pages :

| | |
| --- | --- |
| ressources en échec | aucune |
| erreurs JavaScript | aucune |
| scripts chargés | 7 |
| charge RSC `__next_f` | présente |
| **React attaché au formulaire** | **non** |

Tout est vert sauf la seule chose qui compte. Le fichier est un artefact
interne du rendu serveur, pas ce que Next envoie au navigateur : l'hydratation
de l'App Router passe par le flux que le serveur compose à la requête, et le
recopier tel quel donne une page qui ressemble à l'originale et n'exécute rien.
Un formulaire y devient un décor.

**Ce qui trompe, c'est qu'aucune alarme ne se déclenche.** Pas de 404, pas
d'erreur en console, le style est là, le texte est là. On ne s'en aperçoit
qu'en cliquant — ou en vérifiant que React s'est attaché :

```js
Object.keys(document.querySelector('form')).some(k => k.startsWith('__react'))
```

**Les deux vraies sorties**, quand un hébergeur est indisponible : `output:
'export'` dans la configuration, qui exige de retirer les routes d'API — donc
un vrai choix de conception, pas une astuce — ou **changer d'hébergeur**.
Netlify et Cloudflare Pages construisent un Next.js complet, gratuitement, avec
ses routes serveur. C'était la réponse depuis le début, et une heure est passée
à contourner un quota au lieu de changer de mur.

## Le quota de déploiement est une ressource commune, et les sessions la vident

Un compte d'hébergeur gratuit plafonne les déploiements par **jour et par
compte** — cent chez Vercel. Ce dépôt reçoit plusieurs sessions en parallèle et
fusionne **95 pull requests dans la journée**, mesuré le 28/08/2026 : chacune
déclenche un déploiement d'aperçu, et le compteur est vidé par du travail qui
n'a rien à voir avec celui qui en a besoin.

**Le symptôme arrive au pire moment et ne ressemble pas à sa cause.** Ici :
« Resource is limited - try again in 24 hours ». Aucun rapport apparent avec
les vingt PR de montage vidéo qui l'ont consommé, et le projet qu'on cherchait
à mettre en ligne — une page de vente, la seule chose qui pouvait rentrer de
l'argent — reste bloqué vingt-quatre heures.

Trois choses à en retenir :

- **Un aperçu réussi ne prouve pas que le compteur est libre.** Un aperçu sur
  un projet existant peut passer à l'instant même où la création d'un nouveau
  projet est refusée. Conclure de l'un à l'autre a coûté un aller-retour, et un
  essai raté au propriétaire.
- **Chaque projet supplémentaire double la consommation.** Deux projets
  branchés sur le même dépôt, ce sont deux déploiements par PR.
- **On coupe les aperçus des projets qui n'en ont pas besoin.** Une application
  qui tourne dans le navigateur n'a aucune raison d'être déployée à chaque PR.

Et la sortie, quand le mur est là : **changer de mur.** Netlify et Cloudflare
Pages construisent un Next.js complet, gratuitement, avec ses routes serveur, et
sans toucher au quota de l'autre. Une heure est passée à contourner le plafond
avant d'y penser.

## `cd sous-dossier && …` saute silencieusement quand on y est déjà

Deux éditions perdues dans la même séance, sans un message d'erreur utile.

Le shell d'une session garde son répertoire d'un appel à l'autre. Une commande
qui commence par `cd nexuscrypto && python3 - <<'PY'` échoue donc au `cd` quand
on est **déjà** dans `nexuscrypto` — et le `&&` avale tout le reste. Le script
ne tourne pas, rien ne le dit, et la vérification qui suit passe au vert sur du
code inchangé.

C'est la conjonction qui trompe : l'erreur affichée est `cd: no such file or
directory`, qu'on lit comme un détail, alors qu'elle annule l'édition entière.

**La parade : des chemins absolus dans les scripts d'édition**, et `pwd` avant
de supposer où l'on est.

## Une secousse de caméra sur un plan qui bouge déjà se lit comme une panne

« Ça saccade au moment du cri du dragon. » Le son y était irréprochable —
aucune discontinuité, aucun écrêtage, enveloppe lisse.

C'était l'**image** : une secousse de caméra posée sur le rugissement faisait
passer le mouvement entre deux images consécutives de **16 à 40** pendant
0,35 s. Retirée, le maximum retombe à 23 — le mouvement propre du plan.

**Une secousse sert un plan immobile.** Sur une bête qui hurle et bouge déjà
violemment, elle ne renforce rien : elle brouille, et le brouillage se lit
comme un défaut de lecture.

## Un événement de l'image sans son ne se remarque pas, il se ressent

Des éclairs sortent des yeux du personnage principal, et **aucun bruitage ne
les accompagnait** — le premier arrivait 1,2 s plus tard. Personne ne dit « il
manque un son à 5,42 s » ; on dit « on n'entend pas les éclairs », et seulement
après avoir vu la vidéo cinq fois.

Ça se trouve en relevant les événements **de l'image** :

```python
clairs = [(x > 200).sum() for x in images]   # pixels tres clairs
# une apparition = un facteur 2 ou plus d'une image a la suivante
```

Mesuré : 713 → 2864 pixels en trois images, puis 16 782 sur une seule. Deux
événements majeurs du film, zéro son.

**Faire la liste des événements de l'image, puis pointer le son qui répond à
chacun.** Le montage se construit dans ce sens-là, jamais l'inverse.

## Un `<textarea>` rendu en un seul `<p>` perd tout ce que l'auteur a aéré

Mesuré sur le générateur de TITAN Builder : une présentation d'artisan écrite
en deux paragraphes sortait en un pavé de six lignes sur un téléphone. Le
défaut n'était visible ni dans les tests — tous leurs textes tenaient sur une
ligne — ni dans une mesure : le HTML était valide, l'échappement correct, la
chaîne complète. Il ne s'est vu qu'à l'écran.

La cause est que HTML ignore les retours à la ligne. Un champ multiligne
recueilli par un formulaire les contient forcément, et les rendre bruts revient
à supprimer la mise en forme que la personne a prise la peine de faire.

**Le découpage juste distingue les deux retours**, et c'est là que se logent
les implémentations trop rapides : une ligne vide sépare deux paragraphes, un
simple retour au milieu d'une phrase n'en sépare aucun — il devient une espace.
Découper sur `\n` seul fabrique un paragraphe par ligne et casse les phrases
que l'auteur a juste fait tenir dans la largeur de son écran.

```ts
texte.split(/\n\s*\n/).map((p) => p.trim().replace(/\s*\n\s*/g, ' ')).filter((p) => p !== '')
```

**Et la leçon plus générale : un texte libre se regarde rendu.** Un test qui
n'éprouve que des valeurs d'une ligne ne peut pas voir ce défaut-là, quel que
soit leur nombre.

## Une page de démonstration doit se dire telle sur la page

Un faux numéro et un nom inventé protègent le dépôt du faux témoignage. Ils ne
protègent pas le prospect qui reçoit le lien : rien, à l'écran, ne distinguait
la démonstration d'un vrai client. La mention doit être **dans le contenu de la
page**, pas seulement dans la documentation qui l'accompagne — celle-là, le
prospect ne la lit jamais.

## Une couleur choisie par l'utilisateur ne peut pas décider seule de la lisibilité

Mesuré sur le générateur de TITAN Builder : `#ffd400` avec du blanc dessus donne
**1,43:1**. Le seuil lisible est 4,5:1, et la page se lit sur un chantier, au
soleil, sur un téléphone à moitié assombri par le système.

Le piège n'est pas la couleur, c'est la **paire fixe** : dès qu'un produit
laisse choisir un fond et code le texte en dur, il existe un choix qui rend la
page illisible, et personne ne le voit tant que personne ne fait ce choix-là.

La sortie tient en deux gestes, et le second compte autant que le premier :

1. **Choisir l'encre par le calcul**, blanc ou sombre selon laquelle contraste
   le plus avec la couleur reçue. Sur un bleu profond c'est le blanc, sur un
   jaune c'est l'encre sombre.
2. **Ne pas réutiliser un fond comme couleur de texte.** La même teinte qui
   porte un titre en fond disparaît quand elle devient le texte d'un bouton sur
   du papier blanc. Il en faut une variante déplacée vers le noir — ou vers le
   blanc en thème sombre, ce qu'on oublie une fois sur deux.

**Et ce qu'aucun exemple ne prouve : le seuil doit être éprouvé sur la roue
entière.** Les teintes qui échouent ne sont ni les vives ni les sombres, ce sont
les **moyennes** — un gris-vert, un orange terne — où *aucune* des deux encres
n'atteint 4,5:1. Un test sur trois couleurs bien choisies passe et ne prouve
rien ; vingt-neuf teintes par pas de 15° coûtent 4 ms.

## Un contrôle qui cherche dans tout le fichier ne garde aucune de ses sections

`verifier-coherence.py` contrôlait qu'un projet installable apparaisse « dans le
hook de démarrage » — en cherchant son nom dans le texte entier du script. Le
hook fait pourtant deux choses distinctes : il **installe** les dépendances, et
il **affiche** la commande de vérification de chaque projet.

`paper-manager` avait la première et pas la seconde. Le contrôle était vert :
le bloc d'installation suffisait à rendre le nom présent quelque part. Ses 259
tests passaient, la CI les découvrait, `verifier.sh` aussi — rien n'était cassé,
le projet était juste **invisible** dans la liste que lit la session suivante
pour savoir comment éprouver ce qu'elle touche. Un défaut qui ne rougit nulle
part et qu'on ne cherche pas, puisqu'on ignore la suite qui manque.

La parade tient en une ligne de code : borner la recherche à la section
concernée plutôt qu'au fichier.

```python
bloc = re.search(r"^commandes=\((.*?)^\)", texte, re.S | re.M)
annonce = bloc.group(1).lower()   # et non texte.lower()
```

La règle générale, elle, dépasse ce script : **quand un fichier a plusieurs
sections qui remplissent des rôles différents, un contrôle qui grep le tout
n'en garde aucune.** Il passe dès que le nom apparaît une fois, ce qui est
précisément la situation où l'oubli est le plus probable — on a rempli une
section, pas l'autre. Le symptôme trompe : le contrôle est vert *et* il a
raison de l'être sur la question qu'il pose ; c'est la question qui est trop
large.

Corollaire mesuré le même jour : une table de contrôles qui s'écrit à la main
à côté du code se périme au premier ajout. Celle de `/coherence-depot` avait
neuf lignes pour dix contrôles — le dixième, ajouté quelques jours plus tôt,
n'y était jamais entré. Un outil qui existe pour détecter les listes fausses en
portait une.
