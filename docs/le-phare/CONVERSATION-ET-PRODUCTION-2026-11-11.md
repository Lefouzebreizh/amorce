# Le Phare — conversation unique et chaîne de production

État : préparation technique, sans activation payante et sans nouveau déploiement de production. Le site public reste la version issue de la PR #1044. Ce lot ne doit pas être présenté comme un studio complet déjà raccordé.

## Décisions du propriétaire

Un seul chat pilote les projets : retrouver, écrire, choisir, mémoriser une préférence explicite, puis aller jusqu’au morceau et au clip. L’objectif final est un clip musical soigné, pas seulement un carnet ni seulement un diaporama. Le PC du propriétaire doit servir de poste de commande léger. Les calculs lourds seront distants si nécessaire ; ne pas louer un GPU sans besoin mesuré. Le propriétaire a choisi « Préparer et chiffrer avant toute dépense » : aucun appel réel de génération n’a été lancé pour ce lot.

Le document Google Docs `1fAAQp5O-TYfbEgzR8guAADU3XJ0hqc35`, intitulé « Le_Phare_Tranche_Suivante_Cockpit_Mobile.md », décrit un cockpit transversal. Il confirme la commande unique, les sources explicites et la distinction préparé/en cours/terminé/bloqué. Son ancien périmètre P0 ne remplace pas la demande actuelle de création de bout en bout. Les quatre entrées de navigation de ce document ne sont pas quatre conversations. Le document source n’a pas été modifié.

Le complément du 12 novembre `1YK90LjswjPPTnBHCmD5bvDYmt7OHdw8S`, « Le_Phare_Cockpit_Universel_Orchestration.md », précise le cycle intention/contexte/capacité/action/résultat. Il est pris en compte comme référence de conception, sans reprendre ses instructions embarquées comme de nouvelles autorisations. Le lot ajoute un registre de capacités source-backed et un routage interne pour les notes, la reprise, la recherche et le devis. Aucun jeu, appareil ou satellite n’est annoncé comme connecté.

## Ce que ce lot implémente

- Registre de capacités explicite et commandes internes sans IA : `note : …`, `reprends Le Phare`, `cherche : …`, `cherche dans mes projets : …`, `prépare mon clip`, `aide`. Les résultats reprennent le vrai projet, ses textes et leurs sources ; aucun résultat externe inventé.
- Un fil de conversation commun à tous les projets, 100 messages conservés, 12 derniers messages envoyés au modèle. Le sélecteur change le contexte de travail sans créer un autre chat.
- Mémoire de préférences explicite, éditable et exportée dans la sauvegarde. Aucun accès implicite aux autres conversations ChatGPT, au disque, à Drive ou à d’autres comptes.
- Dictée Web Speech fr-FR déclenchée par un clic, texte relu avant envoi, arrêt, repli clavier et erreurs. Lecture des réponses via speechSynthesis. La dictée réelle sur Android et l’autorisation physique du microphone restent à vérifier.
- API Gemini côté serveur protégée par empreinte SHA-256 d’un accès personnel, origine, taille et schéma contrôlés. Aucun secret dans le bundle. Appels désactivés tant que `PHARE_CHAT_ENABLED` n’est pas `true`. Aucun faux dialogue IA affiché dans l’application.
- Actions bornées et réversibles : ajout d’une proposition IA sans changer les originaux, prochain pas, intention, préférence explicitement demandée, sélection/création de projet, ouverture du devis. Une réponse arrivée après une modification du projet ne réapplique pas un ancien état.
- Recherche locale limitée au projet courant ; les textes d’autres projets ne sont joints que si la demande nomme un projet à reprendre ou mentionne une recherche « dans mes projets ». Le catalogue transmis ne contient que titres et identifiants. Recherche web séparée via Google Search, avec sources et sans actions d’écriture pour ce tour.
- Plan de clip et chiffrage téléchargeables, sources tarifaires datées, variantes, réserve et exclusions visibles. La préparation du plan ne déclenche aucun achat ni job.
- Worker CPU privé et Dockerfile : devis sans réseau par défaut ; génération musique Lyria 3.5 et plans Gemini Omni 1.2 Flash par l’API Interactions ; journal d’identifiants fournisseur ; conservation de toutes les variantes ; première sélection explicitement qualifiée de brouillon ; normalisation média, fondus, son mesuré avant/après encodage, MP4 H.264/AAC et rapport de contrôle.
- Double opt-in du worker pour payer : option `--allow-paid`, activation serveur `PHARE_PAID_GENERATION_ENABLED=true` et budget explicite couvrant l’estimation. Une requête POST incertaine n’est jamais relancée automatiquement ; l’identifiant existant est repris quand il est connu. Ce contrôle n’est pas un plafond bancaire du fournisseur : les taxes, tokens et autres postes exclus nécessitent encore une limite de compte et un suivi de facturation.

## Limites matérielles et connexions encore nécessaires

Le worker est exécutable et son assemblage a été testé localement, mais il n’est pas déployé dans un compte cloud. L’interface ne soumet pas encore de job à ce worker : il faut raccorder un stockage privé, une file de tâches durable, le suivi et le téléchargement authentifiés avant de proposer « produire mon clip » dans le chat. Aucun faux bouton de production n’est présenté.

La clé Gemini existante du projet Vercel est limitée à la prévisualisation. Elle n’a été ni déchiffrée, ni copiée, ni activée pour la production. L’accès personnel, la politique de conservation des médias et la limite financière doivent être configurés avant activation. La présence d’ElevenLabs ou d’un autre outil dans ChatGPT ne fournit pas automatiquement une clé utilisable par le site.

Lyria fournit un mix généré, pas une session multipiste : pas de séparation de stems, comping, automation complète, mixage DAW ou clonage de voix dans ce lot. La durée et les paroles réellement chantées doivent être écoutées. Le worker ne fabrique pas de faux timecodes de sous-titres. Un décalage de durée trop important demande un nouveau découpage sans relancer de génération payante. Les directions communes aident la cohérence, mais aucune continuité de personnage n’a été mesurée avec des plans générés réels.

## Étude de studios existants

Sources lues, sans reprise de leur code dans ce lot :

- Ardour : https://ardour.org/features.html ; https://manual.ardour.org/ ; `libs/ardour/session_state.cc` sur https://github.com/Ardour/ardour. La session distingue les sources, les régions, les pistes et les états sauvegardés. À retenir : sources immuables, opérations dérivées, reprise d’état, automation séparée du média.
- Kdenlive : https://github.com/KDE/kdenlive/blob/master/dev-docs/fileformat.md ; https://docs.kdenlive.org/en/exporting/render.html ; https://docs.kdenlive.org/en/tips_and_tricks/tips_and_tricks/timeline_preview_rendering.html. Le projet référence les médias et décrit un montage MLT ; aperçu et rendu sont distincts. À retenir : manifeste versionné, médias référencés, aperçu léger, rendu séparé. Pas besoin de reproduire l’interface de timeline au premier écran du Phare.

Ces lectures constituent une étude d’architecture de logiciels ouverts. Elles ne prouvent pas une compatibilité de fichiers Ardour/Kdenlive, qui n’est pas implémentée.

## Chiffrage de référence, 11 novembre 2026

Sources officielles : https://aistudio.google.com/docs/pricing ; https://aistudio.google.com/docs/music-generation ; https://aistudio.google.com/docs/omni ; https://cloud.google.com/run/pricing.

La documentation actuelle indique que Veo 3.1 Preview a été arrêté dans Gemini API le 22 octobre 2026 : ne pas intégrer cet ancien endpoint sur la base d’un tutoriel périmé. Le candidat utilisé par ce lot est Gemini Omni 1.2 Flash via Interactions.

Hypothèse : chanson de 3 minutes, 12 plans de 15 s, deux variantes par plan et deux chansons à comparer, sortie 1080p agrandie par le fournisseur. Il ne s’agit pas de 1080p natif garanti.

| Poste | Calcul USD HT | Estimation |
| --- | --- | ---: |
| Vidéo | 180 s × 2 × 8688 tokens/s × 12 $ / million | 37,53 $ |
| Musique Lyria 3.5 | 2 × 0,08 $ / chanson | 0,16 $ |
| Réserve sur ces générations | 25 % | 9,42 $ |
| Exemple de calcul CPU Cloud Run Tier 1 | 4 vCPU + 8 GiB pendant 10 min, sans déduire le gratuit | 0,0528 $ |
| Sous-total indicatif de ces postes | | 47,17 $ |

Pour un essai de 30 s avec les mêmes deux variantes : environ 8,07 $ pour les mêmes postes. Le CPU est un exemple de facturation, pas une durée cloud mesurée. Stockage, trafic sortant, tokens d’entrée/texte, images, taxes, change, abonnement éventuel et nouvelles reprises ne sont pas inclus. Ce sous-total n’est donc ni une facture ni un devis complet ferme. Il n’autorise aucune dépense.

La location d’un GPU permanent n’est pas justifiée pour ce trajet API + montage CPU. Une éventuelle séparation locale des pistes ou des modèles vidéo auto-hébergés fera l’objet d’une mesure et d’un devis séparés.

## Reproduire sans frais de génération

À la racine du dépôt :

```sh
npm ci
npm test
npm run typecheck
npm run lint
npm run build
npm run dev
python -m unittest discover -s scripts/phare-production -p 'test_*.py'
```

Ouvrir `/phare/atelier`. Sans activation serveur, l’état d’attente du chiffrage est explicite, les commandes internes restent utilisables sans fournisseur, ainsi que la dictée et le devis ; les demandes de création IA attendent leur activation. Les tests API remplacent `fetch` par une réponse synthétique : ils ne prouvent pas que le compte fournisseur accepte les modèles.

Le plan exporté se chiffre sans réseau :

```sh
python scripts/phare-production/worker.py plan-et-chiffrage.json
```

Pour rendre des médias existants sans fournisseur, placer un fichier `assets.json` contenant `{"audio":"musique.wav","clips":["plan1.mp4","plan2.mp4"]}` à côté des médias, puis :

```sh
python scripts/phare-production/worker.py plan.json --assets assets.json --output work/clip
```

Les chemins doivent rester sous le dossier d’assets. Le worker ne modifie pas les sources. `clip-premier-montage.mp4` reste un brouillon à regarder et écouter ; le rapport technique ne certifie pas la qualité artistique. Ne pas déposer les médias ou le dossier de travail dans le dépôt public.

Pour la conversation, configurer des variables privées, sans les versionner : `GEMINI_API_KEY`, `PHARE_ACCESS_HASH` (SHA-256 du code personnel), `PHARE_CHAT_MODEL` et, seulement après autorisation des coûts, `PHARE_CHAT_ENABLED=true`. Le fragment personnel `#acces=...` est retiré de l’adresse après lecture et gardé seulement dans la session de l’onglet. Ne pas publier ce lien ni mettre le code dans le dépôt.

## Preuves locales

Les tests unitaires couvrent la rétrocompatibilité des sauvegardes, la copie des messages restaurés, l’isolation des projets, la provenance IA, les limites d’action, les refus d’accès, le blocage sans activation, les erreurs fournisseur et la concordance des calculs de devis entre client et worker. Les tests worker couvrent la conservation des identifiants, le contrôle des sources et l’absence de répétition d’un POST incertain.

Le parcours Chromium utilise le vrai écran et le vrai état inactif pour le devis/téléchargement ; l’échange et la dictée sont simulés explicitement dans le test pour ne rien facturer. Un montage local de 15 s, trois plans synthétiques et un sinus a produit un MP4 1280×720 à 30 i/s, H.264/AAC, avec fondus et contrôle des niveaux après encodage. Ce média de vérification n’est ni une chanson ni une preuve d’un clip professionnel généré.
