'use client';

import { useState } from 'react';
import { useLicenceContexte } from '@/licence/contexte';
import { Button, Hint, Panel } from '../ui';

/**
 * Le champ où coller sa clé, qui n'existait nulle part.
 *
 * Tout le module de licence était écrit et testé — `poserCle`, `demanderEtat`,
 * `autorise` — et **aucun appelant** hors des tests. Une personne qui payait
 * quarante-neuf euros recevait une clé sans endroit où la saisir. C'était le
 * seul défaut du dépôt qui bloquait la vente elle-même, et non l'expérience.
 *
 * Il vit dans l'étape Exporter parce que c'est là que la limite se rencontre :
 * on découvre qu'il manque la pleine définition au moment de choisir, pas dans
 * un écran de réglages qu'on n'ouvre jamais.
 */
export function LicenceBloc() {
  const licence = useLicenceContexte();
  const [saisie, setSaisie] = useState('');
  const pro = licence.etat.statut === 'pro';

  /*
   * Sans serveur, on ne montre **rien**.
   *
   * Il n'existe alors aucun endroit où payer : proposer un champ enverrait
   * chercher une clé qui ne peut pas exister, et afficher « offre libre »
   * annoncerait une limite qui n'est pas encore appliquée. C'est la même règle
   * que la signature — ne pas montrer une contrainte dont on ne donne pas la
   * sortie.
   */
  if (!licence.serveur) return null;

  if (pro) {
    return (
      <Panel title="Ta licence" subtitle="Amorce complet, définitivement.">
        <Hint>
          Licence reconnue. La pleine définition et l’export sans signature sont ouverts sur cet
          appareil.
        </Hint>
        <Button variant="ghost" className="mt-2 w-full" onClick={licence.retirer}>
          Retirer la clé de cet appareil
        </Button>
      </Panel>
    );
  }

  return (
    <Panel
      title="Tu as acheté Amorce ?"
      subtitle="Colle ta clé pour ouvrir la pleine définition et l’export sans signature."
    >
      <label className="block text-xs font-semibold text-muted" htmlFor="cle-licence">
        Ta clé
      </label>
      <input
        id="cle-licence"
        type="text"
        inputMode="text"
        autoComplete="off"
        spellCheck={false}
        placeholder="AMO-XXXXXXXX-XXXXXXXX"
        value={saisie}
        onChange={(event) => setSaisie(event.target.value)}
        // 18 px minimum, et une cible d'au moins 44 px : sur un téléphone en
        // plein jour, une clé se recopie caractère par caractère.
        className="mt-1 min-h-11 w-full rounded-xl border border-edge bg-ink px-3 py-2 font-mono text-[18px] tracking-wide text-mist placeholder:text-muted focus:border-accent focus:outline-none"
      />

      <Button
        variant="primary"
        className="mt-2 w-full"
        disabled={licence.verification}
        onClick={() => void licence.enregistrer(saisie)}
      >
        {licence.verification ? 'Vérification…' : 'Activer ma licence'}
      </Button>

      {licence.erreur && <Hint tone="warn">{licence.erreur}</Hint>}

      <p className="mt-2 text-xs leading-relaxed text-muted">
        La clé reste sur cet appareil. Le serveur ne reçoit qu’elle — jamais un fichier, jamais un
        nom de fichier, jamais la durée de ton montage.
      </p>
    </Panel>
  );
}
