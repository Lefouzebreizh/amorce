import { aUnTelephone, aUnWhatsapp, contact } from '@/lib/config';

export function PiedDePage() {
  return (
    <footer className="border-t border-bordure bg-bleu-pale">
      <div className="mx-auto w-full max-w-5xl px-5 py-10">
        <p className="text-lg font-bold text-encre">Site vitrine artisan express</p>
        <p className="mt-2 max-w-2xl leading-relaxed text-ardoise">
          Artisan du code, ex-routier. Je fais des sites d’une page pour ceux qui travaillent
          dehors, et je les livre en 48 h.
        </p>

        <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-lg">
          {aUnTelephone ? (
            <a className="min-h-11 py-2 font-bold text-bleu underline" href={contact.telephoneLien}>
              {contact.telephoneAffiche}
            </a>
          ) : null}
          {aUnWhatsapp ? (
            <a className="min-h-11 py-2 font-bold text-bleu underline" href={contact.whatsappLien}>
              WhatsApp
            </a>
          ) : null}
          <a className="min-h-11 py-2 font-bold text-bleu underline" href="#formulaire">
            Formulaire
          </a>
        </div>

        {/*
          Dit parce que c'est vrai, et parce que personne d'autre ne le dit :
          cette page ne charge aucun script de mesure et ne dépose aucun témoin.
        */}
        <p className="mt-6 border-t border-bordure pt-5 text-base leading-relaxed text-ardoise">
          Cette page ne dépose aucun cookie et ne charge aucun mouchard. Ce que tu écris dans le
          formulaire m’arrive par courriel et n’est enregistré nulle part ailleurs.
        </p>
      </div>
    </footer>
  );
}
