import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { evolutionEur } from '@/lib/patrimoine';
import type { InstantanePatrimoine } from '@/lib/types';

function bilan(total_eur: number, created_at: string): InstantanePatrimoine {
  return { id: created_at, user_id: 'u1', situation: {}, total_eur, is_partial: false, created_at };
}

describe('évolution patrimoniale', () => {
  it('compare le plus récent au plus ancien', () => {
    assert.equal(evolutionEur([
      bilan(135_000, '2026-09-13T00:00:00Z'),
      bilan(120_000, '2026-01-01T00:00:00Z'),
    ]), 15_000);
  });

  it('ne transforme pas un seul point en tendance', () => {
    assert.equal(evolutionEur([bilan(120_000, '2026-09-13T00:00:00Z')]), null);
    assert.equal(evolutionEur([]), null);
  });
});
