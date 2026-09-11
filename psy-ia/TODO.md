# À faire avant toute mise en ligne PUBLIQUE

Repris tel quel de la note d'initialisation du projet (11/09/2026), puis
**le garde-fou a changé de moment, pas de force — corrigé le 11/09/2026 par
le propriétaire.** Cette liste est un **portail avant tout vrai utilisateur
externe, même en bêta**, pas un portail avant le développement lui-même.

Raison du correctif : un professionnel de santé mentale ne peut pas juger
sérieusement la pertinence clinique d'un système conversationnel sur une
liste de mots-clés lue en markdown — il doit pouvoir lui parler pour de
vrai, exactement comme le propriétaire avant de le montrer à qui que ce
soit. Construire et éprouver l'interface **en interne** (propriétaire, puis
le professionnel consulté ci-dessous, sur l'adresse de travail privée
protégée par l'authentification Vercel) n'est donc plus ce que cette liste
retarde : c'est ce qui permet de la cocher. Ce qui ne bouge pas d'un pouce :
tant qu'elle ne l'est pas, personne d'externe à cette adresse.

- [ ] Liste de mots-clés de détection (`src/lib/crisisDetection.ts`)
      enrichie et validée par un professionnel de santé mentale. **Deux
      précisions déjà intégrées le 11/09/2026**, suite à une relecture
      externe de la note de cadrage : la négation inversée (« je ne veux pas
      mourir ») ajoutée à côté de la négation directe (« je ne veux plus
      vivre »), et la couche 2 resserrée vers une validation empathique mais
      objective ancrée dans les TCC. Ces deux ajouts restent, comme le reste
      de la liste, non validés cliniquement.
      **Faux négatif réel corrigé le 11/09/2026** : « j'ai des idées très
      noires », tapé par Erwann en production, n'avait rien déclenché — deux
      causes cumulées (« idées noires » absent de toute liste, et un simple
      intensificateur comme « très » cassait la contiguïté stricte exigée
      entre les mots d'un motif). Une batterie de vingt formulations
      (directes, indirectes, avec fautes, avec intensificateurs) a été
      rejouée après coup et a trouvé six trous supplémentaires, tous
      corrigés dans la foulée. **Limite connue et assumée, non corrigée** :
      la tolérance ajoutée ne couvre qu'un mot intercalé et les lettres
      répétées (« mourrrir ») — une faute qui change un mot
      ailleurs (« veu » pour « veux », « finire » pour « finir ») reste
      invisible. Corriger ça demanderait une tolérance aux fautes de frappe
      par mot (distance de Levenshtein ou approchant), qui n'existe pas
      aujourd'hui et qui est exactement le genre de calibrage qui doit
      passer par le professionnel de la couche 4, pas être décidé seul.
- [ ] Contact professionnel de santé mentale trouvé pour la revue du prompt
      système et du message de crise (couche 4, voir SECURITY.md).
- [x] **Choix du fournisseur LLM — tranché le 11/09/2026 : Claude, et lui
      seul.** Fiabilité et sécurité priment sur le coût pour ce projet,
      critère non négociable posé dès le départ. Mistral avait été considéré
      pour l'argument RGPD/hébergement européen, mais le RGPD se gère par le
      choix de stockage des données, pas par le modèle — on ne sacrifie pas
      la fiabilité pour ça. `supabase/functions/repondre/index.ts` utilise
      donc déjà le bon fournisseur ; ce n'était plus provisoire à ce point.
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
- **Un écran de conversation minimal existe désormais**, posé le
  11/09/2026 : `src/app/chat/page.tsx` et `src/app/api/repondre/route.ts`,
  branchés sur les trois couches déjà écrites et sur le LLM, déployés sur
  l'adresse de travail privée — précisément pour permettre la revue
  humaine en conditions réelles décrite plus haut, plutôt que de l'attendre.
  Ce n'est **pas** le parcours guidé à choix prévu pour la V1 (pas
  d'écrans à embranchements, pas de choix pré-écrits) : ce dernier reste à
  construire, et peut avancer dès maintenant en parallèle de la revue
  clinique — toujours réservé à un usage interne tant que la liste
  ci-dessus n'est pas cochée.
- Mode conversation vocale libre au micro (V2) — explicitement après le
  parcours guidé, pas en parallèle.
- Authentification et projet Supabase réels : aucun n'existe encore, la
  fonction Edge et le schéma sont écrits contre l'architecture cible mais
  jamais déployés ni éprouvés en conditions réelles.
