import { strict as assert } from 'node:assert';
import { beforeEach, describe, it } from 'node:test';

import { ETAT_INITIAL } from '@/lib/actions/etat';
import { clientFactice, formulaire, poserLeDecor } from '@/lib/__tests__/aides-actions';

const decor = poserLeDecor(import.meta.url);
const { mettreAJourProfil } = await import('@/lib/actions/profil');

const PROFIL = { nomComplet: 'Alice Martin', entreprise: 'Atelier Martin' };

function connecte(resultat?: unknown) {
  const { client, espion } = clientFactice(resultat);
  decor.session = { client, utilisateur: { id: 'utilisateur-1' } };
  return espion;
}

beforeEach(() => {
  decor.invalidations.length = 0;
});

describe('mettre à jour le profil', () => {
  it('n’écrit jamais la colonne du rôle, même si le formulaire la porte', async () => {
    // Le verrou d'escalade est posé dans PostgreSQL, par privilège de colonne.
    // Ce test garde le second : que l'application ne tente même pas l'écriture,
    // pour que le refus ne dépende jamais d'un seul rempart.
    const espion = connecte({ error: null });

    await mettreAJourProfil(ETAT_INITIAL, formulaire({ ...PROFIL, role: 'admin' }));

    const [ligne] = espion.premier('update') as [Record<string, unknown>];
    assert.deepEqual(Object.keys(ligne).sort(), ['company_name', 'full_name']);
  });

  it('ne modifie que sa propre ligne', async () => {
    const espion = connecte({ error: null });

    await mettreAJourProfil(ETAT_INITIAL, formulaire({ ...PROFIL, id: 'quelqu-un-d-autre' }));

    assert.deepEqual(espion.premier('eq'), ['id', 'utilisateur-1']);
  });

  it('fait redescendre le nom jusqu’à la coque privée', async () => {
    // La barre latérale affiche le nom : invalider le seul formulaire
    // laisserait l'ancien affiché jusqu'au prochain rechargement complet.
    connecte({ error: null });

    await mettreAJourProfil(ETAT_INITIAL, formulaire(PROFIL));

    assert.deepEqual(decor.invalidations, [['/', 'layout']]);
  });

  it('ne dit pas à l’utilisateur ce que PostgREST a répondu', async () => {
    // Un message d'erreur de PostgREST cite les tables et les politiques.
    connecte({ error: { message: 'permission denied for column role of relation profiles' } });

    const etat = await mettreAJourProfil(ETAT_INITIAL, formulaire(PROFIL));

    assert.equal(etat.statut, 'erreur');
    assert.ok(!etat.message.includes('policy'));
    assert.ok(!etat.message.includes('profiles'));
  });
});
