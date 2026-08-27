"""Les clients d'API, un par service, et rien d'autre.

La règle est qu'un module de `sources` connaît la forme JSON d'un service et
la traduit en objets de `core.modeles` — il ne décide de rien. Aucun seuil,
aucune note, aucune élimination ici : c'est ce qui permet de remplacer
RugCheck par autre chose le jour où il ferme son accès gratuit, sans relire
une ligne de logique de détection.

| Module          | Service          | Sert à                                  | Clé |
| --------------- | ---------------- | --------------------------------------- | --- |
| `dexscreener`   | DexScreener      | découverte et métriques, toutes chaînes | non |
| `goplus`        | GoPlus Security  | sécurité EVM et Solana                  | opt |
| `honeypot_is`   | honeypot.is      | simulation d'achat/revente (ETH/BSC/Base) | non |
| `rugcheck`      | RugCheck         | sécurité Solana, en second avis         | non |
| `etherscan`     | Etherscan V2     | premiers acheteurs EVM, 60+ chaînes     | oui |
| `solana_rpc`    | Helius ou RPC public | premiers acheteurs et détenteurs Solana | opt |
"""
