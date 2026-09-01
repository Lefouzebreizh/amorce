import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  construireCorpsResend,
  construireCourriel,
  envoyerDemande,
  lienMailtoDemande,
  lireReglages,
  type Reglages,
} from '@/lib/courriel';
import type { Demande } from '@/lib/demande';

const DEMANDE: Demande = {
  nom: 'Yann Le Goff',
  metier: 'Couvreur',
  ville: 'Quimper',
  telephone: '0612345678',
  courriel: 'yann@exemple.fr',
  message: 'Rénovation de toiture.',
};

const REGLAGES: Reglages = {
  cle: 're_essai',
  destinataire: 'boite@exemple.fr',
  expediteur: 'Express <bonjour@exemple.fr>',
};

/** Une réponse HTTP minimale, sans toucher au réseau. */
function reponse(statut: number, corps = '{}'): Response {
  return new Response(corps, { status: statut });
}

describe('construireCourriel', () => {
  it('met le métier et la ville dans le sujet : la boîte se trie à l’œil', () => {
    const { sujet } = construireCourriel(DEMANDE);

    assert.match(sujet, /Yann Le Goff/);
    assert.match(sujet, /Couvreur/);
    assert.match(sujet, /Quimper/);
  });

  it('dit explicitement ce qui manque plutôt que de laisser une ligne vide', () => {
    const { texte } = construireCourriel({ ...DEMANDE, courriel: '', message: '' });

    assert.match(texte, /\(pas donné\)/);
    assert.match(texte, /\(pas de message\)/);
  });
});

describe('construireCorpsResend', () => {
  it('répond à l’artisan quand il a laissé une adresse', () => {
    const corps = construireCorpsResend(DEMANDE, REGLAGES);

    assert.deepEqual(corps.to, ['boite@exemple.fr']);
    assert.equal(corps.from, 'Express <bonjour@exemple.fr>');
    assert.equal('reply_to' in corps && corps.reply_to, 'yann@exemple.fr');
  });

  it('omet la réponse quand il n’y a pas d’adresse, au lieu d’en poser une vide', () => {
    const corps = construireCorpsResend({ ...DEMANDE, courriel: '' }, REGLAGES);

    assert.equal('reply_to' in corps, false);
  });

  it('retombe sur le domaine partagé de Resend quand aucun expéditeur n’est réglé', () => {
    const corps = construireCorpsResend(DEMANDE, { ...REGLAGES, expediteur: undefined });

    assert.match(corps.from, /resend\.dev/);
  });
});

describe('envoyerDemande', () => {
  it('ne tente rien sans clé ni destinataire, et le dit', async () => {
    const sansCle = await envoyerDemande(DEMANDE, { ...REGLAGES, cle: undefined }, async () => {
      throw new Error('le réseau ne devrait pas être touché');
    });
    assert.equal(sansCle.statut, 'non-configure');

    const sansBoite = await envoyerDemande(DEMANDE, { ...REGLAGES, destinataire: undefined }, async () => {
      throw new Error('le réseau ne devrait pas être touché');
    });
    assert.equal(sansBoite.statut, 'non-configure');
  });

  it('poste sur Resend avec la clé en en-tête', async () => {
    let vueUrl = '';
    let vusEntetes: Record<string, string> = {};

    const resultat = await envoyerDemande(DEMANDE, REGLAGES, async (url, options) => {
      vueUrl = String(url);
      vusEntetes = (options?.headers ?? {}) as Record<string, string>;
      return reponse(200, '{"id":"abc"}');
    });

    assert.equal(resultat.statut, 'envoye');
    assert.equal(vueUrl, 'https://api.resend.com/emails');
    assert.equal(vusEntetes.Authorization, 'Bearer re_essai');
  });

  it('rend un échec lisible quand le prestataire refuse', async () => {
    const resultat = await envoyerDemande(DEMANDE, REGLAGES, async () =>
      reponse(422, '{"message":"domaine non vérifié"}'),
    );

    assert.equal(resultat.statut, 'echec');
    assert.ok(resultat.statut === 'echec' && resultat.detail.includes('422'));
  });

  it('rend un échec plutôt qu’une exception quand le réseau tombe', async () => {
    const resultat = await envoyerDemande(DEMANDE, REGLAGES, async () => {
      throw new Error('réseau coupé');
    });

    assert.equal(resultat.statut, 'echec');
    assert.ok(resultat.statut === 'echec' && resultat.detail.includes('réseau coupé'));
  });
});

describe('lireReglages', () => {
  it('lit les trois variables et laisse passer leur absence', () => {
    assert.deepEqual(lireReglages({ RESEND_API_KEY: 're_x' }), {
      cle: 're_x',
      destinataire: undefined,
      expediteur: undefined,
    });
  });
});

describe('lienMailtoDemande', () => {
  /*
   * Le repli qui permet de vendre sans compte d'envoi. Ce qui est vérifié ici
   * n'est pas la forme du lien mais le fait qu'il porte **la demande entière** :
   * un mailto qui perdrait le téléphone de l'artisan ferait perdre le client
   * plus sûrement qu'un formulaire en panne.
   */
  const demande: Demande = {
    nom: 'Jean Dupont',
    metier: 'Couvreur',
    ville: 'Rennes',
    telephone: '06 12 34 56 78',
    courriel: 'jean@example.com',
    message: 'Je veux mon site.',
  };

  it('porte la destination, le sujet et le corps', () => {
    const lien = lienMailtoDemande(demande, 'devis@example.com');

    assert.ok(lien.startsWith('mailto:devis@example.com?'));
    const parametres = new URLSearchParams(lien.slice(lien.indexOf('?') + 1));
    assert.equal(parametres.get('subject'), construireCourriel(demande).sujet);
    assert.equal(parametres.get('body'), construireCourriel(demande).texte);
  });

  it('garde chaque champ de la demande dans le corps', () => {
    const lien = lienMailtoDemande(demande, 'devis@example.com');
    const corps = new URLSearchParams(lien.slice(lien.indexOf('?') + 1)).get('body') ?? '';

    for (const valeur of ['Couvreur', 'Rennes', '06 12 34 56 78', 'jean@example.com']) {
      assert.ok(corps.includes(valeur), `absent du corps : ${valeur}`);
    }
  });

  it("n'encode jamais un espace en plus", () => {
    /*
     * `URLSearchParams` encode l'espace en « + », que plusieurs clients de
     * messagerie affichent littéralement dans le corps du message. Le lien
     * arriverait lisible dans un client et truffé de « + » dans un autre.
     */
    const lien = lienMailtoDemande(demande, 'devis@example.com');

    assert.equal(lien.includes('+'), false);
    assert.ok(lien.includes('%20'));
  });
});
