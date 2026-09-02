# Aller chercher les trois premiers clients

La page à 300 € ne se vend pas toute seule. Personne n'arrive dessus par
hasard : il faut aller voir des artisans un par un. Ce fichier contient les
messages, et surtout **ce qui les empêche d'être du spam**.

---

## La règle qui décide de tout

**Chaque message contient une phrase que toi seul peux écrire : ce que tu as
réellement vu sur sa page.** Sans elle, c'est un publipostage, ça se sent en
deux secondes, et ça brûle le prospect pour de bon.

Dans tous les modèles ci-dessous, cette phrase est marquée `⟦…⟧`. Si tu n'as
rien à y mettre, c'est que tu n'as pas regardé — et il vaut mieux passer au
suivant que d'envoyer un message creux.

Trente secondes sur sa page suffisent. Ce qu'on y trouve, presque à chaque
fois :

- la dernière publication date de 2022 ;
- il y a des photos de chantier, mais aucun numéro visible ;
- les avis sont bons et personne ne les voit ;
- il répond aux messages, donc il est joignable ;
- il n'y a pas de site, ou un lien mort vers un annuaire payant.

---

## 1. Le premier contact

Par Messenger, sur sa page. Court : il le lit sur un chantier, entre deux
choses.

> Bonjour ⟦prénom⟧,
>
> Je suis tombé sur votre page en cherchant un ⟦métier⟧ sur ⟦ville⟧. ⟦Ce que
> vous avez vu — « vos photos de la toiture de la rue X sont franchement
> belles, et je n'ai trouvé votre numéro nulle part »⟧.
>
> Je fais des sites d'une page pour les artisans : votre métier, vos photos,
> votre numéro, et un bouton pour vous appeler. 300 € une fois, livré en 48 h,
> pas d'abonnement.
>
> Je ne suis pas une agence — je suis chauffeur poids lourd, je fais ça à côté,
> et je préfère le dire tout de suite.
>
> Ça vous parle, ou vous êtes déjà équipé ?

**Ce que fait ce message, et pourquoi chaque morceau est là :**

- Le prénom et la ville prouvent qu'il y a quelqu'un derrière.
- L'observation précise prouve que tu as regardé.
- **Le prix est dans le premier message.** Le cacher pour « créer un échange »
  est le réflexe du commercial, et l'artisan le repère : il a déjà eu vingt
  appels d'annuaires qui ne donnent le tarif qu'à la fin.
- « Je ne suis pas une agence » n'est pas de la modestie, c'est ton avantage.
  Il s'est déjà fait avoir par une agence.
- La question laisse une sortie honorable. **« Vous êtes déjà équipé ? » n'est
  pas une question de vente** — elle rend possible un non sans gêne, et c'est
  ce qui fait qu'on te répond.

**Ce qu'il ne fait pas**, et c'est délibéré : aucune urgence inventée, aucune
place limitée, aucun « vos concurrents ont déjà un site ». Ces procédés
marchent une fois et grillent le reste.

---

## 2. La relance, sept jours après

Une seule. Pas deux.

> Bonjour ⟦prénom⟧,
>
> Je reviens vers vous une fois, et je n'insisterai pas — vous avez sûrement
> autre chose à faire qu'à répondre à un inconnu.
>
> Si le sujet du site revient un jour, ma proposition tient : 300 €, une page,
> 48 h. Vous m'écrivez, on en reparle.
>
> Bonne continuation, et belle saison.

**Pourquoi une seule relance.** Deux relances transforment une proposition en
harcèlement, et un artisan qui se sent harcelé le raconte à ses collègues —
sur un métier où tout le monde se connaît, c'est le pire résultat possible.
Dire « je n'insisterai pas » et le tenir vaut mieux qu'un troisième message.

---

## 3. Quand il demande à voir

C'est la question la plus fréquente, et la meilleure : il est intéressé. Elle
arrive sous vingt formes — « ça ressemble à quoi ? », « vous avez des
exemples ? », « c'est quoi exactement pour 300 € ? ».

> Tenez, un exemple complet : ⟦adresse de ta démonstration⟧
>
> C'est une entreprise inventée — je le dis sur la page, je ne vais pas vous
> faire croire à un vrai client alors que vous seriez le premier. Mais c'est
> exactement ce que vous recevez : votre nom, vos services, votre zone, vos
> photos, et le bouton d'appel en haut.
>
> Ouvrez-le sur votre téléphone, c'est là qu'il sera lu.

**Où trouver cette adresse :** ta page de vente sert la démonstration à
`/exemple.html`. Si ta page est à `https://truc.vercel.app`, le lien est
`https://truc.vercel.app/exemple.html`. **Ouvre-le une fois toi-même avant de
l'envoyer** — un lien mort dans le message qui suit un « oui, montrez-moi »
coûte la vente, et c'est le pire moment pour le découvrir.

**Pourquoi le lien n'est pas dans le premier message.** Un lien dans un message
non sollicité fait deux choses, toutes deux mauvaises : il fait tomber le
message plus souvent dans les demandes filtrées de Messenger, et il ressemble à
ce que font les robots. Envoyé **en réponse à sa question**, il ne coûte rien et
arrive au moment où il veut le voir.

**Et « je le dis sur la page » n'est pas une précaution de langage.** La
démonstration porte elle-même la mention qu'elle est fictive. Un artisan qui
découvrirait tout seul que l'exemple est inventé ne rappellerait pas — le dire
avant lui transforme le seul point faible en preuve d'honnêteté.

---

## 3 bis. Le coup qui change tout : la démonstration **à son nom**

Le lien de la section précédente montre le site d'une entreprise inventée. Il
fait le travail. Mais il existe mieux, et ça coûte trente secondes :

```bash
cd titan-builder
npm run demo-prospect -- --entreprise "LE GOFF TOITURES" \
  --metier couvreur --ville Rennes --telephone "02 99 00 00 00"
```

Tu obtiens un fichier `index.html` avec **son enseigne en haut**, sa ville, ses
prestations et son numéro. Tu l'envoies **tel quel dans la conversation** — un
seul fichier, aucun hébergement, aucun lien qui meurt : Messenger et WhatsApp
acceptent les pièces jointes, et son téléphone l'ouvre dans le navigateur.

Métiers prévus : `couvreur`, `macon`, `plombier`, `electricien`, `menuisier`,
`peintre`. `--services "Toiture;Zinguerie;Velux"` remplace la liste par la
sienne — et c'est ce qu'il faut faire dès qu'on a lu sa page : ses mots à lui
valent mieux que les meilleurs mots génériques.

**Pourquoi ça marche là où le lien générique fait tiède.** Il ne se demande plus
« à quoi ça ressemblerait » — il le voit. La question passe de « est-ce que
j'achète un site » à « est-ce que je garde celui-là ». Ce n'est pas la même
décision, et ce n'est pas le même taux de réponse.

**Trois choses que le script fait tout seul, et qu'il ne faut jamais défaire :**

1. La page porte une **mention forcée** : « une proposition, préparée pour X —
   ce n'est pas votre site officiel, elle n'est en ligne nulle part ». Sans
   elle, une page qui affiche l'enseigne de quelqu'un devient son site aux yeux
   de n'importe qui. Il n'existe aucune option pour l'enlever, exprès.
2. La page sort en **`noindex, nofollow`**. Elle ne peut pas remonter dans
   Google à la place du vrai artisan.
3. **Le numéro se recopie depuis sa page, jamais ne s'invente.** Le script le
   refuse s'il manque, et un faux numéro sous son enseigne serait pire que pas
   de démonstration du tout.

**Et le fichier produit ne monte pas dans Git** : `titan-builder/demos/` est
ignoré, comme `prospects.md`. Il porte le nom et le numéro d'une vraie
entreprise, et ce dépôt est public.

---

## 4. Quand il répond « c'est trop cher »

Ne jamais baisser le prix. Un prix qui bouge au premier doute dit que le
premier prix était faux.

> Je comprends. 300 €, c'est une journée de chantier.
>
> Ce que je peux vous dire, c'est ce que ça remplace : les annuaires qui
> prennent 40 ou 50 € par mois vous coûtent ça en six mois, et le jour où vous
> arrêtez de payer, votre fiche disparaît. Là, le site est à vous, il n'y a
> plus rien à payer ensuite.
>
> Si ce n'est pas le moment, ce n'est pas grave. Gardez mon numéro.

**Le déplacement est le seul argument honnête** : on ne dit pas que c'est peu
cher, on dit à quoi ça se compare. Et « si ce n'est pas le moment » se dit
sincèrement — sinon c'est une pression déguisée, et ça s'entend.

---

## 5. Quand il dit oui

C'est le moment où on perd des clients par flottement. Réponds dans l'heure,
et demande **tout d'un coup**.

> Parfait. Pour démarrer, j'ai besoin de quatre choses :
>
> 1. Votre nom et le nom de l'entreprise, tels que vous voulez les voir écrits
> 2. Le numéro sur lequel on doit vous appeler
> 3. Trois ou quatre photos de vos plus beaux chantiers
> 4. Les communes où vous vous déplacez
>
> Vous m'envoyez ça quand vous voulez, je vous montre le site sous 48 h. Vous
> payez une fois que vous l'avez vu et qu'il vous plaît.

**« Vous payez une fois que vous l'avez vu »** est ce qui débloque le premier
client. Tu n'as pas encore de références à montrer : c'est toi qui prends le
risque, pas lui. Ça ne se dit qu'aux premiers — dès qu'il y a trois sites en
ligne, l'acompte redevient normal.

---

## 6. Au téléphone

Tout ce qui précède s'écrit. L'appel obéit à d'autres règles, et il convertit
mieux — un artisan répond à un numéro, il laisse traîner un message.

**Quand appeler.** Entre 12 h et 13 h 30, ou après 17 h 30. Jamais 8 h : il
charge sa camionnette et il t'en voudra.

**Les vingt premières secondes**, et elles décident du reste :

> Bonjour, ⟦prénom⟧ ? Erwann Chevallier. Je ne vous vends pas d'annuaire,
> rassurez-vous — je fais des sites pour les artisans et je suis tombé sur
> votre page. ⟦Ce que vous avez vu.⟧ Vous avez deux minutes, ou je vous
> rappelle ?

Trois choses en trois phrases : qui, **ce que tu n'es pas**, et la permission
de raccrocher. « Je ne vous vends pas d'annuaire » désamorce la garde qu'il a
levée dès « bonjour » — il en reçoit trois par semaine.

**Ensuite, tu te tais.** C'est le plus dur et c'est ce qui vend. La question
« vous avez un site ? » ouvre tout, et sa réponse te donne le reste de l'appel.

**Ce qui se dit en fin d'appel, quoi qu'il ait répondu :**

> Je vous envoie une page à votre nom, vous regardez tranquillement ce soir.
> Si ça ne vous parle pas, vous ne me rappelez pas et il n'y a pas de souci.

Puis tu envoies la démonstration nominative **dans l'heure**, tant que la
conversation est chaude. C'est là que la section 3 bis paie.

**Le seul chiffre à noter, et il tient sur un coin de feuille :** appelés,
décrochés, intéressés. Trois colonnes. Sans elles, au bout de trente appels tu
ne sauras pas s'il faut changer le message ou seulement en passer plus.

---

## Le rythme, et ce qu'on peut en attendre

**Dix messages par jour, pas cent.** Cent messages identiques se voient, se
signalent, et font fermer le compte. Dix messages où chacun contient une
observation réelle prennent une heure et convertissent.

Ce qui se passe en général, et il vaut mieux le savoir avant de commencer :

- sur dix messages, **deux ou trois réponses** ;
- sur ces réponses, **un rendez-vous téléphonique** ;
- sur trois ou quatre appels, **une vente**.

Ce ne sont pas des chiffres mesurés sur ton offre — personne ne les a encore
mesurés. Ce sont les ordres de grandeur habituels de la prospection directe,
et ils servent à une seule chose : **savoir que zéro réponse sur les dix
premiers messages est normal, et que ce n'est pas le moment d'arrêter.**

Le vrai chiffre, tu l'auras après trente messages. Note-les : combien envoyés,
combien de réponses, combien d'appels. C'est la seule façon de savoir si c'est
le message qu'il faut changer, ou simplement le nombre.

---

## Où trouver les artisans

Par ordre de facilité, et sans rien payer :

1. **Facebook, recherche « maçon ⟦ta ville⟧ »**, puis les pages sans site.
2. **Google Maps**, même recherche : les fiches sans site web sont marquées.
3. **Les groupes locaux d'entraide** — quelqu'un demande un couvreur, trois
   artisans répondent, tu as trois pages à regarder.

Commence par ta propre région. Un artisan répond plus volontiers à quelqu'un
qui connaît les communes qu'il cite.
