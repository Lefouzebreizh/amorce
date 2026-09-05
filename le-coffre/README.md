# Le Coffre — version hébergée

La version personnelle et locale de ce projet vit dans `life-organizer/modules/coffre/`
et `life-organizer/interface_web/` : un serveur Flask sur `127.0.0.1`, sans compte,
pensé pour tourner sur une seule machine. Celui-ci en est la **productisation** —
même garantie de chiffrement, mais accessible depuis un navigateur, sans rien
installer, avec un compte par personne.

## Ce qui ne change pas

Le chiffrement est **entièrement côté navigateur** (Web Crypto API, `src/lib/crypto.ts`,
porté sans changement de logique depuis `modules/coffre/stockage.py` et le module
`LOCoffre` de l'interface locale) :

- PBKDF2-HMAC-SHA256, 600 000 itérations, sel propre à chaque coffre.
- AES-256-GCM pour chaque document et pour l'index qui porte les noms d'origine.
- Le serveur — ici Supabase plutôt qu'un Flask local — ne reçoit jamais la phrase
  secrète ni la clé qui en dérive, seulement des octets opaques.

## Ce qui change

| | Local (`life-organizer`) | Hébergé (`le-coffre`) |
| --- | --- | --- |
| Qui peut s'en servir | Une personne, sur sa machine | N'importe qui, avec un compte |
| Authentification | Aucune (127.0.0.1 seul) | Supabase Auth, lien magique par e-mail |
| Isolation des données | Un seul utilisateur | Row Level Security Postgres, par `auth.uid()` |
| Stockage des blobs chiffrés | Dossier local (Drive synchronisé) | Bucket Supabase Storage `coffre-objets` |
| Index + clé | Fichiers locaux (`_cle.json`, `_index.enc`) | Tables Postgres `coffre_cles`, `coffre_index` |

**Deux comptes séparés, par construction** : le compte (e-mail + lien magique,
Supabase Auth) dit *qui* tu es à ce service. La phrase secrète du coffre dit *ce
que tu peux déchiffrer* — elle n'atteint jamais ce service, sous aucune forme.
Les deux ne se substituent jamais l'un à l'autre.

## Le classement automatique (04/09/2026)

Au dépôt d'un fichier, la fonction `classer-document` propose une catégorie,
un nom, et une échéance éventuelle (lecture par Claude en vision) —
**toujours à valider avant que le dépôt n'ait lieu**, jamais appliqué
automatiquement. C'est la seule exception à « rien de lisible ne sort » du
projet ; voir `SECURITY.md`, section « Le classement automatique », pour ce
que ça implique et ses limites.

## Les alertes d'échéance (04/09/2026)

Une échéance validée déclenche, une fois par jour, un e-mail d'alerte avant
qu'elle n'arrive — envoyé par `envoyer-alertes-echeances` (Supabase, tâche
planifiée `pg_cron`), via Resend depuis `alertes@erwannchevallier.com`.
Seule la date sort en clair de la base pour rendre ça possible ; jamais le
nom du document. Voir `SECURITY.md`, section « L'alerte proactive », pour le
compromis exact et sa justification.

## Les rendez-vous (04/09/2026)

Un rendez-vous se note directement (libellé + date), sans document associé —
même mécanique d'alerte que pour une échéance de document, même compromis :
la date seule sort en clair (`coffre_echeances`, `type = 'rendezvous'`), le
libellé reste chiffré dans l'index, comme un nom de fichier.

## La lettre de résiliation (04/09/2026)

Quand un document classé « Assurance », « Énergie » ou « Téléphonie et
internet » a une échéance, et que l'émetteur a pu être lu sur le document,
un brouillon de lettre de résiliation est composé à partir d'un gabarit fixe
(jamais un texte librement écrit par l'IA) — voir `SECURITY.md`, section
« La lettre de résiliation », pour ce qui la distingue volontairement de la
version complète de `paper-manager/core/resiliation.py`. Toujours présentée
comme un brouillon, avec la liste de ce qui manque pour être complète.

## L'habillage visuel (05/09/2026)

Interface responsive : une seule colonne sur téléphone, trois colonnes
(documents / rendez-vous / identité) sur grand écran, pleine largeur jusqu'à
1400px. Chaque catégorie de document a une icône et une couleur reconnaissable
(`accent`, `violet` ou `wine` selon le sens — santé/logement, argent,
abonnement/urgence), une bannière signale l'échéance la plus proche en haut de
page. Aucun impact sur la sécurité ou le flux de données : purement la mise en
forme de ce que l'index déjà déchiffré contient.

## La fiche détail par papier (05/09/2026)

Refonte suivant une maquette dédiée (`coffre-maquette.html`) : chaque
document s'ouvre en fiche détail au clic, plutôt que d'exposer ses actions
directement dans la liste — bannière d'accueil, montant extrait (lu tel quel,
jamais recalculé — même principe que l'émetteur), badge de statut à trois
états (`urgent` / `bientôt` / `calme`, un simple point coloré dérivé de
l'échéance), correction du classement après coup (nom, catégorie, montant,
sans repasser par un nouveau dépôt), et un bouton flottant « Ajouter un
papier » qui remplace la grande zone de dépôt — la page entière reste
déposable au glisser-déposer, juste sans l'encart visuel qui prenait toute la
largeur.

**Périmètre tranché à l'ouverture de ce lot** : la maquette montrée est celle
du Coffre seul, distincte de celle du « Bureau du soir » (`life-organizer`,
chat + budget) montrée à titre de comparaison — les deux sont restées deux
écrans séparés, aucune fusion des deux produits dans ce lot.

**Un vrai bug corrigé au passage** : `deposerFichier`, `supprimerFichier`,
`ajouterRendezVous` et `supprimerRendezVous` reconstruisaient l'index sans
reprendre tous ses champs (`{ objets }` au lieu de `{ ...index, objets }`) —
déposer un fichier, par exemple, effaçait silencieusement l'identité et les
rendez-vous déjà enregistrés. Couvert par quatre tests de régression dans
`coffre.test.ts`.

## Architecture

```
le-coffre/
├── src/
│   ├── app/
│   │   ├── page.tsx            connexion (lien magique par e-mail)
│   │   └── coffre/page.tsx     création / déverrouillage / dépôt (avec validation) / liste
│   └── lib/
│       ├── crypto.ts           primitives Web Crypto — pas de dépendance
│       ├── supabase.ts         client Supabase (clé publiable, sécurité par RLS)
│       └── coffre.ts           les opérations du coffre, contre Supabase
├── supabase/functions/
│   ├── classer-document/       lit un document en clair côté serveur (Claude vision),
│   │                            ne conserve rien — voir SECURITY.md
│   └── envoyer-alertes-echeances/  tâche quotidienne, envoie les alertes via Resend
└── .env.example                 variables à copier en .env.local
```

Projet Supabase : **LIFE ORGANIZER** (`hftofsrykuobbepfusuf`, région `eu-west-1`).
Schéma posé par la migration `creer_le_coffre_multi_utilisateurs` et
`creer_bucket_coffre_objets` (voir l'historique des migrations du projet).

## Démarrer en local

```bash
cp .env.example .env.local   # remplir avec les valeurs du tableau de bord Supabase
npm install
npm run dev
```

Tests : `npm run test` (Vitest — chiffrement, dérivation de clé, gabarit de
lettre de résiliation ; voir `SECURITY.md`).

## Ce qui reste à faire avant un vrai lancement

Voir `SECURITY.md` pour le détail — en résumé : la garantie de suppression
irréversible de la version locale (écrasement avant effacement) ne tient pas
de la même façon sur du stockage cloud — Supabase Storage supprime l'objet,
sans garantie d'effacement physique immédiat côté fournisseur.
