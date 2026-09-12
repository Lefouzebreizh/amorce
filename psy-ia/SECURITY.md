# Sécurité — Psy IA

Exigence non négociable posée par Erwann dès la note d'initialisation du
projet : **la sécurité ne repose jamais sur le LLM seul.** Tout ce qui suit
en découle. Un LLM peut halluciner, céder à l'insistance (sycophancie), ou
simplement mal comprendre un message ambigu un jour donné — aucun de ces
risques ne doit pouvoir compromettre la détection d'un danger réel.

## Les quatre couches, et pourquoi elles sont indépendantes

### Couche 1 — détection de crise déterministe (`src/lib/crisisDetection.ts`)

Un moteur à mots-clés et motifs, en pur TypeScript, sans dépendance et sans
appel réseau. Tourne **avant** tout appel au LLM (voir
`supabase/functions/repondre/index.ts`) et peut intercepter la réponse sans
qu'un seul jeton n'ait été généré. C'est la garantie centrale du projet :
cette couche ne peut pas être « convaincue » de laisser passer un signal,
parce qu'elle ne raisonne pas — elle applique des règles fixes.

**Ce que cette couche N'EST PAS** : une liste validée cliniquement. Elle
reprend telle quelle la liste de départ de la note d'initialisation. Elle
DOIT être enrichie et validée par un professionnel de santé mentale avant
toute mise en ligne, même en bêta (voir TODO.md). Tant que ce n'est pas
fait, ce projet ne doit recevoir aucun vrai utilisateur.

Principe directeur, explicite dans la note d'initialisation : **en cas de
doute, on déclenche.** Un faux positif est gênant ; un faux négatif est
inacceptable.

**Ce principe a été reformulé et durci par Erwann le 11/09/2026**, après
plusieurs faux négatifs corrigés cas par cas — une liste de motifs corrigée
au coup par coup ne finit jamais, il y aura toujours une formulation à
laquelle on n'a pas pensé. La question posée pour chaque message n'est plus
« ce message est-il probablement une crise ? » mais **« existe-t-il une
interprétation plausible et raisonnable de ce message qui indique une
détresse, même si ce n'est pas la lecture la plus probable ? »**. Si oui, la
couche 1 déclenche, sans attendre de répétition ni de confirmation.
Conséquence assumée et voulue : plus de faux positifs (messages anodins
recevant le message de sécurité), en échange de moins de faux négatifs.

**Limite structurelle de ce principe, à ne pas dissimuler.** Un moteur à
motifs, aussi large soit son lexique, ne reconnaît que les formulations
qu'on lui a explicitement données : il ne comprend rien à une tournure
vraiment inédite. C'est exactement ce qu'un LLM saurait faire — mais
l'exigence non négociable ci-dessus interdit de confier ce jugement au LLM
conversationnel lui-même. `crisisDetection.ts` a donc été élargi le
11/09/2026 pour couvrir des FAMILLES de signaux (effondrement, isolement,
perte d'élan, perte de contrôle) plutôt que des cas isolés — la meilleure
approximation déterministe du principe reformulé, pas son accomplissement
complet.

**Ce qui reste une décision de produit non prise, à trancher explicitement
par Erwann s'il juge l'approximation ci-dessus encore insuffisante** : un
second verrou automatisé, distinct du LLM conversationnel — un classifieur
dédié à la seule question « ce message indique-t-il une détresse plausible ? »,
avec son propre prompt système invariable, tournant lui aussi avant toute
génération de réponse et pouvant à lui seul déclencher le message figé.
Cela resterait cohérent avec « la sécurité ne repose jamais sur le LLM
conversationnel seul », mais introduirait un appel réseau et une dépendance
à un modèle dans une couche qui n'en avait aucun jusqu'ici — un changement
d'architecture qui ne doit pas être décidé par une session seule.

### Couche 2 — prompt système anti-sycophancie (`src/lib/systemPrompt.ts`)

Régit le ton et les limites du LLM quand la couche 1 n'a rien détecté.
Cette couche ne fait **jamais** office de filet de sécurité pour un signal
de crise : si la couche 1 se trompe (faux négatif), la couche 2 ne le
rattrape pas — c'est la limite assumée d'un prompt, qui reste un texte que
le modèle peut in fine choisir d'ignorer sous pression. D'où la nécessité
d'une couche 1 fiable en amont, jamais l'inverse.

**Règle 7 ajoutée le 12/09/2026**, après un bug confirmé en production par
Erwann : sur « marre de tout », le modèle a répondu en avançant une
interprétation basse non vérifiée (« ça sonne comme de la fatigue
accumulée ») avant même de poser une question. Cette règle interdit
désormais toute interprétation — douce ou alarmiste — d'une formulation
vague de mal-être : le modèle doit poser une question neutre et ouverte
qui laisse la personne qualifier elle-même ce qu'elle vit, systématiquement,
avant toute reformulation qui nomme une cause ou une intensité. Elle ne
déplace pas la frontière de cette couche : elle ne décide toujours pas
d'intercepter une réponse (ça reste le rôle exclusif de la couche 1) — elle
régit seulement comment le modèle parle quand la couche 1 n'a rien détecté,
avec la même limite assumée qu'un prompt reste un texte que le modèle
pourrait in fine choisir d'ignorer sous pression (couche 4 : à éprouver par
simulation avant mise en ligne, voir TODO.md).

### Couche 3 — limites structurelles de session (`src/lib/sessionLimits.ts`)

Logique inverse d'un modèle économique qui chercherait à maximiser le temps
passé dans l'application. Le seuil 1 (rappel discret) est calculé
localement à la session ; le seuil 2 (redirection ferme sur détresse
répétée entre sessions distinctes) suppose un historique — voir
`supabase/schema.sql` — qui **n'est pas encore branché** dans la fonction
Edge (voir TODO.md).

### Couche 4 — revue humaine avant mise en ligne

Aucun code ne peut remplacer cette couche. Avant toute mise en production,
même bêta : le prompt système complet et le message de crise doivent être
relus par un vrai professionnel de santé mentale (psychologue ou
psychiatre), et le parcours complet doit être éprouvé par des simulations
volontaires de situations de crise, à chaque étape. Rien dans ce dépôt ne
peut attester que cette couche a eu lieu — elle se documente dans TODO.md et
se coche par Erwann, jamais par une session.

## Ce qui n'est PAS mesuré, et ne doit pas être supposé

- La liste de motifs de la couche 1 n'a jamais été confrontée à de vrais
  messages de personnes en détresse, ni relue par un professionnel.
- Le prompt système n'a jamais été testé contre un utilisateur insistant
  simulé (ce que la note d'initialisation demande explicitement).
- **Le fournisseur LLM est tranché depuis le 11/09/2026 : Claude, et lui
  seul** (voir TODO.md) — cette ligne datait d'avant la décision et disait
  le contraire. Fiabilité et sécurité priment sur le coût pour ce projet ;
  ce qui reste non mesuré n'est plus *quel* fournisseur, mais que ce
  fournisseur réponde correctement en conditions réelles (voir l'incident
  de clé invalide du 11/09/2026, second-brain).
- Le seuil 2 de la couche 3 (détresse répétée entre sessions) n'est pas
  branché : `detressePersistanteInterSessions` doit être calculé par
  l'appelant, qui n'existe pas encore.

Tant que ces points ne sont pas levés, ce projet est un squelette
architectural, pas un produit prêt à recevoir un vrai utilisateur en
détresse. C'est écrit ici en toutes lettres pour qu'aucune session future ne
l'oublie ni ne le suppose réglé.
