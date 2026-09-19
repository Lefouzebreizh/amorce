import { strict as assert } from 'node:assert';
import { beforeEach, describe, it, mock } from 'node:test';

import { attendreRedirection, clientFactice, formulaire, poserLeDecor } from '@/lib/__tests__/aides-actions';

const decor = poserLeDecor(import.meta.url);
mock.module(new URL('../bilan/redaction.ts', import.meta.url).href, {
  namedExports: {
    rediger: (situation: typeof SITUATION) => ({
      patrimoine: {
        totalEur:
          (situation.livretsEur ?? 0) +
          (situation.assuranceVieEur ?? 0) +
          (situation.bourseEur ?? 0),
        partiel: false,
      },
    }),
  },
});
const { enregistrerBilan, supprimerBilan } = await import('@/lib/actions/patrimoine');

const SITUATION = {
  age: '30-39',
  foyer: { adultes: 1, enfants: 0 },
  revenuMensuelNetEur: 3_000,
  horizon: '10ans',
  livretsEur: 10_000,
  tauxLivretsPct: null,
  assuranceVieEur: 20_000,
  tauxAssuranceViePct: null,
  bourseEur: 15_000,
  logement: null,
};

function connecte(resultat?: unknown) {
  const { client, espion } = clientFactice(resultat);
  decor.session = { client, utilisateur: { id: 'utilisateur-1' } };
  return espion;
}

beforeEach(() => {
  decor.redirections.length = 0;
  decor.invalidations.length = 0;
});

describe('enregistrer un bilan', () => {
  it('recalcule le total et prend le propriétaire dans la session', async () => {
    const espion = connecte({ error: null });

    const cible = await attendreRedirection(() =>
      enregistrerBilan(formulaire({ situation: JSON.stringify(SITUATION) })),
    );

    const [ligne] = espion.premier('insert') as [Record<string, unknown>];
    assert.equal(ligne.user_id, 'utilisateur-1');
    assert.equal(ligne.total_eur, 45_000);
    assert.equal(cible, '/patrimoine');
  });

  it('refuse un JSON forgé avant de toucher la base', async () => {
    const espion = connecte();
    await enregistrerBilan(formulaire({ situation: '{"age":"inconnue"}' }));
    assert.equal(espion.appels.length, 0);
  });
});

describe('supprimer un bilan', () => {
  it('vise la ligne et son propriétaire', async () => {
    const espion = connecte({ error: null });
    await supprimerBilan(formulaire({ id: 'bilan-1' }));
    assert.deepEqual(
      espion.appels.filter((appel) => appel.methode === 'eq').map((appel) => appel.arguments),
      [['id', 'bilan-1'], ['user_id', 'utilisateur-1']],
    );
  });
});
