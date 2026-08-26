import type { Metadata } from 'next';
import { Euro, FolderKanban, Users } from 'lucide-react';

import { CarteStatistique } from '@/components/carte-statistique';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { lireVueAdministration, nomAffiche } from '@/lib/administration';
import { formaterDate, formaterMontant } from '@/lib/format';
import { exigerAdministrateur } from '@/lib/supabase/session';
import { LIBELLES_ROLE } from '@/lib/types';

export const metadata: Metadata = { title: 'Administration' };

export default async function PageAdministration() {
  const { session } = await exigerAdministrateur();
  const vue = await lireVueAdministration(session);

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Administration</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Vue d&apos;ensemble des comptes et de leurs projets. Lecture seule : modifier la
          fiche d&apos;un client se fait avec lui, jamais à sa place.
        </p>
      </header>

      <section aria-label="Indicateurs" className="grid gap-4 sm:grid-cols-3">
        <CarteStatistique
          intitule="Comptes"
          valeur={String(vue.clients.length)}
          precision="Profils créés à ce jour"
          icone={<Users aria-hidden className="size-4 text-muted-foreground" />}
        />
        <CarteStatistique
          intitule="Projets"
          valeur={String(vue.nombreDeProjets)}
          precision="Tous comptes confondus"
          icone={<FolderKanban aria-hidden className="size-4 text-muted-foreground" />}
        />
        <CarteStatistique
          intitule="Montant estimé"
          valeur={formaterMontant(vue.montantTotal)}
          precision="Somme des enveloppes déclarées"
          icone={<Euro aria-hidden className="size-4 text-muted-foreground" />}
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Comptes</CardTitle>
          <CardDescription>Les plus actifs d&apos;abord.</CardDescription>
        </CardHeader>
        <CardContent>
          {vue.clients.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Aucun compte à afficher.
            </p>
          ) : (
            /*
              Un vrai tableau : les données le sont. Le défilement horizontal est
              porté par ce conteneur, jamais par la page — un écran de téléphone
              qui part de travers rend toute l'application pénible.
            */
            <div className="-mx-2 overflow-x-auto px-2">
              <table className="w-full min-w-[34rem] border-collapse text-sm">
                <caption className="sr-only">
                  Comptes clients, nombre de projets et montant estimé
                </caption>
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th scope="col" className="pb-2 pr-4 font-medium">
                      Client
                    </th>
                    <th scope="col" className="pb-2 pr-4 font-medium">
                      Rôle
                    </th>
                    <th scope="col" className="pb-2 pr-4 text-right font-medium">
                      Projets
                    </th>
                    <th scope="col" className="pb-2 pr-4 text-right font-medium">
                      Montant
                    </th>
                    <th scope="col" className="pb-2 text-right font-medium">
                      Dernier dépôt
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {vue.clients.map((fiche) => (
                    <tr key={fiche.profil.id} className="border-b border-border last:border-0">
                      <th scope="row" className="py-3 pr-4 text-left font-medium">
                        <span className="block">{nomAffiche(fiche.profil)}</span>
                        {fiche.profil.company_name ? (
                          <span className="block text-xs font-normal text-muted-foreground">
                            {fiche.profil.company_name}
                          </span>
                        ) : null}
                      </th>
                      <td className="py-3 pr-4">
                        <Badge variante={fiche.profil.role === 'admin' ? 'information' : 'neutre'}>
                          {LIBELLES_ROLE[fiche.profil.role]}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums">
                        {fiche.nombreDeProjets}
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums">
                        {formaterMontant(fiche.montantTotal)}
                      </td>
                      <td className="py-3 text-right text-muted-foreground">
                        {fiche.dernierProjet ? formaterDate(fiche.dernierProjet) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
