# amorce

Studio de montage vertical pour vidéos IA. On dépose ses rushes, on obtient un
clip prêt à publier : plans courts, transitions, bruitages, sous-titres incrustés,
étalonnage cinéma — et une note de viralité qui dit ce qui fera décrocher.

**Tout se passe dans le navigateur.** Aucun fichier n'est envoyé sur un serveur :
pas de stockage à payer, pas de rushes qui traînent sur une machine tierce.

## Démarrer

```bash
npm install
npm run dev
```

Puis <http://localhost:3000>, de préférence sous Chrome ou Edge — ce sont les
seuls navigateurs qui enregistrent directement en MP4. Firefox fonctionne aussi,
mais produit du WebM.

## Sur téléphone

Le studio est utilisable au doigt, en une colonne : l'aperçu occupe le haut de
l'écran, les étapes se rangent dans une barre d'onglets en bas, et le panneau de
l'étape choisie prend sa place sous l'aperçu plutôt que de le recouvrir.

Deux mécanismes rendent le montage tenable sur un appareil modeste.

**L'aperçu s'adapte tout seul.** Composer une image en 1080 × 1920 avec grain et
halo coûte cher. La définition d'aperçu est donc réduite tant que l'appareil ne
suit pas, et remonte quand il le peut. La composition reste écrite en
coordonnées de sortie — seule une transformation d'échelle est posée sur le
contexte — si bien que positions, corps de police et proportions restent exacts
à tous les paliers. **Le fichier exporté n'est jamais concerné.**

**Un palier trop lourd est abandonné de force.** Un choix manuel prime
normalement sur l'ajustement automatique. Mais au-delà d'un certain seuil, la
boucle de rendu accapare le fil principal au point que l'interface ne répond
plus : l'utilisateur ne peut alors même plus atteindre le réglage qui l'a mis
dans cet état. Mesuré sur un téléphone bridé, l'aperçu tombait à 4,5 images par
seconde. Dans ce cas seulement, l'application reprend la main — et le dit.

L'export propose enfin une définition allégée en 720 × 1280. L'enregistrement se
faisant en temps réel, un appareil qui ne tient pas la cadence perd des images :
sur le téléphone de référence, la sortie en 1080 produisait un fichier de 0,07 Mo
au son quasi inaudible, contre 0,11 Mo et un son normal en 720.

## Le parcours

L'interface est numérotée de 1 à 7 plutôt que de présenter tous les outils à
plat. Un débutant suit l'ordre ; un habitué clique directement sur l'étape qui
l'intéresse.

1. **Importer** — dépose les rushes. Le bouton *Montage express* assemble seul un
   projet complet, à retoucher ensuite.
2. **Monter** — ordre des plans, points d'entrée et de sortie, vitesse,
   transition entrante, mouvement de caméra.
3. **Accroche** — le texte des trois premières secondes, avec dix formules
   éprouvées et l'explication de ce qui les fait fonctionner.
4. **Son** — bruitages et musique de fond.
5. **Cinéma** — étalonnage, grain, vignettage, halo, bandes.
6. **Analyser** — note sur 100, courbe de tension, liste de ce qu'il faut
   corriger.
7. **Exporter** — le fichier, en 1080 × 1920 à 30 images par seconde.

## Ce que l'analyse mesure

La note porte sur la **structure** du montage, pas sur le contenu des images. Elle
ne sait pas si le plan est beau ni si la punchline est drôle ; elle repère ce qui
fait décrocher mécaniquement — un début mou, un plan qui traîne, un trou de
plusieurs secondes sans rien pour relancer l'attention.

| Critère | Poids | Ce qui est mesuré |
| --- | --- | --- |
| Hook | 30 | Texte d'accroche, première coupe et impact sonore dans les 3 premières secondes |
| Rythme | 20 | Durée moyenne des plans et longueur du plus long |
| Tension | 20 | Absence de retombées d'attention de plus de 2,5 s |
| Sous-titres | 15 | Part de la vidéo couverte par du texte |
| Son | 10 | Densité de bruitages, présence d'une musique |
| Format | 5 | Durée totale et cadrage des sources |

Durée conseillée : **15 à 30 secondes**, 60 au maximum. Ce qui décide de la
distribution est le taux de complétion, et il s'effondre avec la longueur.

## Choix techniques

**Un seul chemin de rendu.** `renderFrame` est le seul endroit qui sait à quoi
ressemble une image du montage. La prévisualisation et l'export l'appellent tous
les deux : ce qui est affiché est, par construction, ce qui sera enregistré.

**Un élément vidéo par clip, et non par fichier source.** Deux clips peuvent
découper le même rush et se chevaucher pendant une transition ; un élément
partagé ne pourrait pas être à deux positions de lecture à la fois.

**Les transitions consomment du temps.** Le clip entrant démarre avant la fin du
précédent. Une transition ne peut dépasser 45 % du plus court des deux plans, ce
qui garantit qu'au plus deux clips sont visibles simultanément — invariant sur
lequel le moteur de rendu s'appuie pour ne jamais composer plus de deux couches.

**Les bruitages sont synthétisés.** Aucun fichier audio n'est embarqué : tout est
fabriqué à la volée avec des oscillateurs et du bruit filtré. Pas de bibliothèque
à héberger, pas de question de licence.

**L'export enregistre la prévisualisation en temps réel.** Trente secondes de
vidéo prennent trente secondes. C'est plus lent qu'un rendu hors ligne, mais cela
supprime toute possibilité d'écart entre ce qui a été validé à l'écran et ce qui
atterrit dans le fichier.

**Le temps écoulé n'est pas borné pendant un export.** Il l'est le reste du
temps, pour absorber une mise en veille ou un onglet passé en arrière-plan qui
feraient bondir la tête de lecture. Mais si une image prend plus longtemps que
cette borne, la lecture avance moins vite que le temps réel : le fichier
s'allonge — vingt secondes mesurées pour un montage de sept — pendant que le son
continue, lui, en temps réel. Sans borne, un appareil lent perd des images mais
conserve la bonne durée et la bonne synchronisation.

**Le texte est tracé après l'étalonnage**, donc jamais grainé ni assombri : en
format court, la lisibilité prime sur la cohérence esthétique.

## Vérifier

```bash
npm run typecheck   # types
npm run lint        # style et règles React
npm test            # calcul de la timeline, notation, étalonnage
```

L'essentiel du studio ne peut pas être testé hors d'un navigateur — décodage
vidéo, mixage audio, tracé sur canvas, enregistrement. Un second niveau pilote
donc l'application pour de vrai et contrôle le résultat sur les pixels et sur le
signal sonore :

```bash
npm run fixtures    # fabrique quatre rushes de test (aucun binaire versionné)
npm run dev         # dans un autre terminal
npm run verify      # importe, monte, lit, étalonne, exporte, puis rejoue le fichier
```

`verify` exécute deux profils à la suite : un ordinateur, puis un téléphone dont
le processeur est volontairement bridé quatre fois. Sans ce bridage, la
dégradation automatique de qualité ne se déclencherait jamais sur une machine de
développement et ne serait donc jamais éprouvée.

Les captures d'écran et les fichiers exportés atterrissent dans
`.fixtures/captures/`.
