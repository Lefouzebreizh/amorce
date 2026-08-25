"""Les types que les six modules s'échangent.

Ils vivent ici et non dans les modules parce qu'un module n'en appelle jamais un
autre : le classement reçoit le type détecté par le scan en argument, il ne va
pas le chercher. Sans ce fichier commun, la seule façon de partager une notion
serait un import croisé — et la chaîne deviendrait indémêlable au troisième
module.

À écrire : `Fiche` (un fichier et ce qu'on sait de lui), `Document` (fiche + date,
émetteur, montant), `Media` (fiche + définition, durée, netteté), `Doublon` (un
groupe et celui qu'on garde), `Decision` (garder / écarter / convertir, et pourquoi).
"""
