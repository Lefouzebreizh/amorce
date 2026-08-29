/*
 * Les quelques valeurs qui changent d'un déploiement à l'autre : le numéro
 * qu'on appelle, celui de WhatsApp, le lien de paiement Stripe.
 *
 * Elles sont lues par leur nom complet et non construites dynamiquement — Next
 * remplace `process.env.NEXT_PUBLIC_…` à la compilation, et une clé calculée
 * ressort `undefined` dans le navigateur sans rien signaler.
 *
 * Une valeur absente ne casse rien et n'invente rien : le bouton concerné
 * disparaît et le formulaire prend le relais. Une page de vente qui affiche un
 * faux numéro coûte plus cher qu'une page qui n'en affiche pas.
 */

const TELEPHONE = process.env.NEXT_PUBLIC_TELEPHONE ?? '';
const WHATSAPP = process.env.NEXT_PUBLIC_WHATSAPP ?? '';
const STRIPE = process.env.NEXT_PUBLIC_LIEN_STRIPE ?? '';
/*
 * L'adresse vers laquelle le formulaire bascule quand l'envoi serveur n'est pas
 * réglé. C'est la seule variable qui ne demande **aucun compte à créer** — une
 * adresse qu'on possède déjà suffit — et c'est elle qui permet à une page
 * déployée sans rien d'autre d'encaisser tout de même une demande.
 */
const COURRIEL_DIRECT = process.env.NEXT_PUBLIC_DEVIS_MAILTO ?? '';

/** `06 12 34 56 78` → `+33612345678`, tel quel si le format est déjà international. */
function lienTelephonique(brut: string): string {
  const chiffres = brut.replace(/[^\d+]/g, '');
  if (chiffres.startsWith('+')) return chiffres;
  if (chiffres.startsWith('0')) return `+33${chiffres.slice(1)}`;
  return chiffres;
}

export const contact = {
  telephoneAffiche: TELEPHONE,
  telephoneLien: TELEPHONE === '' ? '' : `tel:${lienTelephonique(TELEPHONE)}`,
  whatsappLien:
    WHATSAPP === ''
      ? ''
      : `https://wa.me/${WHATSAPP.replace(/[^\d]/g, '')}?text=${encodeURIComponent(
          'Salut Erwann, je veux mon site artisan à 299 €.',
        )}`,
  /** Sans lien de paiement, le bouton d'offre renvoie au formulaire. */
  stripeLien: STRIPE,
  /** Adresse de repli du formulaire, sans compte d'envoi à créer. */
  courrielDirect: COURRIEL_DIRECT,
} as const;

export const aUnTelephone = contact.telephoneLien !== '';
export const aUnWhatsapp = contact.whatsappLien !== '';
export const aUnStripe = contact.stripeLien !== '';
export const aUnCourrielDirect = contact.courrielDirect !== '';
