// Squelette d'accueil — le parcours guidé à choix (mode 1) reste à écrire.
// Voir TODO.md : l'interface ne doit s'étoffer qu'après validation du
// prompt système et de la liste de mots-clés par un professionnel, pour ne
// pas polir une façade sur des fondations pas encore coulées.
export default function PageAccueil() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 px-6 py-16">
      <div>
        <p className="text-sm font-semibold tracking-widest text-ink-soft uppercase">Psy IA</p>
        <h1 className="mt-2 text-3xl font-semibold">Un espace pour poser ce que tu ressens</h1>
      </div>

      <p className="text-ink-soft">
        Psy IA est un outil d&apos;accompagnement conversationnel — écoute, réassurance,
        aiguillage. <strong className="text-ink">Ce n&apos;est ni un humain, ni un professionnel de
        santé</strong>, et ça ne le sera jamais : pour un vrai suivi, un vrai professionnel reste la
        seule bonne adresse.
      </p>

      <div className="rounded-xl border border-line px-4 py-3 text-sm text-ink-soft">
        En cas de danger immédiat : <strong className="text-ink">15</strong> (SAMU) ou{' '}
        <strong className="text-ink">112</strong>. Prévention du suicide, 24h/24 et 7j/7 :{' '}
        <strong className="text-ink">3114</strong>, gratuit et confidentiel.
      </div>

      <p className="text-xs text-ink-soft">
        Ce projet est encore en construction et n&apos;a pas encore été validé par un professionnel
        de santé mentale — voir TODO.md dans le dépôt.
      </p>

      <a
        href="/chat"
        className="mt-2 inline-flex min-h-[44px] w-fit items-center rounded-xl border border-line px-4 text-lg text-ink"
      >
        Ouvrir l&apos;aperçu de conversation (privé)
      </a>
    </main>
  );
}
