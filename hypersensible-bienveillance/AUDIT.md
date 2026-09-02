# Audit de sécurité — Hypersensible & Bienveillance

**Date** : 02/09/2026 · **Périmètre** : `hypersensible-bienveillance/` (2 093 lignes)
**Posture** : lecture seule. Aucun fichier de code modifié.

Un constat, et il porte sur ce qui rapporte : le quota gratuit se contourne en
ajoutant un paramètre à l'adresse.

## 🟠 IMPORTANT

### H-1 · `?src=groupe` accorde un accès illimité, sur parole

**Où** — `functions/api/reforme.ts:125-128`, alimenté par
`src/layouts/Base.astro:43`.

```ts
const src = typeof corps.src === 'string' ? corps.src : null;

if (src === 'groupe') {
  return json({ ...reformuler(controle.texte), acces: 'groupe', restant: null, quota });
}
```

`restant: null` — aucun décompte. Et `corps.src` vient du corps de la requête,
que le client compose ; il est lui-même issu du paramètre `?src=` de l'URL, lu
et stocké en session par `Base.astro`.

**Il suffit donc d'ouvrir le site avec `?src=groupe` pour ne plus jamais être
décompté.** Aucune vérification n'accompagne la chaîne : ni jeton, ni référent,
ni signature.

**Pourquoi c'est important** — L'environnement porte un `PRIX_SOUTIEN` : il y a
donc une contrepartie payante, et cette porte la rend facultative. L'intention
écrite dans le code est juste — quelqu'un qui arrive du groupe ne doit pas voir
un quota clignoter — mais elle est appliquée par une déclaration du visiteur,
pas par une preuve.

**Piste de correction** — Faire porter l'appartenance par quelque chose que le
visiteur ne peut pas se donner : un lien signé distribué dans le groupe (HMAC
sur un identifiant et une date d'expiration, vérifié côté serveur), ou à défaut
un décompte plus large pour cette source plutôt qu'un décompte absent. Un
contrôle de référent ne suffirait pas — il se falsifie aussi.

## Ce qui est sain, et deux points valent d'être cités

**Le quota lui-même est tenu côté serveur**, pas dans le navigateur. C'était le
soupçon naturel en voyant `sessionStorage.setItem('hb-restant', …)` dans
`AppCnv.astro` — mais la valeur écrite vient de la réponse du serveur
(`reussite.restant`), et le décompte réel se fait en base :

```ts
restant = await consommer(env.DB, empreinte, src, quota);   // reforme.ts:161
```

Le stockage de session n'est qu'un miroir d'affichage. Le vider ne rend rien.

**L'empreinte s'appuie sur `cf-connecting-ip`, et le code dit pourquoi** :
cet en-tête est posé par Cloudflare et ne peut pas être falsifié par le client,
« contrairement à `x-forwarded-for`, qu'il suffit d'envoyer soi-même ». C'est
exactement le piège que la plupart des limitations de débit ratent.

S'y ajoutent : la saisie est validée avant tout traitement (`valider(corps.texte)`),
un corps illisible rend un 400 explicite, et `sessionStorage` plutôt que
`localStorage` est un choix expliqué — un téléphone prêté ne transmet pas
l'accès de son propriétaire.

## Non couvert

Le contenu de `wrangler.toml` et les accès R2 · le Worker de veille
(`wrangler.veille.toml`) · les règles D1 réellement déployées, par opposition à
celles du dépôt · aucune vérification écran allumé.
