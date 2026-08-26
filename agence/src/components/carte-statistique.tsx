import { Card, CardContent } from '@/components/ui/card';

/*
 * Un indicateur du tableau de bord. La valeur passe avant son intitulé dans la
 * hiérarchie visuelle : c'est elle qu'on vient chercher, l'intitulé ne sert
 * qu'à la nommer.
 */
export function CarteStatistique({
  intitule,
  valeur,
  precision,
  icone,
}: {
  intitule: string;
  valeur: string;
  precision: string;
  icone: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-muted-foreground">{intitule}</span>
          {icone}
        </div>
        <span className="text-3xl font-semibold tracking-tight tabular-nums">{valeur}</span>
        <span className="text-xs text-muted-foreground">{precision}</span>
      </CardContent>
    </Card>
  );
}
