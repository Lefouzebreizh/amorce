import * as React from 'react';

import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/*
 * Un champ de formulaire complet : intitulé, contrôle, phrase d'aide, message
 * d'erreur — et le câblage d'accessibilité qui va avec.
 *
 * Le contrôle est fourni sous forme de fonction pour que `id`,
 * `aria-describedby` et `aria-invalid` soient calculés à un seul endroit. Les
 * recopier à la main dans chaque formulaire, c'est en oublier un : le champ
 * reste alors muet pour un lecteur d'écran, et l'erreur n'existe que
 * visuellement.
 *
 * L'aide est obligatoire. Un champ dont l'intitulé ne suffit pas et qui n'a
 * rien d'autre à dire est un champ qu'on remplit au hasard.
 */
export type ProprietesControle = {
  id: string;
  name: string;
  'aria-describedby': string;
  'aria-invalid': boolean;
  required?: boolean;
};

type ProprietesChamp = {
  nom: string;
  intitule: string;
  aide: string;
  erreur?: string | undefined;
  obligatoire?: boolean;
  className?: string;
  children: (proprietes: ProprietesControle) => React.ReactNode;
};

export function Champ({
  nom,
  intitule,
  aide,
  erreur,
  obligatoire = false,
  className,
  children,
}: ProprietesChamp) {
  const idAide = `${nom}-aide`;
  const idErreur = `${nom}-erreur`;

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <Label htmlFor={nom}>
        {intitule}
        {obligatoire ? (
          <span aria-hidden className="ml-1 text-muted-foreground">
            *
          </span>
        ) : null}
      </Label>

      {children({
        id: nom,
        name: nom,
        'aria-describedby': erreur ? `${idAide} ${idErreur}` : idAide,
        'aria-invalid': Boolean(erreur),
        required: obligatoire,
      })}

      <p id={idAide} className="text-xs text-muted-foreground">
        {aide}
      </p>

      {erreur ? (
        // `role="alert"` : l'erreur arrive après coup, en réponse à un envoi.
        // Sans lui, un lecteur d'écran ne l'annoncerait jamais.
        <p id={idErreur} role="alert" className="text-xs font-medium text-destructive">
          {erreur}
        </p>
      ) : null}
    </div>
  );
}
