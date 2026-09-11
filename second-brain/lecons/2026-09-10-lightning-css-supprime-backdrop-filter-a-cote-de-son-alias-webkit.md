# Déclarer `-webkit-backdrop-filter` à côté de `backdrop-filter` fait disparaître la version standard du CSS compilé

**Projet** : `le-coffre/` (Le Tiroir Secret).

## Ce qui a été mesuré

Un habillage « effet verre » posé le 10/09/2026 déclarait, comme le
recommandent la plupart des tutoriels glassmorphism trouvés en ligne :

```css
.carte {
  backdrop-filter: blur(20px) saturate(140%);
  -webkit-backdrop-filter: blur(20px) saturate(140%);
}
```

Vérifié en conditions réelles (compte de test jetable, `getComputedStyle`
dans un vrai Chromium) : `backdropFilter` **et** `webkitBackdropFilter`
rendaient tous les deux `"none"` sur les cartes concernées — aucun flou
visible, alors que le dégradé et la translucidité posés dans la même règle
fonctionnaient parfaitement.

Cause trouvée en grepant le CSS compilé (`.next/static/chunks/*.css`) : la
version **standard** `backdrop-filter` avait disparu du fichier produit.
Seule `-webkit-backdrop-filter` survivait :

```
.border-line.bg-paper-raised:not(input){-webkit-backdrop-filter:blur(20px)saturate(140%);border-color:#43464d}
```

**Lightning CSS** (le minifieur/autoprefixer utilisé par Next.js 16 via
Turbopack) traite les deux déclarations écrites à la main comme
redondantes et n'en garde qu'une — le préfixe, pas la version standard.
Or `getComputedStyle().backdropFilter` d'un Chromium récent ne lit **que**
la propriété standard : le préfixe seul ne suffit pas à ce que le DOM la
rapporte, même si le rendu visuel aurait pu s'en sortir dans certains
moteurs.

## Le correctif

Écrire uniquement la propriété standard, sans son alias `-webkit-` posé à
la main :

```css
.carte {
  backdrop-filter: blur(20px) saturate(140%);
}
```

Lightning CSS ajoute lui-même le préfixe nécessaire à la compilation, sans
perdre la version standard. Confirmé sur le CSS compilé après correctif :
les deux propriétés (`backdrop-filter` et `-webkit-backdrop-filter`)
survivent.

## Ce qui rend ce piège coûteux

La mesure au niveau du code source (le fichier `.css` écrit à la main) ne
l'aurait jamais montré — le défaut n'existe que dans le **CSS compilé**,
après le passage de Lightning CSS. Un contrôle qui se contente de relire
`globals.css` conclurait à tort que le flou est posé. Seul un test en
conditions réelles (page rendue, `getComputedStyle` sur l'élément) ou un
grep direct du bundle produit (`.next/static/chunks/*.css`) le révèle.

Vaut pour tout projet de ce dépôt qui compile son CSS avec Next.js/Turbopack
et poserait un jour un `backdrop-filter` (ou toute propriété avec alias
vendeur) à la main plutôt que via une classe Tailwind.
