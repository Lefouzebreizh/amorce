# Inbox — le-coffre

## [2026-09-06 21:50] De : session de coordination

Sujet : limite d'upload — 100 Mo jugé insuffisant, chercher côté hébergement actuel

Le patch qui monte la limite d'upload de 20 Mo à 100 Mo n'est pas suffisant pour Erwann : il veut du gigaoctet, pas un palier arbitraire.

Avant de valider quoi que ce soit, il faut d'abord savoir **quel hébergement de fichiers est actuellement utilisé par Le Coffre** (Supabase Storage ? autre chose ?), pour choisir la solution la moins chère et la plus simple **compte tenu de l'existant**, plutôt que de patcher une limite en l'air.

Deux pistes déjà identifiées par recherche web, à évaluer selon la réponse ci-dessus :

- **Vercel Blob** (upload direct navigateur) : jusqu'à 5 To par fichier, contourne la limite de 4,5 Mo des fonctions serverless Vercel.
- **Supabase Storage** : 5 Go par fichier en upload standard, jusqu'à 50 Go en upload reprenable (TUS) sur l'offre Pro Plan et plus.

Priorité constante d'Erwann sur ce projet : toujours la solution la moins chère avec le plus de marge de manœuvre, jamais un pansement qui tiendra six mois.
