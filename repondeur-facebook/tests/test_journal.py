#!/usr/bin/env python3
"""Ce que la mémoire des commentaires traités doit tenir.

Le journal est la seule chose qui empêche une deuxième réponse identique sous
un commentaire déjà traité : ses cas limites se vérifient sur disque, dans un
répertoire temporaire.
"""

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from core.facebook import Commentaire  # noqa: E402
from core.journal import Journal, retenir  # noqa: E402


def com(id_, texte='Merci beaucoup pour ce partage', quand='2026-08-20T10:00:00+0000',
        de_nous=False, deja_repondu=False):
    return Commentaire(id=id_, auteur='Marie', texte=texte, publie_le=quand,
                       de_nous=de_nous, deja_repondu=deja_repondu)


class TestJournal(unittest.TestCase):
    def setUp(self):
        self.dossier = tempfile.TemporaryDirectory()
        self.chemin = Path(self.dossier.name) / 'journal.jsonl'
        self.addCleanup(self.dossier.cleanup)

    def test_un_commentaire_reserve_est_retrouve_a_la_relecture(self):
        Journal(self.chemin).reserver('c1', 'répondu')
        self.assertIn('c1', Journal(self.chemin))

    def test_une_ligne_tronquee_ne_condamne_pas_les_autres(self):
        # Une coupure en pleine écriture laisse une ligne incomplète ; tout
        # perdre à cause d'elle ferait répondre une deuxième fois à tout.
        journal = Journal(self.chemin)
        journal.reserver('c1')
        journal.reserver('c2')
        with self.chemin.open('a', encoding='utf-8') as fichier:
            fichier.write('{"id": "c3"')
        relu = Journal(self.chemin)
        self.assertIn('c1', relu)
        self.assertIn('c2', relu)
        self.assertNotIn('c3', relu)

    def test_le_journal_absent_part_simplement_vide(self):
        self.assertNotIn('c1', Journal(self.chemin))


class TestTri(unittest.TestCase):
    def setUp(self):
        self.dossier = tempfile.TemporaryDirectory()
        self.journal = Journal(Path(self.dossier.name) / 'journal.jsonl')
        self.addCleanup(self.dossier.cleanup)

    def test_un_commentaire_deja_traite_est_ecarte(self):
        self.journal.reserver('c1')
        self.assertEqual(retenir([com('c1')], self.journal), [])

    def test_nos_propres_commentaires_sont_ecartes(self):
        self.assertEqual(retenir([com('c1', de_nous=True)], self.journal), [])

    def test_un_commentaire_deja_repondu_est_ecarte(self):
        self.assertEqual(retenir([com('c1', deja_repondu=True)], self.journal), [])

    def test_un_pouce_seul_est_ecarte(self):
        # Répondre à « 👍 » n'apporte rien et s'entend comme un automate.
        self.assertEqual(retenir([com('c1', texte='👍')], self.journal), [])

    def test_les_plus_anciens_passent_en_premier(self):
        # Une exécution bornée doit rattraper le retard, pas écrémer les
        # nouveautés en laissant le reste vieillir.
        recent = com('c1', quand='2026-08-20T12:00:00+0000')
        ancien = com('c2', quand='2026-08-19T08:00:00+0000')
        self.assertEqual([c.id for c in retenir([recent, ancien], self.journal)],
                         ['c2', 'c1'])


if __name__ == '__main__':
    unittest.main()
