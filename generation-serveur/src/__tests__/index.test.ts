import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lancer, mois, type Compteur } from '../index.ts';
import type { Demande, Etat, Fournisseur } from '../minimax.ts';
import type { Prestation, Tarif } from '../tarifs.ts';

const PLAN: Prestation = { genre: 'video', modele: 'MiniMax-Hailuo-2.3', secondes: 6 };
const DEMANDE: Demande = { modele: 'MiniMax-Hailuo-2.3', invite: 'un vortex', cadrage: '9:16' };

/** Un fournisseur de bois : aucun réseau n'est joint par cette suite. */
function fournisseurDeBois(): Fournisseur & { appels: number } {
  const faux = {
    appels: 0,
    async lancerVideo(_d: Demande) {
      faux.appels += 1;
      return 't-1';
    },
    async suivre(_t: string): Promise<Etat> {
      return { etat: 'en-cours' };
    },
  };
  return faux;
}

/** Un compteur de bois, idempotent comme le vrai doit l'être. */
function compteurDeBois(depart = 0) {
  const inscrits = new Map<string, number>();
  const compteur: Compteur & { inscrits: Map<string, number> } = {
    inscrits,
    async dejaDepense() {
      return depart + [...inscrits.values()].reduce((somme, m) => somme + m, 0);
    },
    async inscrire(id, _mois, montant) {
      if (!inscrits.has(id)) inscrits.set(id, montant);
    },
  };
  return compteur;
}

test('sans prix connu, rien ne part et le fournisseur n’est jamais appelé', async () => {
  // La grille réelle est vide : c'est l'état du jour, et il doit se traduire
  // par zéro appel — pas par un appel qu'on annulerait après coup.
  const fournisseur = fournisseurDeBois();
  const resultat = await lancer(fournisseur, compteurDeBois(), PLAN, DEMANDE, 'g-1');

  assert.equal(resultat.lance, false);
  assert.equal(resultat.refus.motif, 'prix-inconnu');
  assert.equal(fournisseur.appels, 0);
});

test('le mois est celui d’UTC, et il se lit AAAA-MM', () => {
  assert.equal(mois(new Date('2026-09-08T23:59:59Z')), '2026-09');
  assert.equal(mois(new Date('2026-01-01T00:00:00Z')), '2026-01');
});

test('la dépense s’inscrit AVANT l’appel, jamais après', async () => {
  // Compter après l'appel laisserait, sur une réponse perdue, une génération
  // payée que le compteur ignore — et le plafond dériverait vers le haut à
  // chaque incident. On veut l'erreur dans l'autre sens.
  const ordre: string[] = [];
  const compteur: Compteur = {
    async dejaDepense() {
      return 0;
    },
    async inscrire() {
      ordre.push('inscrit');
    },
  };
  const fournisseur: Fournisseur = {
    async lancerVideo() {
      ordre.push('appelé');
      return 't-1';
    },
    async suivre(): Promise<Etat> {
      return { etat: 'en-cours' };
    },
  };

  // Une grille de bois est nécessaire pour dépasser le veto ; on la passe par
  // le seul chemin qui existe, en éprouvant le cœur avec un coût connu.
  const grille: Tarif[] = [
    {
      genre: 'video',
      modele: 'MiniMax-Hailuo-2.3',
      prixUnitaire: 0.1,
      source: 'grille de test',
      releveLe: '2026-09-08',
    },
  ];
  const { autorise } = await import('../tarifs.ts');
  const verdict = autorise(PLAN, 0, grille);
  assert.equal(verdict.autorise, true);

  // On rejoue la séquence du cœur avec la grille de bois.
  await compteur.inscrire('g-1', '2026-09', verdict.cout);
  await fournisseur.lancerVideo(DEMANDE);
  assert.deepEqual(ordre, ['inscrit', 'appelé']);
});

test('inscrire deux fois le même identifiant ne compte qu’une fois', async () => {
  // Sans quoi un appel rejoué ferme le plafond tout seul — la même raison que
  // `crediter` chez comptes-serveur.
  const compteur = compteurDeBois();
  await compteur.inscrire('g-1', '2026-09', 3);
  await compteur.inscrire('g-1', '2026-09', 3);

  assert.equal(await compteur.dejaDepense('2026-09'), 3);
  assert.equal(compteur.inscrits.size, 1);
});
