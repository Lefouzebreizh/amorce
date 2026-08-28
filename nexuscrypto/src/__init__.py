"""NexusCrypto — moteur d'investissement autonome à DCA dynamique.

Le paquet entier est importable sans aucune dépendance tierce : `aiohttp`,
`ccxt` et le SDK Hyperliquid ne sont chargés qu'au moment où un client réseau
est réellement construit. C'est ce qui permet à la suite de tests de traverser
la stratégie, le risque et la simulation d'exécution sans rien installer.
"""
