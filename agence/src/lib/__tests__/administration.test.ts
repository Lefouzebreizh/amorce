import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { assemblerFiches, nomAffiche } from '@/lib/administration';
import type { Profil, Projet, Role, StatutProjet } from '@/lib/types';

function profil(id: string, nom: string | null, role: Role = 'user'): Profil {
  return {
    id,
    updated_at: '2026-01-01T00:00:00Z',
    full_name: nom,
    company_name: null,
    role,
    avatar_url: null,
  };
}

function projet(id: string, client: string, montant: number, cree: string): Projet {
  const statut: StatutProjet = 'draft';

  return {
    id,
    user_id: client,
    title: `Projet ${id}`,
    description: null,
    status: statut,
    amount_estimated: montant,
    created_at: cree,
    updated_at: cree,
  };
}

describe('vue d’administration', () => {
  it('rattache chaque projet à son compte et additionne les montants', () => {
    const vue = assemblerFiches(
      [profil('a', 'Alice'), profil('b', 'Bruno')],
      [
        projet('1', 'a', 100, '2026-03-01T00:00:00Z'),
        projet('2', 'a', 250, '2026-02-01T00:00:00Z'),
        projet('3', 'b', 400, '2026-01-01T00:00:00Z'),
      ],
    );

    const alice = vue.clients.find((fiche) => fiche.profil.id === 'a');

    assert.equal(vue.nombreDeProjets, 3);
    assert.equal(vue.montantTotal, 750);
    assert.equal(alice?.nombreDeProjets, 2);
    assert.equal(alice?.montantTotal, 350);
  });

  it('retient le dépôt le plus récent, la requête rendant les projets antidatés', () => {
    const vue = assemblerFiches(
      [profil('a', 'Alice')],
      [
        projet('1', 'a', 100, '2026-03-01T00:00:00Z'),
        projet('2', 'a', 250, '2026-02-01T00:00:00Z'),
      ],
    );

    assert.equal(vue.clients[0]?.dernierProjet, '2026-03-01T00:00:00Z');
  });

  it('garde les comptes sans projet, avec un dernier dépôt nul', () => {
    const vue = assemblerFiches([profil('a', 'Alice')], []);

    assert.equal(vue.clients.length, 1);
    assert.equal(vue.clients[0]?.nombreDeProjets, 0);
    assert.equal(vue.clients[0]?.dernierProjet, null);
  });

  it('classe les comptes les plus actifs devant, puis par ordre alphabétique', () => {
    const vue = assemblerFiches(
      [profil('c', 'Camille'), profil('a', 'Alice'), profil('b', 'Bruno')],
      [projet('1', 'b', 100, '2026-01-01T00:00:00Z')],
    );

    assert.deepEqual(
      vue.clients.map((fiche) => fiche.profil.id),
      ['b', 'a', 'c'],
    );
  });

  it('ignore un projet dont le compte est hors de portée plutôt que de rompre la page', () => {
    const vue = assemblerFiches(
      [profil('a', 'Alice')],
      [projet('1', 'inconnu', 100, '2026-01-01T00:00:00Z')],
    );

    assert.equal(vue.clients.length, 1);
    assert.equal(vue.clients[0]?.nombreDeProjets, 0);
    // Le total général compte tout ce que la base a servi, y compris ce projet.
    assert.equal(vue.montantTotal, 100);
  });
});

describe('nom affiché', () => {
  it('retombe sur une phrase plutôt que sur du vide', () => {
    assert.equal(nomAffiche(profil('a', null)), 'Compte sans nom');
  });
});
