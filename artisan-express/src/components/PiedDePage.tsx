import { aUnTelephone, aUnWhatsapp, contact } from '@/lib/config';

export function PiedDePage() {
  return (
    <footer className="border-t border-bordure bg-bleu-pale">
      <div className="mx-auto w-full max-w-5xl px-5 py-10">
        <p className="text-lg font-bold text-encre">Site vitrine artisan express</p>
        {/*
          Ce paragraphe répétait mot pour mot la présentation du Hero — « artisan
          du code, ex-routier » — et re-vendait les 48 h que le titre annonce
          déjà. Sur une page unique, le lecteur croise les deux dans le même
          défilement : ça se lit comme un bégaiement, et le propriétaire l'a
          signalé en ces termes.

          La place est rendue à ce que la charte demande en fin de page : une
          invitation, jamais un rappel commercial.
        */}
        <p className="mt-2 max-w-2xl leading-relaxed text-ardoise">
          Une question avant de te décider ? Écris-moi — même juste pour savoir si ça vaut le coup
          pour ton métier.
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
          {/*
            La loi demande que les mentions légales soient **accessibles**, pas
            qu'elles soient mises en avant. Un lien de pied de page est
            exactement ce qu'elle attend, et c'est là que tout le monde les
            cherche.
          */}
          <a className="min-h-11 py-2 font-bold text-bleu underline" href="/mentions-legales">
            Mentions légales
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
