# Rétrospective — la Boîte à Outils IA, du 08 au 10 septembre 2026

*Demandée par le propriétaire le 10/09/2026. Chronologie relevée depuis
`git log` et l'API GitHub, jamais de mémoire. Les durées sont du temps
**écoulé**, mesurable ; l'effort, lui, ne l'est pas et n'est pas estimé.*

---

## Ce qu'il faut lire en premier

Onze problèmes, **quinze pull requests**, et une seule chose qui n'a pas
bougé : **le site rapporte toujours sur un seul outil**.

Le coût réel de cette séance ne se lit pas dans les durées — les PR se
fusionnent en 1 à 5 minutes. Il se lit dans le **nombre d'allers-retours** : le
propriétaire a signalé **cinq défauts** que la session aurait dû voir seule, et
a passé sa soirée en poste de contrôle qualité sur un travail annoncé fini à
chaque fois.

| Mesure | Valeur |
| --- | --- |
| PR ouvertes puis fusionnées | 6 sur la séance visuelle (#837, #840, #841, #843, #846, #848) |
| Délai moyen ouverture → fusion | **3,3 minutes** |
| Défauts signalés par le propriétaire | **5** |
| Défauts trouvés par la session avant livraison | 4 |
| Défauts trouvés par l'intégration continue | 2 |
| Programmes d'affiliation ouverts pendant la séance | **0** |

**La bonne nouvelle est arithmétique** : rien n'a été bloqué par un mur
technique. Tout ce qui a coûté du temps était détectable avant de livrer.

---

## 1. La branche portait un commit orphelin de onze jours

**Quand** : 09/09, avant le premier lot.
**Temps perdu** : quelques minutes.
**Ce qui s'est passé** : `claude/ai-affiliate-autopilot-6788jo` existait déjà,
avec un commit du 27 août dont la prémisse — « le réseau n'est pas en ligne » —
avait disparu depuis.

**Pourquoi pas détecté plus tôt** : rien ne mesure l'âge d'une branche au
moment où on la reprend. Le nom d'une branche ne dit pas si son contenu tient
encore.

**Règle proposée pour `CLAUDE.md`** (§ Git, après « Partir de `main` à jour ») :

> **Une branche qu'on reprend se date avant de s'y remettre.**
> `git log -1 --format=%ci <branche>` et `git rev-list --count <branche>..origin/main`.
> Au-delà de deux jours d'écart, on ne continue pas dessus : on repart de
> `origin/main` avec `git checkout -B`, et on dit ce qu'on abandonne plutôt que
> de l'écraser en silence. Un commit dont la prémisse a disparu ne se rebase
> pas, il se jette — mais il se jette **à voix haute**.

---

## 2. Le sitemap périmé bloquait le déploiement, sans le dire

**Quand** : 09/09, en ajoutant la fiche Gamma.
**Temps perdu** : un cycle de construction complet.
**Ce qui s'est passé** : ajouter un outil rend le sitemap obsolète.
`construire-sites.js` sortait alors en **code 2 sans nommer le sitemap** — le
déploiement Pages aurait échoué.

**Pourquoi pas détecté plus tôt** : le code de sortie était juste, le message
ne l'était pas. Une erreur qui ne se nomme pas se cherche là où elle n'est pas.

**Règle proposée** (§ 8, après les quatre règles de méthode) :

> **Un échec qui ne se nomme pas est un défaut du garde-fou, pas du code.**
> Tout contrôle qui interrompt une chaîne dit **quel** fichier, **quelle**
> valeur attendue et **quelle** commande la régénère. Un `exit` nu coûte le
> temps de le diagnostiquer, à chaque fois, à chaque session.

---

## 3. Un vrai lien d'affiliation dans une niche en pause

**Quand** : 09/09, en posant le premier lien Gamma.
**Temps perdu** : le lien a été posé deux fois.
**Ce qui s'est passé** : le lien réel a d'abord atterri dans `education`, dont
la niche porte `actif: false`. Il a passé **toute** la validation, a fait
baisser le compteur de liens de démonstration — et ne s'affichait nulle part.

**Pourquoi pas détecté plus tôt** : aucune vérification ne croise « lien réel »
avec « niche construite ». Les deux étaient vrais séparément.

**Règle proposée** (§ 4, fiche `annuaire-ia`) :

> **Ce qui rapporte se pose dans une niche servie, jamais en réserve.** Avant
> d'écrire un lien d'affiliation réel, lire `niche.actif`. Une niche en pause
> accepte tout et n'affiche rien : le lien compte comme posé dans tous les
> tableaux de bord et ne peut rapporter un centime.

---

## 4. Un signalement de bug qui n'en était pas un

**Quand** : 09/09. **Priorité annoncée par le propriétaire : « Corrige ça en
priorité ».**
**Temps perdu** : le plus gros poste de la séance — reproduction locale,
lecture du workflow, comparaison des octets de l'artefact, puis mesure du site
depuis le bac à sable.
**Ce qui s'est passé** : le message d'erreur cité — « un navigateur refuse de
lire un fichier local en `file://` » — ne peut pas se produire en https. Le
site fonctionnait : 17 outils rendus, JSON en 200, panneau d'erreur masqué.

**Pourquoi pas détecté plus tôt** : personne, des deux côtés, n'avait ouvert
l'adresse réelle. Le propriétaire décrivait ce qu'il voyait, la session lisait
le code.

**Ce que ça a vraiment coûté** : la priorité annoncée a absorbé la soirée sur
un défaut inexistant, pendant que le vrai blocage — **105 liens en
démonstration** — n'a pas bougé d'une ligne.

**Règle proposée** (§ 8 bis, en tête de « Comment procéder ») :

> **Un signalement se reproduit avant de se corriger, et la reproduction se
> fait à l'adresse indiquée.** Le premier geste sur tout rapport de bug est
> d'ouvrir l'URL et de mesurer. Si le défaut ne se reproduit pas, on le dit
> **avant** de chercher une cause, et on nomme les deux ou trois situations
> réelles qui produisent le même symptôme. Corriger un défaut qu'on n'a pas vu
> revient à réparer une pièce qui n'est pas cassée.

---

## 5. La racine du réseau rendait un 404

**Quand** : 08/09, trouvé en mesurant autre chose.
**Temps perdu** : faible, mais le défaut vivait là depuis le premier
déploiement — **six jours**.
**Ce qui s'est passé** : `dist/` ne contenait que des dossiers de niche. Or
`lefouzebreizh.github.io/amorce/` est l'adresse la plus courte, celle qu'on
tape de mémoire, et celle que le journal des déploiements donne lui-même.

**Pourquoi pas détecté plus tôt** : tous les contrôles portaient sur
`/<niche>/`. **Personne n'avait ouvert la racine.**

**Règle proposée** (§ 8 bis, section 2) :

> **La racine d'un site se vérifie comme une page.** Elle n'est jamais dans la
> liste des adresses à contrôler parce qu'elle n'est le chemin de personne — et
> c'est celle qu'on tape de mémoire. Tout parcours de vérification ouvre `/`
> avant les pages profondes.

---

## 6. La charte du studio n'était pas appliquée sur les pages construites

**Quand** : 09/09, PR #837.
**Temps perdu** : un cycle de construction, trouvé juste avant de livrer.
**Ce qui s'est passé** : `construire-sites.js` injectait un `<style>` avec les
couleurs de la niche **après** le lien vers la feuille — donc plus fort
qu'elle. Les pages rendaient l'ancien violet pendant que la source portait le
nouveau.

**Pourquoi pas détecté plus tôt** : la feuille de style était juste. Seul
`getComputedStyle` sur la page **rendue** pouvait le voir.

**Règle proposée** (§ 2 bis, invariants) :

> **Une couleur se vérifie sur ce que le navigateur peint, jamais sur ce que
> le CSS déclare.** `getComputedStyle` sur la page construite, pas un `grep`
> dans la source. Une injection en ligne, un ordre de chargement ou une
> spécificité suffisent à rendre une feuille juste et une page fausse.

---

## 7. Trois défauts visuels que seul le regard a trouvés

**Quand** : 09/09, PR #837, avant livraison.
**Temps perdu** : nul — trouvés à temps. Cités parce qu'**aucun test ne les
voyait**.

| Défaut | Ce qui le cachait |
| --- | --- |
| Le survol sautait au lieu de glisser | Tailwind v4 rend `-translate-y-1` par la propriété `translate` ; la transition ne nommait que `transform` |
| Le prix était à **28°** de la sauge du bouton affilié, à 1,16:1 | La couleur était codée en dur, hors charte, à deux endroits |
| Le second `text-emerald-300` avait survécu au premier remplacement | Un `replace` Python n'avait attrapé qu'une occurrence |

**Règle proposée** (§ 10, « Modifier ce dépôt ») :

> **Un remplacement se compte, il ne se constate pas.** Après tout
> remplacement de valeur, `grep -c` sur l'ancienne valeur doit rendre **zéro**.
> Un `replace` qui n'attrape qu'une occurrence sur deux laisse un défaut dans
> la moitié la moins regardée du fichier.

---

## 8. Le sous-titre en blanc et les chips gris — 1er aller-retour

**Quand** : 09/09 20:53, PR #840. **Signalé par le propriétaire.**
**Temps perdu** : un aller-retour depuis un téléphone.
**Ce qui s'est passé** : le dégradé portait sur le premier `<span>` seulement,
et les chips de filtre étaient restés en `border-bord` gris — non touchés par
la refonte, parce que personne n'avait regardé cette rangée-là.

**Pourquoi pas détecté plus tôt** : la refonte avait traité les badges des
cartes. Les chips de filtre font la même chose visuellement, portent le même
mot dans l'interface, et n'avaient pas été inventoriés.

**Règle proposée** (§ 8 bis, section 1) :

> **Une refonte visuelle s'inventorie avant de commencer.** Lister tous les
> éléments qui portent la couleur ou le motif qu'on change — badge, chip,
> pastille, trait, halo, bouton — et cocher chacun. Deux éléments qui se
> ressemblent à l'écran se corrigent ensemble ou pas du tout : n'en corriger
> qu'un rend l'incohérence **plus** visible qu'avant.

---

## 9. Le violet pâle répandu au-delà des badges — 2e et 3e aller-retour

**Quand** : 09/09 21:10 (PR #841) puis 21:21 (PR #843).
**Temps perdu** : **deux** allers-retours en trente minutes, sur le même sujet.
**Ce qui s'est passé** : `#C2A2F6` avait été choisi pour tenir le contraste des
badges, puis employé aussi dans le dégradé du titre. Le propriétaire l'a vu en
comparant avec son studio.

**La mesure qui a tout réglé** : le studio ne porte pas un violet, il en porte
**deux** — `#7C3AED` pour le décor, `#D4C6FB` pour le texte. Relevé sur la page
peinte, pas sur les jetons déclarés.

| | Sur la carte composite `#1b1e28` |
| --- | --- |
| `#7C3AED` | 2,92:1 |
| `#C2A2F6` (celui qui a été livré) | **6,17:1 — sous le plancher de 7:1** |
| `#D4C6FB` | 7,98:1 |

**Pourquoi pas détecté plus tôt** : la palette d'un produit voisin n'avait
jamais été **relevée**. Elle avait été reconstituée à partir d'un brief.
Personne n'avait ouvert le site du studio pour mesurer ce qu'il peint.

**Ce que ça a coûté en plus** : la première correction (#841) a recopié du
studio un dégradé à palier — turquoise tenu jusqu'à 35 % — qui affaiblissait le
violet. Il a fallu un troisième aller-retour pour le retirer. **Une correction
faite sans regarder le résultat en produit une deuxième.**

**Règle proposée** (§ 2 bis, après le registre des accents) :

> **La palette d'un produit voisin se relève sur la page peinte, jamais sur
> ses jetons déclarés.** Avant d'aligner un produit sur un autre, ouvrir le
> site de référence et lire `getComputedStyle` sur ses éléments réels — titre,
> badge, trait, petit texte. Un jeton dit une valeur, pas l'usage qu'on en
> fait : `--violet` peut exister sans qu'aucune lettre ne soit peinte avec.
>
> **Et un produit sombre a besoin de deux teintes par accent, pas d'une** : la
> profonde pour les dégradés, les traits et les halos ; une claire dérivée pour
> tout ce qui se lit. Un seul jeton oblige à choisir entre une teinte délavée
> et un texte sous le plancher — c'est exactement l'arbitrage qui a coûté ces
> deux allers-retours.

---

## 10. Seize fiches sur dix-sept sans aucun lien — 4e aller-retour

**Quand** : 09/09 22:05, PR #846. **Signalé par le propriétaire :** « aucun
lien ne marche à part gamma ».
**Temps perdu** : un aller-retour, et surtout **le défaut vivait là depuis le
premier jour du site**.
**Ce qui s'est passé** : un garde-fou masque les boutons dont l'adresse est
encore `exemple-affiliation.com` — c'est juste, un bouton vers un domaine
inexistant est pire que pas de bouton. Personne n'avait mesuré **ce qu'il
laissait** : 16 fiches sur 17 sans aucun `<a>`. Un comparateur d'outils d'où
l'on ne peut pas partir essayer l'outil.

**Pourquoi pas détecté plus tôt** : le contrôle s'appelait « aucun lien de
démonstration cliquable » et rendait `0 trouvé`. **« 0 lien mort » et « 0 lien »
rendent le même vert.**

**Règle proposée** (§ 8 bis, section 2) :

> **Un contrôle compte ce qui doit être là, jamais l'absence de ce qui ne doit
> pas y être.** « 0 erreur » et « 0 contenu » sont indiscernables. Tout
> garde-fou qui **retire** quelque chose s'accompagne d'un contrôle qui compte
> ce qui **reste** — liens cliquables, cartes affichées, champs remplis — avec
> le nombre attendu écrit en clair.

---

## 11. Le contrôle de cohérence rouge en CI, vert en local

**Quand** : 10/09 09:47, PR #848.
**Temps perdu** : un cycle de CI et un correctif.
**Ce qui s'est passé** : `bg-panneau/70`, écrit entre accents graves, est lu
comme un chemin du dépôt par `verifier-coherence.py`. Le contrôle passait en
local et échouait sur le runner.

**Pourquoi** : la règle de dernier recours du contrôleur cherche la feuille du
chemin — ici `70` — **n'importe où dans l'arbre**, y compris dans des dossiers
ignorés par git. Un fichier de ce nom traînait en local ; le clone frais du
runner n'en a pas.

**Ce que ça dit de la méthode** : la session avait une preuve. Elle portait sur
le mauvais objet — exactement ce que la section QA venait d'interdire, appliqué
à sa propre vérification.

**Règle proposée** (§ 10, « Commandes ») :

> **Une vérification qui décide d'une fusion se lance sur une archive du
> commit, jamais sur la copie de travail.**
> `git archive HEAD | tar -x -C /tmp/verif && cd /tmp/verif && …`
> Un fichier ignoré, un artefact de construction ou un cache présent en local
> et absent d'un clone frais suffit à rendre un contrôle vert ici et rouge
> chez le runner. Ce n'est pas un aléa : c'est deux arbres différents.

---

## Déviations par rapport à la priorité annoncée

**Trois, et la troisième est la seule qui compte.**

**a) « Corrige ça en priorité » sur un défaut inexistant.** Le signalement du
09/09 a orienté la soirée entière vers un bug qui n'existait pas. Aucun
manquement de personne : le propriétaire décrivait fidèlement ce qu'il voyait,
et il voyait une page en cache ou ouverte depuis un fichier.

**b) La passerelle MiniMax, validée puis retirée.** Le propriétaire a validé
l'emplacement `generation-serveur/`, puis s'est corrigé : « ce n'était pas pour
toi ». Rien n'a été perdu, parce que la session avait cherché l'existant avant
d'écrire. C'est le §0 bis, règle 4, qui a payé ici.

**c) Et la vraie déviation, celle que personne n'a nommée sur le moment :
toute la séance est passée sur l'habillage.** Six PR, quatre leçons, une
palette alignée au centième de contraste — pendant que la seule mesure qui
décide du revenu n'a pas bougé :

| | Début de séance | Fin de séance |
| --- | --- | --- |
| Outils qui rapportent | 2 sur 107 | **2 sur 107** |
| Programmes à ouvrir | 98 | **98** |

Le site est plus beau, plus lisible, plus accessible et enfin utilisable. Il
rapporte exactement autant qu'avant. **Ce n'est pas un reproche à la session :
elle a fait ce qui lui était demandé, message après message.** C'est un défaut
de cadrage — personne n'a posé, en tête de séance, ce que la soirée devait
avoir changé au bout du compte.

**Règle proposée** (§ 0, après « Jamais de temps mort ») :

> **Une séance s'ouvre sur le chiffre qu'elle doit déplacer.** Avant le premier
> lot, écrire en une ligne la mesure visée — un revenu, un nombre d'outils
> servis, un délai, un taux — et sa valeur de départ. À la fin, la redonner.
> Une séance qui livre six lots sans déplacer le chiffre qu'elle s'était donné
> n'a pas échoué : elle a travaillé sur autre chose, et il faut que ça se voie.
>
> Ça ne suspend rien et ne remplace aucune demande : le propriétaire reste
> maître de ce qu'il demande message après message. La ligne sert à rendre
> visible, à lui comme à la session, l'écart entre ce qui avance et ce qui
> compte.

---

## Ce qui, dans le processus actuel, a permis que ça traîne

Quatre causes, et elles se recoupent toutes sur une seule.

**1. La vérification portait sur la source, pas sur le rendu.** Sept des onze
problèmes étaient invisibles dans le code et évidents à l'écran. Le dépôt
disait même, jusqu'au 08/09, qu'une session « ne peut pas regarder » une page
`*.github.io` — c'était faux, le bac à sable la sert. Une impossibilité écrite
dispense de chercher.

**2. Les contrôles comptaient des absences.** « 0 lien mort », « 0 erreur
JavaScript », « aucune couleur hors charte » : trois formulations qui restent
vertes sur une page vide.

**3. Chaque correction repartait sans balayage complet.** Cinq PR visuelles en
quatre-vingt-dix minutes, chacune déclenchée par un défaut voisin du
précédent. Le sous-titre, puis les chips, puis le violet, puis le dégradé.
**Le propriétaire a servi de boucle de contrôle qualité.**

**4. Le cache a fabriqué deux faux signalements.** GitHub Pages sert le HTML en
`max-age=600`. Deux fois, le propriétaire a décrit une version corrigée dix
minutes plus tôt. Ce n'est pas anodin : ça use la confiance dans les comptes
rendus, des deux côtés.

**Règle proposée** (§ 8 bis, « Comment procéder », point 1) :

> **Toute mesure sur une page déployée se fait avec le cache contourné**
> (`?t=<horodatage>`), et tout compte rendu qui donne une adresse rappelle en
> une ligne que le HTML est servi en `max-age=600`. Une session qui mesure du
> neuf et un propriétaire qui voit du vieux ne se contredisent pas : ils
> regardent deux fichiers différents.

---

## Les huit règles, à recopier telles quelles

| № | Section visée | Règle en une phrase |
| --- | --- | --- |
| 1 | § Git | Une branche qu'on reprend se date ; au-delà de deux jours, on repart de `main` **à voix haute**. |
| 2 | § 8 | Un contrôle qui interrompt une chaîne nomme le fichier, la valeur attendue et la commande qui répare. |
| 3 | § 4 · `annuaire-ia` | Un lien qui rapporte se pose dans une niche servie ; lire `niche.actif` avant d'écrire. |
| 4 | § 8 bis | Un signalement se reproduit **à l'adresse indiquée** avant qu'on en cherche la cause. |
| 5 | § 8 bis | La racine d'un site se vérifie comme une page — c'est celle qu'on tape de mémoire. |
| 6 | § 2 bis | Une couleur se vérifie sur ce que le navigateur **peint**, jamais sur ce que le CSS déclare. |
| 7 | § 10 | Un remplacement se compte : `grep -c` sur l'ancienne valeur doit rendre zéro. |
| 8 | § 8 bis | Un contrôle compte ce qui **doit** être là ; « 0 erreur » et « 0 contenu » rendent le même vert. |

Et les trois qui portent sur la conduite plutôt que sur le code :

| № | Section visée | Règle en une phrase |
| --- | --- | --- |
| 9 | § 8 bis | Une refonte visuelle s'inventorie avant de commencer ; deux éléments qui se ressemblent se corrigent ensemble. |
| 10 | § 10 · Commandes | Une vérification qui décide d'une fusion se lance sur une **archive du commit**. |
| 11 | § 0 | Une séance s'ouvre sur le chiffre qu'elle doit déplacer, et se ferme en le redonnant. |

---

## Ce qui reste ouvert, et n'appartient qu'au propriétaire

**Neuf programmes d'affiliation ouvrables sur `generaliste`** — Runway,
Synthesia, ElevenLabs, Descript, Zapier, Suno, HeyGen, Ideogram, Adobe Firefly
— et **89 sur le reste du réseau**. Classés par ce qui paie le plus vite dans
`annuaire-ia/AFFILIATION.md`.

Sept outils n'auront **jamais** de programme : OpenAI, Anthropic, Google,
Midjourney, Canva, Notion. Ils portent désormais un lien direct, non rémunéré
et annoncé comme tel.

C'est le seul levier qui reste. Tout le reste est fait.
