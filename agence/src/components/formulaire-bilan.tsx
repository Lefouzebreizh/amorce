'use client';

import * as React from 'react';
import { useActionState } from 'react';

import { Button } from '@/components/ui/button';
import { BoutonSoumettre } from '@/components/ui/bouton-soumettre';
import { Champ } from '@/components/ui/champ';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { RapportBilan } from '@/components/rapport-bilan';
import { soumettreBilan } from '@/lib/actions/bilan';
import { ETAT_INITIAL_BILAN } from '@/lib/actions/etat-bilan';
import { HORIZONS, LIBELLES_HORIZON, LIBELLES_TRANCHE_AGE, TRANCHES_AGE } from '@/lib/bilan/validation';

const ETAPES = ['Vous', 'Ce que vous avez', 'Pour quoi faire'] as const;

/** À quel écran vit chaque champ — pour ramener l'utilisateur devant une
 *  erreur qui serait sinon signalée sur un écran resté masqué. */
const ETAPE_DU_CHAMP: Readonly<Record<string, number>> = {
  age: 0,
  adultes: 0,
  enfants: 0,
  revenuMensuelNetEur: 0,
  livretsEur: 1,
  tauxLivretsPct: 1,
  assuranceVieEur: 1,
  tauxAssuranceViePct: 1,
  bourseEur: 1,
  logementValeurEur: 1,
  logementCapitalRestantDuEur: 1,
  horizon: 2,
};

/*
 * Un assistant en trois écrans dans un seul `<form>`.
 *
 * Les champs des trois écrans restent tous montés en permanence — seul
 * l'écran courant est visible (`hidden`, qui masque sans exclure du
 * `FormData`, contrairement à `disabled`). Naviguer entre écrans ne perd donc
 * aucune saisie, sans état React à synchroniser pour chaque champ : seul le
 * numéro d'écran et la case « propriétaire » (qui, elle, doit vraiment retirer
 * les deux champs du logement quand elle est décochée) sont suivis en `useState`.
 *
 * Rien n'est validé avant le bouton final : la seule validation qui compte est
 * celle, côté serveur, de `soumettreBilan` — revalidée quoi qu'il arrive côté
 * client.
 */
export function FormulaireBilan() {
  const [etat, action] = useActionState(soumettreBilan, ETAT_INITIAL_BILAN);
  const [etape, setEtape] = React.useState(0);
  const [proprietaire, setProprietaire] = React.useState(false);

  // Une erreur peut porter sur un champ d'un écran resté masqué (l'utilisateur
  // a avancé jusqu'au bouton final) : sans ce recentrage, elle resterait
  // invisible, exactement le genre de défaut qu'un test automatisé ne voit pas.
  //
  // Ajustée pendant le rendu (plutôt que dans un effet) dans une première
  // version : `useActionState` fait transiter `etat` via le Router de Next.js,
  // et appeler `setState` pendant le rendu est alors entré en conflit avec sa
  // propre mise à jour (« Cannot update a component (Router) while rendering a
  // different component »), constaté à l'essai dans le navigateur. Un effet
  // est le bon outil ici : `etat` vient d'un système externe (le résultat
  // d'une Server Action), pas d'un simple calcul dérivé du rendu.
  React.useEffect(() => {
    const champsEnErreur = Object.keys(etat.erreurs);
    if (champsEnErreur.length === 0) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEtape(Math.min(...champsEnErreur.map((champ) => ETAPE_DU_CHAMP[champ] ?? 0)));
  }, [etat.erreurs]);

  if (etat.statut === 'succes' && etat.bilan) {
    return <RapportBilan bilan={etat.bilan} />;
  }

  const derniereEtape = etape === ETAPES.length - 1;

  return (
    <form action={action} className="flex flex-col gap-6" noValidate>
      <ol className="flex gap-2 text-xs font-medium text-muted-foreground" aria-label="Étapes">
        {ETAPES.map((titre, index) => (
          <li
            key={titre}
            aria-current={index === etape ? 'step' : undefined}
            className={index === etape ? 'text-foreground' : undefined}
          >
            {index + 1}. {titre}
            {index < ETAPES.length - 1 ? <span aria-hidden className="ml-2">·</span> : null}
          </li>
        ))}
      </ol>

      <div hidden={etape !== 0} className="flex flex-col gap-5">
        <Champ nom="age" intitule="Votre tranche d'âge" aide="Une tranche suffit, l'âge exact ne change aucun constat." erreur={etat.erreurs.age} obligatoire>
          {(proprietes) => (
            <Select defaultValue="" {...proprietes}>
              <option value="" disabled>
                Choisissez…
              </option>
              {TRANCHES_AGE.map((tranche) => (
                <option key={tranche} value={tranche}>
                  {LIBELLES_TRANCHE_AGE[tranche]}
                </option>
              ))}
            </Select>
          )}
        </Champ>

        <div className="grid gap-5 sm:grid-cols-2">
          <Champ nom="adultes" intitule="Adultes dans le foyer" aide="Vous, ou vous deux." erreur={etat.erreurs.adultes} obligatoire>
            {(proprietes) => (
              <Select defaultValue="1" {...proprietes}>
                <option value="1">1</option>
                <option value="2">2</option>
              </Select>
            )}
          </Champ>

          <Champ nom="enfants" intitule="Enfants" aide="Zéro si vous n'en avez pas." erreur={etat.erreurs.enfants} obligatoire>
            {(proprietes) => <Input type="number" inputMode="numeric" min={0} step={1} defaultValue={0} {...proprietes} />}
          </Champ>
        </div>

        <Champ
          nom="revenuMensuelNetEur"
          intitule="Revenu mensuel net (€)"
          aide="Le vôtre, ou celui du foyer. Sert d'approximation pour juger votre réserve de sécurité."
          erreur={etat.erreurs.revenuMensuelNetEur}
          obligatoire
        >
          {(proprietes) => <Input type="number" inputMode="decimal" min={0} step="0.01" {...proprietes} />}
        </Champ>
      </div>

      <div hidden={etape !== 1} className="flex flex-col gap-5">
        <Champ nom="livretsEur" intitule="Livrets (€)" aide="Livret A, LDDS, LEP, livret bancaire… ce qui est disponible tout de suite. Laissez vide si vous n'en avez pas." erreur={etat.erreurs.livretsEur}>
          {(proprietes) => <Input type="number" inputMode="decimal" min={0} step="0.01" {...proprietes} />}
        </Champ>
        <Champ nom="tauxLivretsPct" intitule="Leur taux (%)" aide="Facultatif : sans réponse, nous prenons le taux du Livret A." erreur={etat.erreurs.tauxLivretsPct}>
          {(proprietes) => <Input type="number" inputMode="decimal" min={0} max={100} step="0.01" {...proprietes} />}
        </Champ>

        <Champ nom="assuranceVieEur" intitule="Assurance vie (€)" aide="Le capital total. Laissez vide si vous n'en avez pas." erreur={etat.erreurs.assuranceVieEur}>
          {(proprietes) => <Input type="number" inputMode="decimal" min={0} step="0.01" {...proprietes} />}
        </Champ>
        <Champ nom="tauxAssuranceViePct" intitule="Son rendement l'an dernier (%)" aide="Facultatif, mais c'est le chiffre le plus utile : il est sur votre relevé annuel." erreur={etat.erreurs.tauxAssuranceViePct}>
          {(proprietes) => <Input type="number" inputMode="decimal" min={0} max={100} step="0.01" {...proprietes} />}
        </Champ>

        <Champ nom="bourseEur" intitule="Bourse (€)" aide="Compte-titres, PEA… Laissez vide si vous n'en avez pas." erreur={etat.erreurs.bourseEur}>
          {(proprietes) => <Input type="number" inputMode="decimal" min={0} step="0.01" {...proprietes} />}
        </Champ>

        <div className="flex items-center gap-2">
          <input
            id="proprietaire"
            type="checkbox"
            checked={proprietaire}
            onChange={(evenement) => setProprietaire(evenement.target.checked)}
            className="size-4 rounded border-input accent-primary"
          />
          <Label htmlFor="proprietaire">Je suis propriétaire de mon logement</Label>
        </div>

        {proprietaire ? (
          <div className="grid gap-5 sm:grid-cols-2">
            <Champ nom="logementValeurEur" intitule="Valeur du logement (€)" aide="Estimation, pas une expertise." erreur={etat.erreurs.logementValeurEur} obligatoire>
              {(proprietes) => <Input type="number" inputMode="decimal" min={0} step="0.01" {...proprietes} />}
            </Champ>
            <Champ nom="logementCapitalRestantDuEur" intitule="Capital restant dû (€)" aide="Zéro si le crédit est soldé." erreur={etat.erreurs.logementCapitalRestantDuEur} obligatoire>
              {(proprietes) => <Input type="number" inputMode="decimal" min={0} step="0.01" defaultValue={0} {...proprietes} />}
            </Champ>
          </div>
        ) : null}
      </div>

      <div hidden={etape !== 2} className="flex flex-col gap-5">
        <Champ
          nom="horizon"
          intitule="Cet argent sert à quoi ?"
          aide="La seule question qui relève vraiment du conseil : elle décide si de l'argent disponible est une sagesse ou un décalage."
          erreur={etat.erreurs.horizon}
          obligatoire
        >
          {(proprietes) => (
            <Select defaultValue="" {...proprietes}>
              <option value="" disabled>
                Choisissez…
              </option>
              {HORIZONS.map((horizon) => (
                <option key={horizon} value={horizon}>
                  {LIBELLES_HORIZON[horizon]}
                </option>
              ))}
            </Select>
          )}
        </Champ>
      </div>

      {etat.statut === 'erreur' && etat.message ? (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {etat.message}
        </p>
      ) : null}

      <div className="flex justify-between gap-3">
        <Button
          type="button"
          variante="contour"
          onClick={() => setEtape((valeur) => Math.max(0, valeur - 1))}
          disabled={etape === 0}
        >
          Précédent
        </Button>

        {derniereEtape ? (
          <BoutonSoumettre libelleEnCours="Calcul…">Voir mon bilan</BoutonSoumettre>
        ) : (
          <Button type="button" onClick={() => setEtape((valeur) => Math.min(ETAPES.length - 1, valeur + 1))}>
            Suivant
          </Button>
        )}
      </div>
    </form>
  );
}
