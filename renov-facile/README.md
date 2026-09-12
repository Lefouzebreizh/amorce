# Rénov Facile

Accompagnement pas à pas pour une demande d'aide à la rénovation énergétique
(MaPrimeRénov', CEE) : avant le dépôt, pendant l'instruction, en cas de refus
ou de blocage. Site statique, aucune dépendance, aucun serveur, tout tient
dans le navigateur.

## Lancer le site

```bash
python3 -m http.server 8080
# puis ouvrir http://localhost:8080/
```

N'importe quel serveur de fichiers statiques convient — il n'y a ni build ni
étape de compilation.

## Vérifier

```bash
npm test
```

Lance, dans l'ordre : les utilitaires de date, le coffre chiffré, la
structure de la démarche (toute étape référencée existe, aucune étape
orpheline), le format du rappel `.ics`, et le filet de reprise automatique.

Ce que les tests ne couvrent pas : le rendu DOM (`js/engine.js` manipule
directement le DOM), la mise en page, les icônes. **Parcourir les trois
branches du questionnaire dans un vrai navigateur avant de considérer un
changement terminé.**

## D'où vient le moteur

Le moteur générique de questionnaire (`js/engine.js`), le coffre chiffré
(`js/coffre.js`), le brouillon de reprise automatique (`js/brouillon.js`),
les utilitaires de date (`js/dates.js`) et le rappel de calendrier
(`js/ics.js`) sont portés, sans changement de logique, depuis
[`Lefouzebreizh/ensemble-mdph`](https://github.com/Lefouzebreizh/ensemble-mdph)
(dépôt séparé). Ces fichiers ne connaissent aucun contenu de démarche — toute
la matière de Rénov Facile vit dans `js/data/renovation.js`.

Deux choses du gabarit d'origine n'ont volontairement pas été reprises :

- **La personnalisation de notice par un modèle de langage** (`api/notice.js`
  côté ensemble-mdph) — ce site n'a pas de serveur, et `js/engine.js` a été
  retouché pour retirer l'appel réseau correspondant plutôt que de le laisser
  échouer à chaque écran.
- **Le rappel par e-mail et le chat** (Supabase, Resend, un modèle de
  langage) — hors du périmètre de ce lot. Le rappel de calendrier `.ics`, qui
  ne demande aucun serveur, est repris tel quel.

## Structure

```
index.html              page unique (accueil + questionnaire)
confidentialite.html    politique de confidentialité
css/style.css           charte turquoise lagon, portée d'ensemble-mdph
favicon.svg
img/hero-ocean.svg      fond dégradé du héro, générique
js/
  dates.js              utilitaires de date partagés
  ics.js                génération du rappel de calendrier .ics
  brouillon.js          filet de reprise automatique (localStorage, en clair)
  coffre.js             coffre chiffré (PBKDF2 + AES-GCM, localStorage)
  engine.js             moteur générique de questionnaire
  data/renovation.js    contenu : la démarche Rénov Facile elle-même
  main.js               page d'accueil, pont vers le coffre
  numeros.js            modale « Numéros utiles »
tests/                  suite Node native (node:vm + node:assert-like)
```

## La démarche elle-même

Une question d'aiguillage (pas encore déposé / en instruction / refusé ou
bloqué), puis trois branches :

1. **Avant la demande** — trois vérifications d'éligibilité (âge du
   logement, résidence principale, nature des travaux), puis une notice sur
   l'artisan RGE, les couleurs de revenu, le cumul des aides et les délais du
   guichet.
2. **Pendant l'instruction** — geste isolé ou rénovation d'ampleur, puis la
   date de dépôt : un calculateur estime la fin d'instruction (3 ou 6 mois)
   et affiche un message adapté selon que ce délai est dépassé ou non.
3. **Refus ou blocage** — refus écrit (avec calcul du délai de recours de 2
   mois) ou silence radio, les deux menant à la même notice de fond : motifs
   de refus flous, relance, ne rien signer tant que le flou persiste, bons
   interlocuteurs gratuits.

Le contenu des trois blocs a été fourni par le propriétaire du produit et
n'est pas réécrit sans raison — seule sa mise en forme en étapes de
questionnaire est nouvelle.
