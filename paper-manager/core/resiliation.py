"""Module 4 — le courrier prêt à signer.

Résiliation, contestation de facture, demande de remboursement : un gabarit de
`modeles/`, rempli avec l'identité et le contrat, puis relu par le modèle pour
le seul paragraphe qui dépend du cas (le motif).

Pourquoi un gabarit et pas une lettre entièrement écrite par le modèle : un
courrier de résiliation n'est opposable que s'il contient certaines mentions —
identité, référence client, contrat visé, date d'effet demandée, demande
d'accusé de réception. Une lettre rédigée de bout en bout est plus élégante et
oublie une mention sur cinq. Le gabarit garantit le fond ; le modèle ne
s'occupe que de la forme du motif.

Trois règles :

1. **Aucun courrier n'est envoyé.** Le module produit un fichier dans
   `coffre/courriers/`, à relire et à signer. Un courrier administratif parti
   tout seul ne se rattrape pas.
2. **Le recommandé est indiqué quand il est nécessaire** (`recommande`) : c'est
   la preuve de l'envoi qui fait foi en cas de litige, pas le courrier.
3. **Le courrier est ajouté au journal comme un document.** Il fait partie du
   dossier ; le jour où le prélèvement continue malgré la résiliation, c'est
   lui qu'on cherche.
"""
