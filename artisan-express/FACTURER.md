# Facturer, quand il dit oui

Le moment le plus mal préparé de toute la chaîne : il a dit oui, il demande une
facture, et c'est là qu'on improvise. Ce fichier existe pour que non.

---

## Le SIRET existe — SIREN 109356972

Cette section demandait le numéro comme un préalable. Il est arrivé :
**SIREN 109356972**, immatriculation validée le **31/08/2026**, confirmée par le
propriétaire le 03/09. Le verrou d'encaissement de la page est levé en
conséquence (`src/lib/config.ts`).

La raison qui rendait ce numéro indispensable reste vraie et mérite d'être
relue : une facture porte obligatoirement le numéro de celui qui l'émet, et
encaisser sans être enregistré expose à des ennuis qui coûtent bien plus que
300 €.

**Le SIREN suffit légalement** sur une facture — neuf chiffres. Le SIRET en
porte quatorze, en ajoutant le code établissement, et n'est pas exigé. Écrire
l'un ou l'autre est correct ; ne rien écrire ne l'est pas.

⚠️ **Un point que je ne peux toujours pas vérifier d'ici**, et qui te concerne
directement : l'effet d'une activité déclarée sur les allocations en cours.
`service-public.fr` et `bpifrance-creation.fr` restent hors d'atteinte depuis
cette machine — mesuré, ils rendent `000`. À poser à France Travail dans le même
rendez-vous que le reliquat et l'ACRE.

Les mentions ci-dessous, en revanche, **ne sont plus écrites de mémoire** :
elles ont été vérifiées le 03/09/2026, et l'une d'elles venait de changer.

---

## La commande — une facture en trente secondes

```bash
cd artisan-express
npm run facture -- --client "LE GOFF TOITURES" \
  --adresse "12 rue des Lilas, 35000 Rennes"
```

Elle écrit un fichier HTML dans `factures/`. Tu l'ouvres, tu imprimes en PDF
depuis le navigateur, tu envoies le PDF. Toutes les mentions y sont, et le
**numéro se suit tout seul** — c'est la mention la plus contrôlée, et celle
qu'on rate en recopiant à la main.

**Au premier passage, elle refuse et écrit `factures/emetteur.json`.** Il faut
y mettre ton **IBAN** : sans lui la facture est conforme, lisible… et
impayable. C'est le seul champ à remplir, tout le reste est prérempli. Ce
fichier n'entre pas dans Git, et `factures/` non plus — il porte ton IBAN et le
nom de tes clients, et le dépôt est public.

Options : `--montant 49`, `--prestation "…"`, `--siret …`, `--livre 2026-09-05`
si la prestation a été faite un autre jour que l'émission.

**Le numéro sert de référence de virement**, et il est écrit sur la facture.
Sans lui, un virement arrive sans qu'on sache lequel il solde — au premier
client ça se devine, au dixième non.

---

## Le modèle, si tu préfères à la main

À recopier dans un document, à remplir, à envoyer en PDF. **La commande
ci-dessus fait la même chose sans risque d'oubli** ; ce gabarit reste là pour
savoir ce qu'elle produit, et pour le jour où tu factures depuis un téléphone.

> **FACTURE ⟦numéro⟧**
> Émise le ⟦date d'émission⟧
>
> **⟦Ton nom ou ta raison sociale⟧**
> ⟦Adresse complète⟧
> SIREN 109356972 — EI
> ⟦Courriel⟧ — ⟦Téléphone⟧
>
> **Facturé à**
> ⟦Nom de l'entreprise cliente⟧
> ⟦Adresse⟧
> ⟦SIRET du client, s'il en a un⟧
>
> | Prestation | Quantité | Prix unitaire | Total |
> | --- | --- | --- | --- |
> | Création d'un site vitrine d'une page, livré et mis en ligne | 1 | 300,00 € | 300,00 € |
>
> **Total : 300,00 €**
> *TVA non applicable, art. L. 233-1 du CIBS*
>
> Prestation réalisée le ⟦date de livraison⟧.
>
> **Règlement par virement**
> Titulaire : Erwann Chevallier
> IBAN ⟦ton IBAN⟧
> BIC ⟦ton BIC⟧
> Référence à indiquer : ⟦le numéro de la facture⟧
>
> Paiement à réception.
> En cas de retard : pénalités au taux légal, et indemnité forfaitaire de
> recouvrement de 40 €.

---

## Les mentions, et pourquoi chacune est là

| Mention | Ce qu'elle évite |
| --- | --- |
| **Numéro de facture**, dans une suite continue sans trou | C'est la mention la plus contrôlée. Une numérotation à trous se remarque immédiatement. Le plus simple : `2026-001`, `2026-002`. |
| **Date d'émission** et **date de la prestation** | Deux dates différentes, et les deux sont demandées. |
| **Identité complète de l'émetteur**, numéro et mention « EI » compris | Sans numéro, le document n'est pas une facture. Le SIREN suffit — voir plus haut. |
| **Identité du client** | Une facture nominative, jamais « à qui de droit ». |
| **Désignation précise de la prestation** | « Prestation de service » seul est insuffisant. |
| **Prix et total** | Ici tout est en euros nets : pas de TVA à afficher. |
| **« TVA non applicable, art. L. 233-1 du CIBS »** | **La mention qui manque le plus souvent, et elle a changé de texte le 01/09/2026** — voir l'encadré sous ce tableau. Sans elle, un client peut croire qu'il paie de la TVA récupérable, et son comptable revient dessus. |
| **Conditions de règlement et pénalités** | Obligatoires entre professionnels, y compris quand on n'a aucune intention de les appliquer. |

### La mention de TVA a changé il y a deux jours

Vérifié le 03/09/2026, et c'est le genre de détail qu'on recopie d'un vieux
modèle sans le voir : depuis le **1er septembre 2026**, la formule
« TVA non applicable, art. 293 B du CGI » est remplacée par
**« TVA non applicable, art. L. 233-1 du code des impositions sur les biens et
services (CIBS) »**.

**Rien ne brûle** : une tolérance court **jusqu'au 30 juin 2028**, et une facture
portant l'ancienne formule reste acceptée d'ici là. Mais la première facture de
cette activité tombe pile dans la semaine du changement — autant écrire la bonne
tout de suite plutôt que de reprendre un modèle dans deux ans.

**Et « EI » se met à côté du nom.** L'entrepreneur individuel doit faire suivre
son identité de ces deux lettres, sur la facture comme sur le site.

---

## Ce qu'on ne fait pas

**On n'encaisse pas avant d'avoir livré.** Le délai est de 48 h : demander un
acompte à quelqu'un qui ne te connaît pas ajoute une friction au seul moment où
il a dit oui. Livrer d'abord, montrer, puis facturer — c'est aussi ce qui rend
la garantie crédible.

**On ne facture pas une modification comprise.** `APRES-LA-LIVRAISON.md` dit ce
qui l'est et ce qui ne l'est pas. Une facture surprise pour un changement de
numéro de téléphone coûte le bouche-à-oreille, qui vaut bien plus que 300 €.

**On garde une copie de chaque facture.** Pas dans ce dépôt — il est public.
