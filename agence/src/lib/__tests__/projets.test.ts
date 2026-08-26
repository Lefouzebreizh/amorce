import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { calculerStatistiques, estFiltreStatut } from '@/lib/projets';
import type { Projet, StatutProjet } from '@/lib/types';

function projet(statut: StatutProjet, montant: number): Projet {
  return {
    id: `id-${statut}-${montant}`,
    user_id: 'utilisateur',
    title: 'Projet',
    description: null,
    status: statut,
    amount_estimated: montant,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

describe('statistiques du tableau de bord', () => {
  it('rend des compteurs à zéro sans projet', () => {
    const stats = calculerStatistiques([]);

    assert.equal(stats.total, 0);
    assert.equal(stats.montantTotal, 0);
    assert.equal(stats.montantEnCours, 0);
    assert.deepEqual(stats.parStatut, { draft: 0, in_progress: 0, completed: 0 });
  });

  it('répartit les projets par statut', () => {
    const stats = calculerStatistiques([
      projet('draft', 100),
      projet('in_progress', 200),
      projet('in_progress', 300),
      projet('completed', 400),
    ]);

    assert.equal(stats.total, 4);
    assert.deepEqual(stats.parStatut, { draft: 1, in_progress: 2, completed: 1 });
  });

  it("ne compte dans l'enveloppe en cours que ce qui est en cours", () => {
    const stats = calculerStatistiques([
      projet('draft', 100),
      projet('in_progress', 250),
      projet('completed', 400),
    ]);

    assert.equal(stats.montantTotal, 750);
    assert.equal(stats.montantEnCours, 250);
  });
});

describe('filtre de statut', () => {
  it('accepte « tous » et chacun des statuts', () => {
    assert.equal(estFiltreStatut('tous'), true);
    assert.equal(estFiltreStatut('draft'), true);
    assert.equal(estFiltreStatut('in_progress'), true);
    assert.equal(estFiltreStatut('completed'), true);
  });

  it('refuse une valeur inconnue plutôt que de filtrer sur du vide', () => {
    assert.equal(estFiltreStatut('archive'), false);
    assert.equal(estFiltreStatut(''), false);
    assert.equal(estFiltreStatut(undefined), false);
  });
});
