# Une rampe de creux posée sur la coupe ne baisse rien

05/09/2026 — mesuré en plaçant un rugissement sur la fin d'un montage.

## Le symptôme

Un son ajouté refuse de passer devant le mixage existant. On monte son gain, la
crête de la somme sort, on redescend ; la boucle oscille et le nouveau son reste
sous ce qu'il devait dominer. Cinq essais, dont trois portaient sur le mauvais
objet — le caractère du cri, sa compression, son égalisation.

## La cause

Le creux qui efface le mixage sous le nouveau son avait sa rampe **posée sur la
coupe** : `creux[a:a+rampe] = linspace(1, fond, rampe)`.

Pendant les 0,30 s de la rampe, le mixage n'est donc quasiment pas atténué — et
c'est précisément là que se trouvait sa crête. Mesuré : le rush sous le creux
piquait à **0,812 au lieu de 0,082**, dix fois trop. C'est lui, et non le son
ajouté, qui consommait toute la réserve de niveau.

## La correction

La rampe descend **avant** la coupe : `creux[a-rampe:a]`. Le mixage est déjà au
fond quand le nouveau son entre. Le même cri est alors passé de −20,2 dB à
−16,4 dB entendus, sans changer une seule fois son gain à la main.

C'est aussi ce que fait un ingénieur du son : il baisse avant, pas pendant.

## La leçon générale

**Une boucle qui pousse d'un côté et rabote de l'autre n'est pas un réglage, et
elle ne le dit pas.** Elle rend un nombre plausible et faux. La parade est de
calculer les deux bornes séparément — celle que la cible demande, celle que la
crête permet — puis de prendre la plus petite **et d'écrire laquelle a mordu**.
C'est cette phrase-là, « borné par la crête », qui a fait chercher au bon
endroit.
