# Le rejet d’un champ ne nécessite pas une adresse distante dans sa fixture

Le garde `src/lib/__tests__/frontiere.test.ts` parcourt les fichiers TypeScript de `src/lib`, y compris les tests placés directement dans ce dossier. La fixture négative du champ `endpoint` de `phare-recipes.test.ts` contenait une adresse distante littérale : le contrôle global échouait, bien que l’importateur rejette ce champ avant toute exécution.

Reproduction : 25 tests réussis sur 26 ; seul le garde des adresses distantes échoue, en désignant la fixture à la ligne 74. Remplacer la valeur par `/fixture-endpoint` conserve le contrôle du rejet de champ inconnu. Même commande ensuite : 26 réussites, zéro échec. Le garde de frontière reste inchangé.

Commande : `node --experimental-strip-types --test src/lib/phare-recipes.test.ts src/lib/phare-engine-registry.test.ts src/lib/__tests__/frontiere.test.ts`.

Le commit `aa57ef2123c29aae93eabecc795f52dabcef2719` contient la correction ciblée ; le workflow GitHub « Amorce » associé a réussi. Ce contrôle ne constitue pas une preuve de raccord des recettes à l’application.
