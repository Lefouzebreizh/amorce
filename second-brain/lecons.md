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
