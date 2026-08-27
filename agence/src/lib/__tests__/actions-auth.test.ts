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
const { seConnecter, sInscrire, demanderReinitialisation, definirMotDePasse, seDeconnecter } =
  await import('@/lib/actions/auth');

const CONNEXION = { email: 'alice@exemple.fr', motDePasse: 'un-mot-de-passe' };
/* `entreprise` est facultative au sens du contenu, pas de la présence : le
 * formulaire l'envoie toujours, vide au besoin, et le schéma l'exige. */
const INSCRIPTION = {
  ...CONNEXION,
  motDePasse: 'huit-au-moins',
  nomComplet: 'Alice Martin',
  entreprise: '',
};

/** Le service d'authentification répond `resultat` à tout. */
function service(resultat: unknown = { data: { session: {} }, error: null }) {
  const { client, espion } = clientFactice(resultat);
  decor.session = { client, utilisateur: { id: 'utilisateur-1' } };
  return espion;
}

beforeEach(() => {
  decor.redirections.length = 0;
  decor.invalidations.length = 0;
});

describe('se connecter', () => {
  it('ne suit pas une destination qui sort du site', async () => {
    // Sans ce garde-fou, un lien « /connexion?suivant=https://piege.example »
    // ferait atterrir sur le site du pêcheur une fois le mot de passe saisi,
    // avec l'air d'y avoir été mené par l'application.
    service();

    const cible = await attendreRedirection(() =>
      seConnecter(ETAT_INITIAL, formulaire({ ...CONNEXION, suivant: 'https://piege.example' })),
    );

    assert.ok(cible.startsWith('/'));
    assert.ok(!cible.includes('piege'));
  });

  it('suit une destination interne', async () => {
    service();

    const cible = await attendreRedirection(() =>
      seConnecter(ETAT_INITIAL, formulaire({ ...CONNEXION, suivant: '/projets/42' })),
    );

    assert.equal(cible, '/projets/42');
  });

  it('refuse une double barre oblique, qui vaut une adresse absolue', async () => {
    service();

    const cible = await attendreRedirection(() =>
      seConnecter(ETAT_INITIAL, formulaire({ ...CONNEXION, suivant: '//piege.example' })),
    );

    assert.ok(!cible.includes('piege'));
  });

  it('ne redirige pas quand l’identification échoue', async () => {
    service({ error: { code: 'invalid_credentials', message: 'Invalid login credentials' } });

    const etat = await seConnecter(ETAT_INITIAL, formulaire(CONNEXION));

    assert.equal(etat.statut, 'erreur');
    assert.equal(decor.redirections.length, 0);
  });
});

describe('s’inscrire', () => {
  it('attend la confirmation par courriel au lieu d’entrer', async () => {
    // Supabase rend un utilisateur sans session tant que le courriel n'est pas
    // confirmé : rediriger ici mènerait à une coque privée sans droits.
    service({ data: { session: null }, error: null });

    const etat = await sInscrire(ETAT_INITIAL, formulaire(INSCRIPTION));

    assert.equal(etat.statut, 'succes');
    assert.match(etat.message, /courriel de confirmation/);
    assert.equal(decor.redirections.length, 0);
  });

  it('transmet le nom au profil, que le trigger recopiera', async () => {
    const espion = service({ data: { session: {} }, error: null });

    await attendreRedirection(() => sInscrire(ETAT_INITIAL, formulaire(INSCRIPTION)));

    const [demande] = espion.premier('signUp') as [
      { options: { data: Record<string, unknown> } },
    ];
    assert.equal(demande.options.data.full_name, 'Alice Martin');
  });
});

describe('demander une réinitialisation', () => {
  it('répond la même chose que l’adresse existe ou non', async () => {
    // Répondre « compte inconnu » transformerait ce formulaire en outil de
    // vérification d'adresses : on saurait qui est client, sans mot de passe.
    service({ error: null });
    const connue = await demanderReinitialisation(ETAT_INITIAL, formulaire({ email: CONNEXION.email }));

    service({ error: { code: 'user_not_found', message: 'User not found' } });
    const inconnue = await demanderReinitialisation(ETAT_INITIAL, formulaire({ email: 'personne@exemple.fr' }));

    assert.deepEqual(connue, inconnue);
    assert.equal(connue.statut, 'succes');
  });

  it('dit en revanche la limite d’envoi, sur laquelle l’utilisateur peut agir', async () => {
    service({ error: { code: 'over_email_send_rate_limit', message: 'rate limit' } });

    const etat = await demanderReinitialisation(ETAT_INITIAL, formulaire({ email: CONNEXION.email }));

    assert.equal(etat.statut, 'erreur');
  });
});

describe('définir un nouveau mot de passe', () => {
  it('refuse sans la session ouverte par le lien de récupération', async () => {
    decor.session = null;

    const etat = await definirMotDePasse(
      ETAT_INITIAL,
      formulaire({ motDePasse: 'huit-au-moins', confirmation: 'huit-au-moins' }),
    );

    assert.equal(etat.statut, 'erreur');
    assert.match(etat.message, /lien a expiré/);
  });

  it('refuse deux saisies différentes avant même de demander la session', async () => {
    const espion = service({ error: null });

    const etat = await definirMotDePasse(
      ETAT_INITIAL,
      formulaire({ motDePasse: 'huit-au-moins', confirmation: 'autre-chose' }),
    );

    assert.equal(etat.statut, 'erreur');
    assert.equal(espion.appels.length, 0);
  });
});

describe('se déconnecter', () => {
  it('ferme la session et rafraîchit la coque avant de partir', async () => {
    const espion = service();

    const cible = await attendreRedirection(() => seDeconnecter());

    assert.ok(espion.appels.some((appel) => appel.methode === 'signOut'));
    assert.deepEqual(decor.invalidations, [['/', 'layout']]);
    assert.equal(cible, '/connexion');
  });

  it('ramène à la connexion même sans session à fermer', async () => {
    // Un bouton de déconnexion cliqué deux fois ne doit pas finir en erreur.
    decor.session = null;

    assert.equal(await attendreRedirection(() => seDeconnecter()), '/connexion');
  });
});
