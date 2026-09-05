# Cinq produits grand public — où se placer, et pourquoi

Écrit le 02/09/2026. Recherche faite en ligne le jour même ; les sources sont
citées en bas, et tout chiffre non sourcé est signalé comme non mesuré.

---

## Avant les cinq idées : la seule chose que je te dirais si je n'avais qu'une phrase

**Ne fais pas cinq applications. Fais un moteur et cinq portes.**

Les cinq pistes ci-dessous tapent toutes sur le même mur — la paperasse
française — et elles demandent toutes exactement les quatre mêmes briques :

1. **lire un document** qu'on photographie (courrier, notification, facture,
   relevé) et en extraire les champs qui décident ;
2. **savoir quelle est la règle** qui s'applique, et surtout quel est le
   **délai** ;
3. **produire le bon écrit** — formulaire rempli, lettre recommandée, recours —
   prêt à signer ;
4. **surveiller la suite** et réveiller la personne au bon moment.

Tu as déjà les briques 1 et 4, écrites et testées : `paper-manager/` extrait des
champs de documents, `life-organizer/` range et lit les premières pages d'un
document quand son nom ne dit rien. Ce sont les deux morceaux les plus chers à
construire, et ils sont faits.

Ce qui change d'un produit à l'autre, c'est **la règle et le moment** — pas la
technique. Donc : un noyau, et des « cartouches » métier. C'est ce qui permet à
un développeur seul de tenir cinq produits ; c'est aussi ce qui les tue tous si
tu les écris cinq fois.

### Et l'objection que je te dois avant de te vendre du rêve

Tu as aujourd'hui **quatre chantiers grand public** — Amorce, Life-Organizer,
Conseiller Patrimoine, artisan-express — et **aucun n'a encore encaissé un
euro**. Un cinquième produit ne rapproche pas de la première vente, il l'éloigne.

Ce document répond donc à ta question en entier, mais je le classe autrement :
la colonne « délai jusqu'au premier euro » compte plus que la colonne « taille
du marché », et c'est elle qui donne l'ordre du tableau.

| # | Produit | Marché | Concurrence | Premier euro | Réutilise |
| --- | --- | --- | --- | --- | --- |
| 5 | **Le Coffre** — papiers, échéances, abonnements — **construit, voir `le-coffre/`** | énorme, flou | forte mais mal placée | **semaines** | Life-Organizer + paper-manager |
| 2 | **Le Dossier** — MDPH / handicap invisible | 1 formulaire, ~1 M/an | quasi nulle | **1 à 2 mois** | paper-manager |
| 4 | **Le Recours** — litiges du quotidien | universel | moyenne | 1 à 2 mois | paper-manager |
| 1 | **Le Classeur** — l'après-décès | ~600 000 familles/an | faible, artisanale | 2 à 3 mois | Life-Organizer |
| 3 | **La Relève** — aidant : droits et argent | 11 M d'aidants | forte, mais à côté | 3 mois | tout |

---

## 1. Le Classeur — tout ce qu'il faut faire quand quelqu'un meurt

### La douleur

Un décès déclenche une cascade de démarches sur trois horizons qui ne se
recouvrent pas : **48 heures** pour la déclaration et les obsèques, **7 à
30 jours** pour prévenir les organismes, débloquer les aides et l'assurance-vie,
puis **1 à 6 mois** pour la succession chez le notaire. Chaque étape demande un
acte de décès en plusieurs exemplaires, et l'oubli d'un organisme se paie
plusieurs mois plus tard en indus à rembourser.

Le moment est le pire possible pour lire une notice. C'est exactement la
situation où un produit vaut cher : la personne n'a ni le temps, ni la tête, ni
l'envie de comprendre.

### Ce qui existe

Des **prestataires de service humain**, pas des produits : Postumo, Tranquillité
(une équipe près de Dijon), Actea, Heritia. Ils facturent de l'accompagnement à
la main. Les pompes funèbres proposent un « service démarches » en option,
rarement bon, jamais transparent sur le prix.

**Aucun n'est un logiciel que la famille tient elle-même.** C'est un marché de
services artisanaux, ce qui veut dire deux choses : la demande est prouvée
(des gens paient déjà), et personne n'a industrialisé.

### La niche exacte

Pas « on fait vos démarches à votre place » — c'est le métier des autres, et ça
demande des mandats, une assurance RC pro et du personnel.

**« Le classeur qui vous dit quoi faire, dans quel ordre, avec le courrier déjà
écrit. »** La famille garde la main, l'outil porte la charge mentale.

Le coin d'entrée le plus fin : **le compte à rebours**. Personne ne vend
aujourd'hui « il vous reste 4 jours pour la banque, 11 pour la caisse de
retraite, et l'assurance-vie n'a pas de délai mais 3 200 € dorment dessus ».

### Le produit

- On saisit une dizaine de faits (statut marital, régime, employeur, banques,
  bailleur ou propriétaire, enfants).
- L'outil génère **la liste ordonnée par délai**, pas par thème — c'est
  l'inversion qui fait la différence.
- Chaque ligne produit **le courrier prêt**, avec le nombre exact d'actes de
  décès à joindre.
- Un module « ce que vous pouvez toucher » : capital décès (**3 922 € en
  2026**), pension de réversion, allocation CAF en cas de perte d'un enfant de
  moins de 25 ans. C'est la partie qui rend le prix indolore.
- Tout en local. Ce sont les documents les plus intimes qu'une famille possède ;
  les envoyer sur un serveur est un argument de vente **contre** toi.

### Le modèle

**Achat unique, 49 à 79 €.** Aucun abonnement — on ne s'abonne pas à la mort de
son père, et le proposer serait obscène.

Deuxième canal, plus lent mais plus gros : **les pompes funèbres indépendantes**
(hors gros réseaux) qui cherchent un service à offrir sans embaucher. Licence
annuelle, ils l'offrent à la famille, ça leur fait un argument face aux réseaux.

### Le risque

Se tromper sur une règle a des conséquences réelles. La parade est écrite dans
ton dépôt : **on n'invente pas**. Chaque étape cite son texte, et là où le droit
est incertain, l'outil dit « demandez au notaire » au lieu de trancher.

---

## 2. Le Dossier — le formulaire MDPH, et le paragraphe qui décide de tout

### La douleur

Un dossier MDPH (Cerfa n° 15692*01) ouvre d'un coup l'AAH, la PCH, la RQTH et
la carte mobilité inclusion. La MDPH a **4 mois légaux** pour répondre, et en
vrai **3 à 12 mois selon le département**. En cas de refus, il reste **un mois**
pour déposer un recours préalable — passé ce délai, il faut tout recommencer,
donc réattendre jusqu'à un an.

Et au milieu du formulaire il y a un espace libre, **le « projet de vie »**, que
personne ne sait remplir. C'est pourtant lui que l'équipe pluridisciplinaire
lit ; le reste est administratif. Un dossier médicalement identique passe ou ne
passe pas selon ce que la personne a su écrire sur ces quelques lignes.

### Ce qui existe

Des **guides**. Beaucoup, tous gratuits, tous sous forme d'articles :
quelles-aides.fr, handi-loisirs, administrationfacile, les associations. Les
travailleurs sociaux de la MDPH aident au remplissage — quand on décroche un
rendez-vous.

**Aucun outil ne rédige avec vous.** Le marché est vide au seul endroit qui
compte.

### La niche exacte

**« Le projet de vie, écrit avec toi, dans tes mots. »**

C'est la niche la plus étroite des cinq, et c'est ce qui la rend prenable en
solo. On ne remplace pas la MDPH, on ne promet aucun résultat : on transforme
« décrivez vos difficultés » en un entretien guidé qui produit un texte
utilisable.

### Le produit

- Un entretien question par question, à l'oral si la personne préfère parler
  qu'écrire — **et tu sais déjà transcrire sur la machine, sans réseau**
  (sherpa-onnx, 25× le temps réel, aucun octet qui sort).
- Le texte du projet de vie, écrit à la première personne, en langage concret :
  pas « je souffre d'un trouble de l'attention » mais « je mets deux heures à
  ouvrir mon courrier et j'ai raté trois rendez-vous ce trimestre ». C'est ce
  registre-là que la MDPH sait évaluer.
- **Le compte à rebours du recours**, armé automatiquement à la date de
  notification. À lui seul il justifie le prix : rater un mois coûte un an.
- Le certificat médical, les pièces, la checklist par département.

### Le modèle

**Achat unique, 29 à 39 €**, avec une version gratuite honnête (la checklist et
le compte à rebours) et le payant sur la rédaction. Le public est souvent
précaire : un abonnement serait à la fois indécent et invendable.

### Pourquoi c'est toi qui dois le faire

**Tu as déjà l'audience.** Tes 48 000 hypersensibles, créatifs et cabossés sont
statistiquement la population qui dépose ces dossiers — TDAH, TSA, troubles
anxieux, handicap invisible. Aucun concurrent ne peut acheter cette audience, et
toi tu n'as pas à la payer.

C'est la seule des cinq idées où ton avantage n'est pas réplicable.

### Le risque

Le registre. Un outil qui « optimise » un dossier MDPH serait un outil qui
apprend à tricher, et ça se retourne — contre les gens d'abord, contre toi
ensuite. La ligne à tenir est nette : **on aide à dire vrai, pas à dire mieux.**
Elle est aussi commercialement la bonne, parce que c'est celle qu'aucun
concurrent ne pourra copier sans mentir.

---

## 3. La Relève — l'aidant familial, côté droits et côté argent

### La douleur

**11 millions d'aidants** en France. La charge n'est pas seulement le temps
passé : c'est l'APA à demander, la PCH à monter, l'AJPA pour se faire indemniser
un congé, le crédit d'impôt sur l'emploi à domicile, l'obligation alimentaire
entre frères et sœurs, et la récupération sur succession de l'aide sociale à
l'hébergement — celle-là, presque personne ne la découvre avant qu'il soit trop
tard.

### Ce qui existe

**Famirelay** et **Nello** occupent la coordination : agenda partagé, partage
d'informations entre proches, stockage de documents. C'est bien fait et c'est
déjà pris.

**Le volet droits et argent est libre.** Les deux applications organisent le
« qui passe mardi » ; aucune ne dit « votre mère a droit à 480 € d'APA que vous
ne demandez pas » ni « signer ce papier engage la maison ».

### La niche exacte

**« Ce que ça vous coûte, ce que vous pouvez récupérer, et ce que vous signez. »**

Le déclencheur d'achat n'est pas le confort, c'est la peur — la peur bien fondée
de découvrir dans trois ans qu'on a signé quelque chose qu'on n'avait pas
compris.

### Le produit

- Un état des lieux du dossier du parent : ressources, dépendance, biens.
- La liste des droits ouverts, chiffrée, avec le formulaire prérempli.
- **L'alerte sur les engagements** : ce qu'implique une demande d'ASH, une
  obligation alimentaire, une donation entre frères et sœurs.
- La répartition entre les enfants, en clair, pour que la conversation de
  famille ait un document au milieu de la table plutôt que des souvenirs.

### Le modèle

**Abonnement 6 à 9 €/mois**, ici légitime : la situation dure des années et
change tous les trimestres. Ou 89 € l'année.

### Le risque

C'est le plus lent des cinq à monter — le domaine est large et le droit change
souvent. À ne lancer qu'après qu'un des quatre autres paie.

---

## 4. Le Recours — se faire rembourser, sans avocat et sans y passer ses soirées

### La douleur

Universelle, et c'est sa force : tout le monde s'est fait avoir au moins une
fois — un remboursement qui ne vient pas, un abonnement résilié qui prélève
encore, un artisan qui ne revient pas, un sinistre sous-indemnisé.

Le levier juridique existe et il est méconnu : **depuis le 1er octobre 2023, une
tentative de résolution amiable est obligatoire avant le tribunal pour tout
litige jusqu'à 5 000 €.** Autrement dit, la lettre bien faite n'est plus une
politesse, c'est une **étape de procédure** — et l'entreprise en face le sait.

### Ce qui existe

- **SignalConso** (DGCCRF), gratuit, mais c'est un signalement à
  l'administration, pas une réclamation qui vous rembourse.
- **litige.fr**, qui vend de la mise en demeure et de l'injonction de payer.
- Des dizaines de sites de modèles de lettres gratuits, tous médiocres et
  identiques.
- Les médiateurs de branche, gratuits, lents et invisibles pour le public.

Le vide est entre les deux : entre le modèle Word générique et la plateforme
juridique payante, **rien qui parte de ta situation réelle**.

### La niche exacte

**« Tu photographies le contrat et la facture, tu racontes en trois phrases, tu
reçois la lettre qui oblige. »**

Le mot qui compte est *oblige* : pas une lettre de plainte, une lettre qui cite
le bon article, fixe un délai, et annonce la suite. C'est très exactement ce que
ton `paper-manager/` sait déjà commencer à faire.

### Le produit

- Extraction des faits depuis les documents photographiés : dates, montants,
  références de contrat.
- Choix du bon fondement selon le cas (garantie légale de conformité, droit de
  rétractation, obligation de délivrance conforme…).
- **La lettre recommandée prête**, avec le délai et l'étape suivante nommée.
- Le suivi : relance, saisine du médiateur compétent, puis le pas d'après.

### Le modèle

**3 à 5 € la lettre**, ou 19 € l'année en illimité pour un foyer. Le calcul est
imparable côté client : on ne dépense 5 € que quand on en réclame 200.

C'est aussi le seul des cinq qui se **partage** tout seul — quelqu'un qui a
récupéré 340 € en parle.

### Le risque

La frontière du conseil juridique. Un modèle de lettre est libre ; un conseil
personnalisé sur une situation est une profession réglementée. La ligne est
tenable — l'outil produit un écrit à partir de faits, ne dit jamais « vous allez
gagner » — mais elle doit être écrite dans le produit dès la première version,
pas après le premier courrier d'un ordre professionnel.

---

## 5. Le Coffre — tes papiers, tes échéances, tes abonnements zombies

### La douleur

Celle qui touche tout le monde, tous les jours, sans nom et sans drame.
**34 % des 16-74 ans rencontrent au moins une difficulté numérique majeure** dans
leurs tâches quotidiennes, et **près de 40 % des Français se disent angoissés à
l'idée de faire une démarche administrative en ligne**. Ce n'est pas une
population marginale, c'est un tiers du pays.

À côté, la fuite silencieuse : les abonnements qu'on ne résilie pas, les
garanties qu'on ne fait pas jouer parce qu'on a perdu la facture, les
attestations qu'on refait payer parce qu'on ne sait plus où elles sont.

### Ce qui existe

- **Digiposte** (La Poste) et les coffres-forts bancaires : du stockage, et
  seulement du stockage. Ils rangent, ils ne préviennent de rien.
- Google Drive, Dropbox, Notion : génériques, et il faut être organisé — donc
  ils servent exactement à ceux qui n'en ont pas besoin.
- Les applis de résiliation type Unsubscribe : anglo-saxonnes, branchées sur le
  compte bancaire, ce qui coûte l'accès à la moitié du public visé.

Personne, en France, ne fait la chose évidente : **relier le document à
l'échéance qu'il contient.**

### La niche exacte

**« Tu photographies, il classe, et il te réveille avant qu'il soit trop
tard. »**

Et l'argument que ni La Poste ni Google ne peuvent tenir : **rien ne sort de ton
téléphone.** C'est déjà l'invariant de Life-Organizer ; ici il devient l'accroche
commerciale, pas une note technique.

### Le produit

Écrit le 02/09/2026, ce paragraphe décrivait deux chantiers à ouvrir. **Les
deux sont faits** : `le-coffre/` existe depuis le lendemain, et porte
exactement ce que celui-ci réclamait — voir `CLAUDE.md` § Stack et
`le-coffre/README.md`.

- `life-organizer` range par thème et par date, et lit les premières pages d'un
  document quand son nom ne dit rien — inchangé.
- `paper-manager` extrait des champs — inchangé.
- **La couche d'échéances n'est plus un manque** : PR #685 (04/09/2026) l'a
  posée directement dans `le-coffre/`, en fonction Supabase
  (`classer-document`), indépendamment de `paper-manager`. Le module
  `calendrier` reste bien retiré de Life-Organizer — cette partie-là de la
  phrase d'origine tient toujours — mais l'écosystème ne dépend plus
  seulement de `paper-manager` pour cette fonction : deux détections
  d'échéance coexistent maintenant, l'une en ligne de commande, l'autre dans
  `le-coffre/`.
- **L'interface existe aussi** : `le-coffre/` est un site Next.js, pas un
  terminal — c'est la « couche d'interface » que ce paragraphe réclamait.

### Le modèle

Non tranché ici : `le-coffre/README.md` ne fixe pas encore de prix. Ce que ce
paragraphe décrivait comme un modèle à choisir reste une décision de produit
ouverte, à prendre au moment de la commercialisation plutôt qu'à relire ici.

### Le risque

**Le risque décrit ici — « il reste en ligne de commande » — n'existe plus** :
`le-coffre/` est déjà une interface web. Le risque qui reste à évaluer,
lui, est nouveau et n'est pas mesuré dans ce fichier : deux implémentations
de la détection d'échéance (`paper-manager/core/calendrier.py` et la fonction
Supabase de `le-coffre/`) peuvent diverger avec le temps si l'une évolue sans
l'autre.

---

## Ce que j'ai regardé et écarté — pour t'éviter de le refaire

| Piste | Pourquoi je l'écarte |
| --- | --- |
| **Coparentalité / garde alternée** | Marché saturé et mature : 2houses, Coot, Copareo, Share(d), OurFamilyWizard, entre 5 et 20 €/mois. Copareo a même une ligne téléphonique dédiée qui archive appels et SMS. Il n'y a plus de coin libre. |
| **Gestion locative petits bailleurs** | Rentila : ~50 000 utilisateurs, 200 000 lots, **gratuit jusqu'à un bien**. Un gratuit installé est le pire concurrent possible pour un nouveau venu. |
| **MaPrimeRénov'** | Douleur énorme et fraude massive, mais le rôle d'accompagnement est devenu **réglementé** — rendez-vous France Rénov' obligatoire, « Mon Accompagnateur Rénov' » agréé obligatoire sur les rénovations d'ampleur. On ne rentre pas seul sur un marché où l'État distribue les cartes. |
| **Mémoire familiale / biographies** | Le plus tentant pour toi — Amorce sait déjà monter — mais c'est devenu encombré en dix-huit mois : FamilyStories, Ystory, Remembr, Ma fabrique des souvenirs, Elefantia, Raconteo. Ils font tous la même chose (IA + questions + texte). **Garde-le comme extension d'Amorce**, pas comme produit séparé : ton avantage réel, c'est le montage vidéo local sans téléverser les rushes de la famille — aucun d'eux ne le fait. |
| **Non-recours aux aides sociales** | 10 Md€ non réclamés par an, prime d'activité à 39 % de non-recours, RSA à 34 % : le chiffre donne envie. Mais l'État a `mesdroitssociaux.gouv.fr` (58 aides) et mes-allocs.fr occupe le privé. Surtout, la réforme de l'**Allocation Sociale Unique** annoncée pour 2026 va rebattre RSA, APL et prime d'activité : construire un produit sur des règles qui changent l'an prochain, c'est payer deux fois. |

---

## Ce que je ferais à ta place, dans l'ordre

1. **Rien de neuf avant qu'un produit paie.** artisan-express est en ligne depuis
   aujourd'hui : la prochaine chose à faire est un client, pas un projet.
2. **Puis Le Coffre (n° 5)** — parce que c'est 80 % écrit, et que finir vaut
   mieux que commencer.
3. **Puis Le Dossier (n° 2)** — parce que c'est le seul où ton audience de
   48 000 personnes est un avantage que personne ne peut t'acheter.

Le reste attend d'avoir un chiffre d'affaires derrière.

---

## Sources

- [Non-recours aux droits : 10 Md€ non réclamés — aide-sociale.fr](https://www.aide-sociale.fr/non-recours/)
- [Non-recours aux aides sociales : 10 milliards d'euros perdus chaque année — Quelles Aides](https://www.quelles-aides.fr/mag/decryptages/non-recours-aides-sociales-10-milliards-solutions-2026/)
- [Illectronisme : 34 % des 16-74 ans en difficulté numérique — Banque des Territoires](https://www.banquedesterritoires.fr/illectronisme-34-des-16-74-ans-en-difficulte-numerique-en-2025-liag-creuse-les-ecarts)
- [L'illectronisme en chiffres — ANLCI](https://www.anlci.gouv.fr/illectronisme/lillectronisme-en-chiffres/)
- [Dossier MDPH 2026 : formulaire, pièces justificatives et délais — Quelles Aides](https://www.quelles-aides.fr/aah-handicap/mdph-handicap/dossier-mdph/)
- [RQTH 2026 : dossier MDPH, conditions, délai et droits — AdministrationFacile](https://www.administrationfacile.com/demarches/rqth-reconnaissance-travailleur-handicape-2026/)
- [Succession : 7 étapes clés après un décès en 2026 — GTLF](https://gtlf.fr/succession-7-etapes-cles-apres-deces-2026/)
- [Déclaration décès à la CPAM : démarches et capital décès — IRCEM](https://www.ircem.com/actualites/questions/declaration-deces-cpam-demarches-et-capital-deces/)
- [Postumo — accompagnement aux démarches décès](https://www.postumo.fr/)
- [Tranquillité — démarches administratives après décès](https://www.tranquillite.fr/)
- [Famirelay — l'application des aidants familiaux](https://www.famirelay.com/)
- [Nello — soutien aux aidants familiaux en France](https://nello.eu/)
- [L'aidance en France : chiffres clés 2026 — Monka](https://www.monka.care/statistiques-monka/aidant-en-france-les-chiffres-cles)
- [Comment régler un litige de la consommation — economie.gouv.fr](https://www.economie.gouv.fr/dgccrf/les-fiches-pratiques/comment-regler-un-litige-de-la-consommation)
- [Mise en demeure : définition et mentions obligatoires — litige.fr](https://www.litige.fr/articles/mise-en-demeure-definition-droit-civil)
- [Meilleures applications de coparentalité : comparatif — Copareo](https://copareo.com/blog/meilleures-applications-coparentalite-comparatif-2025)
- [Rentila — logiciel de gestion locative](https://rentila.fr/tour)
- [MaPrimeRénov' rouvre avec un rendez-vous obligatoire — MySweetImmo](https://www.mysweetimmo.com/2026/02/21/renovation-energetique-maprimerenov-rouvre-avec-un-rendez-vous-obligatoire/)
- [Mon Accompagnateur Rénov' 2026 : rôle, coût, choix](https://orelnienergie.com/2026/05/07/mon-accompagnateur-renov-mar-guide-2026/)
- [FamilyStories — La Revue française de Généalogie](https://www.rfgenealogie.com/infos/familystories-une-application-mobile-pour-ne-pas-perdre-la-memoire-des-siens)
- [Ystory — La Revue française de Généalogie](https://www.rfgenealogie.com/infos/ystory-l-application-pour-raconter-sa-vie)
