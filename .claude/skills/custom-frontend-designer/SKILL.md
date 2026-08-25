---
name: custom-frontend-designer
description: Concevoir et coder une interface distinctive pour Amorce, le studio de montage vertical — panneaux d'étape, coques ordinateur et téléphone, briques de ui.tsx, jetons Tailwind v4. À charger avant d'ajouter un écran, un panneau, un réglage ou un composant à Amorce, avant de retoucher sa mise en page, et dès qu'il est question d'interface, d'apparence, de composant React ou de Tailwind dans ce dépôt. Complète CLAUDE.md, qui porte les règles ; celle-ci porte le métier.
---

# Dessiner une interface pour Amorce

`CLAUDE.md` à la racine porte **les règles** — jetons `@theme`, extensions
explicites, `'use client'`, invariants du moteur de rendu. Les relire avant de
commencer ; cette skill ne les répète pas.

Ce qui suit porte **le métier** : comment faire une interface qui ne ressemble
pas à un gabarit, à l'intérieur de ces règles.

## Ce qu'est Amorce, et ce que ça impose

Un studio de montage vertical qui tourne **entièrement dans le navigateur**.
Aucun fichier ne part sur un serveur. L'utilisateur arrive avec des rushes et
repart avec un fichier exporté, en sept étapes.

Deux conséquences pour toute interface qu'on y ajoute :

**L'aperçu est le sujet.** Tout le reste est autour. Rien ne se superpose à
l'aperçu — un panneau flottant masque précisément ce qu'on est en train de
régler. Si un réglage a besoin d'être vu en même temps que son effet, il va à
côté, pas dessus.

**L'utilisateur n'est pas monteur.** Il ne sait pas ce qu'est une transition en
fondu enchaîné ni un bus audio. D'où la règle que `Field` impose dans le code :
**chaque réglage porte une phrase qui dit ce qu'il fait**. Un curseur sans
explication est un curseur qu'on ne touchera pas. Ce n'est pas de la
documentation, c'est ce qui rend le réglage utilisable.

## Le langage visuel

**Par surfaces, pas par contours.** Les plans se distinguent par empilement de
fonds — `slab`, `panel`, `raised` — et non par des bordures. Une bordure est
réservée à ce qui sépare vraiment, ou à ce qui est sélectionné. Une interface
faite de cadres imbriqués a l'air d'un formulaire administratif ; une interface
faite de surfaces a de la profondeur.

**L'accent ne désigne qu'une chose : l'action à faire.** Et ce qui va bien. Si
trois éléments sont en accent sur un écran, aucun n'attire l'œil. Avant de
mettre de l'accent, demandez-vous : est-ce l'action suivante ? Si non, c'est du
`mist` ou du `muted`.

**Le vide est un matériau.** Un panneau dense se lit moins vite qu'un panneau
aéré, même s'il montre plus. Sur une étape, une seule chose doit sauter aux
yeux.

## Un panneau, une fois

`steps.tsx` aiguille vers `panels/*`, et **les panneaux sont rigoureusement les
mêmes des deux côtés**. Seule la coque change : `StudioDesktop` en trois
colonnes, `StudioMobile` en une colonne avec barre d'onglets.

Ne jamais dupliquer un panneau pour le mobile. Le jour où le réglage change,
une des deux copies est oubliée — et c'est toujours celle qu'on ne teste pas.
Si un panneau ne tient pas en mobile, c'est le panneau qu'il faut simplifier,
pas la coque qu'il faut contourner.

## Éviter le gabarit

Une interface générée ressemble vite à toutes les autres : cartes arrondies
partout, ombres douces uniformes, un dégradé, des icônes en tête de section, du
centrage systématique. Rien de tout cela n'est faux ; c'est simplement ce que
produit l'absence de décision.

Décidez au moins une chose par écran. Une hiérarchie typographique qui vienne du
sujet — un studio de montage a des durées, des numéros de plan, des formes
d'onde, tout cela veut des chiffres tabulaires et de la précision. Un rythme
d'espacement qui vous appartienne. Un endroit, un seul, où l'interface se permet
un geste.

Et gardez le reste tranquille. Une audace par écran suffit ; deux se battent.

## Avant de dire que c'est fini

`npm run typecheck && npm run lint && npm test` sur ce qui est calculable.

Puis, si le changement touche au rendu, à l'audio, à l'export ou au mobile :
**`npm run verify`**. C'est le seul filet réel — il pilote un vrai Chromium et
contrôle le résultat sur les pixels et sur le signal sonore, pas sur la présence
d'éléments dans le DOM. Une interface qui passe les tests unitaires et rate
`verify` est cassée.
