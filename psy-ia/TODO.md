# À faire avant tout développement ultérieur ou mise en ligne

Repris tel quel de la note d'initialisation du projet (11/09/2026). Cette
liste est un **portail**, pas une formalité : tant qu'elle n'est pas cochée,
ce projet ne doit recevoir aucun vrai utilisateur, même en bêta.

- [ ] Liste de mots-clés de détection (`src/lib/crisisDetection.ts`)
      enrichie et validée par un professionnel de santé mentale.
- [ ] Contact professionnel de santé mentale trouvé pour la revue du prompt
      système et du message de crise (couche 4, voir SECURITY.md).
- [ ] Choix du fournisseur LLM tranché sur le critère fiabilité > coût — pas
      le critère habituel du dépôt. `supabase/functions/repondre/index.ts`
      utilise Claude à titre provisoire, pas comme décision définitive.
- [ ] Rédaction complète et définitive du prompt système
      (`src/lib/systemPrompt.ts`) — la base posée ici doit être affinée avec
      le professionnel ci-dessus.
- [ ] Tests de simulation de crise avant toute mise en ligne, même en
      version bêta — y compris des simulations volontaires d'utilisateurs
      insistants pour vérifier que le modèle ne cède pas sous la pression
      (sycophancie).

## Ce qui reste aussi à construire, indépendamment de la liste ci-dessus

- Le seuil 2 de la couche 3 (détresse répétée sur plusieurs sessions
  distinctes) n'est pas branché : il faut créer le projet Supabase, y
  rejouer `supabase/schema.sql`, et écrire la requête qui interroge
  `journal_crise` pour calculer `detressePersistanteInterSessions`.
- Le parcours guidé à choix (mode 1, `src/app/page.tsx`) n'est qu'un
  squelette d'accueil — les écrans du parcours lui-même restent à écrire, et
  ne devraient l'être qu'après validation du prompt système et de la liste
  de mots-clés : construire l'interface avant que le contenu ne soit
  clinique reviendrait à polir une façade sur des fondations pas coulées.
- Mode conversation vocale libre au micro (V2) — explicitement après le
  parcours guidé, pas en parallèle.
- Authentification et projet Supabase réels : aucun n'existe encore, la
  fonction Edge et le schéma sont écrits contre l'architecture cible mais
  jamais déployés ni éprouvés en conditions réelles.
