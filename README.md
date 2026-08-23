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

Les captures d'écran et le fichier exporté atterrissent dans `.fixtures/captures/`.
