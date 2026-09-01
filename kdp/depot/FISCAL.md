# Le questionnaire fiscal — celui qui décide du rang un

`projets-actifs/ordre-de-mise-en-vente.md` laisse deux chantiers à égalité au
rang **1 ?**, et une seule question les départage : **les redevances d'auteur
KDP peuvent-elles être versées sans SIRET ?** Artisan Express, lui, vend une
prestation de service — facturer sans numéro n'est pas possible, et son
encaissement en ligne est fermé pour cette raison exacte.

Ce questionnaire est la façon d'obtenir la réponse. Il est **gratuit**, il
**ne publie rien**, et il se refait autant de fois qu'on veut.

État au 31/08/2026 : **compte KDP ouvert, questionnaire non rempli.**

---

## Ce qu'il est, et ce qu'il n'est pas

C'est un **formulaire américain**. Amazon paie depuis les États-Unis et doit
déclarer au fisc américain ce qu'elle verse et à qui. Le questionnaire sert à
deux choses, et à rien d'autre : savoir si vous êtes une personne américaine,
et fixer le taux de retenue à la source sur vos redevances.

**Il ne demande pas de SIRET.** Le SIRET est un identifiant d'entreprise
française ; ce formulaire n'a pas de champ pour lui. Ce n'est pas une
tolérance, c'est qu'il ne pose pas la question.

**Ce qu'il ne règle pas :** comment vous déclarez ces revenus en France. C'est
une autre question, elle relève du fisc français et pas d'Amazon, elle ne bloque
pas l'encaissement, et l'immatriculation est de toute façon en cours au guichet
unique. Rien de ce fichier n'est un conseil fiscal.

---

## Où il se trouve

Pas dans le livre — dans le compte. Le titre et le questionnaire sont deux
chemins séparés, et celui-ci se remplit **avant** d'avoir quoi que ce soit à
publier.

> KDP → **Mon compte** → *Informations fiscales* → **Remplir le questionnaire fiscal**

---

## Écran par écran

**1. Êtes-vous une personne américaine ?** → Non.

**2. Particulier ou entreprise ?** → **Particulier** *(Individual)*.

C'est **l'écran qui décide**. Le parcours « particulier » aboutit à un
formulaire W-8BEN, qui est celui des personnes physiques. Le parcours
« entreprise » aboutit à un W-8BEN-E et réclame des pièces d'entité que vous
n'avez pas encore. Tant que le SIRET n'est pas validé, il n'y a rien à déclarer
comme entreprise : c'est « particulier », et ce n'est pas un contournement.

**3. Identité et adresse.** Nom, prénom, adresse en France. Le nom doit être le
vôtre, pas le nom de plume — c'est le bénéficiaire du virement.

**4. Numéro d'identification fiscale.**

| Ce qu'on demande | Ce qu'on répond |
| --- | --- |
| Numéro fiscal **américain** (SSN / ITIN / EIN) | Vous n'en avez pas — cochez la case prévue |
| Numéro fiscal **étranger** | Votre **numéro fiscal français**, 13 chiffres |

Le numéro fiscal se lit **en haut de la première page de votre avis d'impôt sur
le revenu**, sous « Votre numéro fiscal ». Il est aussi affiché dans votre
espace sur `impots.gouv.fr`.

**Deux pièges, et ils se ressemblent :**

- Ce n'est **pas le numéro de sécurité sociale**. Plusieurs guides en ligne
  parlent de « numéro INSEE » à cet endroit — c'est une confusion entre
  l'identifiant social et l'identifiant fiscal. Ne la suivez pas : lisez le
  numéro sur l'avis.
- Ce n'est **pas le SIRET**, y compris quand il sera arrivé. Le SIRET identifie
  une entreprise, ce champ identifie un contribuable.

**5. Traité fiscal France–États-Unis.** Demandez le bénéfice du traité. Sans
numéro fiscal renseigné, la retenue par défaut est de **30 %** ; le traité la
réduit. **Le formulaire affiche le taux qu'il va appliquer — c'est le chiffre
à noter**, pas celui que vous aurez lu ailleurs.

**6. Signature électronique**, puis un récapitulatif et un statut.

---

## Ce qu'il faut noter en sortant

C'est la mesure, et elle tient en trois lignes. Sans elles, le rang 1 reste
indécidable.

| À relever | Réponse |
| --- | --- |
| Le questionnaire est-il allé au bout **en particulier**, sans jamais réclamer de numéro d'entreprise ? | |
| Taux de retenue affiché à la fin | |
| Statut affiché ensuite *(en cours de validation / validé / autre)* | |

---

## Ce que chaque réponse décide

**Il est allé au bout sans numéro d'entreprise** → **KDP est premier, sans
discussion.** C'est le seul chantier qui a déjà son public — 48 000 personnes —
et le seul qui encaisserait avant le SIRET. Le geste suivant n'est alors pas de
fabriquer une image : c'est d'assembler avec la couverture provisoire, de
déposer, et de **commander l'épreuve papier** — voir `EPREUVE.md`, dont les deux
semaines d'impression courent pendant qu'on travaille la couverture définitive.
Les champs du formulaire de dépôt sont prêts à coller dans `FICHE-KDP.md`, et la
suite est dans `../lancement/PLAN-DE-LANCEMENT.md`.

**Il a réclamé un numéro d'entreprise** → KDP bute sur le même mur qu'Artisan
Express. Les deux attendent le SIRET, et le classement se rejoue sur d'autres
critères. Écrivez-le dans `projets-actifs/ordre-de-mise-en-vente.md` : c'est
une réponse qui vaut autant que l'autre, et qui ferme la question.

---

## Ce que ce fichier n'affirme pas

**Le formulaire à l'écran l'emporte sur ce fichier.** Les cotes, les libellés et
les taux bougent d'une année à l'autre — comme le rappelle déjà `FICHE-KDP.md`
pour les champs du dépôt.

Et une limite qui doit être écrite : `kdp.amazon.com` est **inaccessible depuis
une session** — refusé par le mandataire de sortie, mesuré le 31/08/2026. Ce
qui précède vient donc de sources de seconde main, pas de la documentation
d'Amazon lue directement. La structure du parcours (personne américaine,
particulier ou entreprise, W-8BEN, numéro fiscal étranger, traité) est
concordante d'une source à l'autre ; **les taux et les libellés exacts ne le
sont pas**, et c'est pourquoi la mesure ci-dessus se relève à l'écran plutôt
que de se recopier ici.

Sources consultées le 31/08/2026 :
[Vappingo](https://www.vappingo.com/word-blog/kdp-taxes-for-authors/) ·
[PublishRank](https://publishrank.io/learn/operations/kdp-tax-information) ·
[BookBeam](https://bookbeam.io/blog/how-to-escape-30-tax-withholding-as-a-non-us-self-publisher-a-quick-guide/) ·
[MYeBook](https://myebook.online/amazon-kdp-tax-interview/)
