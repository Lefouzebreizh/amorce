---
name: debogage-systematique
description: >-
  Diagnostiquer un bug, un test qui échoue ou un comportement inattendu en
  trouvant la cause avant de proposer le moindre correctif. Dit quelle commande
  reproduit réellement le défaut selon le projet touché — les tests unitaires ne
  voient ni le rendu canvas, ni le son, ni l'export, ni le mobile — et fait
  d'abord relire les quatorze pièges déjà consignés dans CLAUDE.md, qui
  expliquent une bonne part des symptômes qu'on rencontre ici. À utiliser dès
  qu'une chose ne marche pas comme prévu : test rouge, écran noir, son absent,
  export tronqué, mise en page qui déborde, intégration continue en échec,
  lenteur inexpliquée — y compris quand la demande dit seulement « ça marche
  pas », « c'est cassé », « pourquoi ça fait ça », « le son a disparu »,
  « regarde ce test », ou quand un correctif précédent n'a rien changé.
  Particulièrement utile quand la cause paraît évidente : c'est là qu'on se
  trompe et qu'on corrige un symptôme.
---

# Débogage systématique

Un correctif posé sans avoir compris la cause a deux issues : il ne marche pas,
ou il marche par accident et masque le vrai défaut jusqu'à ce qu'il revienne
ailleurs. Les deux coûtent plus cher que l'enquête qu'on a voulu s'épargner.

**La règle : pas de correctif avant d'avoir identifié la cause.** Elle vaut
surtout quand elle semble superflue — quand le bug paraît simple, quand on est
pressé, quand la correction saute aux yeux. C'est exactement là qu'on corrige un
symptôme.

## Avant tout : les pièges déjà connus

Ce dépôt tient une liste de quatorze pièges dans la section « Pièges connus » de
`CLAUDE.md`. Elle n'est pas décorative : chacun a coûté un débogage à quelqu'un,
et plusieurs produisent des symptômes qui n'évoquent pas du tout leur cause.

Relis-la avant d'ouvrir quoi que ce soit. Quelques exemples de ce qu'elle
t'épargne :

| Symptôme | Cause déjà documentée |
| --- | --- |
| L'aperçu sort noir | `renderFrame` s'arrête au fond noir sans clip ; ou un lien objet restauré qui pointe dans le vide |
| Une police n'est pas la bonne | Le canvas ne déclenche pas son chargement — `preloadCaptionFonts` manque |
| Le canvas se vide sans raison | Un redimensionnement réinitialise le contexte — voir le cache de `resolveContext` |
| Un bruitage grave est inaudible | Aucun haut-parleur de téléphone ne descend sous ~400 Hz |
| Un montage restauré s'ouvre vide | Le navigateur a effacé les fichiers ; les plans orphelins sont retirés |
| Le mixage pompe à chaque frappe | Les deux couches d'un impact doivent se partager le niveau, pas s'additionner |
| L'export n'a pas la bonne extension | MP4 sous Chrome et Edge seulement, WebM ailleurs |

Si le symptôme y figure, l'enquête est déjà faite.

## Reproduire, avec la bonne commande

Un bug qu'on ne sait pas déclencher à volonté ne se corrige pas : on ne pourra
pas prouver qu'il a disparu. Reproduire vient donc avant de comprendre.

Le point qui fait perdre le plus de temps ici : **`npm test` ne voit pas
l'essentiel d'Amorce.** Il couvre ce qui est calculable hors navigateur —
timeline, notation, guidage, étalonnage, sous-titres, paliers de qualité, store.
Le décodage vidéo, le mixage, le tracé canvas, l'enregistrement et la reprise
après rechargement lui échappent complètement. Un test vert ne dit rien d'un
écran noir.

| Ce qui est cassé | Ce qui le reproduit |
| --- | --- |
| Timeline, note de viralité, guidage, store, étalonnage | `npm test` |
| Rendu, audio, export, mise en page mobile | `npm run verify` (avec `npm run dev` dans un autre terminal) |
| Un défaut qui n'apparaît que sur téléphone | `AMORCE_PROFILE=mobile npm run verify` — le bridage processeur ×4 n'est pas décoratif |
| La reprise après rechargement | `npm run verify:reprise`, qui existe à part pour ça |
| Types, imports, règles de style | `npm run typecheck`, `npm run lint` |
| Look & Find (Flutter) | `flutter analyze`, `flutter test` dans `look_and_find/` |
| Chaîne KDP | `python3 kdp/pipeline/valider.py` |
| Studio audio | `python3 -m unittest discover -s mon-app-audio/tests` |
| Assistant d'allocation | `python3 -m unittest discover -s patrimoine/tests` |
| Radar crypto : notation, filtres, sécurité | `cd pepites && python3 -m unittest discover -s tests` |
| Radar crypto : l'effet d'un réglage | `cd pepites && python3 profils.py` — les tests passent sans dire que la note du profil « accumulation » est tombée de 100 à 48 |
| Radar crypto : une réponse d'API malformée | ajouter la charge utile à `ClientFactice` dans `pepites/tests/test_pipeline.py` — un vrai scan est impossible ici, voir plus bas |

`npm run fixtures` fabrique les rushes de test si `.fixtures/rushes/` est vide.
Les captures et exports du parcours atterrissent dans `.fixtures/captures/` :
c'est là qu'on regarde ce qui a réellement été produit, plutôt que de déduire.

## L'enquête

**1. Lis l'erreur en entier.** La trace d'appel, le numéro de ligne, le code.
Elle contient souvent la réponse, et la survoler pour aller « au vrai problème »
fait recommencer vingt minutes plus tard.

**2. Regarde ce qui a changé.** `git diff`, `git log` sur les fichiers
concernés. Un comportement qui marchait a une cause dans ce qui a bougé depuis.

**3. Demande-toi quel invariant est cassé.** Les huit invariants en tête de
`CLAUDE.md` sont la raison pour laquelle l'application fonctionne — un bug de
rendu ou de son en viole presque toujours un. Deux couches vidéo dépassées, un
tracé ajouté « juste pour l'aperçu », une position calculée sur la taille réelle
du canvas au lieu du repère 1080 × 1920, un volume posé sur un élément média au
lieu du graphe audio. L'agent `revue-invariants` fait cette relecture.

**4. Remonte à la source de la mauvaise valeur.** Là où l'erreur éclate est
rarement là où elle naît. Voir `references/tracage-a-rebours.md`.

Si le défaut est signalé depuis un téléphone et ne se reproduit pas en
vérification, la source est souvent l'appareil lui-même — fichier importé à
zéro octet, débit d'export effondré, décodeurs vidéo saturés. Ces cas sont
mesurés dans `references/defauts-telephone.md`, à lire avant de chercher dans
le code.

**5. Formule une hypothèse qui prédit quelque chose d'observable.** « Je pense
que X est la cause, donc si je regarde Y je devrais voir Z. » Une hypothèse
qu'aucune observation ne peut démentir n'en est pas une.

**6. Ne change qu'une chose à la fois.** Deux modifications simultanées qui
font disparaître le bug ne disent pas laquelle a agi — et l'autre reste dans le
code sans raison.

## Corriger

Le correctif s'écrit une fois la cause nommée, et il vise la cause. S'il faut
choisir entre traiter le symptôme là où il apparaît et traiter l'origine plus
haut, c'est l'origine — sinon le même défaut ressortira par un autre chemin.

Un test qui échoue et qu'on rend vert en l'affaiblissant n'est pas corrigé : il
est supprimé sans le dire. Si un test gêne, c'est soit qu'il a raison, soit
qu'il est faux — et le déclarer faux demande de savoir pourquoi.

Puis relance la commande qui reproduisait le bug, pas une autre. Un correctif de
rendu validé par `npm test` n'est pas validé.

## Quand trois correctifs ont échoué

C'est le signal le plus utile de cette fiche, et le plus facile à ignorer quand
on est lancé. Si trois tentatives n'ont rien donné — surtout si chacune a fait
apparaître un problème ailleurs — le défaut n'est plus dans le code qu'on
retouche : il est dans la manière dont c'est construit.

Arrête-toi et dis-le, plutôt que d'en tenter une quatrième. Un quatrième
correctif sur une architecture qui ne tient pas ajoute de la dette à un endroit
qui va être refait.

## Signaux qu'on a quitté la méthode

Si tu te surprends à penser l'une de ces phrases, l'enquête n'est pas faite :

- « Correction rapide maintenant, je regarderai après. »
- « J'essaie de changer ça pour voir. »
- « C'est probablement X. »
- « Je ne comprends pas bien, mais ça devrait marcher. »
- « Je change plusieurs choses et je relance les tests. »
- « Je vérifierai à la main plutôt que d'écrire le test. »

Et si l'utilisateur dit « arrête de deviner », « tu as vérifié ? » ou « on
tourne en rond » : la réponse n'est pas un correctif de plus, c'est de revenir
à la reproduction.

## Le faux diagnostic propre aux sessions distantes

Le mandataire réseau refuse une partie du monde extérieur, et le symptôme
ressemble à s'y méprendre à une panne de code :

- **`api.dexscreener.com` et les services de sécurité sont bloqués.** Un
  `python3 pepites/main.py scan` s'arrête sur « Réseau indisponible » après une
  trentaine de secondes. C'est le comportement attendu de l'outil face à une
  coupure, pas un défaut à corriger. Le radar se déboguit ici sur des réponses
  rejouées.
- **`dl.google.com` est bloqué**, donc pas de SDK Android : c'est l'intégration
  continue qui construit l'APK.

Avant de conclure « ça ne marche pas », vérifier de quel côté du mandataire se
trouve la panne : `curl -sS "$HTTPS_PROXY/__agentproxy/status"` dit ce qui a été
refusé et pourquoi.

## Ce qu'on ne conclut pas trop vite

« Ce test est instable » et « ça vient de l'environnement » sont vrais parfois,
et faux la plupart du temps. Avant de le dire : le défaut survit-il à une
seconde exécution ? Apparaît-il aussi sur la branche principale ? Sur le profil
téléphone bridé, un défaut de synchronisation qu'on croyait aléatoire devient
souvent reproductible — c'est même la raison d'être de ce bridage.

Si l'enquête aboutit vraiment à une cause extérieure, dis ce que tu as écarté et
comment, pour que le prochain ne recommence pas.
