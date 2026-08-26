---
name: custom-frontend-designer
description: Concevoir et coder une interface pour le studio Amorce — Next.js 15, React 19, Tailwind v4. Dit où atterrit chaque fichier, quelles briques existent déjà, et les cinq règles de style qui font l'identité de l'application (surfaces plutôt que contours, accent unique, jetons de thème, aide obligatoire sous chaque réglage, un seul panneau pour les deux coques). À utiliser dès qu'on ajoute ou retouche un écran, un panneau, un composant, une mise en page, une couleur, une animation ou un état vide dans `src/` — y compris quand la demande dit seulement « rends ça plus beau », « refais cet écran » ou « ajoute un bouton ».
---

# Dessiner une interface pour Amorce

Amorce est un studio de montage vertical : on y juge des images en permanence.
L'interface n'est donc pas un habillage, c'est un instrument de mesure — tout ce
qui brille, clignote ou colore sans raison fausse le jugement de celui qui
monte. « Moderne » ici veut dire **calme, rapide, et lisible à une main dehors**,
pas décoré.

## Où atterrit le code

| Besoin | Fichier |
| --- | --- |
| Une brique réutilisable (bouton, panneau, jauge) | `src/components/ui.tsx` |
| Le contenu d'une étape | `src/components/panels/*.tsx` |
| L'aiguillage étape → panneau | `src/components/steps.tsx` |
| La disposition d'ensemble | `StudioDesktop.tsx` (trois colonnes) / `StudioMobile.tsx` (une colonne + onglets) |
| Une couleur, une police, un réglage global | `src/app/globals.css`, bloc `@theme` |

**Les panneaux d'étape sont les mêmes des deux côtés.** Seule la coque change.
Dupliquer un panneau « pour le mobile » est la façon la plus sûre de faire
diverger les deux interfaces en trois commits.

## Les cinq règles qui font l'identité

Chacune est justifiée dans le fichier concerné ; relire le commentaire avant de
s'en écarter.

1. **Le design se fait par surfaces empilées, pas par contours.** Cinq plans de
   profondeur existent (`ink`, `slab`, `panel`, `raised`, `edge`). Une bordure
   est réservée à ce qui sépare vraiment (bandeau, barre d'étapes) et à ce qui
   est sélectionné. Une interface où tout est encadré se lit comme une pile de
   boîtes et plus rien n'y ressort.
2. **L'accent ne désigne qu'une chose : l'action à faire, et ce qui va bien.**
   S'en servir aussi pour les états actifs le rend décoratif, donc muet. Un
   écran a un accent, pas cinq.
3. **Aucune valeur hexadécimale dans une classe.** Les couleurs sont des jetons
   déclarés dans `@theme` : `bg-panel`, `text-muted`, `border-edge`. Une couleur
   inventée sur place échappe au thème et vieillit seule.
4. **`Field` impose un texte d'aide à côté de chaque réglage.** Ce n'est pas une
   politesse : un curseur sans phrase qui dit ce qu'il fait est un curseur qu'on
   ne touchera pas. Si l'aide est difficile à écrire, c'est souvent le réglage
   qui est mal conçu.
5. **Cibles tactiles d'au moins 44 px** (`min-h-11`), même sur ordinateur. Voir
   la compétence `tailwind-mobile-ux` pour le reste du terrain mobile.

## Réutiliser avant d'inventer

`ui.tsx` fournit déjà : `Panel`, `Field`, `Button`, `Slider` (qui arbitre entre
régler et faire défiler au doigt), `Choice`, `Hint`, `Collapsible`, `Actions`,
`UndoControls`, `ScoreBadge`, `EmptyState`. Un nouveau composant se justifie
quand aucune de ces briques ne dit la chose — pas quand l'une d'elles demande un
réglage de plus.

Quand une brique manque vraiment, l'ajouter **dans `ui.tsx`** plutôt que dans le
panneau qui en a besoin : c'est ce qui empêche trois boutons différents de
coexister.

## Ce qui rend une interface vivante ici

- **Le rythme, pas l'ornement.** Une hiérarchie tient à l'espacement et à la
  taille, pas à des traits. Un bloc respire, un groupe se serre.
- **La profondeur raconte l'importance.** Ce qui est manipulé monte d'un plan
  (`raised`), ce qui est contexte reste au fond (`slab`).
- **Le mouvement sert à ne pas perdre l'utilisateur**, jamais à impressionner.
  Transitions sur les couleurs, l'opacité et les transformations — jamais sur
  des propriétés qui recalculent la mise en page. `globals.css` réduit déjà
  toutes les durées sous `prefers-reduced-motion`, ne pas contourner ce garde-fou
  avec une animation JavaScript.
- **Deux polices, deux rôles** : `font-display` pour les titres, `font-body`
  pour tout le reste. Une troisième fonte n'ajoute pas du caractère, elle en
  retire.
- **L'état vide est un écran à part entière** (`EmptyState`) : il dit quoi faire
  ensuite. Une zone vide sans phrase est un cul-de-sac.

## Deux pièges propres à ce dépôt

- **Rien ne se superpose à l'aperçu.** Un panneau flottant masque précisément ce
  qu'on est en train de régler.
- **La première image doit sortir dans la bonne disposition.** Une source
  extérieure à React (taille d'écran, préférence système) se lit avec
  `useSyncExternalStore` — un effet + `setState` fait sortir la première image
  en disposition d'ordinateur avant de corriger, et cela se voit.

## Vérifier

```bash
npm run typecheck && npm run lint     # toujours
npm run verify                        # dès que le rendu ou la mise en page bouge
```

`npm run verify` pilote un vrai Chromium sur deux profils, dont un téléphone
bridé ×4, et contrôle des pixels — c'est le seul filet qui voie un débordement
ou un contraste perdu. Il demande `npm run dev` dans un autre terminal, et
`npm run fixtures` une fois pour fabriquer les rushes d'essai.

Si l'un des deux réclame `playwright install`, c'est qu'il manque
`AMORCE_CHROMIUM=/opt/pw-browsers/chromium` : le navigateur est là, sa révision
n'est simplement pas celle que Playwright attend. Ne pas lancer l'installation.

## Avant de rendre la main

- Chaque nouveau réglage a sa phrase d'aide.
- Aucune couleur en dur, aucun `border` posé par réflexe.
- L'écran tient en 390 px de large sans défilement horizontal.
- Le mobile et l'ordinateur passent par le même panneau.
- L'accent ne désigne qu'une seule chose à l'écran.
