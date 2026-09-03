# Le Coffre — version hébergée, multi-utilisateurs

Un site statique (une seule page, `index.html`) qui parle directement à
Supabase (authentification, base de données, stockage de fichiers) — aucun
serveur applicatif à faire tourner soi-même.

C'est la productisation de `life-organizer/modules/coffre/` : même garantie,
même chiffrement (AES-256-GCM, dérivation PBKDF2, 600 000 itérations), mais
pensé pour que n'importe qui puisse ouvrir un lien, créer un compte, et
déposer un document — sans terminal, sans installation.

## Ce qui change par rapport à la version locale de Life-Organizer

| | Locale (Life-Organizer) | Hébergée (ici) |
| --- | --- | --- |
| Utilisateurs | Un seul, la machine elle-même en fait foi | Plusieurs, un vrai compte (e-mail + mot de passe) par personne |
| Stockage | Disque local (`coffre.dossier`) | Supabase Storage, un bucket privé, un dossier par utilisateur |
| Index chiffré | Fichier `_index.enc` sur disque | Colonne `index_chiffre` de la table `coffres` |
| Isolement entre utilisateurs | Sans objet (un seul coffre) | Row Level Security Postgres + policies de Storage — Postgres refuse, pas le code applicatif |
| Chiffrement | Web Crypto, côté navigateur | Identique, même code adapté |

Ce que ni l'un ni l'autre ne change : **ce serveur ne voit jamais la phrase
secrète, ni la clé qui en dérive, ni le contenu en clair d'un document.**

## Mise en place

1. Un projet Supabase (Postgres + Auth + Storage). Appliquer `schema.sql` —
   crée la table `coffres` (RLS activée) et le bucket `coffre-objets`
   (politiques par dossier `<user_id>/...`).
2. **Important, à ne pas oublier** : les policies RLS filtrent les lignes,
   mais Postgres exige en plus un `GRANT` de base sur la table pour le rôle
   `authenticated` — sans lui, toute requête échoue avec « permission denied »
   avant même que RLS n'entre en jeu. `schema.sql` le fait déjà ; à refaire à
   la main si la table est recréée autrement.
3. Renseigner `SUPABASE_URL` et `SUPABASE_KEY` (la clé *publishable*, jamais
   la clé de service) en tête du `<script>` d'`index.html`.
4. Dans le tableau de bord Supabase, **Authentication → Providers → Email** :
   décocher « Confirm email » simplifie l'inscription pour un public non
   technique (à reconsidérer avant un vrai lancement public, pour filtrer les
   adresses invalides).
5. Déployer `index.html` tel quel sur n'importe quel hébergeur statique
   (Vercel, Netlify, GitHub Pages…) — aucune étape de build.

## Vérifié manuellement (pas de suite automatisée pour l'instant)

Inscription, connexion, création du coffre, dépôt d'un fichier (chiffré),
téléchargement (déchiffré, comparé octet à octet à l'original), suppression
(vérifiée absente du bucket ensuite), déconnexion puis reconnexion avec
déverrouillage par la même phrase secrète, et refus d'une phrase secrète
incorrecte.

## Ce qui manque, volontairement, pour l'instant

- **Aucun classement par IA** : le dépôt hébergé est un coffre nu — on
  dépose un fichier, on le retrouve. Le classement automatique
  (`modules/depot/`) suppose un serveur Python qui lit le contenu en clair
  avant chiffrement ; l'ajouter ici demanderait une fonction serveur séparée
  (Supabase Edge Function, par exemple), pas seulement du HTML statique.
- **Pas de sauvegarde séparée** ni de suppression différée avec écrasement
  multi-passe (contrairement à `modules/coffre/stockage.py` en local) —
  Supabase gère ses propres sauvegardes côté infrastructure, mais la
  suppression d'un objet Storage ici est immédiate et simple.
- **Mot de passe de compte oublié** : Supabase Auth sait envoyer un e-mail
  de réinitialisation, ce flux n'est pas encore branché dans la page.
