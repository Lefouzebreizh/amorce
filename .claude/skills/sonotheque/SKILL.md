---
name: sonotheque
description: Constituer et tenir la bibliothèque de bruitages du dépôt — dragons et créatures, impacts, whooshes, magie, foules, ambiances — puis choisir dans le lot la prise qui portera vraiment. Mesure chaque son sur trois critères éliminatoires et écarte ce qui ne peut pas marcher, avant toute écoute. À utiliser dès qu'une demande dit « il me faut un cri de dragon », « un son de créature », « quels bruitages j'ai », « cette prise est utilisable ? », « range mes sons », « trouve-moi un impact », « j'ai téléchargé des sons », « on n'entend pas le monstre », « le rugissement sonne faux » — et dès que des fichiers audio arrivent en vrac. À utiliser aussi **avant** de synthétiser quoi que ce soit : une synthèse de rugissement fabrique un orgue, pas une gorge, et ce piège a coûté une nuit entière. Ici on **choisit et range** le matériau ; pour le fabriquer et le mixer c'est `/bande-son`, pour juger un fichier déjà mixé `/voir-le-son`, pour sortir au niveau d'un téléphone `/master-telephone`.
---

# Un dossier de bruitages ment par omission

Quatre prises du même mot-clé s'y rangent côte à côte, et rien ne distingue
celle qui portera d'une qui sera inaudible. **L'écart mesuré entre la meilleure
et la pire atteint couramment vingt décibels** sur la bande qu'un téléphone
restitue.

D'où l'index, qui écarte avant l'écoute :

```bash
python3 kits/sfx/indexer.py
```

Il range dans `kits/sfx/<famille>/` — `dragons`, `impacts`, `whooshes`,
`magic`, `crowds`, `atmos` — et écrit son verdict dans
`second-brain/sound_index.json`. **Il ne remplace pas l'oreille** : il retire
ce qui ne peut pas marcher, ce qui laisse l'oreille juger de ce qui reste.

## Les trois critères, et l'échec dont chacun vient

| critère | seuil | pourquoi |
| --- | --- | --- |
| sonie | **−20 LUFS** | un impact qu'il faut remonter de dix décibels remonte son bruit de fond avec lui |
| énergie > 400 Hz | **−22 dB** | c'est la limite basse d'un haut-parleur de téléphone : en dessous, le son est *absent*, pas discret |
| durée | selon la famille | une queue est ce qui donne sa taille à une bête ; un impact, lui, **doit** être bref |

La durée n'a pas de seuil unique, et c'est une correction payée : un seuil à
1,2 s écartait un pas de titan de 0,85 s. Un impact est perçu comme un choc
*parce qu'il* est court. Les seuils sont donc par famille — 1,5 s pour un
dragon, 0,5 s pour un impact.

## Le cri de créature : la seule sortie est le matériau

Ceci a coûté une nuit et six versions rejetées, alors autant l'écrire net.

**La synthèse fabrique un orgue, pas une gorge.** Un grondement construit par
pile d'harmoniques dessine des bandes parallèles au spectrogramme, et l'oreille
l'entend comme un orgue. Désaccorder les rangs de un ou deux pour cent n'y
change rien. `montage-auto/cri_dragon.py` va plus loin — il synthétise un
appareil vocal, avec formants mobiles et sous-harmonique — et **reste en
dessous d'une vraie prise**. Il sert à combler un trou en sachant de combien on
est en dessous, jamais à remplacer.

**Et ne garder que des prises graves échoue autrement.** Saturer un grave pur
pour lui fabriquer les harmoniques qu'un téléphone restitue recrée exactement
le même peigne, puisqu'un grondement basse fréquence est lui-même presque
harmonique.

**Ce qu'il faut chercher dans un lot**, et c'est mesurable : la prise qui porte
**déjà du vrai aigu** — du feulement, du souffle rauque, du grattement de
gorge — c'est-à-dire de l'énergie au-dessus de 400 Hz *sans traitement*. Une
seule suffit : on la décline transposée vers le bas, transposée vers le haut,
ralentie. Mesuré sur un dragon : **−13,0 / −12,4 / −12,8 / −13,4 dB de tenue
sur trois secondes**, contre onze décibels d'affaissement par toutes les autres
méthodes.

Les prises graves ne sont pas à jeter : elles servent au **poids**, filtrées
sous 400 Hz, là où elles vivent. Elles ne portent jamais le cri.

## Ce qu'on demande à un humain d'aller chercher

Aucune banque de sons n'est joignable depuis une session distante. Mesuré :
`freesound.org`, `cdn.freesound.org` et `archive.org` rendent tous `000` — le
mandataire refuse le tunnel, il n'y a pas même de réponse HTTP. Seul GitHub
répond, et il n'héberge pas de banque de cris.

**Reconfirmé le 01/09/2026, clé en main.** Le propriétaire a créé des
identifiants d'API Freesound ; les trois hôtes rendent toujours `000`, et la
route `/apiv2/search/text/` avec eux. **Une clé ne débloque rien** tant que
`*.freesound.org` n'est pas dans la politique réseau de l'environnement.

Ce que la mesure a appris en passant, et qui vaut au-delà de Freesound :

- **Les noms de variables sont `FREESOUND_API_KEY`, `FREESOUND_CLIENT_ID` et
  `FREESOUND_CLIENT_SECRET`.** Le premier suffit presque toujours : le client
  officiel du MTG lit `os.getenv('FREESOUND_API_KEY')` dans ses propres
  exemples, et l'authentification par jeton ouvre la recherche, les
  métadonnées et les fichiers d'écoute. Les deux autres ne servent qu'au flux
  OAuth2, seul chemin vers les **originaux en pleine qualité** — et le client
  prévient qu'il faut l'implémenter soi-même.
- Sur la page de crédentiels de Freesound, le champ est étiqueté « Client
  secret / Api key » : **c'est la même chaîne**, ce qui explique qu'on croie
  avoir deux valeurs quand on n'en a qu'une à poser.
- **⚠️ `freesound-python` sur PyPI est un squat de « dependency confusion »** —
  son propre résumé le dit, auteur `nvk0x`, version 0.1. Le vrai client du MTG
  **n'est pas publié sur PyPI** : il vit sur GitHub, et se lit très bien par
  `raw.githubusercontent.com` sans rien installer. Le seul portage plausible y
  est `freesound-api`, qui se déclare clone et pointe vers son dépôt.

**La leçon générale : un nom de paquet qui ressemble au dépôt officiel n'est
pas le paquet officiel.** Lire la source depuis GitHub coûte une requête et
n'exécute rien ; `pip install` exécute du code d'installation avant qu'on ait
lu une ligne.

Le matériau vient donc de l'extérieur, et la demande doit être **précise** :

- **À chercher** : « tiger snarl », « lion growl close », « bear roar » — les
  prises rapprochées, où on entend la gorge.
- **À éviter** : « cinematic boom », « deep impact », « sub drop », « deep
  monster rumble ». C'est du grave pur : ça ne portera pas le cri, et ça ne
  sert qu'au poids.
- **Gratuit et légal** : Pixabay Sound Effects (sans compte, usage commercial
  libre), la bibliothèque audio de YouTube, les effets intégrés de CapCut.

Demander « un rugissement de lion » ne suffit pas. Demander « une prise
rapprochée où on entend le souffle et la gorge » donne un lot exploitable du
premier coup.

## Le piège qui annule tout le reste

**Ne jamais poser un cri sur un rush qui porte déjà le sien.** Deux
rugissements décalés ne s'additionnent pas, ils battent — et l'oreille rapporte
ce battement comme une saturation qu'aucune mesure de niveau ne voit. Relever
d'abord les événements du rush, et ne poser que ce qui lui manque.

## Poser les sons sur un montage

Une fois le lot trié, `montage-auto/couches_audio.py` les pose sur un montage
déjà mixé, avec leurs instants, leurs gains et leur esquive — et il mesure ce
qu'un téléphone en restitue. C'est lui qui porte l'excitation harmonique, la
parade qui rend un grave audible sans le remonter.
