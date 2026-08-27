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
const { mettreAJourProfil, supprimerMonCompte } = await import('@/lib/actions/profil');

const PROFIL = { nomComplet: 'Alice Martin', entreprise: 'Atelier Martin' };

function connecte(resultat?: unknown) {
  const { client, espion } = clientFactice(resultat);
  decor.session = { client, utilisateur: { id: 'utilisateur-1' } };
  return espion;
}

beforeEach(() => {
  decor.invalidations.length = 0;
  decor.redirections.length = 0;
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

describe('effacer son compte', () => {
  it('n’envoie aucun identifiant : la base efface `auth.uid()` et rien d’autre', async () => {
    // C'est la garantie centrale, et elle est structurelle : la fonction du
    // schéma ne prend pas de paramètre. Une requête forgée n'a donc aucun champ
    // où glisser le compte de quelqu'un d'autre.
    const espion = connecte({ error: null });

    await attendreRedirection(() => supprimerMonCompte());

    assert.deepEqual(espion.premier('rpc'), ['supprimer_mon_compte']);
  });

  it('coupe la session localement, sans la présenter à un compte disparu', async () => {
    const espion = connecte({ error: null });

    await attendreRedirection(() => supprimerMonCompte());

    assert.deepEqual(espion.premier('signOut'), [{ scope: 'local' }]);
  });

  it('renvoie à l’accueil, pas à un espace privé devenu vide', async () => {
    connecte({ error: null });

    const cible = await attendreRedirection(() => supprimerMonCompte());

    assert.equal(cible, '/');
    assert.deepEqual(decor.invalidations, [['/', 'layout']]);
  });

  it('ne déconnecte ni ne redirige quand la base a refusé', async () => {
    // Sortir l'utilisateur de sa session alors que son compte existe encore
    // lui ferait croire à un effacement qui n'a pas eu lieu.
    const espion = connecte({ error: { message: 'permission denied for table users' } });

    await supprimerMonCompte();

    assert.equal(espion.premier('signOut'), undefined);
    assert.equal(decor.redirections.length, 0);
  });
});
