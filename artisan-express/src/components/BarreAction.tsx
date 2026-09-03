import { aUnTelephone, aUnWhatsapp, contact } from '@/lib/config';

/*
 * Le bandeau collé en bas, sur téléphone seulement.
 *
 * Sur un écran de 20:9 tenu à une main, le tiers haut est hors de portée du
 * pouce sans changer de prise : ce qu'on touche vit en bas, ce qu'on lit reste
 * en haut. Le `padding-bottom` compte la barre de gestes d'Android, sans quoi
 * le bouton passe sous elle et déclenche le retour système au lieu de l'appel.
 *
 * Le `padding-bottom` du `body` réserve la place de ce bandeau, sinon il masque
 * la dernière ligne de la page.
 *
 * **Un seul bouton plein, et c'est celui qui vend.** Les trois étaient pleins,
 * et ça ne se voyait pas tant qu'ils portaient trois couleurs — bleu, vert de
 * WhatsApp, orange. Passés à l'accent unique de la charte, deux verts se
 * battaient côte à côte et plus rien ne disait où appuyer. Le §2 bis le dit en
 * propres termes : un accent qui décore est un accent muet.
 *
 * WhatsApp perd donc son vert de marque ici. Son libellé suffit à le désigner,
 * et un second vert saturé à côté de l'accent annulait les deux. Il le garde en
 * revanche dans les gabarits de téléphone plus bas : là-bas c'est le bouton
 * d'un site livré qu'on montre, donc du contenu, pas de la commande.
 */
const SECONDAIRE =
  'flex min-h-14 flex-1 min-w-0 items-center justify-center whitespace-nowrap rounded-xl '
  + 'border-2 border-edge bg-panel px-1.5 text-lg font-semibold text-encre';
const PRINCIPAL =
  'flex min-h-14 flex-1 min-w-0 items-center justify-center whitespace-nowrap rounded-xl '
  + 'bg-accent px-1.5 text-lg font-semibold text-accent-encre';
export function BarreAction() {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50 border-t border-edge bg-slab/95 px-2 pt-3 backdrop-blur md:hidden"
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
    >
      <div className="flex gap-1.5">
        {aUnTelephone ? (
          <a
            className={SECONDAIRE}
            href={contact.telephoneLien}
          >
            Appeler
          </a>
        ) : null}

        {aUnWhatsapp ? (
          <a
            className={SECONDAIRE}
            href={contact.whatsappLien}
          >
            WhatsApp
          </a>
        ) : null}

        <a
          className={PRINCIPAL}
          href="#offre"
        >
          Mon site
        </a>
      </div>
    </div>
  );
}
