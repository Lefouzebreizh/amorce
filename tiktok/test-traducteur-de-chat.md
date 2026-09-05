# Le test à zéro euro du traducteur de chat — 05/09/2026

Une vidéo, pas de code, pas de boutique. Ce fichier existe pour que le résultat
soit **jugé contre une hypothèse écrite avant**, et non rationalisé après.

> **Ce test n'a pas eu lieu, et il n'aura pas lieu sous cette forme.** Le
> propriétaire a refusé de publier la vidéo le jour même : elle le montre chez
> lui, avec son chat, dans un intérieur qu'il ne veut pas donner à voir. Le
> refus est net et ne se contourne pas — il porte sur ce qui part en public à
> son nom, ce que le §0 de `CLAUDE.md` range parmi les trois exceptions à
> l'autonomie.
>
> Le reste du fichier est **conservé tel quel**, et ce n'est pas de la
> paresse : l'hypothèse, les mesures et la table de décision restent justes.
> Ce qui est tombé est le **véhicule**, pas la thèse. Ce qui le remplace est
> écrit en fin de page.

## Pourquoi ce test précède tout le reste

La route commerciale a été tranchée le 05/09/2026 : application **gratuite**,
habillages de cartes payants, aimant vers les autres produits, **web uniquement**
— pas de store, donc pas de chantier natif.

Mais cette route repose sur une thèse qui n'a jamais été éprouvée : **ce qui se
vend n'est pas la traduction, c'est la carte.** Personne n'a besoin de savoir ce
que dit son chat ; les gens veulent quelque chose à poster. Si la carte
n'accroche pas, ni la boutique d'habillages ni le reste n'ont de sens — et ça se
mesure pour le prix d'une publication.

**La communauté s'y prête**, et ce n'était pas acquis : le propriétaire a
confirmé le même jour qu'elle est très orientée animaux de compagnie. Sans cette
réponse, la route entière était un pari à l'aveugle.

## Ce qui est publié

Le chat du propriétaire, filmé à 5 h 10 le 05/09/2026, verdict `demande`. La
carte est posée en bandeau haut, avec un fondu qui la fait disparaître avant
48 % de hauteur.

| | mesuré |
| --- | --- |
| texte | 25 à 37 % de hauteur — sous TikTok, au-dessus d'Instagram |
| format | 1080 × 1920, H.264/AAC, 21 s |
| sonie | **−13,8 LUFS**, vrai pic −1,8 dBTP |

**La chute est dans le rush, pas dans le montage.** La carte dit « Je ne dirai
pas quoi. Tu vas trouver » et le plan se termine sur la gamelle. Rien n'a été
mis en scène.

**Le son reste 4 dB sous la cible téléphone, et c'est accepté.** Trois gains
essayés — +13, +18, +22 dB — pour un rendement décroissant : le limiteur fait le
travail et pousser davantage écraserait les miaulements, qui sont le contenu.
L'intégrale est tirée vers le bas par les silences du clip, pas par le mixage.
Ce qui la remonterait est une coupe, donc une décision de montage.

## La légende, validée par le propriétaire — ne pas la réécrire

> 5h10. Il me réveille.
>
> J'ai fait passer son miaulement dans le traducteur que je bricole. Il a
> compris. Il a dit : "Toi. Viens." Et il a refusé de dire quoi.
>
> Regarde la fin, tu sauras.
>
> Et chez toi, il te réveille à quelle heure ?

Un premier jet expliquait l'outil — le droit de répondre « je n'ai pas
compris », ce que les concurrents ne font pas. Le propriétaire l'a coupé : ça
sortait du récit pour entrer dans l'argumentaire, et ça éloignait la question
finale de la chute. **Le différenciateur ne se plaide pas dans une légende de
vingt secondes.**

## Ce que le résultat décide

| si | alors |
| --- | --- |
| la carte fait réagir | la boutique d'habillages a un sens, on la construit |
| ça glisse | on a appris pour le prix d'un post, et la thèse « la carte est le produit » tombe |

Les chiffres se notent dans `mesures.md`, qui porte déjà le tableau et sait où
les trouver. Ce fichier-ci ne les duplique pas : il porte ce que ce tableau
n'a pas — ce qu'on attendait avant de regarder.

**Ce que ce test ne mesure pas** : si l'application est bonne. Elle nomme une
intention sur 31 vrais chats sur 40 et n'en invente aucune sur 20 témoins.
Ça, c'est déjà mesuré, et ce n'est pas la question ici.

## Ce que le refus a appris — 05/09/2026

Le coût d'un test se compte rarement en euros, et « zéro euro » a fait passer
celui-ci pour gratuit. Il ne l'était pas : il demandait au propriétaire de
publier son domicile et son animal devant quarante-huit mille personnes. Un
prix qui ne se chiffre pas reste un prix, et c'est celui-là qui a fait échouer
le test — pas la thèse qu'il devait éprouver.

**La leçon vaut au-delà de ce produit** : quand un plan repose sur un geste que
seul le propriétaire peut faire, ce geste se décrit **avant** d'être chiffré à
zéro. « Il suffit de publier une vidéo » n'est pas un coût nul, c'est un coût
qu'on n'a pas regardé.

## Ce qui peut le remplacer

Deux véhicules restent, et ils ne mesurent pas la même chose. Aucun n'est
engagé : la décision est au propriétaire, comme la précédente.

| véhicule | ce qu'il mesure | ce qu'il coûte |
| --- | --- | --- |
| **l'application en ligne**, partagée en lien | l'**usage** — combien l'ouvrent, combien vont jusqu'à une carte | un déploiement, et un mot dans sa communauté |
| une carte seule, sans vidéo ni intérieur | l'**accroche** de la carte, la thèse d'origine | une publication, mais sans le récit qui la portait |

Le premier est le plus solide des deux, et pour une raison qui n'était pas
visible avant le refus : une vidéo mesure si les gens **regardent**, une
application mesure si les gens **s'en servent**. Pour décider d'une boutique
d'habillages, c'est le second signal qui vaut — on ne vend pas un habillage à
quelqu'un qui n'a jamais fabriqué de carte.

**Ce qui manque pour l'atteindre, mesuré le 05/09/2026** : la page
`web/page/index.html` tourne, mais elle n'est servie que par
`outils/epreuve.mjs`, qui sert `dist/` et les trois fichiers de TensorFlow
**depuis `node_modules`, à la volée**. Aucune étape ne rassemble un dossier
statique déposable. Il en faut une — bâtir le TypeScript, recopier les trois
`tf-*.js` et leur WASM, y joindre les 4,1 Mo de YAMNet — et elle n'existe pas.
C'est une demi-journée, pas un chantier ; mais c'est une demi-journée qui ne se
lance qu'après la décision, pas avant.
