import { MESURE } from '@/components/ui';
import { aUnTelephone, aUnWhatsapp, contact } from '@/lib/config';

export function PiedDePage() {
  return (
    <footer className="artisan-footer">
      <div className="artisan-footer__inner">
        <div className="artisan-footer__brand">
          <span className="artisan-nav__mark" aria-hidden="true"><span>AE</span></span>
          <div>
            <p>Artisan Express</p>
            <span>Un site clair pour un métier bien fait.</span>
          </div>
        </div>
        {/*
          Ce paragraphe répétait mot pour mot la présentation du Hero — « artisan
          du code, ex-routier » — et re-vendait les 48 h que le titre annonce
          déjà. Sur une page unique, le lecteur croise les deux dans le même
          défilement : ça se lit comme un bégaiement, et le propriétaire l'a
          signalé en ces termes.

          La place est rendue à ce que la charte demande en fin de page : une
          invitation, jamais un rappel commercial.
        */}
        <p className={`artisan-footer__lead leading-relaxed text-ardoise ${MESURE}`}>
          Une question avant de te décider ? Écris-moi — même juste pour savoir si ça vaut le coup
          pour ton métier.
        </p>

        <div className="artisan-footer__links text-lg">
          {aUnTelephone ? (
            <a className="min-h-11 py-2 font-bold text-accent underline" href={contact.telephoneLien}>
              {contact.telephoneAffiche}
            </a>
          ) : null}
          {aUnWhatsapp ? (
            <a className="min-h-11 py-2 font-bold text-accent underline" href={contact.whatsappLien}>
              WhatsApp
            </a>
          ) : null}
          <a className="min-h-11 py-2 font-bold text-accent underline" href="#formulaire">
            Formulaire
          </a>
          {/*
            La loi demande que les mentions légales soient **accessibles**, pas
            qu'elles soient mises en avant. Un lien de pied de page est
            exactement ce qu'elle attend, et c'est là que tout le monde les
            cherche.
          */}
          <a className="min-h-11 py-2 font-bold text-accent underline" href="/mentions-legales">
            Mentions légales
          </a>
        </div>

        {/*
          Dit parce que c'est vrai, et parce que personne d'autre ne le dit :
          cette page ne charge aucun script de mesure et ne dépose aucun témoin.
        */}
        <p className={`artisan-footer__privacy text-base leading-relaxed text-ardoise ${MESURE}`}>
          Cette page ne dépose aucun cookie et ne charge aucun mouchard. Ce que tu écris dans le
          formulaire m’arrive par courriel et n’est enregistré nulle part ailleurs.
        </p>
      </div>
    </footer>
  );
}
