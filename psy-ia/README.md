# Psy IA

Accompagnement conversationnel de bien-être psychologique — écoute active,
conseils, réassurance, aiguillage, présence. Deux modes prévus : un parcours
guidé à choix (V1, ne demande pas de formuler ses pensées au départ) puis
une conversation vocale libre au micro (V2).

Développé sur le même principe technique qu'[Ensemble face aux
démarches](https://ensemble-mdph.vercel.app) : React, fonction Edge
Supabase pour la génération dynamique, hébergement Vercel.

## Exigence fondatrice

**Ce projet doit être « blindé », sans droit à l'erreur. La sécurité ne
repose jamais sur le LLM seul.** Le détail complet de l'architecture à
quatre couches indépendantes est dans [SECURITY.md](./SECURITY.md) ; ce
qu'il reste à valider avant toute mise en ligne, même en bêta, est dans
[TODO.md](./TODO.md) — et cette deuxième liste n'est pas cochée.

## Structure

```
src/lib/crisisDetection.ts   Couche 1 — détection de crise, déterministe, hors LLM
src/lib/crisisMessage.ts     Couche 1 — message figé, jamais généré
src/lib/systemPrompt.ts      Couche 2 — prompt système anti-sycophancie
src/lib/sessionLimits.ts     Couche 3 — limites structurelles de session
supabase/functions/repondre  Point de jonction des trois couches, avant tout appel LLM
supabase/schema.sql          Journal des déclenchements de crise (jamais le texte des messages)
src/app/                     Interface Next.js — squelette d'accueil, parcours guidé à écrire
```

## Commandes

```bash
npm run dev        # serveur de développement
npm run build      # build de production
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm run test       # tests unitaires des couches 1 et 3 (node --test, aucune dépendance de test ajoutée)
```

## Contexte marché (recherche du 11/09/2026)

Concurrents existants : Wysa, Woebot (anglo-saxons, TCC), Mon Sherpa
(français, conçu par une psychiatre), Agatos. Une étude montre que les
chatbots génériques ne répondent correctement à un message suicidaire que
dans ~80 % des cas, contre 97 % pour un thérapeute humain — et sur 29
chatbots testés, aucun ne respectait systématiquement tous les critères de
sécurité. Axes de différenciation retenus : détection de crise déterministe
hors LLM, sycophancie mesurée et bridée activement, transparence totale sur
la nature IA, logique de redirection ferme plutôt que de rétention.

## État du projet

Squelette architectural : les trois couches logicielles (détection,
prompt, limites de session) sont écrites et testées unitairement contre ce
que la note d'initialisation décrit. Rien de tout cela n'a encore été validé
par un professionnel de santé mentale, ni éprouvé en conditions de crise
réelles. Voir TODO.md avant tout accès externe.

**Un écran de conversation existe depuis le 11/09/2026** — `src/app/chat/`
et `src/app/api/repondre/`, branchés sur les trois couches ci-dessus et sur
Claude — précisément pour que le propriétaire et le professionnel de santé
mentale consulté puissent lui parler pour de vrai avant de juger sa
pertinence clinique, plutôt que de lire une liste de motifs en markdown.
C'est un correctif de méthode voulu par le propriétaire : le garde-fou de
TODO.md portait à tort sur le développement, il porte en réalité sur la
mise en ligne **publique** — voir TODO.md pour le détail du raisonnement.

**Adresse de travail, posée le 11/09/2026 — non publique, usage interne
seulement.** Un projet Vercel existe (`psy-ia`), lié au dépôt sur `main`,
protégé par l'authentification Vercel (`ssoProtection`, portée `all` — les
deux valeurs plus restreintes, `preview` et `all_except_custom_domains`,
laissaient passer en clair l'alias court sans domaine personnalisé, mesuré
avant correction). Non indexé (`noindex, nofollow` en meta et en en-tête
HTTP). Ce n'est ni un lancement ni une bêta : c'est l'adresse où le
propriétaire et le professionnel consulté testent l'application, rien de
plus — voir TODO.md pour ce qui reste avant tout accès public.
