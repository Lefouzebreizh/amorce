# Le défaut vit dans la couture entre deux moitiés justes

**04/09/2026.** Écriture de la sauvegarde d'une base client pour le socle
`agence/`. Deux défauts trouvés, tous deux invisibles à la relecture, tous deux
au même endroit : la jonction entre deux gestes dont aucun n'est faux.

## Ce qui a été mesuré

L'aller-retour complet — remplir une base au schéma du socle, sauvegarder,
**détruire la base**, restaurer, compter — a échoué deux fois avant de passer.

**Premier défaut.** `pg_dump --schema=public` ne prend pas le déclencheur qui
crée un profil à l'inscription d'un compte : il est posé sur `auth.users`, dans
le schéma `auth`, et le filtre l'exclut. Il appelle pourtant une fonction de
`public` — il est donc à nous, pas à Supabase.

Conséquence si personne ne le voit : une base restaurée **accepte de nouveaux
comptes sans jamais leur créer de profil**. Rien ne le signale à la
restauration, qui se termine sans erreur. Le défaut apparaît à la **première
inscription réelle**, c'est-à-dire chez le client, un jour où plus personne ne
pense à la sauvegarde.

**Second défaut, découvert seulement après avoir corrigé le premier.** Restaurer
les comptes **réveille** ce déclencheur, qui fabrique un profil vide par compte.
Ces profils-là entrent en collision avec les vrais, restaurés juste après :

```
pg_restore: error: COPY failed for table "profiles":
ERROR: duplicate key value violates unique constraint "profiles_pkey"
```

L'ordre est contraint et il n'y a pas d'échappatoire : `profiles.id` référence
`auth.users`, donc les comptes passent forcément en premier.

## Ce qui rend ces deux-là instructifs

Aucune des deux moitiés n'est fautive. Le déclencheur fait exactement son
travail — créer un profil quand un compte naît. La restauration fait exactement
le sien — remettre les lignes sauvegardées. **C'est leur enchaînement qui
casse**, et un enchaînement ne se relit pas : il s'exécute.

C'est la même famille que le contrôle dont les deux côtés viennent de la même
source, déjà écrite dans `lecons.md` — sauf qu'ici les deux côtés sont bien
indépendants, et que c'est leur *ordre* qui n'avait jamais été joué.

## Portée générale

**Une sauvegarde qui n'a jamais été restaurée n'est pas une sauvegarde, c'est un
fichier.** Un `pg_dump` planifié reste vert pendant deux ans sur une base vidée
par une migration ratée : il sauvegarde fidèlement le néant. Ce qui prouve
quelque chose est le chemin inverse, joué en entier — et il doit **détruire**,
sinon il ne prouve rien non plus.

Le contrôle a donc besoin de deux choses que personne n'écrit spontanément :

- **un manifeste** produit au moment de la sauvegarde, qui compte les lignes
  table par table. Sans lui, la restauration se vérifie contre rien et passe au
  vert sur une base vide ;
- **une vérification de ce qui n'est pas des lignes** : la RLS réactivée, les
  politiques présentes, les déclencheurs revenus. Une restauration qui ramène
  les données sans les politiques rend une base **ouverte à qui détient la clé
  publique**, et c'est le plus cher des défauts silencieux.

Vaut au-delà des bases de données : partout où deux étapes correctes se
succèdent sans avoir jamais été enchaînées pour de vrai — un export puis un
import, un chiffrement puis un déchiffrement, un rendu puis un encodage. La
relecture voit deux gestes justes ; seule l'exécution voit la couture.

## Deux corollaires PostgreSQL, mesurés

- **`pg_dump` refuse un serveur plus récent que lui.** Les projets Supabase de
  ce compte tournent en **PostgreSQL 17** ; cette machine porte un client
  **16.13**. Le refus est en anglais, au milieu d'une sortie longue. Un script
  de sauvegarde doit le vérifier lui-même et dire le remède.
- **Le pooler en mode transaction (port 6543) ne sait pas servir `pg_dump`.**
  C'est pourtant l'adresse que l'interface Supabase met en avant. La connexion
  directe est sur 5432, dans le même écran.
