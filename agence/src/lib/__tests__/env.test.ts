import { strict as assert } from 'node:assert';
import { describe, it, afterEach } from 'node:test';

import { MESSAGE_SITE_INVALIDE, MESSAGE_SITE_MANQUANT, lireUrlDuSite } from '@/lib/env';

/*
 * `NEXT_PUBLIC_SITE_URL` construit les deux liens envoyés par courriel :
 * confirmation d'inscription et réinitialisation du mot de passe. C'est la
 * seule variable du socle dont une mauvaise valeur laisse l'application se
 * construire, se déployer et s'afficher normalement — puis casse l'inscription
 * et la récupération de compte, sans qu'aucune page ne change d'aspect.
 *
 * Ces tests lisent `process.env` à l'exécution, ce qui n'est possible que côté
 * serveur : Next remplace textuellement les `process.env.NEXT_PUBLIC_…` dans le
 * bundle du navigateur. C'est justement pourquoi la vérification vit dans un
 * module serveur et non dans un composant.
 */
const ENVIRONNEMENT = process.env.NODE_ENV;
const ADRESSE = process.env.NEXT_PUBLIC_SITE_URL;

// `NODE_ENV` est déclarée en lecture seule par les types de Node. Un
// hébergeur, lui, la pose comme n'importe quelle autre variable : la vue
// mutable ci-dessous reproduit ce qu'il fait, sans ouvrir de brèche ailleurs.
const variables = process.env as Record<string, string | undefined>;

function poser(nodeEnv: string | undefined, siteUrl: string | undefined): void {
  if (nodeEnv === undefined) delete variables.NODE_ENV;
  else variables.NODE_ENV = nodeEnv;

  if (siteUrl === undefined) delete variables.NEXT_PUBLIC_SITE_URL;
  else variables.NEXT_PUBLIC_SITE_URL = siteUrl;
}

afterEach(() => poser(ENVIRONNEMENT, ADRESSE));

describe("adresse publique du site", () => {
  it('replie sur localhost hors production', () => {
    poser('development', undefined);
    assert.equal(lireUrlDuSite(), 'http://localhost:3000');
  });

  it('refuse de se replier en production', () => {
    poser('production', undefined);
    assert.throws(() => lireUrlDuSite(), { message: MESSAGE_SITE_MANQUANT });
  });

  it('traite une variable vide comme absente', () => {
    // Un champ laissé blanc chez l'hébergeur rend une chaîne vide, pas
    // `undefined` : sans le `trim`, elle passerait pour une adresse déclarée.
    poser('production', '   ');
    assert.throws(() => lireUrlDuSite(), { message: MESSAGE_SITE_MANQUANT });
  });

  it('retire la barre oblique finale', () => {
    // `https://client.fr//auth/confirmer` est refusé par la liste blanche de
    // redirections de Supabase, qui compare au caractère près.
    poser('production', 'https://client.fr/');
    assert.equal(lireUrlDuSite(), 'https://client.fr');
  });

  it('retire un chemin collé par mégarde', () => {
    poser('production', 'https://client.fr/espace-client?utm=1#haut');
    assert.equal(lireUrlDuSite(), 'https://client.fr');
  });

  it('refuse une adresse sans protocole', () => {
    poser('production', 'client.fr');
    assert.throws(() => lireUrlDuSite(), { message: MESSAGE_SITE_INVALIDE });
  });

  it('refuse un protocole qui ne mène nulle part depuis un courriel', () => {
    poser('production', 'ftp://client.fr');
    assert.throws(() => lireUrlDuSite(), { message: MESSAGE_SITE_INVALIDE });
  });

  it('garde un port explicite', () => {
    poser('production', 'https://client.fr:8443');
    assert.equal(lireUrlDuSite(), 'https://client.fr:8443');
  });
});
