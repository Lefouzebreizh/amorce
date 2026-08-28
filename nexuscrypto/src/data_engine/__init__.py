"""Ingestion multi-sources.

Toutes les sources partagent la même forme : elles reçoivent un `Fetcher` (ou
un client CCXT) par le constructeur, ne décident rien, et rendent les objets de
`core/modeles.py`. Aucune ne journalise une décision, aucune ne lève quand elle
échoue autrement que par les exceptions de `core/reseau.py` — c'est
l'agrégateur qui décide de ce qu'il fait d'une source muette."""
