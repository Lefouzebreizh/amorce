# Facturer, quand il dit oui

Le moment le plus mal préparé de toute la chaîne : il a dit oui, il demande une
facture, et c'est là qu'on improvise. Ce fichier existe pour que non.

---

## Avant tout : il faut un SIRET

Une facture porte obligatoirement le numéro SIRET de celui qui l'émet. Pas de
SIRET, pas de facture — et encaisser une prestation sans être enregistré expose
à des ennuis qui coûtent bien plus que 299 €.

Si ce numéro n'existe pas encore, **c'est la première chose à faire**, avant le
premier message de prospection. L'inscription en micro-entrepreneur se fait en
ligne, elle est gratuite, et le numéro arrive en une à trois semaines. Rien
d'autre dans ce dépôt ne dépend de ça — mais l'encaissement, si.

⚠️ **Deux points que je ne peux pas vérifier d'ici**, et qui te concernent
directement : l'effet d'une activité déclarée sur des allocations en cours, et
la liste exacte des mentions ci-dessous. `service-public.fr` et
`bpifrance-creation.fr` sont hors d'atteinte depuis cette machine — mesuré, ils
rendent `000`. Ce qui suit est écrit de mémoire et **se vérifie une seule fois**,
avant la première facture. Après, c'est réglé pour toutes les suivantes.

---

## Le modèle

À recopier dans un document, à remplir, à envoyer en PDF.

> **FACTURE ⟦numéro⟧**
> Émise le ⟦date d'émission⟧
>
> **⟦Ton nom ou ta raison sociale⟧**
> ⟦Adresse complète⟧
> SIRET ⟦14 chiffres⟧
> ⟦Courriel⟧ — ⟦Téléphone⟧
>
> **Facturé à**
> ⟦Nom de l'entreprise cliente⟧
> ⟦Adresse⟧
> ⟦SIRET du client, s'il en a un⟧
>
> | Prestation | Quantité | Prix unitaire | Total |
> | --- | --- | --- | --- |
> | Création d'un site vitrine d'une page, livré et mis en ligne | 1 | 299,00 € | 299,00 € |
>
> **Total : 299,00 €**
> *TVA non applicable, article 293 B du CGI*
>
> Prestation réalisée le ⟦date de livraison⟧.
> Paiement à réception. Règlement par ⟦virement / espèces / lien de paiement⟧.
> En cas de retard : pénalités au taux légal, et indemnité forfaitaire de
> recouvrement de 40 €.

---

## Les mentions, et pourquoi chacune est là

| Mention | Ce qu'elle évite |
| --- | --- |
| **Numéro de facture**, dans une suite continue sans trou | C'est la mention la plus contrôlée. Une numérotation à trous se remarque immédiatement. Le plus simple : `2026-001`, `2026-002`. |
| **Date d'émission** et **date de la prestation** | Deux dates différentes, et les deux sont demandées. |
| **Identité complète de l'émetteur**, SIRET compris | Sans SIRET, le document n'est pas une facture. |
| **Identité du client** | Une facture nominative, jamais « à qui de droit ». |
| **Désignation précise de la prestation** | « Prestation de service » seul est insuffisant. |
| **Prix et total** | Ici tout est en euros nets : pas de TVA à afficher. |
| **« TVA non applicable, art. 293 B du CGI »** | **La mention qui manque le plus souvent.** Sans elle, un client peut croire qu'il paie de la TVA récupérable, et son comptable revient dessus. |
| **Conditions de règlement et pénalités** | Obligatoires entre professionnels, y compris quand on n'a aucune intention de les appliquer. |

---

## Ce qu'on ne fait pas

**On n'encaisse pas avant d'avoir livré.** Le délai est de 48 h : demander un
acompte à quelqu'un qui ne te connaît pas ajoute une friction au seul moment où
il a dit oui. Livrer d'abord, montrer, puis facturer — c'est aussi ce qui rend
la garantie crédible.

**On ne facture pas une modification comprise.** `APRES-LA-LIVRAISON.md` dit ce
qui l'est et ce qui ne l'est pas. Une facture surprise pour un changement de
numéro de téléphone coûte le bouche-à-oreille, qui vaut bien plus que 299 €.

**On garde une copie de chaque facture.** Pas dans ce dépôt — il est public.
