import Link from 'next/link';
import type { Modele } from '@/lib/commande';
import { PRIX_BASE } from '@/lib/commande';

/**
 * La carte d'un modèle, sur la page d'accueil.
 *
 * Toute la carte est un lien : sur un téléphone, viser un bouton de la taille
 * d'un timbre au bas d'une carte est le geste qu'on rate. La mention « Choisir
 * ce modèle » reste affichée parce qu'elle dit ce qui va se passer — mais elle
 * n'est pas la seule zone à atteindre.
 */
export function CarteModele({ modele }: { modele: Modele }) {
  const [debut, fin] = modele.teintes;

  return (
    <Link
      href={`/configurer/${modele.id}`}
      className="verre lueur group flex flex-col gap-4 rounded-3xl p-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-neon-clair sm:p-6"
      aria-label={`Choisir le modèle ${modele.nom}`}
    >
      {/* L'aperçu. Un dégradé et un emoji plutôt qu'une image : une capture de
          site qui n'existe pas encore serait une promesse fausse, et une image
          distante ferait clignoter la carte au chargement. */}
      <div
        className="relative flex h-36 items-center justify-center overflow-hidden rounded-2xl border border-bord sm:h-40"
        style={{ background: `linear-gradient(135deg, ${debut}22, ${fin}33)` }}
        aria-hidden="true"
      >
        <span className="text-6xl drop-shadow-[0_6px_20px_rgba(0,0,0,.6)]">{modele.emoji}</span>
        <span
          className="absolute inset-x-6 bottom-4 h-1 rounded-full opacity-80"
          style={{ background: `linear-gradient(90deg, ${debut}, ${fin})` }}
        />
      </div>

      <div>
        <h3 className="text-xl font-extrabold tracking-tight sm:text-2xl">{modele.nom}</h3>
        <p className="mt-1 text-sm text-sourdine">{modele.pourQui}</p>
      </div>

      <p className="text-[0.95rem] leading-relaxed text-slate-200">{modele.accroche}</p>

      <ul className="flex flex-col gap-1.5">
        {modele.points.map((point) => (
          <li key={point} className="flex items-start gap-2 text-sm text-sourdine">
            <span aria-hidden="true" style={{ color: fin }}>▸</span>
            {point}
          </li>
        ))}
      </ul>

      <div className="mt-auto flex items-center justify-between gap-3 pt-2">
        <span className="text-sm text-sourdine">
          à partir de <strong className="text-lg text-white">{PRIX_BASE} €</strong>
        </span>
        <span
          className="inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold text-white"
          style={{ background: `linear-gradient(90deg, ${debut}, ${fin})` }}
        >
          Choisir ce modèle
        </span>
      </div>
    </Link>
  );
}
