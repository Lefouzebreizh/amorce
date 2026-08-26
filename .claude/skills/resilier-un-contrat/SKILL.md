---
name: resilier-un-contrat
description: Résilier un abonnement, une assurance ou un contrat à reconduction tacite avec `paper-manager` — savoir jusqu'à quand c'est encore possible sans frais, quel texte invoquer, et produire le courrier prêt à signer avec les mentions qui le rendent opposable. À utiliser dès qu'une demande dit « je veux résilier », « comment arrêter mon abonnement », « mon assurance se renouvelle », « lettre de résiliation », « puis-je encore annuler », « ils m'ont prévenu trop tard », ou parle de préavis, de reconduction tacite, de loi Chatel, de fin d'engagement, ou de frais pour partir avant le terme.
---

# Résilier un contrat

Outillé par `paper-manager`. Le geste tient en une commande, mais **la date
compte plus que la lettre** : la même résiliation coûte zéro ou une année selon
le jour où elle part.

## D'abord : jusqu'à quand ?

```bash
cd paper-manager
python3 paper.py etat        # la date de préavis de chaque contrat, et le coût d'un départ
```

La date affichée est celle du **préavis**, jamais celle du terme. Un contrat
qui se termine le 1er novembre avec deux mois de préavis n'est plus résiliable
après le 2 septembre : le 3, l'année suivante est due.

## Ensuite : le courrier

```bash
python3 paper.py resilier maif-habitation                    # PDF prêt à signer
python3 paper.py resilier orange-fibre --texte               # à coller dans un formulaire en ligne
python3 paper.py resilier salle-sport --motif "un déménagement"
```

Le gabarit est choisi par la situation, pas par l'utilisateur :

| Situation | Ce que dit la lettre | Effet |
| --- | --- | --- |
| Avis d'échéance **reçu** moins de 15 jours avant la fin du préavis | Loi Chatel : le délai rouvre | au terme |
| Le préavis peut encore être respecté | Résiliation à l'échéance, préavis cité | au terme, **sans frais** |
| Assurance ou mutuelle en cours depuis plus d'un an, préavis dépassé | Résiliation à tout moment | un mois après réception |
| Tout le reste | Texte neutre | un mois |

`--gabarit <nom>` force un autre texte de `modeles/`, `paper.py resilier --help`
liste le reste.

## Les cinq règles qui décident

- **Le préavis, pas l'échéance.** C'est la seule date qui compte, et elle n'est
  écrite nulle part sur le contrat : elle se calcule.
- **Un an de contrat ouvre la porte** pour une assurance ou une complémentaire
  santé : résiliation à tout moment, sans frais ni pénalité, sans motif à
  donner, effet un mois après la notification, et remboursement du prorata de
  cotisation non couru. C'est la voie quand le préavis est manqué.
- **Un avis d'échéance en retard rouvre le délai** (loi Chatel). Mais un avis
  **à venir** ne fonde rien : tant que la date de réception est dans le futur,
  la lettre ne peut pas affirmer avoir reçu ce courrier — elle se ferait écarter
  d'un revers. C'est pourquoi `date_avis_echeance` se note **en ouvrant le
  courrier**, jamais à l'avance.
- **Un contrat souscrit en ligne se résilie en ligne**, par une fonction dédiée
  et gratuite. Quand `resiliable_en_ligne` est vrai, la commande le rappelle et
  donne l'adresse : le courrier ne sert alors que de preuve.
- **Le texte invoqué dépend de qui est en face** : code des assurances pour un
  assureur, code de la sécurité sociale pour une complémentaire santé, code de
  la consommation pour tout le reste. Le mauvais article affaiblit exactement la
  lettre qu'on voulait rendre opposable.

## Avant d'envoyer

Le programme refuse de produire un fichier auquel manque l'une des mentions qui
rendent la lettre opposable — référence client, contrat visé, date d'effet,
demande de confirmation écrite. Il reste trois choses qu'il ne peut pas faire :

1. **Relire.** C'est une lettre signée de son nom.
2. **Choisir le recommandé.** La commande le signale quand le contrat l'exige :
   en cas de litige, c'est la **preuve de l'envoi** qui fait foi, pas le contenu.
3. **Envoyer.** Rien ne part tout seul ; un courrier administratif parti par
   erreur ne se rattrape pas.

## Après

```bash
python3 paper.py etat --traiter <id-alerte>   # l'échéance ne revient plus
python3 paper.py agenda                       # le rappel disparaît du téléphone
```

Tant que la confirmation écrite n'est pas arrivée, garder l'alerte ouverte : un
prélèvement qui continue après une résiliation est le cas où l'on cherche, trois
mois plus tard, la preuve de ce qu'on a envoyé. Le courrier produit reste dans
`coffre/courriers/`, daté.

## Si le contrat est encore sous engagement

`paper.py etat` chiffre ce que coûte un départ immédiat — les mois restants de
la **première** période, celle qui engage réellement. Une assurance reconduite
depuis quatre ans ne coûte rien à quitter, même si son contrat porte une durée
de douze mois : les reconductions tacites n'engagent pas. Ne jamais annoncer un
coût de sortie sans avoir vérifié ce point, sous peine de faire renoncer à une
résiliation gratuite.
