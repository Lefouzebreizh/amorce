/**
 * L'adaptateur MiniMax — le seul fichier du service qui connaisse le réseau.
 *
 * Sa surface n'a pas été écrite de mémoire ni recopiée du brief : elle a été
 * relevée dans `minimax-mcp`, le serveur MCP que MiniMax publie lui-même sur
 * PyPI, parce que ses cinq hôtes sont injoignables depuis une session distante.
 * Le détail et ce que le brief en disait de faux sont dans
 * `second-brain/lecons/2026-09-08-la-surface-de-minimax-se-lit-sans-joindre-minimax.md`.
 *
 * **La vidéo se fait en trois temps, pas en deux.** On soumet, on sonde, on va
 * chercher le fichier — et c'est la troisième étape que le brief oubliait :
 * `POST /v1/video_generation` ne rend qu'un identifiant de tâche.
 *
 * **Seuls `Success` et `Fail` sont des états finaux.** Tout le reste veut dire
 * « encore en cours », et c'est pour ça qu'aucune énumération fermée des états
 * intermédiaires n'est écrite ici : le fournisseur peut en ajouter un demain,
 * et un code qui les liste tomberait sur celui qu'il ne connaît pas.
 *
 * **Aucun média de l'appareil ne monte ici.** L'API accepte un
 * `first_frame_image`, et il n'est pas exposé : ce serait le premier rush de
 * quelqu'un qui partirait chez un tiers, et la génération intégrée n'a été
 * ouverte que pour ce qui *naît* sur le serveur. Le jour où une image de départ
 * se justifie, ça se décide, ça s'écrit, et ça ne se glisse pas dans un
 * paramètre optionnel.
 */

/** L'adresse de base et la clé. Rien de tout ça n'est écrit dans le dépôt. */
export type Acces = { hote: string; cle: string };

/** Ce qu'on demande : du texte, une durée, un cadrage. Jamais un fichier. */
export type Demande = {
  modele: string;
  invite: string;
  secondes?: number;
  /** `"9:16"` pour une série verticale. Exposé par l'API, contrairement à d'autres. */
  cadrage?: string;
};

/** Ce que le fournisseur rend quand la tâche est finie. */
export type Fini = { etat: 'fini'; adresse: string };
/** Ce qu'il rend tant qu'elle tourne. */
export type EnCours = { etat: 'en-cours' };
/** Ce qu'il rend quand elle échoue, avec ce qu'il a dit. */
export type Echoue = { etat: 'echoue'; explication: string };

export type Etat = Fini | EnCours | Echoue;

/**
 * Le minimum que le service attend d'un fournisseur.
 *
 * L'existence de cette interface est ce qui rend tout le reste éprouvable hors
 * ligne : les tests branchent un fournisseur de bois, et rien n'appelle
 * `fetch`. C'est la même mesure que `Base` chez les deux serveurs voisins.
 */
export type Fournisseur = {
  /** Soumet la demande et rend l'identifiant de la tâche. */
  lancerVideo(demande: Demande): Promise<string>;
  /** Où en est cette tâche. */
  suivre(tache: string): Promise<Etat>;
};

/** Le corps d'une réponse, sans supposer sa forme. */
async function lire(reponse: Response): Promise<Record<string, unknown>> {
  if (!reponse.ok) {
    throw new Error(`MiniMax a répondu ${reponse.status} sur ${reponse.url}`);
  }
  return (await reponse.json()) as Record<string, unknown>;
}

/** L'adaptateur réel. `porte` existe pour que les tests n'aient pas de réseau. */
export function minimax(acces: Acces, porte: typeof fetch = fetch): Fournisseur {
  const entetes = {
    Authorization: `Bearer ${acces.cle}`,
    'Content-Type': 'application/json',
  };

  return {
    async lancerVideo(demande) {
      // Le corps ne porte que ce qui a été demandé : un champ absent est un
      // champ que le fournisseur remplit avec son défaut, ce qui vaut mieux
      // qu'une valeur inventée ici.
      const corps: Record<string, unknown> = { model: demande.modele, prompt: demande.invite };
      if (demande.secondes) corps.duration = demande.secondes;
      if (demande.cadrage) corps.aspect_ratio = demande.cadrage;

      const rendu = await lire(
        await porte(`${acces.hote}/v1/video_generation`, {
          method: 'POST',
          headers: entetes,
          body: JSON.stringify(corps),
        }),
      );
      const tache = rendu.task_id;
      if (typeof tache !== 'string' || tache === '') {
        throw new Error('MiniMax n’a pas rendu de task_id : la tâche n’existe pas.');
      }
      return tache;
    },

    async suivre(tache) {
      const rendu = await lire(
        await porte(`${acces.hote}/v1/query/video_generation?task_id=${encodeURIComponent(tache)}`, {
          headers: entetes,
        }),
      );

      if (rendu.status === 'Fail') {
        return { etat: 'echoue', explication: `La tâche ${tache} a échoué chez MiniMax.` };
      }
      // Tout ce qui n'est ni Success ni Fail tourne encore — y compris un état
      // que ce code ne connaît pas.
      if (rendu.status !== 'Success') return { etat: 'en-cours' };

      const fichier = rendu.file_id;
      if (typeof fichier !== 'string' || fichier === '') {
        return {
          etat: 'echoue',
          explication: `La tâche ${tache} est réussie sans file_id : rien à récupérer.`,
        };
      }

      // La troisième étape, celle que le brief oubliait.
      const recu = await lire(
        await porte(`${acces.hote}/v1/files/retrieve?file_id=${encodeURIComponent(fichier)}`, {
          headers: entetes,
        }),
      );
      const adresse = (recu.file as { download_url?: unknown } | undefined)?.download_url;
      if (typeof adresse !== 'string' || adresse === '') {
        return {
          etat: 'echoue',
          explication: `Le fichier ${fichier} n’a pas d’adresse de téléchargement.`,
        };
      }
      return { etat: 'fini', adresse };
    },
  };
}
