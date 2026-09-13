# Rappels : normaliser les retours avant l’échappement

Paper-Manager et le moteur administratif partageaient le même oubli : leur
échappement remplaçait LF, mais conservait CR dans une consigne Windows CRLF
ou dans un texte avec CR seul. Le fichier ICS contenait alors un retour chariot
brut au milieu d’une propriété.

La correction normalise CRLF puis CR en LF avant de protéger les caractères
réservés. Les délimiteurs CRLF entre propriétés, l’heure et les identifiants
restent inchangés. Le défaut a été reproduit dans les deux modules avant
correction, y compris dans les octets réellement écrits sur disque.

Validation locale Windows : 261 tests Paper-Manager et 92 tests moteur
administratif réussis. Deux anciens tests Paper-Manager supposaient des
séparateurs POSIX : ils comparent désormais des Path, sans changer le stockage
applicatif. Le premier lancement dans le bac à sable a rencontré des refus
d’accès aux dossiers temporaires ; la suite complète a été relancée avec les
permissions nécessaires.

Ces preuves portent sur la génération du fichier. Elles ne remplacent pas
un import dans Google Calendar, Outlook ou le calendrier d’un téléphone.
