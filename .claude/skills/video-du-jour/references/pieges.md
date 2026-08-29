# Les pannes qui ne lèvent aucune erreur

Chaque entrée a été rencontrée pour de vrai, et chacune a coûté du temps parce
que rien ne signalait le problème. Elles sont rangées par le moment où elles
frappent.

Le fil commun : **une chaîne vidéo échoue en silence.** Un décodeur qui rend du
noir, un muxeur qui horodate faux, un recadrage qui jette le sujet — aucun ne
lève d'exception. C'est pourquoi tout le parcours se termine par une mesure sur
les pixels et par une planche-contact qu'on regarde.

## Sommaire

- [À l'import](#à-limport)
- [Au rendu](#au-rendu)
- [À l'enregistrement](#à-lenregistrement)
- [Au cadrage et au texte](#au-cadrage-et-au-texte)
- [Sur la voix](#sur-la-voix)
- [Dans l'environnement](#dans-lenvironnement)
- [Autour du dépôt](#autour-du-dépôt)

---

## À l'import

### Une image fixe est refusée par le studio

**Symptôme** — « Format non pris en charge » sur un PNG parfaitement valide, ce
qui envoie chercher un problème d'encodage inexistant.

**Cause** — Le studio n'acceptait historiquement que de la vidéo :
`accept="video/*"` sur le sélecteur, et un import qui décode avec un élément
`<video>`. Corrigé depuis, mais le symptôme réapparaît sur toute branche
antérieure.

**Ce qu'il faut savoir** — Une image fixe n'a ni son, ni tête de lecture, ni
durée propre. Trois chemins la confondent avec un rush et cassent en silence :
le plafond de décodeurs, le graphe audio, et le montage express. Voir
l'invariant n° 3 dans `CLAUDE.md`.

### Un fichier arrive vide, à zéro octet

**Symptôme** — Import refusé, message d'encodage, alors que le fichier s'ouvre
normalement ailleurs.

**Cause** — Sur Android, le sélecteur rend un fichier encore dans le nuage sans
l'avoir téléchargé. Le fichier est bon ; c'est la copie qui manque.

**Solution** — L'ouvrir une fois depuis le gestionnaire de fichiers, ou passer
par le bouton *Partager*, qui transmet les octets réels.

### Un HEIC ne se décode pas

**Symptôme** — Une photo d'iPhone refusée sans motif clair.

**Cause** — Aucun navigateur de bureau ne décode le HEIC. Le fichier n'est pas
en cause.

**Solution** — Le convertir en JPEG en amont. Le routage doit tout de même
reconnaître l'extension comme une image, sinon elle part dans la voix off — une
erreur bien plus déroutante qu'un refus.

## Au rendu

### L'export sort noir au-delà de six plans

**Symptôme** — Le montage s'ouvre, annonce la bonne durée, et n'affiche rien.

**Cause** — Un navigateur Android n'accorde que six à huit décodeurs vidéo
simultanés. Au-delà, les plans supplémentaires ne produisent aucune image et
rien n'est signalé. D'où `DECODEURS_MAX` et un pool qui ne garde chargés que les
plans proches de la tête de lecture.

**À retenir** — Ce plafond ne concerne que les rushes. Une image fixe est
portée par un `<img>` et ne mobilise aucun décodeur : la compter dans le
plafond ferait évincer des plans gratuits, et un défilé d'illustrations
clignoterait en rechargeant sans cesse les mêmes fichiers.

### Le son disparaît au premier plan d'image fixe

**Symptôme** — Une vidéo entièrement muette dès qu'un plan fixe est présent.

**Cause** — Brancher une source Web Audio sur un `<img>` lève, et l'exception
emporte le reste du mixage.

**Solution** — Le graphe audio passe par un accesseur qui ne rend que les
éléments `<video>` (`getVideo`), jamais l'accesseur générique.

### Chaque raccord passe par du noir

**Symptôme** — La vidéo clignote à chaque coupe. Invisible sur une image fixe,
flagrant à la lecture.

**Cause** — Le plan sortant cesse d'être tracé à l'instant exact où l'entrant
commence son fondu à zéro. Le fondu ne se fait plus entre deux images mais entre
une image et du noir.

**Solution** — Le plan sortant reste tracé pendant toute la durée de la
transition. Les plans étant dessinés dans l'ordre, l'entrant se pose par-dessus
— deux couches au plus, jamais davantage.

## À l'enregistrement

### Le fichier est trois fois trop court

**Symptôme** — 3,7 s annoncées pour 10,8 s composées. La piste audio, elle, a
la bonne durée.

**Cause** — `canvas.captureStream(fps)` capture automatiquement. En rendu
logiciel, composer une image de 1080 × 1920 coûte souvent plus que le tiers de
seconde alloué : le muxeur horodate alors à la cadence nominale et le fichier
sort à la fraction correspondante.

**Solution** — `captureStream(0)` puis `track.requestFrame()` après chaque
dessin, la boucle cadencée sur l'horloge réelle. On perd des images sur une
machine lente ; on ne perd jamais la durée ni la synchronisation.

### Le lecteur annonce une durée fausse

**Symptôme** — Un contrôle automatique conclut à un fichier tronqué alors qu'il
est complet.

**Cause** — Un MP4 écrit à la volée par `MediaRecorder` ne porte pas de durée
fiable dans son en-tête. `video.duration` dans un navigateur lit alors n'importe
quoi.

**Solution** — Sonder avec `ffmpeg`, pas avec un élément `<video>`. Le
réencodage réécrit une durée exacte au passage. **Attention** : ce piège fait
conclure à un défaut inexistant — vérifier avant de « corriger » quoi que ce
soit.

### Le MP4 contient du VP9 et de l'Opus

**Symptôme** — `MediaRecorder.isTypeSupported('video/mp4')` répond oui, mais le
fichier est refusé ou mal transcodé par les plateformes.

**Cause** — Chromium accepte le conteneur MP4 et y range les codecs qu'il a
sous la main, qui ne sont pas ceux qu'attend un MP4.

**Solution** — Réencoder systématiquement en H.264 + AAC. Ce n'est pas une
précaution : c'est la seule combinaison qu'une plateforme ingère sans y toucher.

### L'enregistrement sort muet

**Cause** — Le contexte audio reste suspendu tant qu'aucun geste utilisateur
n'a eu lieu, et rien ne le signale.

**Solution** — Lancer le navigateur avec
`--autoplay-policy=no-user-gesture-required`.

## Au cadrage et au texte

### Un rush porte des sous-titres gravés dans l'image

**Symptôme** — Un titre traverse le visage du sujet, ou se pose sur la gueule
d'une créature. Il ne vient d'aucun calque du montage, et aucun réglage ne le
déplace.

**Cause** — Les générateurs vidéo incrustent le texte du prompt dans les
pixels. Ce n'est pas une piste de sous-titres : c'est de l'image.

**Ce qui ne marche pas, et il faut cesser de l'essayer.** Trois voies ont été
épuisées sur un même plan avant d'être écartées :

- **`delogo`** interpole depuis le bord de sa boîte. Sur un logo de coin il est
  parfait ; sur des lettres de 100 px de haut et pleine largeur, la boîte est
  trop grande pour que l'interpolation ait de quoi travailler — le texte reste
  lisible en fantôme et un filage vertical apparaît.
- **Le flou local** moyenne une bande souvent sombre : le résultat est une
  bande quasi noire, donc exactement la dalle qu'on cherchait à éviter.
- **Le rapiéçage** — recopier la même bande prise à un instant sans texte —
  échoue pour une raison qu'aucun raisonnement ne donne à l'avance : **ces
  rushes portent une suite de sous-titres**, pas un seul. Mesuré sur un plan de
  7,5 s : « RIFT ZERO FIVE », puis « BREACH OPEN », puis un titre. La bande
  n'est jamais propre, à aucune image.

**Solution — deux, selon ce que le texte recouvre.**

**Quand il est sur le sujet** : le recouvrir d'une plaque au noyau
**parfaitement opaque**, et y écrire autre chose plutôt que rien. Une plaque
vide se lit comme une panne ; une plaque qui porte une phrase se lit comme un
carton. Lui donner la même forme partout dans le film : répétée, elle devient
un système ; isolée, elle reste une rustine.

**Quand le plan bouge** : l'incrustation, elle, ne bouge pas. Un travelling
avant la promène sur le cadre — poitrail, puis mâchoire. Il suffit alors de
**terminer le plan avant qu'elle n'arrive au mauvais endroit**, en fondu image
et son. C'est la correction la moins chère et la seule qui ne laisse aucune
trace.

**La contrainte qui décide entre les deux** : chercher à quel moment le texte
apparaît. S'il naît en même temps que le geste que le plan raconte — des yeux
qui s'embrasent, une explosion — couper avant supprime le paiement du plan, et
il faut recouvrir. Sinon, couper.

### Le sujet est coupé, ou absent

**Symptôme** — Il ne reste qu'un fond, une croupe, un museau tranché au bord.

**Cause** — Le recouvrement 9:16 centre. Sur une image large dont le sujet
n'est pas au milieu, il garde exactement ce qui n'intéresse personne.

**Solution** — Mesurer d'abord la part de largeur qui survit ; en dessous de
60 %, choisir un ancrage et **regarder plusieurs essais**. Un sujet plus large
que le cadre ne rentrera pas : il faut décider ce qu'on garde, et pour un être
vivant c'est la tête.

### Un panoramique coupe un sujet qui tenait

**Cause** — Le balayage impose un sur-cadrage de 10 % pour ne pas découvrir de
vide sur le bord vers lequel il va. Ce sur-cadrage rogne l'image.

**Solution** — Panoramique seulement sur ce qui a de la marge. Sur un sujet
serré, un zoom lent donne du mouvement sans rien perdre.

### Un texte incrusté dans l'image se retrouve tronqué

**Symptôme** — « HYPERSENSIBLE, HUMOUR ET BIENVEILLANCE » devient « HUMOUR ET
BIENV ».

**Solution** — Écarter l'image, ou cadrer au-dessus du bandeau au prix d'un
cadrage plus serré. Un texte étranger tronqué est pire qu'un cadrage moyen, et
il se bat de toute façon avec les textes du montage.

### Le texte est illisible sur un téléphone

**Cause** — Une taille choisie en regardant un aperçu de 270 px de large. Sur
un canevas de 1080, un corps de 96 px paraît confortable et ne l'est pas.

**Repères** — Accroche : 130 à 140 px. Sous-titres : 75 à 85 px. Liseré noir à
26 % du corps, sans quoi le blanc disparaît sur une image claire.

### Un texte apparaît pendant un flash blanc

**Solution** — Le décaler après la transition. Gris sur blanc ne se lit pas, et
le dernier carton est ce que le spectateur emporte.

### Une coupe de ligne automatique casse une formule

**Symptôme** — « 1 an · 1 / vidéo par jour ».

**Solution** — Écrire la coupe à la main avec un retour à la ligne. Le retour
automatique est grammaticalement correct et visuellement raté.

## Sur la voix

### Un silence en tête de prise

Il tombe dans les trois secondes qui décident si le spectateur reste. C'est le
seul silence qui coûte vraiment ; celui de fin ne fait qu'allonger le fichier.

### Un raccord de coupe s'entend

**Cause** — Coller deux morceaux net dans un silence fait un trou : un silence
enregistré porte le souffle de la pièce, ce n'est pas du vide.

**Solution** — Croiser les deux bords sur environ 60 ms, et poser un fondu de
10 ms aux extrémités du fichier pour éviter le clic.

### Une phrase est devenue fausse depuis l'enregistrement

**Solution** — La couper plutôt que de tout réenregistrer. Une vidéo plus
courte se termine plus souvent, et le taux de complétion décide de la
distribution. Réenregistrer coûte une prise, un raccord audible si la pièce a
changé, et souvent une soirée.

## Dans l'environnement

### Playwright ne trouve pas son navigateur

**Symptôme** — « Please run the following command to download new browsers »
alors qu'un Chromium parfaitement utilisable est installé.

**Cause** — Playwright cherche la révision exacte qu'attend sa version.

**Solution** — Passer `executablePath`. Les emplacements connus sont testés
dans `scripts/outils.mjs` ; `AMORCE_CHROMIUM` permet d'en imposer un.

### ffmpeg refuse un MP3 valide

**Symptôme** — « Invalid data found when processing input » sur un fichier que
`file` identifie correctement.

**Cause** — Le `ffmpeg` livré avec Playwright est amputé : ni démuxeurs, ni
encodeurs. Il ne sert qu'à ses propres captures.

**Solution** — Installer `ffmpeg-static`. C'est ce que fait `cheminFfmpeg`.

### « Failed to fetch » depuis une page locale

**Cause** — Une page ouverte en `file://` n'a pas le droit de `fetch` ses
voisines, et le message ne dit rien du schéma d'URL.

**Solution** — Servir le dossier en HTTP le temps du rendu.

## Autour du dépôt

### « GitHub access is not enabled for this session »

**Symptôme** — `POST https://api.github.com/repos/…/pulls` répond 403, alors
que l'application GitHub est bien installée sur le compte et que `git push`
passe sans broncher.

**Ce que ça ne veut pas dire** — que la voie est fermée. Le jeton n'est pas
dans l'environnement, il est derrière le **serveur MCP GitHub** : ce sont les
outils `mcp__github__*` qui ouvrent, suivent et fusionnent une PR. Appeler
`api.github.com` au `curl` ou par la commande `gh` échouera toujours.

**Donc, dans l'ordre** — chercher `mcp__github__create_pull_request`. S'il
répond, c'est la bonne voie et il n'y a rien d'autre à faire.

**S'il n'existe pas dans la session** — et il arrive qu'il ne soit pas rattaché
— alors seulement : pousser la branche et laisser fusionner à la main, en
commit de fusion, jamais en squash. Le dire en nommant la vraie cause : « le
serveur MCP GitHub n'est pas rattaché à cette session », et non « GitHub est
inaccessible ». Les deux phrases mènent à des réactions très différentes, et la
seconde envoie chercher dans des réglages qui ne sont pas en cause.

**Avant de rendre la main** — vérifier que la branche se fusionne proprement
avec `git merge-tree --write-tree origin/main <branche>` et le dire. « Un tap,
zéro conflit » évite une inquiétude inutile.

### La fusion locale est refusée

**Symptôme** — `git merge` bloqué par le garde-fou de permissions, alors même
que `CLAUDE.md` autorise explicitement à fusionner.

**Ce qu'il faut faire** — Le dire simplement, pousser la branche, donner le
chemin exact dans l'interface. Ne pas contourner, ne pas réessayer en boucle.

### Le dépôt bouge pendant qu'on travaille

Plusieurs sessions en parallèle : `main` peut avancer de vingt commits en une
soirée. Refaire `git fetch` et repartir de `origin/main` avant de pousser.
