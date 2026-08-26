---
name: audit-code-ia
description: Auditer une base de code générée par IA qui ne tient plus en production, et livrer un rapport d'une page classé par ce qui cassera en premier. Relève les secrets en clair, l'autorisation absente côté serveur, les coûts non bornés, l'absence de tests, et chiffre le coût de la remise en état. À utiliser dès qu'il s'agit d'auditer, reprendre, réparer, expertiser ou chiffrer une application « vibe-codée », construite avec Lovable, Bolt, v0, Replit ou Cursor — et aussi pour « ce code tient-il la route », « est-ce rattrapable ou faut-il tout refaire », « combien pour remettre ça d'aplomb », ou préparer un devis de reprise. Ne pas attendre le mot « audit ».
---

# Auditer une base de code générée par IA

L'offre repose sur un renversement : le client ne se demande pas s'il veut un
audit, il est déjà bloqué. Le rapport ne doit donc pas convaincre — il doit
**hiérarchiser**. Une liste de trente problèmes non classés est aussi inutile
que pas de rapport : elle rend le devis impossible et paralyse le client.

D'où la règle qui gouverne tout le reste : **cinq constats, classés par ce qui
cassera en premier en production**, et le correctif du premier déjà écrit.

## Avant de commencer

Ne lire que du code auquel on a été invité : un dépôt public, ou un accès donné
par son propriétaire. Un audit non sollicité se fait sur du public, et se dit
comme tel dans le rapport.

## 1. Le relevé mécanique

```bash
python3 .claude/skills/audit-code-ia/scripts/scan.py <chemin-du-depot>
```

Le script collecte, il ne juge pas : secrets en clair, secrets exposés au
navigateur, `.env` versionnés, motifs à risque, couverture de tests,
verrouillage des dépendances, fichiers démesurés, marqueurs d'inachèvement.

Il est volontairement étroit. **Un faux positif dans un rapport d'audit coûte
la crédibilité de tout le reste** — le client vérifie toujours le premier
constat, et s'il est faux il ne lit pas le deuxième.

## 2. La lecture, que le script ne remplace pas

Les trois défauts les plus coûteux ne se détectent pas par expression
régulière. Les chercher à la main, dans cet ordre :

**L'autorisation côté serveur.** Le défaut le plus grave et le plus répandu :
le contrôle d'accès existe dans l'interface, et nulle part ailleurs. Vérifier
qu'une route d'API ou une règle de base de données refuse une requête forgée —
pas seulement que le bouton est masqué. Sur Supabase / Firebase, regarder si
les règles de sécurité au niveau des lignes sont **activées**, pas seulement
écrites. C'est le constat qui justifie à lui seul une mission.

**Les coûts non bornés.** Un appel à une API payante sans plafond ni limite de
débit, dans un chemin qu'un visiteur déclenche. Une boucle ou un abus, et la
facture du mois dépasse le budget de l'année. Chercher les appels sortants
payants et remonter jusqu'à ce qui les déclenche.

**Ce qui ne se redéploie pas.** Schéma de base modifié à la main, variables
d'environnement qui n'existent que sur la machine d'origine, étape de build non
reproductible. L'application tourne, mais personne ne peut la remettre en
route. Test décisif : **peut-on la reconstruire depuis le dépôt seul ?**

## 3. Le classement

Classer par **ce qui casse en premier**, pas par gravité théorique.

| Rang | Nature | Pourquoi en premier |
| --- | --- | --- |
| 1 | Secret exploitable en clair | Le dommage est déjà en cours, et il est irréversible : la clé doit être révoquée aujourd'hui. |
| 2 | Autorisation absente côté serveur | Une seule requête forgée suffit ; les données sorties ne rentrent pas. |
| 3 | Coût non borné | Se déclenche sans prévenir, et le montant ne se négocie pas après coup. |
| 4 | Impossible à redéployer | Ne casse rien tant que rien ne bouge — et bloque tout le jour où il faut corriger. |
| 5 | Absence de tests | Ne casse rien directement : c'est ce qui rend tout le reste irréparable. Toujours dernier, jamais absent. |

L'absence de tests ferme le rapport parce qu'elle est le **multiplicateur** :
elle transforme chaque correctif en pari. C'est aussi ce qui justifie une
mission plutôt qu'un dépannage, et le dire à cette place l'appuie sur les
quatre constats précédents au lieu de l'annoncer à froid.

## 4. Le rapport

Gabarit dans `assets/rapport.md`. **Une page. Cinq constats. Pas six.**

```bash
cp .claude/skills/audit-code-ia/assets/rapport.md <client>-audit.md
```

Trois exigences qui font la différence entre un rapport lu et un rapport classé :

- **Le correctif du constat n°1 est écrit, pas décrit.** Le code, ou les
  commandes exactes. C'est ce qui transforme un diagnostic en preuve de
  compétence, et c'est le seul endroit où offrir du travail gratuit se
  rentabilise.
- **Chaque constat porte sa conséquence chiffrée ou datée** : « votre clé
  OpenAI est lisible dans le dépôt public depuis le 3 mars » bat « mauvaise
  gestion des secrets ». Un fait vérifiable ne se discute pas.
- **Aucun jugement sur l'IA ni sur celui qui a écrit le code.** « Le code est
  mauvais » fait perdre le client ; « voici ce qui cassera mardi » le fait
  signer. Il a construit ce qu'il pouvait avec ce qu'il avait.

## 5. Le chiffrage

L'audit est vendu à **prix fixe** — c'est sa raison d'être commerciale. Le
périmètre d'une reprise est inconnu avant de l'avoir regardée ; forfaitiser la
reprise sans audit préalable est le moyen le plus sûr de travailler à perte, et
c'est précisément pourquoi peu de prestataires acceptent ce travail.

Le rapport se clôt sur trois options chiffrées, jamais une seule :

1. **Le strict nécessaire** — constats 1 à 3, ce qui arrête l'hémorragie.
2. **La remise en état** — les cinq constats, plus un harnais de tests sur les
   chemins critiques.
3. **Ne rien faire** — avec le coût attendu de l'inaction. Cette option doit
   figurer : elle rend les deux autres crédibles, et un client qui se sent
   forcé ne signe pas.

## Convention

Français partout. Le rapport est un document client : relire pour qu'il tienne
sans jargon, un dirigeant non technique devant pouvoir classer les cinq
constats sans aide.
