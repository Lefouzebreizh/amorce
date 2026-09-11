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
par un professionnel de santé mentale, testé en conditions réelles contre un
vrai LLM, ni déployé. Voir TODO.md avant d'aller plus loin.
