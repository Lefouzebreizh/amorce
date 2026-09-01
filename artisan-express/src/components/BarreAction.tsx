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
 */
export function BarreAction() {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50 border-t border-bordure bg-white/95 px-2 pt-3 backdrop-blur md:hidden"
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
    >
      <div className="flex gap-1.5">
        {aUnTelephone ? (
          <a
            className="flex min-h-14 flex-1 min-w-0 items-center justify-center whitespace-nowrap rounded-xl bg-bleu px-1.5 text-lg font-semibold text-white"
            href={contact.telephoneLien}
          >
            Appeler
          </a>
        ) : null}

        {aUnWhatsapp ? (
          <a
            className="flex min-h-14 flex-1 min-w-0 items-center justify-center whitespace-nowrap rounded-xl bg-[#128C4B] px-1.5 text-lg font-semibold text-white"
            href={contact.whatsappLien}
          >
            WhatsApp
          </a>
        ) : null}

        <a
          className="flex min-h-14 flex-1 min-w-0 items-center justify-center whitespace-nowrap rounded-xl bg-chantier px-1.5 text-lg font-semibold text-white"
          href="#offre"
        >
          Mon site
        </a>
      </div>
    </div>
  );
}
