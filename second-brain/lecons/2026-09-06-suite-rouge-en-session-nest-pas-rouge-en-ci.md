# Une suite rouge en session n'est pas rouge en CI

*Coût : deux affirmations fausses — « CI rouge, fusion bloquée » annoncée sur une
PR et au propriétaire, plus une tâche ouverte pour « réparer » un test qui
n'était pas cassé.*

Mesuré le 06/09/2026 sur la PR #750 (`le-coffre`, un diff qui ne touchait que
`supabase/schema.sql`). Le test `src/lib/__tests__/formulaire.test.ts` échouait
**dans le conteneur de session** — `fail 1`, reproduit avec la vraie commande du
projet, et même sur `origin/main` pur. J'en ai conclu « le rouge est
préexistant, il bloque la CI », et je l'ai écrit sur la PR.

C'était faux. Les check-runs du head disaient l'inverse : `mergeable=True`,
`state=clean`, et le job `le-coffre.yml` (« Tests, types et lint ») **vert**. Le
test passe sur le runner ; il n'échoue que dans le conteneur de session, qui
résout mal les dépendances du projet (une invocation manuelle rendait même
`ERR_MODULE_NOT_FOUND tsx`).

**La cause du faux pas :** avoir pris le résultat local pour la vérité. `CLAUDE.md`
§7 dit déjà « une suite verte en session ne dit rien de la CI ». Le symétrique
est aussi vrai et plus traître, parce qu'un rouge a l'air d'un fait dur qu'on
n'ose pas contredire : **une suite rouge en session ne dit rien non plus.**

**La parade, et elle coûte un appel :** avant d'annoncer un blocage CI — surtout
sur une PR qu'on a ouverte —, lire les check-runs du head, qui sont l'autorité,
jamais le résultat local.

```bash
head=$(curl -sS ".../pulls/<n>" -H "Authorization: Bearer $GH_TOKEN" \
  | python3 -c "import json,sys;print(json.load(sys.stdin)['head']['sha'])")
curl -sS ".../commits/$head/check-runs" -H "Authorization: Bearer $GH_TOKEN"
```

Le local sert à écrire et à itérer vite ; il ne tranche pas l'état d'une PR. Ce
qui tranche est le runner — et il se lit, il ne se devine pas depuis sa propre
machine.
