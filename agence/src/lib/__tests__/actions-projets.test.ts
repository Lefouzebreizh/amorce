import { strict as assert } from 'node:assert';
import { beforeEach, describe, it } from 'node:test';

import { ETAT_INITIAL } from '@/lib/actions/etat';
import {
  attendreRedirection,
  clientFactice,
  formulaire,
  poserLeDecor,
} from '@/lib/__tests__/aides-actions';

const decor = poserLeDecor(import.meta.url);
const { creerProjet, mettreAJourProjet, supprimerProjet } = await import('@/lib/actions/projets');

const PROJET = {
  titre: 'Site vitrine',
  description: 'Refonte complète',
  statut: 'in_progress',
  montant: '2500',
};

/** Session d'un utilisateur connu, avec un client qui rend `resultat`. */
function connecte(resultat?: unknown) {
  const { client, espion } = clientFactice(resultat);
  decor.session = { client, utilisateur: { id: 'utilisateur-1' } };
  return espion;
}

beforeEach(() => {
  decor.redirections.length = 0;
  decor.invalidations.length = 0;
});

describe('créer un projet', () => {
  it('prend le propriétaire dans la session, jamais dans le formulaire', async () => {
    // Le cas qui justifie ce test : un appel forgé qui ajoute `user_id` au
    // formulaire ne doit pas pouvoir déposer un projet chez quelqu'un d'autre.
    const espion = connecte({ data: { id: 'projet-9' }, error: null });

    await attendreRedirection(() =>
      creerProjet(ETAT_INITIAL, formulaire({ ...PROJET, user_id: 'victime' })),
    );

    const [ligne] = espion.premier('insert') as [Record<string, unknown>];
    assert.equal(ligne.user_id, 'utilisateur-1');
  });

  it('mène au projet créé et rafraîchit les listes', async () => {
    connecte({ data: { id: 'projet-9' }, error: null });

    const cible = await attendreRedirection(() => creerProjet(ETAT_INITIAL, formulaire(PROJET)));

    assert.equal(cible, '/projets/projet-9');
    assert.deepEqual(decor.invalidations, [['/tableau-de-bord'], ['/projets']]);
  });

  it('refuse un formulaire invalide sans jamais toucher la base', async () => {
    const espion = connecte();

    const etat = await creerProjet(ETAT_INITIAL, formulaire({ ...PROJET, titre: '' }));

    assert.equal(etat.statut, 'erreur');
    assert.equal(espion.appels.length, 0);
  });

  it('rend un message lisible quand la base refuse', async () => {
    connecte({ data: null, error: { message: 'violates row-level security' } });

    const etat = await creerProjet(ETAT_INITIAL, formulaire(PROJET));

    assert.equal(etat.statut, 'erreur');
    assert.match(etat.message, /pas pu être enregistré/);
    assert.equal(decor.redirections.length, 0, 'une écriture refusée ne mène nulle part');
  });
});

describe('modifier un projet', () => {
  it('vise la ligne par son identifiant et par son propriétaire', async () => {
    // La clause redondante avec la RLS : sans elle, viser le projet d'un autre
    // renverrait « 0 ligne modifiée », indiscernable d'un projet supprimé.
    const espion = connecte({ data: { id: 'projet-9' }, error: null });

    await mettreAJourProjet(ETAT_INITIAL, formulaire({ ...PROJET, id: 'projet-9' }));

    const filtres = espion.appels.filter((appel) => appel.methode === 'eq');
    assert.deepEqual(filtres.map((appel) => appel.arguments), [
      ['id', 'projet-9'],
      ['user_id', 'utilisateur-1'],
    ]);
  });

  it('distingue un projet disparu d’une erreur de base', async () => {
    connecte({ data: null, error: null });

    const etat = await mettreAJourProjet(ETAT_INITIAL, formulaire({ ...PROJET, id: 'projet-9' }));

    assert.equal(etat.statut, 'erreur');
    assert.match(etat.message, /n['’]existe plus/);
  });

  it('sans identifiant, ne touche à rien', async () => {
    const espion = connecte();

    const etat = await mettreAJourProjet(ETAT_INITIAL, formulaire(PROJET));

    assert.equal(etat.statut, 'erreur');
    assert.equal(espion.appels.length, 0);
  });
});

describe('supprimer un projet', () => {
  it('ne supprime que chez soi, puis ramène à la liste', async () => {
    const espion = connecte({ error: null });

    const cible = await attendreRedirection(() =>
      supprimerProjet(formulaire({ id: 'projet-9' })),
    );

    assert.deepEqual(
      espion.appels.filter((a) => a.methode === 'eq').map((a) => a.arguments),
      [['id', 'projet-9'], ['user_id', 'utilisateur-1']],
    );
    assert.equal(cible, '/projets');
  });

  it('ne redirige pas quand la suppression échoue', async () => {
    // Rediriger malgré l'échec ferait croire à une suppression réussie.
    connecte({ error: { message: 'permission denied' } });

    await supprimerProjet(formulaire({ id: 'projet-9' }));

    assert.equal(decor.redirections.length, 0);
  });
});
