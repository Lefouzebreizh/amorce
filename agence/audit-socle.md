# Audit technique — Socle Agence

**Pour :** Erwann · **Le :** 27 août 2026 · **Portée :** `agence/` — 63 fichiers source, 3 778 lignes, à jour de `main`.

_Audit du socle livré aux clients, mené sur le dépôt et **exécuté** : le contrôle
RLS a tourné sur un PostgreSQL 16 réel pendant cet audit. Cinq constats, classés
par ce qui cassera en premier — pas par gravité théorique._

**Ce que je n'ai pas trouvé, et qui compte :** aucun secret en clair, aucun `.env`
versionné, la clé `service_role` lue nulle part, les dépendances verrouillées,
la RLS **activée** et non seulement écrite, le `with check` présent, les
privilèges de colonne repris à zéro pour fermer l'escalade de rôle. Les quatre
défauts qui coulent une reprise de code généré sont absents. Ce qui suit est ce
qui reste.

---

## 1. La dérive d'une base client est invisible

**Le fait :** le schéma s'installe en collant `supabase/schema.sql` dans l'éditeur
SQL du projet (README, étape 2). Il s'en écarte tout aussi facilement — une
politique désactivée un soir de débogage, une table ajoutée par l'interface. Le
contrôle qui existe, `verifier-rls.sql`, écrit dans `auth.users` et exige une base
jetable : il tourne en intégration continue, jamais sur le projet du client. Rien
ne regarde la base livrée.

**La conséquence :** l'intégration continue reste verte pendant que la base d'un
client sert tout le contenu de `profiles` à n'importe quel porteur de la clé
publique — laquelle est publiée dans le navigateur, par conception. La faille ne
se voit ni dans le dépôt, ni dans l'application, ni dans les tests.

**Le correctif :** livré avec ce rapport — `supabase/etat-rls.sql`, en lecture
seule, exécutable sur une base de production.

```bash
npm run etat:rls -- "postgresql://postgres:MOT_DE_PASSE@db.PROJET.supabase.co:5432/postgres"
```

Sans message, la base est conforme. Sinon le script s'arrête en nommant l'écart.
Il contrôle cinq points : RLS active, les cinq politiques du socle présentes,
aucune politique inconnue ajoutée à la main, `profiles.role` non modifiable par un
compte ordinaire, et `is_admin()` toujours `security definer` à `search_path` figé.

Éprouvé sur six scénarios : il passe sur une base conforme et **échoue sur
chacune des cinq dérives** — un contrôle qui ne peut pas échouer ne contrôle rien.

À faire de votre côté : le passer sur chaque projet client livré, et le remettre
après toute intervention manuelle dans l'interface Supabase.

---

## 2. Les limites d'authentification ne sont pas dans le dépôt

**Le fait :** `mot-de-passe-oublie` et `inscription` sont des routes POST publiques
qui déclenchent un envoi de courriel. Le code sait lire les refus de Supabase
(`over_email_send_rate_limit`, `auth.ts` ligne 129) mais ne fixe aucune limite :
elles vivent dans l'interface du projet, se règlent client par client, et
changent quand on branche un SMTP maison.

**La conséquence :** un quota de courriels vidé en quelques minutes, le domaine
d'envoi classé indésirable, et plus personne ne peut réinitialiser son mot de
passe — y compris les clients légitimes. `next.config.ts` le dit déjà pour les
en-têtes : *ce qui n'est pas dans le dépôt s'oublie à la mise en ligne suivante.*

**À faire :** activer le CAPTCHA sur les points d'authentification (Supabase >
Authentication > Attack Protection), et l'inscrire dans le parcours d'installation
du README — au même titre que les trois variables d'environnement.

---

## 3. Une page privée sur six ne redemande pas la session — **corrigé**

**Le fait :** `src/app/(prive)/projets/nouveau/page.tsx` n'appelle ni
`exigerSession` ni `exigerAdministrateur`, là où les cinq autres pages privées le
font. Le garde de `proxy.ts` ne compense pas : le fichier lui-même précise que sa
redirection est « un confort de navigation, **pas** un contrôle d'accès ».

**La conséquence :** aujourd'hui, rien — la page n'affiche qu'un formulaire vide et
l'action serveur, elle, se garde. Mais c'est le motif que le prochain
développeur recopiera sur une page qui affichera des données, et il n'y a pas de
test pour l'en empêcher.

**Corrigé le 27 août 2026** : `await exigerSession();` en tête du composant, qui
devient `async`. La page bascule du même coup en rendu à la demande.

---

## 4. Aucune politique de sécurité du contenu — **corrigé**

**Le fait :** `next.config.ts` pose trois en-têtes (`nosniff`,
`Referrer-Policy`, `X-Frame-Options`). Il n'y a pas de `Content-Security-Policy`.

**La conséquence :** le jour où un client ajoute une bulle de discussion, un
traqueur d'audience ou une police distante — et il le fera — un script injecté
s'exécute sans contrainte, et peut lire le jeton de session dans les requêtes
sortantes. Tant qu'aucun tiers n'entre, rien ne se passe.

**Corrigé le 27 août 2026** : `lib/securite.ts` compose la politique et le
proxy la pose, jeton compris. Trois pages étaient pré-rendues à la compilation —
dont **inscription** et **mot de passe oublié** — et un jeton n'existe qu'à la
requête : elles auraient été servies avec des scripts refusés. Elles passent
donc en rendu à la demande.

Vérifié dans un vrai Chromium, sur la version de production : zéro refus sur
cinq pages, React s'hydrate, le formulaire réagit, et **quatorze scripts sur
quatorze portent le jeton**.

---

## 5. Les Server Actions ne sont pas testées — **corrigé**

**Le fait :** 34 tests unitaires, tous sur des fonctions pures — validation,
mise en forme, navigation, agrégats d'administration. Les **neuf actions
serveur** (`projets.ts`, `profil.ts`, `auth.ts`), c'est-à-dire tout ce qui écrit
en base et tout ce qui porte les gardes, n'en ont aucun.

**La conséquence :** ce constat ne casse rien par lui-même — il rend les quatre
précédents difficiles à réparer sans en créer d'autres. Le jour où un correctif
touche `exigerSession`, rien ne le dit : la garantie du socle repose alors sur la
relecture, à chaque fois.

**Corrigé le 27 août 2026** : 25 tests couvrent les neuf actions, portés à 66 en
tout. Ils tiennent les garanties, pas la mécanique — le propriétaire d'un projet
vient de la session et jamais du formulaire, la mise à jour vise la ligne par son
identifiant *et* par son propriétaire, le profil n'écrit jamais la colonne du
rôle, la connexion refuse une destination hors du site, et la demande de
réinitialisation répond la même phrase que l'adresse existe ou non.

Les actions sont testées telles quelles, sans les réécrire : le harnais
(`__tests__/aides-actions.ts`) simule leurs quatre voisins — session, client
Supabase, invalidation de cache, redirection.

---

## Ce que je propose

Prix laissés vides : c'est votre propre socle, et l'effort compte plus que le
tarif. Les délais supposent une journée de travail effectif, pas une journée de
calendrier.

| Option | Contenu | Délai |
| --- | --- | --- |
| **Arrêter l'hémorragie** | Constats 1 à 3 — **livrés** | fait |
| **Remise en état** | Constats 4 et 5 — **livrés**. Reste le n°2 : un réglage dans l'interface Supabase | 5 minutes |
| **Ne rien faire** | — | Coût attendu : la première base client qui dérive expose les données de tous les comptes, sans que rien ne l'annonce. Le reste peut attendre. |

_Le constat n°1 est le seul qui ne se rattrape pas après coup : les données
sorties ne rentrent pas._
