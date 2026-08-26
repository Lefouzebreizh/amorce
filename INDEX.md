# INDEX — idées et projets

Tableau de bord unique. Toute idée entre par `/inbox/`, ressort en
`/projets-actifs/` (validée, fiche d'exécution écrite) ou en
`/archives-backlog/` (bonne, mais pas maintenant).

## Statuts

| Statut | Sens |
| --- | --- |
| **En cours** | Fiche écrite, exécution commencée. |
| **Faisable** | Score ≥ 6/10, fiche écrite, pas encore démarrée. |
| **En pause** | Score correct mais bloquée (temps, budget, dépendance). |
| **À trier** | Idée brute dans `/inbox/`, pas encore notée. |

## Idées

| Idée | Statut | Score | Fiche | Prochain pas |
| --- | --- | --- | --- | --- |
| Producteur de formats courts IA | **En pause** | 7/10 | [fiche](archives-backlog/producteur-formats-courts-ia.md) | Reprendre si un prospect demande spontanément |
| Audit & reprise de code généré par IA | **Faisable** | 8/10 | [fiche](projets-actifs/audit-reprise-code-genere-ia.md) | 1 audit gratuit d'une page, envoyé non sollicité (< 48 h) |
| Studio audio (Streamlit) | **En pause** | — | [fiche](archives-backlog/studio-audio.md) | Reprendre si Amorce bute sur la voix off |
| Assistant d'allocation d'actifs | **En pause** | — | [fiche](archives-backlog/assistant-patrimoine.md) | Reprendre au premier besoin réel de rééquilibrage |

## Terrain existant (base du critère « Alignement »)

Ce dépôt héberge neuf chantiers actifs sans code commun, plus deux en sommeil.
Une idée nouvelle s'évalue aussi à sa capacité à s'y greffer plutôt qu'à ouvrir
un front de plus. La liste vieillit vite — recompter avant de noter.

| Chantier | Ce que c'est | Pile | État |
| --- | --- | --- | --- |
| **Amorce** (racine) | Studio de montage vertical pour rushes IA, 100 % navigateur. | Next.js 15, React 19, Tailwind v4 | actif |
| **Look & Find** (`look_and_find/`) | Application mobile de scan / recherche. | Flutter, Riverpod 3 | actif |
| **Chaîne KDP** (`kdp/`) | Pré-presse de couvertures et validation de niches. | Python | actif |
| **Socle Agence** (`agence/`) | Socle de production livré aux clients. | Next.js 16, Supabase | actif |
| **Paper-Manager** (`paper-manager/`) | Assistant administratif : scan, échéances, résiliations. | Python | actif |
| **Life-Organizer** (`life-organizer/`) | Rangement de fichiers personnels. | Python | actif |
| **Répondeur Facebook** (`repondeur-facebook/`) | Réponses aux commentaires via l'API Graph. | Python | actif |
| **Chaîne de montage** (`montage-auto/`) | Montage automatisé. | Python | actif |
| **Volet TikTok** (`tiktok/`) | Concepts et scripts, sans code. | — | actif |
| _Studio audio_ (`archives-backlog/mon-app-audio/`) | Outil audio. | Python, Streamlit | en sommeil |
| _Patrimoine_ (`archives-backlog/patrimoine/`) | Allocation d'actifs. | Python | en sommeil |
