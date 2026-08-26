'use client';

import { useActionState } from 'react';

import { useRetourToast } from '@/components/retour-toast';
import { BoutonSoumettre } from '@/components/ui/bouton-soumettre';
import { Champ } from '@/components/ui/champ';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { creerProjet, mettreAJourProjet } from '@/lib/actions/projets';
import { ETAT_INITIAL } from '@/lib/actions/etat';
import { LIBELLES_STATUT, STATUTS_PROJET, type Projet } from '@/lib/types';

/*
 * Un seul formulaire pour la création et la modification.
 *
 * Les deux écrans posent exactement les mêmes questions ; les séparer
 * garantirait qu'un champ ajouté un jour n'existe que d'un côté. Seule l'action
 * appelée change — et, à la création, la présence d'un identifiant caché.
 */
export function FormulaireProjet({ projet }: { projet?: Projet }) {
  const [etat, action] = useActionState(
    projet ? mettreAJourProjet : creerProjet,
    ETAT_INITIAL,
  );

  useRetourToast(etat);

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {projet ? <input type="hidden" name="id" value={projet.id} /> : null}

      <Champ
        nom="titre"
        intitule="Titre du projet"
        aide="Ce que vous reconnaîtrez d'un coup d'œil dans la liste. 120 caractères au plus."
        erreur={etat.erreurs.titre}
        obligatoire
      >
        {(proprietes) => (
          <Input
            defaultValue={projet?.title}
            maxLength={120}
            placeholder="Refonte du site vitrine"
            {...proprietes}
          />
        )}
      </Champ>

      <Champ
        nom="description"
        intitule="Description"
        aide="Le périmètre, les contraintes, ce qui reste à trancher. Facultatif."
        erreur={etat.erreurs.description}
      >
        {(proprietes) => (
          <Textarea
            defaultValue={projet?.description ?? ''}
            maxLength={2000}
            placeholder="Six pages, reprise de la charte existante, mise en ligne avant la rentrée."
            {...proprietes}
          />
        )}
      </Champ>

      <div className="grid gap-5 sm:grid-cols-2">
        <Champ
          nom="statut"
          intitule="Statut"
          aide="Il pilote la répartition affichée sur le tableau de bord."
          erreur={etat.erreurs.statut}
          obligatoire
        >
          {(proprietes) => (
            <Select defaultValue={projet?.status ?? 'draft'} {...proprietes}>
              {STATUTS_PROJET.map((statut) => (
                <option key={statut} value={statut}>
                  {LIBELLES_STATUT[statut]}
                </option>
              ))}
            </Select>
          )}
        </Champ>

        <Champ
          nom="montant"
          intitule="Montant estimé (€)"
          aide="Une estimation, pas un devis : elle sert à suivre l'enveloppe en cours."
          erreur={etat.erreurs.montant}
          obligatoire
        >
          {(proprietes) => (
            <Input
              type="number"
              // `inputMode` décimal : sur téléphone, le pavé numérique s'ouvre
              // directement, virgule comprise.
              inputMode="decimal"
              min={0}
              step="0.01"
              defaultValue={projet?.amount_estimated ?? 0}
              {...proprietes}
            />
          )}
        </Champ>
      </div>

      {etat.statut === 'erreur' && etat.message ? (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {etat.message}
        </p>
      ) : null}

      <div>
        <BoutonSoumettre libelleEnCours="Enregistrement…">
          {projet ? 'Enregistrer les modifications' : 'Créer le projet'}
        </BoutonSoumettre>
      </div>
    </form>
  );
}
