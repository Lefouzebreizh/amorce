import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { assemblerFiches, lireVueAdministration, nomAffiche } from '@/lib/administration';
import { clientFactice } from '@/lib/__tests__/aides-actions';
import type { Session } from '@/lib/supabase/session';
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

/*
 * La coupure à mille lignes de PostgREST. C'est le défaut le plus discret de
 * cette page : la requête réussit, la page s'affiche, et le montant présenté
 * comme le total du compte client est celui des mille premières lignes.
 *
 * Ces tests portent sur `assemblerFiches`, seul endroit où le rapprochement des
 * chiffres se décide, et donc seul endroit où l'écart peut être vu.
 */
describe('réponse coupée par le serveur', () => {
  const recus = [profil('a', 'Alice')];
  const projetsRecus = [projet('1', 'a', 100, '2026-01-02T00:00:00Z')];

  it('ne signale rien quand tout est arrivé', () => {
    const vue = assemblerFiches(recus, projetsRecus, { comptes: 1, projets: 1 });

    assert.equal(vue.tronquee, null);
    assert.equal(vue.nombreDeComptes, 1);
    assert.equal(vue.nombreDeProjets, 1);
  });

  it('ne signale rien quand le serveur ne compte pas', () => {
    // Sans `count`, on ne sait rien de plus que ce qu'on a reçu : supposer une
    // coupure inventerait un avertissement, et un avertissement de trop se
    // désapprend aussi vite qu'un avertissement absent.
    const vue = assemblerFiches(recus, projetsRecus);

    assert.equal(vue.tronquee, null);
    assert.equal(vue.nombreDeProjets, 1);
  });

  it('dit ce qui manque quand le serveur a coupé', () => {
    const vue = assemblerFiches(recus, projetsRecus, { comptes: 1200, projets: 1000 });

    assert.deepEqual(vue.tronquee, { comptes: 1199, projets: 999 });
  });

  it('rend le nombre réel de projets, pas celui des lignes reçues', () => {
    const vue = assemblerFiches(recus, projetsRecus, { comptes: 1, projets: 1000 });

    assert.equal(vue.nombreDeProjets, 1000);
  });

  it('somme le montant sur les seules lignes reçues, et le dit', () => {
    // Le montant ne peut pas être exact : les lignes qui manquent manquent. Ce
    // qui compte est que la page sache qu'il minore, plutôt que de l'afficher
    // comme un total.
    const vue = assemblerFiches(recus, projetsRecus, { comptes: 1, projets: 1000 });

    assert.equal(vue.montantTotal, 100);
    assert.ok(vue.tronquee, 'le montant minore et rien ne le signale');
  });

  it("ne fabrique pas d'écart négatif quand un compte est en retard", () => {
    // Une ligne insérée entre le `count(*)` et la lecture rend plus de lignes
    // que le compte. Le cas qui compte est **mixte** : les projets sont bien
    // coupés, les comptes sont en avance. Sans borne à zéro, la page annonce
    // « -1 compte manque à l'appel », ce qui décrédibilise l'avertissement
    // entier — et un cas où les deux sont négatifs ne l'aurait pas vu, leur
    // somme restant sous zéro.
    const vue = assemblerFiches(recus, projetsRecus, { comptes: 0, projets: 1000 });

    assert.deepEqual(vue.tronquee, { comptes: 0, projets: 999 });
  });
});

describe('lecture de la vue', () => {
  it("demande au serveur le compte exact, sur les deux tables", async () => {
    // Sans `count: 'exact'`, la coupure à mille lignes redevient invisible et
    // toute la garde ci-dessus ne sert plus à rien. Le retrait de cette option
    // compile sans erreur et laisse le reste de la suite au vert : c'est
    // précisément pourquoi ce test existe.
    const { client, espion } = clientFactice({ data: [], error: null, count: 0 });

    await lireVueAdministration({ client } as unknown as Session);

    const selections = espion.appels.filter((appel) => appel.methode === 'select');

    assert.equal(selections.length, 2, 'les deux tables doivent être interrogées');

    for (const selection of selections) {
      assert.deepEqual(
        selection.arguments[1],
        { count: 'exact' },
        'chaque lecture doit réclamer le compte exact',
      );
    }
  });
});
