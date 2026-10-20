'use client';

import * as React from 'react';

import { analyserAllocation, LIBELLES_ALLOCATION, POCHES_ALLOCATION, type CiblesAllocation, type PocheAllocation, type ValeursAllocation } from '@/lib/bilan/allocation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Situation } from '@/lib/bilan/modeles';
import { euros } from '@/lib/bilan/valorisation';

const NOMBRES = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
const CENTIMES = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2, minimumFractionDigits: 2 });

const CIBLES_DEPART = {
  liquidites: '',
  assuranceVie: '',
  bourse: '',
  crypto: '',
  immobilier: '',
} satisfies Record<PocheAllocation, string>;

function lireNombre(texte: string): number | null {
  if (texte.trim() === '') return null;
  const valeur = Number(texte.trim().replace(',', '.'));
  return Number.isFinite(valeur) ? valeur : null;
}

function valeurInitiale(situation: Situation): Record<PocheAllocation, string> {
  return {
    liquidites: situation.livretsEur === null ? '' : String(situation.livretsEur),
    assuranceVie: situation.assuranceVieEur === null ? '' : String(situation.assuranceVieEur),
    bourse: situation.bourseEur === null ? '' : String(situation.bourseEur),
    crypto: '',
    immobilier: situation.logement
      ? String(situation.logement.valeurEur - situation.logement.capitalRestantDuEur)
      : '0',
  };
}

function valeursCompletes(champs: Record<PocheAllocation, string>): ValeursAllocation | null {
  const valeurs = {} as Record<PocheAllocation, number>;
  for (const poche of POCHES_ALLOCATION) {
    const valeur = lireNombre(champs[poche]);
    if (valeur === null || valeur < (poche === 'immobilier' ? -50_000_000 : 0) || valeur > 50_000_000) return null;
    valeurs[poche] = valeur;
  }
  return valeurs;
}

function ciblesCompletes(champs: Record<PocheAllocation, string>): CiblesAllocation | null {
  const cibles = {} as Record<PocheAllocation, number>;
  for (const poche of POCHES_ALLOCATION) {
    const valeur = lireNombre(champs[poche]);
    if (valeur === null || valeur < 0 || valeur > 100) return null;
    cibles[poche] = valeur;
  }
  const somme = Object.values(cibles).reduce((total, valeur) => total + valeur, 0);
  return Math.abs(somme - 100) <= 0.01 ? cibles : null;
}

/** Calcul uniquement dans l'onglet : aucun envoi ni enregistrement des valeurs. */
export function SimulateurAllocation({ situation }: { situation: Situation }) {
  const [montants, setMontants] = React.useState(() => valeurInitiale(situation));
  const [cibles, setCibles] = React.useState(CIBLES_DEPART);
  const [apport, setApport] = React.useState('0');

  const valeursLues = valeursCompletes(montants);
  const ciblesLues = ciblesCompletes(cibles);
  const apportLu = lireNombre(apport);
  const resultat = valeursLues && ciblesLues && apportLu !== null && apportLu >= 0 && apportLu <= 50_000_000
    ? analyserAllocation(valeursLues, ciblesLues, apportLu)
    : null;

  const sommePartielle = POCHES_ALLOCATION.reduce((somme, poche) => somme + (lireNombre(cibles[poche]) ?? 0), 0);
  const toutesLesCiblesSaisies = POCHES_ALLOCATION.every((poche) => lireNombre(cibles[poche]) !== null);
  const sommeCiblesCorrecte = toutesLesCiblesSaisies && Math.abs(sommePartielle - 100) <= 0.01;
  const totalCibles = Math.round(sommePartielle * 10) / 10;

  return (
    <section aria-labelledby="titre-repartition" className="scroll-mt-6">
      <Card className="overflow-hidden border-primary/25 shadow-md">
        <CardHeader className="bg-[radial-gradient(ellipse_at_top_left,var(--color-accent),transparent_72%)] pb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Approfondir votre bilan</p>
          <CardTitle id="titre-repartition" className="mt-2 text-xl sm:text-2xl">Votre patrimoine, face à votre propre cible</CardTitle>
          <CardDescription className="max-w-2xl leading-relaxed">
            Complétez les montants manquants, définissez vous-même votre répartition idéale et observez les écarts. Le bilan rapide ne demande pas votre poche crypto.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-7 pt-6">
          <div className="grid gap-7 lg:grid-cols-[1.1fr_0.9fr]">
            <fieldset className="flex min-w-0 flex-col gap-4">
              <legend className="mb-1 text-sm font-semibold">1. Ce que vous détenez aujourd’hui</legend>
              <p className="-mt-2 text-xs leading-relaxed text-muted-foreground">Les montants connus du bilan sont repris. Saisissez 0 pour une poche vide. L’immobilier est calculé net du crédit restant.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {POCHES_ALLOCATION.map((poche) => {
                  const identifiant = `montant-${poche}`;
                  return (
                    <div key={poche} className="flex flex-col gap-2">
                      <Label htmlFor={identifiant}>{LIBELLES_ALLOCATION[poche]} (€)</Label>
                      <Input
                        id={identifiant}
                        type="number"
                        inputMode="decimal"
                        min={poche === 'immobilier' ? -50_000_000 : 0}
                        max={50_000_000}
                        step="0.01"
                        value={montants[poche]}
                        onChange={(evenement) => setMontants((precedents) => ({ ...precedents, [poche]: evenement.target.value }))}
                        aria-describedby={`${identifiant}-aide`}
                      />
                      <span id={`${identifiant}-aide`} className="text-xs text-muted-foreground">
                        {poche === 'immobilier'
                          ? 'Valeur estimée moins le crédit restant.'
                          : poche === 'crypto'
                            ? 'À compléter : ce montant n’était pas demandé au bilan rapide.'
                            : 'Montant total connu pour cette poche.'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </fieldset>

            <fieldset className="flex min-w-0 flex-col gap-4">
              <legend className="mb-1 text-sm font-semibold">2. La répartition que vous choisissez</legend>
              <p className="-mt-2 text-xs leading-relaxed text-muted-foreground">Il n’y a pas de profil prérempli : vos cibles doivent totaliser 100 %.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {POCHES_ALLOCATION.map((poche) => {
                  const identifiant = `cible-${poche}`;
                  return (
                    <div key={poche} className="flex flex-col gap-2">
                      <Label htmlFor={identifiant}>{LIBELLES_ALLOCATION[poche]} (%)</Label>
                      <Input
                        id={identifiant}
                        type="number"
                        inputMode="decimal"
                        min={0}
                        max={100}
                        step="0.1"
                        value={cibles[poche]}
                        onChange={(evenement) => setCibles((precedentes) => ({ ...precedentes, [poche]: evenement.target.value }))}
                      />
                    </div>
                  );
                })}
              </div>
              <p aria-live="polite" className={sommeCiblesCorrecte ? 'text-sm font-medium text-success' : 'text-sm text-muted-foreground'}>
                {sommeCiblesCorrecte
                  ? 'Vos cibles totalisent 100 %.'
                  : toutesLesCiblesSaisies
                    ? `Vos cibles totalisent ${NOMBRES.format(totalCibles)} %. Ajustez-les pour arriver à 100 %.`
                    : `${NOMBRES.format(totalCibles)} % renseignés sur 100 %.`}
              </p>
            </fieldset>
          </div>

          <div className="grid gap-4 border-t border-border pt-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <div className="max-w-sm">
              <Label htmlFor="apport-mensuel">Versement mensuel envisagé (€)</Label>
              <Input
                id="apport-mensuel"
                className="mt-2"
                type="number"
                inputMode="decimal"
                min={0}
                max={50_000_000}
                step="0.01"
                value={apport}
                onChange={(evenement) => setApport(evenement.target.value)}
              />
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground sm:max-w-xs">
              Simulation sans vente : elle répartit ce versement vers les poches sous votre cible.
            </p>
          </div>

          {resultat ? (
            <div aria-live="polite" className="flex flex-col gap-4 rounded-xl border border-border bg-muted/50 p-4 sm:p-5">
              {resultat.totalEur > 0 ? (
                <div>
                  <h3 className="text-lg font-semibold">Répartition calculée sur {euros(resultat.totalEur)}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Écart positif : poche au-dessus de votre cible. Écart négatif : en dessous.</p>
                </div>
              ) : (
                <div>
                  <h3 className="text-lg font-semibold">Votre patrimoine saisi est nul</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Les parts actuelles ne sont pas calculables. La simulation d’un versement suit tout de même les cibles que vous avez choisies.</p>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
                  <caption className="sr-only">Comparaison entre vos parts actuelles et vos cibles</caption>
                  <thead>
                    <tr className="border-b border-border text-xs text-muted-foreground">
                      <th scope="col" className="py-2 pr-3 font-medium">Poche</th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">Part actuelle</th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">Votre cible</th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">Écart en €</th>
                      {resultat.apportMensuelEur > 0 ? <th scope="col" className="py-2 pl-3 text-right font-medium">Versement simulé</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {resultat.lignes.map((ligne) => (
                      <tr key={ligne.poche} className="border-b border-border/70 last:border-0">
                        <th scope="row" className="py-3 pr-3 font-medium">{LIBELLES_ALLOCATION[ligne.poche]}</th>
                        <td className="px-3 py-3 text-right tabular-nums">{ligne.partPct === null ? '—' : `${NOMBRES.format(ligne.partPct)} %`}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{NOMBRES.format(ligne.ciblePct)} %</td>
                        <td className="px-3 py-3 text-right tabular-nums">{euros(ligne.ecartEur)}</td>
                        {resultat.apportMensuelEur > 0 ? <td className="py-3 pl-3 text-right tabular-nums">{CENTIMES.format(ligne.apportSimuleEur)} €</td> : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Cette simulation applique uniquement les chiffres et les cibles saisis ici. Elle ne tient pas compte de la fiscalité, des frais, du risque ou de vos autres objectifs ; elle ne constitue pas une recommandation d’achat ou de vente. Rien n’est enregistré.
              </p>
            </div>
          ) : (
            <p role="status" className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
              Pour afficher la comparaison, complétez chaque montant puis répartissez vos cibles sur 100 %.
            </p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
