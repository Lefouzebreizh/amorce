# Pipeline de fiabilité Amorce

Ce dossier conserve le registre et l'état de reprise du pipeline. Revoir les
preuves actuelles avant chaque action : les projets, branches et accès évoluent.

## Coordination

- Le coordinateur retrouve les PR ouvertes et leur SHA avant de déléguer.
- Des sous-agents bornés traitent les tâches indépendantes : Vercel, CI GitHub,
  puis plugins réellement nécessaires. Une seule session écrit un fichier donné.
- Privilégier les outils natifs connectés et les solutions existantes. Une
  connexion manquante ne bloque pas les tâches indépendantes. Ne pas déléguer à
  Erwann des clics, commandes ou copier-coller techniques.
- Conserver les modifications des autres sessions. Lire le diff, exécuter les
  contrôles pertinents, puis vérifier de nouveau le SHA avant l'intégration
  autorisée. Aucun achat, contournement d'accès ou suppression irréversible.

## Trois preuves différentes

1. `vercel-coherence.yml` valide le schéma et les fichiers du registre, ainsi que
   le filtre de builds. Il s'exécute sur les PR/pushes qui touchent ces fichiers
   et à la demande. Il ne sonde pas les services en ligne.
2. L'automatisation ChatGPT **Contrôle PR Amorce** est activée pour les événements
   de PR. L'automatisation **Fiabilité Vercel Amorce** est activée chaque matin,
   heure de Paris. Son instruction répartit l'audit entre sous-agents et exige
   désormais les réponses HTTP réelles. Leur activation n'est pas la preuve
   qu'une exécution future a eu lieu.
3. Un site fonctionne seulement après contrôle de son URL et du contenu attendu.
   `READY`, une CI verte, un statut Vercel `Ignored` ou des agrégats de logs vides
   ne suffisent pas. Un détour SSO doit être distingué d'une panne applicative.

Les champs `criticalPaths`, `expectedText` et `protectedPreview` guident l'audit
en ligne. Le validateur local contrôle leur structure, pas le contenu servi.
Pour les textes, normaliser casse, espaces et entités HTML avant comparaison.
Les champs décrivent une attente, pas une preuve d'accès ni un contrôle de
protection appliqué par le registre.

## Filtre de déploiement

`VERCEL_GIT_PREVIOUS_SHA` désigne le dernier déploiement réussi. Si cette base
manque, n'est pas dans le clone ou n'est plus un ancêtre, le filtre autorise la
construction : `HEAD^` peut masquer un changement applicatif plus ancien. Le
code de sortie Vercel est inversé : 0 ignore, 1 construit.

Source : [variables système Vercel](https://vercel.com/docs/environment-variables/system-environment-variables).

Audit Landing est prévu uniquement en preview : sa configuration exclut `main`
de l'intégration Git et ignore les builds hors `VERCEL_ENV=preview`. Cela ne
retire pas les droits administrateur de déployer manuellement ni ne crée un
projet Vercel absent.

## Reprise — audit du 13 septembre 2026

Les 7 IDs Amorce du registre concordent avec Vercel. Les accueils d'Amorce, du
Coffre, du Chat traducteur, de Psy IA (URL directe), de Rénov Facile et d'Artisan
Express ont répondu HTTP 200. Ce contrôle d'accueil ne valide pas leurs parcours
authentifiés. Ensemble MDPH répond aussi 200, mais relève du dépôt distinct
`Lefouzebreizh/ensemble-mdph`.

**Incident ouvert : IPTV.** Le déploiement
`dpl_H7Qx7EGbR6iVxFNgQw5m27cuQfJu` est READY mais son accueil
<https://iptv-two-chi.vercel.app/> renvoie HTTP 500. Les logs montrent
`ENOENT: no such file or directory, mkdir 'donnees'` (digest `407203172`).
`iptv/src/serveur/depot-partage.ts` attend SQLite dans `donnees/iptv.db` ; le
README prévoit une machine privée avec disque persistant, proxy vidéo et
ffmpeg, sans authentification publique. Déplacer la base dans `/tmp` perdrait
favoris et historique ; remplacer 500 par 503 ne remettrait pas le service en
marche. Aucun correctif de façade appliqué. Le runtime privé existant doit être
accessible par un exécuteur autorisé avant de préparer sa remise en service.
Cette session n'a trouvé ni cible SSH configurée ni connecteur Contabo/Tailscale.

**Aperçu absent : Audit Landing.** Le projet `amorce-pr953-audit-landing` et le
déploiement historique `dpl_5PZ7vo5mKPXkh5g8QVg8ewNdaGHF` renvoient 404. Ne pas
annoncer cet ancien lien comme une preview disponible.

**Psy IA :** le correctif de la PR #964 est en preview READY au SHA `a7d7c52`,
distinct de la production observée. Vérifier sa PR avant toute reprise.

| Capacité | Preuve de connexion | Limite connue |
|---|---|---|
| GitHub | Utilisateur Lefouzebreizh et dépôt lisibles | Contrôler chaque droit d'écriture au moment nécessaire |
| Vercel | Équipe et 8 projets lisibles | Le connecteur ne remplace pas un accès SSH au VPS |
| Supabase | 3 projets visibles | ensemble-mdph et LIFE ORGANIZER sains ; socle-agence-banc-essai inactif |
| Sites | Ensemble privé actif, version 6 | Accès propriétaire uniquement |
| Codex Security | Disponible au catalogue | Non installé ; revue du code et CI en repli |
| ClickUp | Disponible au catalogue | Non installé ; suivi versionné GitHub en repli |
| Cloudflare | Aucun outil exposé et recherche catalogue vide | Gestion authentifiée non vérifiable |

Aucun de ces constats n'autorise l'affichage d'un secret ou l'affaiblissement
d'une protection. Ne notifier que corrections vérifiées, incidents importants
et décisions indispensables ; un rapport au passé distingue livré et bloqué.
