---
name: tailwind-mobile-ux
description: Régler l'affichage tactile vertical d'Amorce pour un smartphone Xiaomi (HyperOS/MIUI, Chrome Android, écran ~20:9) — hauteur utile réelle, barre de gestes, zone du pouce, cibles tactiles, gestes qui entrent en conflit avec le défilement, assombrissement automatique de Chrome, taille de police système. À utiliser dès qu'une demande parle de téléphone, de mobile, de tactile, de portrait, de « ça déborde », « c'est trop petit », « je n'arrive pas à attraper », « ça scrolle quand je règle », ou quand on retouche `StudioMobile.tsx`, un bandeau, une barre d'onglets ou un curseur.
---

# Le terrain : un Xiaomi tenu à une main, en vertical

Le format court se regarde debout, dehors, à une main, sur un écran très haut et
étroit. Tout ce qui suit vient de là. Les parades sont déjà en place dans le
dépôt : la plupart du travail consiste à **ne pas les défaire**.

Repère de taille : un Xiaomi à 1080 px physiques et un rapport de pixels de 2,75
donne environ **393 px CSS de large**. Le profil « téléphone » de
`scripts/verify.mjs` en simule 390 × 640 — 640 et non la hauteur nominale, parce
que la barre d'adresse et la barre système amputent réellement l'écran.


## Le Xiaomi est le terrain, pas la cible

Tout ce qui suit part de cet appareil parce que c'est celui qui sert à juger.
Mais **une mise en page calée sur un modèle casse chez tout le monde sauf son
auteur** — et il ne le voit jamais. Un téléphone n'a pas un viewport, une gamme
en a des dizaines : de 360 à 440 points de large en usage courant, avec des
encoches de tailles différentes et une taille de police que l'utilisateur a pu
doubler.

Vérifiez donc aux extrémités, pas seulement sur l'appareil sous la main. Trois
largeurs couvrent l'essentiel : **360**, **390**, **430**. Ce qui tient à 360 et
à 430 tient partout entre les deux.

## Les sept pièges, et la parade

**1. La hauteur qui ment.** `100vh` compte la barre d'adresse dépliée : le bas de
l'interface passe sous l'écran, et c'est là que sont les boutons.
→ `h-[100dvh]`, jamais `100vh`. Déjà en place dans `StudioMobile.tsx`.

**2. La barre de gestes.** HyperOS pose une barre de navigation par gestes en bas
de l'écran ; un bouton collé au bord devient inatteignable, ou pire, déclenche le
retour système.
→ `env(safe-area-inset-bottom)` sur tout bandeau fixe, avec un plancher :
`style={{ paddingBottom: 'max(0.375rem, env(safe-area-inset-bottom))' }}`. Même
chose en haut pour l'encoche.

**3. Le doigt n'est pas une souris.** En dessous de 44 px, on vise à côté et on
recommence.
→ `min-h-11` sur tout ce qui se touche. Vaut aussi pour les petits boutons de
texte : un « Retirer » de 13 px de haut est un piège.

**4. Le geste volé.** Amorcer un balayage vertical sur un curseur en changeait la
valeur : `touch-action: none` donne au curseur *tous* les gestes, défilement
compris.
→ L'arbitrage se fait dans le composant `Slider`, qui distingue une intention
horizontale d'un simple défilement (`globals.css` explique pourquoi la règle
globale a été retirée). Ne pas remettre de `touch-action` sur un curseur.

**5. Chrome qui assombrit d'autorité.** Android peut appliquer un thème sombre
automatique aux pages qui ne se déclarent pas. Amorce est déjà sombre par choix
— une zone laissée en clair, ou une couleur posée en dur hors du thème, se fait
recolorer sans prévenir.
→ Passer par les jetons `@theme`. Une couleur inventée sur place est justement
celle que le navigateur se croira autorisé à changer.

**6. La police système agrandie.** Beaucoup de gens règlent MIUI sur une police
plus grande. Une hauteur fixée en pixels tronque alors le texte au lieu de
s'adapter.
→ Hauteurs minimales (`min-h-*`) plutôt que hauteurs fixes ; laisser le contenu
pousser. Vérifier en zoomant à 150 % dans le navigateur.

**7. Ce qui masque ce qu'on règle.** Un panneau flottant au-dessus de l'aperçu
cache exactement l'image dont on juge le réglage.
→ Rien ne se superpose à l'aperçu. Les réglages vivent dans le tiroir du bas,
qui pousse l'aperçu au lieu de le recouvrir.

## La zone du pouce

Sur un écran de 20:9 tenu à une main, le tiers haut est hors de portée sans
changer de prise. L'action principale et la navigation vivent **en bas** — c'est
pourquoi la barre d'onglets et le tiroir de réglages sont là. Ce qui monte en
haut : ce qu'on regarde (l'aperçu, le titre d'étape), pas ce qu'on touche.

## Essayer pour de vrai

Trois niveaux, du plus rapide au plus fidèle :

```bash
# 1. Le profil téléphone de la vérification, bridé ×4 (indispensable : sans le
#    bridage, la dégradation automatique de qualité ne se déclenche jamais).
npm run dev                       # dans un terminal
npm run fixtures                  # une fois : les rushes d'essai
AMORCE_PROFILE=mobile npm run verify
# Réclame `playwright install` ? Il manque AMORCE_CHROMIUM=/opt/pw-browsers/chromium.

# 2. L'émulation du navigateur : outils de développement, appareil 393 × 873.
#    Voit les débordements, ne voit ni le tactile réel ni la barre de gestes.

# 3. Le vrai téléphone, sur le même réseau que l'ordinateur :
npx next dev -H 0.0.0.0           # puis http://<ip-de-l-ordinateur>:3000
```

Le troisième niveau est le seul qui montre la barre de gestes, la police système
et la vraie perception du contraste en plein jour. C'est celui qui a fait
remonter le gris du texte : `--color-muted` a été éclairci parce qu'un gris
discret cesse simplement d'être lu dehors.

## Avant de rendre la main

- Aucun défilement horizontal en 390 px de large.
- Rien d'important dans les 48 px du bas hors `safe-area`.
- Tout ce qui se touche fait au moins 44 px.
- Le défilement vertical fonctionne en partant d'un curseur.
- L'aperçu n'est jamais recouvert.
- `AMORCE_PROFILE=mobile npm run verify` passe.
