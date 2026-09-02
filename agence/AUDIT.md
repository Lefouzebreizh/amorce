# Audit de sécurité — Socle Agence

**Date** : 02/09/2026 · **Périmètre** : `agence/` (79 fichiers TypeScript et SQL)
**Posture** : lecture seule. Aucun fichier de code n'a été modifié.

Chaque constat est **vérifié par exécution**. C'est le troisième audit de la
série, et le seul projet du dépôt qui porte une vraie authentification
multi-utilisateurs et des politiques RLS — donc le seul où « propriétaire » et
« autorisation » ont un sens.

**Un seul défaut trouvé.** Ce rapport est court parce que le projet est solide,
pas parce que l'audit a été rapide : le détail de ce qui a été cherché et
trouvé sain est en fin de fichier, et il vaut le constat.

## Coordination

| Périmètre | Où |
| --- | --- |
| Amorce + serveur de licence | PR #563 |
| Life-Organizer | `life-organizer/AUDIT.md` |
| Paper-Manager | `paper-manager/AUDIT.md` |
| **Socle Agence** | **ce fichier** |
| `iptv/`, `titan-builder/`, `hypersensible-bienveillance/`, `conseiller-patrimoine/`, `nexuscrypto/`, `pepites/` | **personne** |

---

## 🟠 IMPORTANT

### A-1 · Redirection ouverte : une tabulation franchit `destinationSure()`

**Où** — `src/lib/navigation.ts:31-40` (le filtre),
`src/app/auth/confirmer/route.ts:44,52,58` et `src/lib/actions/auth.ts:42,61`
(les deux points d'entrée).

Le filtre refuse trois vecteurs classiques et les refuse correctement :

```ts
const estCheminInterne =
  valeur.startsWith('/') && !valeur.startsWith('//') && !valeur.includes('\\');
```

Mais l'analyse d'URL du standard WHATWG **retire les tabulations, les retours
chariot et les sauts de ligne** avant d'interpréter la chaîne. Un `/` suivi
d'une tabulation puis d'un `/` franchit donc le filtre — qui ne voit pas `//` —
et redevient `//` au moment de la résolution.

**Vérifié par exécution**, avec le filtre et la construction `new URL(destination, origin)`
exactement tels qu'ils sont dans le code :

| `suivant` reçu | après filtre | URL finale |
| --- | --- | --- |
| `/projets` | `/projets` | `https://agence.example/projets` |
| `//evil.com` | *(replié)* | `https://agence.example/tableau-de-bord` |
| `https://evil.com` | *(replié)* | `https://agence.example/tableau-de-bord` |
| `/%2f%2fevil.com` | inchangé | `https://agence.example/%2f%2fevil.com` |
| **`/⇥/evil.com`** | **inchangé** | **`https://evil.com/`** ⚠ |
| **`/␊/evil.com`** | **inchangé** | **`https://evil.com/`** ⚠ |
| **`/␍/evil.com`** | **inchangé** | **`https://evil.com/`** ⚠ |

**Pourquoi c'est dangereux** — Le paramètre est lu directement des
`searchParams` de la route de confirmation, et d'un champ de formulaire dans
l'action de connexion. Un lien
`https://<le-vrai-domaine>/auth/confirmer?suivant=/%09/evil.com&token_hash=…`
porte le **vrai** nom de domaine de l'agence : c'est ce que la victime regarde
avant de cliquer. Elle confirme son adresse sur le site authentique, puis
atterrit sur une page contrôlée par l'attaquant — au moment précis où elle
s'attend à voir un écran de connexion.

C'est le scénario d'hameçonnage que la redirection ouverte sert à monter, et la
confirmation d'inscription en est le meilleur moment : l'utilisateur vient
d'établir sa confiance.

**Et les tests donnent une fausse assurance.** `src/lib/__tests__/navigation.test.ts`
couvre `https://exemple-malveillant.fr` et `//exemple-malveillant.fr` — les deux
vecteurs que le filtre arrête. Aucun ne porte de caractère d'espacement. La
suite est verte, et le défaut est là : c'est exactement le motif que ce dépôt
nomme *« une mesure disait vert et le fichier était faux »*.

**Piste de correction** — Refuser toute valeur contenant un caractère de
contrôle (`\t`, `\n`, `\r`, et plus largement `U+0000`–`U+001F`) avant les
contrôles existants ; ou, plus sûr, résoudre la valeur contre l'origine puis
vérifier que l'URL obtenue a bien la même origine — ce qui ferme la famille
entière au lieu d'un vecteur à la fois. Ajouter les trois cas au fichier de
tests, dont l'absence est ici la moitié du défaut.

---

## Ce qui a été cherché, et trouvé sain

Chaque ligne ci-dessous a été vérifiée, pas supposée. C'est la partie longue de
ce rapport, et elle est délibérément détaillée : plusieurs de ces points sont
ceux qu'une pile Supabase rate le plus souvent.

### L'escalade de rôle est réellement fermée

C'est le défaut classique de ce montage, et le schéma le nomme lui-même en
tête : *« Un utilisateur ne peut pas s'accorder un rôle. »* Le vérifier
importait, parce qu'une intention déclarée n'est pas une protection.

Elle l'est ici. `public.is_admin()` lit `profiles.role`, et la politique
*« Un utilisateur modifie son propre profil »* autorise bien l'écriture de sa
propre ligne — **mais la RLS filtre les lignes, pas les colonnes**, et le schéma
en tire la conséquence à la ligne 175 :

```sql
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, company_name, avatar_url) on public.profiles to authenticated;
```

`revoke all` **d'abord**, puis colonne par colonne. `role` n'est dans aucune
liste, et l'énumération de tous les `grant` du schéma confirme qu'aucun
privilège large ne vient le réaccorder ailleurs — un `grant update` sans
colonnes, plus loin, aurait tout annulé en silence, puisque les privilèges
s'additionnent.

### Les politiques RLS

- **Les deux tables ont la RLS activée** : deux `create table`, deux
  `enable row level security`.
- Toutes les politiques comparent à `(select auth.uid())`.
- **`with check` est présent partout où il compte** — sur l'`update` de
  `profiles` et sur le `for all` de `projects`. C'est l'oubli le plus fréquent :
  sans lui, un utilisateur passe le `using` puis écrit une ligne au nom d'un
  autre.

### Les fonctions `SECURITY DEFINER`

Les trois (`is_admin`, `handle_new_user`, `supprimer_mon_compte`) posent
`set search_path = ''`, ce qui ferme l'élévation de privilège par détournement
du chemin de recherche. Toutes sont suivies d'un `revoke all … from public`
puis d'un `grant execute` nominatif.

`supprimer_mon_compte()` refuse une session absente avec
`errcode = 'insufficient_privilege'` et supprime `auth.users` **pour le seul
`auth.uid()` appelant** — aucun paramètre, donc rien à falsifier.

### L'architecture d'accès

- **Aucune clé `service_role` nulle part.** L'application ne connaît que
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` : il n'existe aucun chemin qui contourne la
  RLS. C'est ce qui rend vraie la première décision du schéma — *« une faille
  d'interface ne peut pas exposer les données d'un autre client »*.
- **`getUser()` et non `getSession()`** (`src/lib/supabase/session.ts:10-28`),
  avec la raison écrite : `getSession()` lit un cookie que n'importe qui
  fabrique, `getUser()` fait valider le jeton.
- **Les six pages privées sont gardées deux fois** — vérifié une par une : cinq
  appellent `exigerSession()` directement, la sixième est couverte par
  `(prive)/layout.tsx` qui l'appelle aussi, en plus du garde de `proxy.ts`.
- La page d'administration ne pose pas de contrôle de rôle dans l'interface :
  elle s'appuie sur la RLS, qui ne rend aucune ligne à un non-administrateur.
  C'est cohérent avec la décision écrite du schéma, et c'est le bon sens de la
  dépendance — l'interface ne garde rien que la base ne garde déjà.

### Le reste

- **Aucun SQL brut interpolé.** Le seul `rpc()` appelle
  `supprimer_mon_compte()`, sans argument.
- **Aucun secret versionné** : seul `.env.example` est suivi par git, et aucun
  jeton en dur dans `src/` ni `supabase/`.
- **Dépendances verrouillées** par `package-lock.json` — ce que les projets
  Python du dépôt n'ont pas.
- Le schéma est **rejouable** (`create table if not exists`,
  `drop policy if exists`), donc réexécutable sans casser un projet en service.

---

## Non couvert, et dit plutôt que supposé

- **Le schéma n'a pas été exécuté contre une vraie base.** Tout ce qui précède
  est lu dans `supabase/schema.sql` et éprouvé par raisonnement sur les
  privilèges PostgreSQL, pas observé sur une instance. Le projet porte
  `supabase/verifier-rls.sql` et `tests/rls/socle-supabase.sql` : c'est là qu'il
  faut confirmer, sur une base réelle, que les politiques déployées sont bien
  celles du fichier — un schéma juste dans le dépôt et une base qui a dérivé
  donnent exactement la même lecture ici.
- **Les dépendances n'ont pas été confrontées à une base de vulnérabilités** :
  aucun hôte de ce type n'est joignable depuis une session distante.
- **Le comportement réel du navigateur sur `redirect()` de Next** (action
  serveur, `src/lib/actions/auth.ts:61`) n'a pas été observé. Le vecteur A-1 y
  est le même helper et le même paramètre ; seul le chemin de la route de
  confirmation a été éprouvé de bout en bout.
