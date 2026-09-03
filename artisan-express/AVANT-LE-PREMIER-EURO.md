# Avant le premier euro réel

*État au 03/09/2026, après confirmation du SIRET — SIREN 109356972, validé le
31/08. Ce fichier est une liste de contrôle, pas un récit : ce qui est fait
disparaît, ce qui reste porte le nom de celui qui peut le faire.*

---

## Fait, et vérifié

- ✅ **La page est en ligne**, publique, sans mur d'authentification :
  https://artisan-express-ashy.vercel.app
- ✅ **Le verrou d'encaissement est levé.** `ENCAISSEMENT_OUVERT` dans
  `src/lib/config.ts` et `SIRET_ACTIF` dans `src/components/Offre.tsx` sont
  passés à `true`, le SIREN est écrit à côté, et un test refuse qu'on l'efface
  (éprouvé par sabotage : 29/30 sans lui, 30/30 avec).
- ✅ **`FACTURER.md` est à jour** : le gabarit porte le SIREN et la mention « EI »,
  et la formule de TVA a été corrigée — voir le point 6 ci-dessous, elle a changé
  il y a deux jours.
- ✅ **La démonstration nominative** se fabrique en une commande
  (`npm run demo-prospect` dans `titan-builder/`).

---

## Ce qui manque, dans l'ordre où ça bloque

### Bloc A — encaisser en ligne

**Le code est prêt et n'attend qu'une chose : un lien de paiement.** `aUnStripe`
exige `ENCAISSEMENT_OUVERT` **et** `NEXT_PUBLIC_LIEN_STRIPE`. Le verrou est
ouvert ; sans le lien, le bouton continue de mener au formulaire, exactement
comme avant. **C'est voulu** : un bouton « payer » qui ne mène nulle part coûte
le client et la réputation d'un coup.

| # | Ce qu'il reste | Qui | Pourquoi lui |
| --- | --- | --- | --- |
| 1 | **Créer et activer le compte Stripe** — pièce d'identité, SIREN, IBAN | **Erwann** | Je n'ai aucun accès Stripe, et un compte de paiement ne se crée pas au nom de quelqu'un d'autre |
| 2 | **Créer un lien de paiement à 300 €** (Stripe → Paiements → Liens de paiement). Il ressemble à `https://buy.stripe.com/…` | **Erwann** | idem |
| 3 | **Me donner ce lien** | Erwann | il entre dans le paquet à la compilation |
| 4 | **Poser `NEXT_PUBLIC_LIEN_STRIPE` et redéployer** | **moi** | — |

**Le piège du point 4, et il est réel :** le projet Vercel `artisan-express` est
né d'un **dépôt de fichiers**, pas d'un lien Git. Poser la variable dans le
tableau de bord **ne suffit pas** — Next remplace les `NEXT_PUBLIC_*` à la
compilation, et il n'y a pas de recompilation automatique. Il faut un nouveau
dépôt, que je fais. Donc : tu m'envoies le lien, je m'occupe du reste.

**Et je n'ai pas d'outil pour poser une variable d'environnement sur Vercel** —
vérifié aujourd'hui. Je la mets dans le paquet que je dépose.

### Bloc B — ce qui est obligatoire avant de vendre, et qui manque

| # | Ce qu'il reste | Qui | Ce qu'il me faut |
| --- | --- | --- | --- |
| 5 | **Les mentions légales** sur la page — obligatoires pour un site commercial | **moi**, avec tes infos | dénomination exacte (« Erwann Chevallier — EI » ?), **adresse du siège**, courriel de contact. L'hébergeur, je l'ai (Vercel Inc.) |
| 6 | **La mention de TVA à jour sur les factures** | fait, à connaître | depuis le **01/09/2026** c'est « TVA non applicable, **art. L. 233-1 du CIBS** », plus « art. 293 B du CGI ». Tolérance jusqu'au 30/06/2028, donc rien ne brûle — mais ta première facture tombe pile dans la semaine du changement |
| 7 | **Des conditions de vente** — délai de 48 h, la modification comprise, la propriété du code, le remboursement | **moi**, sur ta décision | une seule réponse : rembourses-tu si le site ne plaît pas ? `PROSPECTION.md` promet déjà « tu payes une fois que tu l'as vu », ce qui règle la question autrement et mieux |

Je ne peux pas inventer l'adresse du siège : c'est la seule ligne qui manque
pour que je livre les mentions légales dans la foulée.

### Bloc C — ce qui fait que la page convertit

Ce ne sont pas des blocages légaux, mais chacun coûte des ventes, et aucun ne
demande de code — seulement des valeurs que je pose au prochain déploiement.

| # | Variable | Ce que ça change |
| --- | --- | --- |
| 8 | `NEXT_PUBLIC_TELEPHONE` | **Le plus cher des quatre.** Sans lui, le bandeau du bas n'a qu'un bouton, l'entête ne propose pas d'appeler, et un artisan qui veut téléphoner ne peut pas |
| 9 | `NEXT_PUBLIC_WHATSAPP` | le second bouton du bandeau |
| 10 | `NEXT_PUBLIC_SITE_URL` | l'aperçu quand tu partages le lien par SMS ou Messenger — aujourd'hui il n'y en a aucun |
| 11 | `RESEND_API_KEY` + `DEVIS_DESTINATAIRE` | le formulaire t'envoie un courriel au lieu de basculer sur le repli `mailto`. Le repli marche, mais il demande un geste de plus au prospect |

### Bloc D — ce qui amène quelqu'un sur la page

| # | Ce qu'il reste | Qui |
| --- | --- | --- |
| 12 | **50 artisans contactés** | **Erwann** — Facebook et Google Maps sont hors d'atteinte depuis cette machine, mesuré |
| 13 | Les démonstrations nominatives correspondantes | moi, dès que la liste existe |

---

## Le chemin le plus court jusqu'à 300 €

Il ne passe **pas** par Stripe, et c'est le point que cette liste rend visible.

Un site à 300 € se règle très bien **par virement**, de la main à la main, dès
que la facture est émise. Le SIREN existe, `FACTURER.md` est à jour, la page est
en ligne : **tu peux encaisser aujourd'hui**, sans attendre un seul des points
du bloc A.

Stripe sert à encaisser *depuis la page*, sans toi. C'est mieux — mais c'est un
confort, pas un prérequis. Les points 8 à 13 rapportent plus vite que les points
1 à 4.

**Donc l'ordre réel :**

1. ~~Le **téléphone** dans les variables~~ — fait le 03/09.
2. ~~Les **mentions légales**~~ — faites, en ligne, `/mentions-legales`.
3. ~~L'**IBAN** dans `factures/emetteur.json`~~ — fait le 03/09, contrôlé
   trois fois, facture d'essai rendue et regardée. **La chaîne d'encaissement
   par virement est complète de bout en bout.**
4. Les **50 artisans** (point 12) — **c'est le seul point qui reste entre toi
   et 300 €**, et il ne peut venir que de toi : aucune plateforme sociale
   n'est joignable depuis une session.
5. La **facture par virement** au premier qui dit oui : une commande, le PDF
   part.
6. Stripe pendant que ça tourne.

---

## Et l'autre produit — Amorce

La question a été posée : débloque-t-on aussi le serveur de licence dans le même
geste ?

**Ce n'est pas une question de priorité, c'est un mur.** `wrangler deploy`
demande un `CLOUDFLARE_API_TOKEN`, et cette session n'en a aucun — vérifié :
zéro variable Cloudflare dans l'environnement, aucune session `wrangler`
ouverte. La base D1 existe pourtant déjà (`wrangler.toml` porte son
`database_id`), donc il ne manque que le jeton.

Deux façons de le lever, au choix :

- **tu déposes le Worker toi-même** depuis ta machine — `cd licence-serveur &&
  npx wrangler deploy` — c'est une commande, et le code est vert (14 tests) ;
- **tu me donnes un jeton d'API Cloudflare** et je le fais d'ici.

Tant que ni l'un ni l'autre n'arrive, Amorce ne peut pas encaisser, quoi qu'on
fasse — et c'est pour ça que la réponse est **artisan-express d'abord** : pas
parce que je le préfère, parce que l'autre est fermé de l'extérieur.
