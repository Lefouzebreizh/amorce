'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { enregistrerBilan } from '@/lib/actions/patrimoine';
import type { Situation } from '@/lib/bilan/modeles';
import { CONSTATS_MONTRES_MAX, premierGesteTexte, type Bilan } from '@/lib/bilan/redaction';
import { ETIQUETTES, type Constat, type Ton } from '@/lib/bilan/modeles';
import { euros } from '@/lib/bilan/valorisation';

/*
 * Le rendu en cartes du `Bilan` — `bilan.constats` et `bilan.patrimoine`,
 * pas `bilan.texte` (le Markdown assemblé pour `npm run exemple`, pensé pour
 * un terminal, pas pour cette mise en page).
 *
 * Contrainte de conception, préférence durable : jamais d'orange ni de jaune,
 * aucun feu tricolore. `--warning` (proche de l'orange) existe dans la
 * palette d'agence/ pour d'autres écrans ; ce composant ne l'utilise jamais.
 * Les trois `ton` se distinguent par `--success` (bravo, seule couleur du
 * trio) et par le fond neutre (`--muted`/`--accent`) pour `attention` et
 * `coute` — cohérent avec un texte qui n'est lui-même jamais alarmiste.
 */

const VARIANTE_PAR_TON: Readonly<Record<Ton, 'succes' | 'neutre' | 'information'>> = {
  bravo: 'succes',
  attention: 'neutre',
  coute: 'information',
};

const LIBELLE_TON: Readonly<Record<Ton, string>> = {
  bravo: 'Ça va bien',
  attention: 'À regarder',
  coute: 'Ça vous coûte',
};

function CarteConstat({ constat }: { constat: Constat }) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <CardTitle className="text-base">{constat.titre}</CardTitle>
        <Badge variante={VARIANTE_PAR_TON[constat.ton]}>{LIBELLE_TON[constat.ton]}</Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
        {constat.explication.split('\n\n').map((paragraphe, index) => (
          <p key={index}>{paragraphe}</p>
        ))}
        {constat.coutAnnuelEur !== null ? (
          <p className="font-semibold text-foreground">Environ {euros(constat.coutAnnuelEur)} par an.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function RapportBilan({ bilan, situation, connecte }: { bilan: Bilan; situation: Situation; connecte: boolean }) {
  const { patrimoine, constats } = bilan;
  const bravos = constats.filter((constat) => constat.ton === 'bravo');
  const problemes = constats.filter((constat) => constat.ton !== 'bravo').slice(0, CONSTATS_MONTRES_MAX);
  const geste = premierGesteTexte(problemes);

  const lignesConnues = patrimoine.lignes.filter((ligne) => ligne.montantEur !== null && ligne.montantEur > 0);

  return (
    <div className="flex flex-col gap-8">
      {bilan.baremesARelire ? (
        <p role="status" className="rounded-md bg-muted px-4 py-3 text-sm text-muted-foreground">
          Les taux de référence de cet outil n’ont pas été revus récemment. Les constats ci-dessous
          restent vrais, mais certains montants peuvent être absents plutôt que faux.
        </p>
      ) : null}

      <div>
        <p className="text-2xl font-semibold tracking-tight">
          {patrimoine.totalEur > 0
            ? `Vous avez ${euros(patrimoine.totalEur)}, et vous ne le saviez sans doute pas.`
            : "Nous n'avons pas encore assez d'éléments pour faire un total."}
        </p>
        {patrimoine.totalEur > 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            C&apos;est le premier chiffre, et il surprend presque tout le monde : on additionne rarement
            son logement, ses livrets et son épargne dans la même phrase.
            {patrimoine.partiel
              ? ` Ce total est un minimum : vous n'avez rien indiqué pour ${patrimoine.pochesInconnues
                  .map((poche) => ETIQUETTES[poche].toLowerCase())
                  .join(', ')}.`
              : ''}
          </p>
        ) : null}

        {lignesConnues.length > 0 ? (
          <dl className="mt-4 grid gap-2 sm:grid-cols-2">
            {lignesConnues.map((ligne) => (
              <div key={ligne.poche} className="rounded-md border border-border bg-card px-4 py-3">
                <dt className="text-xs text-muted-foreground">{ETIQUETTES[ligne.poche]}</dt>
                <dd className="text-lg font-semibold">
                  {euros(ligne.montantEur ?? 0)}
                  {ligne.detail ? <span className="ml-1 text-xs font-normal text-muted-foreground">({ligne.detail})</span> : null}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>

      {bravos.length > 0 ? (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold tracking-tight">Ce qui va bien</h2>
          {bravos.map((constat) => (
            <CarteConstat key={constat.cle} constat={constat} />
          ))}
        </div>
      ) : null}

      {problemes.length > 0 ? (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold tracking-tight">
            {problemes.some((constat) => constat.coutAnnuelEur !== null) ? 'Ce qui vous coûte, en revanche' : 'Ce qui mérite un regard'}
          </h2>
          {problemes.map((constat) => (
            <CarteConstat key={constat.cle} constat={constat} />
          ))}
        </div>
      ) : bravos.length > 0 ? (
        <p className="text-sm text-muted-foreground">
          Nous n&apos;avons rien trouvé qui vous coûte de l&apos;argent inutilement. C&apos;est plus rare
          qu&apos;on ne croit, et ça se dit.
        </p>
      ) : null}

      {geste !== null ? (
        <Card className="border-primary/30 bg-accent">
          <CardContent className="pt-6 text-sm text-accent-foreground">
            <span className="font-semibold">Si vous ne faites qu&apos;une chose ce mois-ci :</span> {geste}
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-primary/30 bg-accent">
        <CardHeader>
          <CardTitle className="text-lg">FinancIA peut suivre cette évolution</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm text-accent-foreground">
          <p>
            Enregistrez des instantanés datés pour comparer votre patrimoine dans le temps. Aucun nom
            de banque, IBAN ou numéro de contrat n’est demandé.
          </p>
          {connecte ? (
            <form action={enregistrerBilan}>
              <input type="hidden" name="situation" value={JSON.stringify(situation)} />
              <Button type="submit">Enregistrer ce bilan</Button>
            </form>
          ) : (
            <Link href="/inscription" className="inline-flex min-h-11 items-center justify-center self-start rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground hover:bg-primary/90">
              Créer mon espace de suivi
            </Link>
          )}
        </CardContent>
      </Card>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Je suis un assistant IA d’aide à la décision. Ceci ne constitue pas un conseil en
        investissement financier officiel (statut CIF). Investir comporte des risques de perte en capital.
      </p>

      <div>
        <Button variante="contour" onClick={() => window.location.reload()}>
          Refaire un bilan
        </Button>
      </div>
    </div>
  );
}
