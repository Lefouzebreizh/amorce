import type { Metadata } from 'next';

import { Apparition, BarreAchat, Comparatifs, TeteTitan, VideoDemo } from './composants';
import {
  AUDIENCE,
  economie,
  lienDAchat,
  EMPLACEMENTS_TEMOIGNAGES,
  ETAPES,
  FORMULES,
  LIENS,
  TEMOIGNAGES,
  WHATSAPP_PRET,
} from './contenu';
import './titan.css';

export const metadata: Metadata = {
  title: 'Montage Titan 24 h — ta vidéo de cabine, rendue époustouflante',
  description:
    'Envoie ta vidéo de cabine, de chantier ou d’atelier. Je te la rends montée façon AZEROTH en 24 h maximum, format vertical, son d’aplomb. 49 € la vidéo, pas satisfait remboursé.',
};

/** Le titre d'une section : un mot en cyan au-dessus, la phrase en dessous. */
function TitreSection({ oeil, titre, sous }: { oeil: string; titre: string; sous?: string }) {
  return (
    <header className="mb-8">
      <p className="text-lg font-bold tracking-[0.24em] text-titan-neon uppercase">{oeil}</p>
      <h2 className="mt-3 font-display text-3xl leading-tight text-mist sm:text-4xl">{titre}</h2>
      {sous ? <p className="mt-3 max-w-2xl text-lg text-muted">{sous}</p> : null}
    </header>
  );
}

export default function PageMontageTitan() {
  const vedette = FORMULES.find((formule) => formule.vedette) ?? FORMULES[0];
  const achatVedette = lienDAchat(vedette);

  return (
    <main className="titan titan-grain relative min-h-[100dvh] overflow-hidden text-mist">
      <div className="titan-halos" aria-hidden />

      <div className="relative z-10 mx-auto w-full max-w-6xl px-5 pb-40">
        {/* ---------------------------------------------------------------- */}
        {/* Le premier écran : la tête, la promesse, la preuve, le bouton.    */}
        {/* ---------------------------------------------------------------- */}
        <section className="pt-12 pb-16 sm:pt-20">
          {/*
            * Sur téléphone, l'ordre est promesse → preuve → argument → bouton :
            * la démo se glisse juste sous le titre, là où elle répond à la seule
            * question qu'on se pose à cet instant. Sur grand écran elle reprend
            * sa colonne à droite, et le texte se relit d'une traite à gauche.
            */}
          <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-10">
            <div className="lg:col-start-1 lg:row-start-1">
              <Apparition>
                <div className="flex items-center gap-4">
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full ring-2 ring-titan-neon/40">
                    <TeteTitan />
                  </div>
                  <p className="text-lg font-bold tracking-[0.22em] text-titan-neon uppercase">
                    Montage Titan
                    <span className="mt-1 block text-titan-ember">24 heures chrono</span>
                  </p>
                </div>
              </Apparition>

              <Apparition delai={80}>
                <h1 className="mt-7 font-display text-4xl leading-[1.05] text-mist sm:text-5xl lg:text-6xl">
                  Ta vidéo de cabine moche
                  <span className="text-titan-neon">{'\u00a0→ '}époustouflante</span> en 24 h.
                  <span className="mt-2 block text-titan-ember">49 €</span>
                </h1>
              </Apparition>

              {/*
                * Le bouton monte sous le titre, avant la démo.
                *
                * Mesuré : posé après le sous-titre, il tombait à 886 px sur le
                * terrain de référence — treize pixels sous le pli, donc jamais vu
                * par qui n'a pas encore décidé de faire défiler. Une page de
                * vente dont le premier écran ne porte aucune action n'en demande
                * aucune ; elle informe.
                *
                * Et il ne s'affiche que s'il mène quelque part : un bouton qui
                * pointe sur « # » perd un client déjà convaincu, ce qui est le
                * seul défaut de cette page qui coûte de l'argent comptant.
                */}
              <Apparition delai={200}>
                {achatVedette ? (
                  <a
                    href={achatVedette.href}
                    className="mt-7 flex min-h-14 w-full max-w-sm items-center justify-center rounded-2xl bg-titan-ember px-7 text-xl font-black whitespace-nowrap text-titan-night"
                  >
                    {achatVedette.libelle}
                  </a>
                ) : (
                  <p className="mt-7 max-w-sm rounded-2xl border border-dashed border-edge bg-slab/60 px-5 py-4 text-lg text-muted">
                    La commande ouvre dès que le paiement est branché. Rien à cliquer d’ici là :
                    un bouton qui ne mène nulle part vaut moins que pas de bouton.
                  </p>
                )}
                <p className="mt-3 text-lg text-muted">
                  Pas satisfait&nbsp;= remboursé. Sans discussion, sans formulaire.
                </p>
              </Apparition>
            </div>

            <Apparition delai={200} className="mx-auto w-full max-w-[300px] lg:col-start-2 lg:row-span-2 lg:row-start-1">
              <div className="rounded-3xl p-[1.5px] titan-filet">
                <div className="overflow-hidden rounded-3xl bg-titan-night">
                  <VideoDemo />
                  <p className="px-4 py-3 text-lg text-muted">
                    <span className="font-bold text-mist">AZEROTH</span> — 21,5 s, monté en cabine
                    sur une aire d’autoroute.
                  </p>
                </div>
              </div>
            </Apparition>

            <div className="lg:col-start-1 lg:row-start-2">
              <Apparition delai={160}>
                <p className="max-w-xl text-xl leading-relaxed text-muted">
                  31 kg perdus, 9 mois clean, 44 tonnes. Je sais ce que c’est de filmer sur un
                  Redmi qui tremble, une main sur le volant et le pare-brise plein de sel.
                  <span className="text-mist"> Je te la transforme.</span>
                </p>
              </Apparition>

              <Apparition delai={240}>
                <a
                  href="#comment"
                  className="mt-6 flex min-h-14 w-full max-w-sm items-center justify-center rounded-2xl border border-edge bg-panel px-7 text-xl font-semibold whitespace-nowrap text-mist"
                >
                  Comment ça marche
                </a>
              </Apparition>
            </div>

          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Ce que ça change, montré plutôt que raconté.                      */}
        {/* ---------------------------------------------------------------- */}
        <section className="py-16" id="avant-apres">
          <Apparition>
            <TitreSection
              oeil="Avant / Après"
              titre="La même prise. Deux mondes."
              sous="Appuie sur Avant, puis sur Après. C’est la seule démonstration qui compte : rien n’est refilmé, c’est ta vidéo qui change de camp."
            />
          </Apparition>
          <Comparatifs />
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* L'offre. Deux formules, une seule mise en avant.                  */}
        {/* ---------------------------------------------------------------- */}
        <section className="py-16" id="offre">
          <Apparition>
            <TitreSection
              oeil="L’offre"
              titre="Un prix, pas un devis."
              sous="Tu sais ce que tu payes avant d’envoyer quoi que ce soit."
            />
          </Apparition>

          <div className="grid gap-6 md:grid-cols-2">
            {FORMULES.map((formule, index) => {
              const gain = economie(formule);
              const achat = lienDAchat(formule);
              return (
                <Apparition key={formule.cle} delai={index * 90}>
                  <article
                    className={`flex h-full flex-col rounded-3xl p-[1.5px] ${
                      formule.vedette ? 'titan-filet' : 'bg-edge'
                    }`}
                  >
                    <div className="flex h-full flex-col rounded-3xl bg-slab p-6">
                      {formule.vedette ? (
                        <span className="mb-4 flex h-9 w-fit items-center rounded-full bg-titan-ember px-4 text-lg font-black tracking-wider text-titan-night uppercase">
                          Le meilleur choix
                        </span>
                      ) : (
                        <span aria-hidden className="mb-4 hidden h-9 md:block" />
                      )}

                      <h3 className="font-display text-2xl text-mist">{formule.nom}</h3>

                      <p className="mt-3 flex items-baseline gap-2">
                        <span className="font-display text-5xl text-titan-neon">{formule.prix} €</span>
                        {gain > 0 ? (
                          <span className="text-lg font-semibold text-titan-ember">
                            tu économises {gain} €
                          </span>
                        ) : null}
                      </p>

                      <ul className="mt-6 flex-1 space-y-3">
                        {formule.inclus.map((ligne) => (
                          <li key={ligne} className="flex gap-3 text-lg text-muted">
                            <span aria-hidden className="mt-1 text-titan-neon">
                              ◆
                            </span>
                            <span>{ligne}</span>
                          </li>
                        ))}
                      </ul>

                      {achat ? (
                        <a
                          href={achat.href}
                          className={`mt-7 flex min-h-14 items-center justify-center rounded-2xl px-6 text-xl font-black whitespace-nowrap ${
                            formule.vedette
                              ? 'bg-titan-ember text-titan-night'
                              : 'bg-titan-neon text-titan-night'
                          }`}
                        >
                          {achat.libelle}
                        </a>
                      ) : (
                        <p className="mt-7 rounded-2xl border border-dashed border-edge px-5 py-4 text-lg text-muted">
                          Commande bientôt ouverte.
                        </p>
                      )}
                    </div>
                  </article>
                </Apparition>
              );
            })}
          </div>

          <Apparition delai={180}>
            <p className="mt-6 text-center text-lg text-muted">
              Paiement sécurisé. <span className="text-mist">Pas satisfait&nbsp;= remboursé.</span>{' '}
              Tu gardes la vidéo dans tous les cas.
            </p>
          </Apparition>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Trois étapes, pour qu'on sache où on met les pieds.               */}
        {/* ---------------------------------------------------------------- */}
        <section className="py-16" id="comment">
          <Apparition>
            <TitreSection
              oeil="Comment ça marche"
              titre="Trois gestes, et c’est fini."
              sous="Pas de brief à rédiger, pas d’appel à caler. Tu envoies, je monte."
            />
          </Apparition>

          <ol className="grid gap-5 md:grid-cols-3">
            {ETAPES.map((etape, index) => (
              <Apparition key={etape.numero} delai={index * 90}>
                <li className="h-full rounded-2xl border border-edge bg-slab p-6">
                  <span className="font-display text-4xl text-titan-neon">{etape.numero}</span>
                  <h3 className="mt-3 text-xl font-bold text-mist">{etape.titre}</h3>
                  <p className="mt-2 text-lg text-muted">{etape.detail}</p>
                </li>
              </Apparition>
            ))}
          </ol>

          {WHATSAPP_PRET ? (
            <Apparition delai={280}>
              <a
                href={LIENS.whatsapp}
                className="mt-6 flex min-h-14 w-full items-center justify-center rounded-2xl border border-titan-neon/50 bg-panel px-6 text-lg font-semibold text-titan-neon"
              >
                Une question avant de payer ? Écris-moi sur WhatsApp
              </a>
            </Apparition>
          ) : null}
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Les preuves. Les chiffres d'abord, la parole des autres ensuite.  */}
        {/* ---------------------------------------------------------------- */}
        <section className="py-16" id="preuves">
          <Apparition>
            <TitreSection
              oeil="Les preuves"
              titre="Je ne vends pas une méthode. Je publie tous les jours."
            />
          </Apparition>

          <div className="grid gap-5 sm:grid-cols-3">
            {AUDIENCE.map((ligne, index) => (
              <Apparition key={ligne.quoi} delai={index * 80}>
                <div className="h-full rounded-2xl border border-edge bg-slab p-6">
                  <p className="font-display text-4xl text-titan-neon">{ligne.valeur}</p>
                  <p className="mt-1 text-xl font-bold text-mist">{ligne.quoi}</p>
                  <p className="mt-2 text-lg text-muted">{ligne.ou}</p>
                </div>
              </Apparition>
            ))}
          </div>

          <Apparition delai={160}>
            <div className="mt-8 flex flex-col items-center gap-6 rounded-3xl border border-edge bg-slab p-6 sm:flex-row sm:items-center">
              <div className="h-28 w-28 shrink-0 overflow-hidden rounded-2xl ring-2 ring-titan-ember/40">
                <TeteTitan />
              </div>
              <p className="text-lg leading-relaxed text-muted">
                Je monte mes vidéos moi-même, dans la cabine, entre deux chargements, avec l’outil
                que j’ai construit pour ça. Le feuilleton{' '}
                <span className="text-mist">Jour 1 / 365</span> sort tous les jours depuis le
                premier — c’est ce qui a servi de terrain d’essai à tout ce que je te vends ici.
                <span className="block pt-2 text-mist">Si ça tient à 44 tonnes, ça tiendra chez toi.</span>
              </p>
            </div>
          </Apparition>

          <div className="mt-8 grid gap-5 sm:grid-cols-3">
            {TEMOIGNAGES.length > 0
              ? TEMOIGNAGES.map((temoignage) => (
                  <Apparition key={temoignage.texte}>
                    <blockquote className="h-full rounded-2xl border border-edge bg-slab p-6">
                      <p className="text-lg text-mist">« {temoignage.texte} »</p>
                      <footer className="mt-3 text-lg text-muted">
                        {temoignage.qui} — {temoignage.source}
                      </footer>
                    </blockquote>
                  </Apparition>
                ))
              : Array.from({ length: EMPLACEMENTS_TEMOIGNAGES }, (_, index) => (
                  <Apparition key={index} delai={index * 80}>
                    <div className="flex h-full min-h-32 flex-col justify-center rounded-2xl border border-dashed border-edge bg-slab/50 p-6 text-center">
                      <p className="text-lg text-muted">
                        {index === 0
                          ? 'La première place est libre. Elle ira au premier retour reçu, avec son nom et sa source.'
                          : 'Emplacement libre.'}
                      </p>
                    </div>
                  </Apparition>
                ))}
          </div>

          <Apparition delai={220}>
            <p className="mt-4 text-center text-lg text-muted">
              Aucun avis inventé sur cette page. Tant qu’il n’y a pas de client, il n’y a pas de
              citation — ce serait la seule chose qui vaille la peine de te faire fuir.
            </p>
          </Apparition>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* La dernière marche.                                              */}
        {/* ---------------------------------------------------------------- */}
        <section className="py-16">
          <Apparition>
            <div className="rounded-3xl p-[1.5px] titan-filet">
              <div className="rounded-3xl bg-slab px-6 py-12 text-center">
                <h2 className="font-display text-3xl leading-tight text-mist sm:text-5xl">
                  Ta prochaine vidéo peut sortir demain.
                </h2>
                <p className="mx-auto mt-4 max-w-xl text-xl text-muted">
                  Tu as déjà la vidéo. Elle est dans ton téléphone, elle tremble, tu l’as jamais
                  publiée. C’est exactement celle-là qu’il me faut.
                </p>
                {achatVedette ? (
                  <a
                    href={achatVedette.href}
                    className="mx-auto mt-8 flex min-h-14 w-full max-w-sm items-center justify-center rounded-2xl bg-titan-ember px-6 text-xl font-black text-titan-night"
                  >
                    {achatVedette.libelle}
                  </a>
                ) : null}
                <p className="mt-4 text-lg text-muted">
                  À partir de {FORMULES[0].prix} €. Pas satisfait&nbsp;= remboursé.
                </p>
              </div>
            </div>
          </Apparition>
        </section>

        <footer className="border-t border-edge pt-8 pb-4 text-center text-lg text-muted">
          <p>Montage Titan — monté à la main, dans une cabine, par un humain.</p>
        </footer>
      </div>

      {achatVedette ? <BarreAchat lien={achatVedette.href} libelle={achatVedette.libelle} /> : null}
    </main>
  );
}
