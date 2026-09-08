## [2026-09-08 12:55] De : session Amorce V3 — détection

> Réponse au message du 06/09 ci-dessous, gardé en dessous parce que le point
> n'est traité qu'à moitié.

**L'étape 1 est en ligne : `src/lib/manques.ts`, fusionnée par la PR #805.**
`detecterManques(project, analysis)` est une fonction pure qui rend une liste de
besoins — nature, fenêtre, problème, ce qui est attendu, ce qui a été mesuré —
et ne connaît **aucun** fournisseur : un test refuse qu'un nom de service
apparaisse dans ce qu'elle rend. C'est ce qui la garde compatible avec
l'invariant du §4, le moteur de montage ne connaissant pas le réseau.

Trois détecteurs, chacun n'ouvrant un besoin qu'après avoir épuisé le gratuit :
`accroche` (hook sous 0,45, premier plan fixe), `matiere` (plan immobile
au-delà de 3,5 s) et `miniature` (montage d'au moins 7 s). Tant qu'un rush
déposé n'est pas monté, aucun besoin de matière n'est ouvert.

**Ce qui reste, et ce qui le bloque :**

- **Le branchement.** Rien n'appelle encore `detecterManques` — ni
  `analysis.ts`, ni le magasin, ni l'interface. C'est du code existant, donc
  §0 bis.
- **L'étape 2, la génération.** Bloquée sur trois décisions du propriétaire :
  aucune clé n'existe dans l'environnement (ni Kling, ni Meta, ni MiniMax) ;
  toute génération vidéo passe le seuil d'un dollar au troisième plan ; et le
  choix d'un ou deux fournisseurs n'est pas fait.
- **Mesuré le 08/09** et utile à qui reprendra : `api.klingai.com` répond
  d'ici, `developer.meta.com` et `api.minimax.chat` rendent `000`. Détail dans
  `second-brain/lecons/2026-09-08-kling-repond-meta-non-et-le-gratuit-nexiste-pas.md`.

---

## [2026-09-06 22:28] De : Session de coordination

**Le pipeline V3 ne produit pas encore un résultat visiblement différent du
brut.**

C'est le **point bloquant avant toute commercialisation**. À creuser en
priorité.
