/**
 * Qui parle, parmi les visages d'un plan.
 *
 * Le cadrage suivait la **plus grande** boîte quand il n'avait pas d'histoire,
 * et une planche tirée d'un vrai rush a montré que c'est faux : la caméra
 * partait sur un visage d'arrière-plan plus grand que celui du sujet qui
 * parlait. Le plus grand visage n'est pas le sujet ; **celui qui parle l'est**.
 *
 * ## Le signal, et pourquoi celui-là
 *
 * Deux mesures que le studio a déjà sous la main, croisées :
 *
 * - **Le remuement de la bouche** — la luminance moyenne du tiers bas de la
 *   boîte, d'un échantillon à l'autre. Une bouche qui s'ouvre découvre une
 *   cavité sombre : la moyenne bouge. C'est grossier et c'est gratuit, puisque
 *   l'image est déjà tracée sur la toile d'analyse.
 * - **L'énergie du son** du rush, fenêtre par fenêtre.
 *
 * Ni l'un ni l'autre ne dit qui parle. Leur **corrélation**, si : un visage qui
 * remue quand il y a du son et se tait quand il n'y en a pas est le locuteur.
 * Un visage immobile ne corrèle avec rien ; un visage qui bouge tout le temps —
 * quelqu'un qui marche au fond — ne corrèle pas non plus, parce qu'il remue
 * aussi pendant les silences.
 *
 * ## Ce qui n'a pas été mesuré, et il faut le lire avant d'y toucher
 *
 * **Aucune de ces règles n'a vu un vrai locuteur.** Les rushes fabriqués par
 * `npm run fixtures` portent un disque coloré, pas un visage : le détecteur n'y
 * trouve rien, donc rien de ce fichier n'y est éprouvé de bout en bout. Les
 * tests ci-contre éprouvent l'**arithmétique** — la corrélation, le suivi des
 * pistes, la règle de départage — sur des signaux fabriqués à la main.
 *
 * C'est la même position que `chat-traducteur` avant ESC-50, et elle se dit
 * plutôt qu'elle ne se tait : ce qui manque est un rush filmé avec deux
 * personnes dont une parle. Tant qu'il n'existe pas, ce module améliore un
 * choix qui était mesuré faux, sans qu'on puisse chiffrer de combien.
 *
 * ## Pourquoi le tiers bas plutôt que les points du détecteur
 *
 * BlazeFace rend six points caractéristiques, dont un pour la bouche. Leur
 * **ordre** n'est pas vérifiable ici — il n'y a aucun visage à mesurer — et
 * écrire contre un ordre supposé est précisément ce que ce dépôt s'interdit.
 * Le tiers bas central d'une boîte de visage droit est la bouche, sans
 * hypothèse à vérifier. Le jour où un rush filmé existe, la comparaison des
 * deux se fera sur pièces.
 */

/** Ce qu'un échantillon retient d'un visage, pour ce module et lui seul. */
export type Mesure = {
  /** Abscisse du centre, en pixels de l'image analysée. */
  centre: number;
  /** Largeur de la boîte, qui sert de distance maximale d'un échantillon à l'autre. */
  largeur: number;
  /** Luminance moyenne du tiers bas de la boîte, de 0 à 255. */
  bouche: number;
};

/** Un visage suivi d'un échantillon à l'autre, avec son remuement de bouche. */
export type Piste = {
  /** Abscisse du centre au premier échantillon, en pixels de l'image analysée. */
  centre: number;
  /** Variation de la bouche entre échantillons consécutifs. Un de moins que d'échantillons. */
  remuement: number[];
};

/**
 * Combien le meilleur doit dépasser le second pour qu'on le déclare locuteur.
 *
 * Même forme que `DOMINANCE` dans `detection.ts`, et pour la même raison : un
 * **rapport** se défend sans avoir à inventer un seuil absolu. Deux visages qui
 * corrèlent presque autant ne se départagent pas — on préfère alors dire qu'on
 * ne sait pas, et laisser l'appelant retomber sur son pis-aller, plutôt que de
 * trancher sur un écart que la mesure ne soutient pas.
 */
export const SEPARATION = 1.5;

/**
 * Corrélation de Pearson entre deux séries de même longueur.
 *
 * Rend `null` — et non zéro — quand l'une des deux ne varie pas : un son
 * parfaitement constant ou un visage parfaitement immobile ne portent aucune
 * information, et rendre zéro les ferait passer pour « mesurés et non
 * corrélés », ce qui est une affirmation qu'on n'a pas les moyens de faire.
 */
export function correlation(a: number[], b: number[]): number | null {
  const n = Math.min(a.length, b.length);
  if (n < 2) return null;

  let sa = 0;
  let sb = 0;
  for (let i = 0; i < n; i++) {
    sa += a[i];
    sb += b[i];
  }
  const ma = sa / n;
  const mb = sb / n;

  let haut = 0;
  let carresA = 0;
  let carresB = 0;
  for (let i = 0; i < n; i++) {
    const ea = a[i] - ma;
    const eb = b[i] - mb;
    haut += ea * eb;
    carresA += ea * ea;
    carresB += eb * eb;
  }
  if (carresA === 0 || carresB === 0) return null;
  return haut / Math.sqrt(carresA * carresB);
}

/**
 * Le centre du visage qui parle, ou `null` quand la mesure ne tranche pas.
 *
 * `null` n'est pas un échec : c'est le cas le plus fréquent — un plan muet, un
 * seul visage immobile, deux personnes qui parlent ensemble. L'appelant garde
 * alors son pis-aller, et rien n'est pire qu'avant.
 */
export function sujetQuiParle(pistes: Piste[], energie: number[]): number | null {
  if (pistes.length === 0) return null;

  const notes = pistes
    .map((piste) => ({ piste, note: correlation(piste.remuement, energie) }))
    // Une corrélation négative dit que le visage remue pendant les silences :
    // c'est un indice contre lui, jamais un candidat faible.
    .filter((c): c is { piste: Piste; note: number } => c.note !== null && c.note > 0)
    .sort((a, b) => b.note - a.note);

  if (notes.length === 0) return null;
  if (notes.length === 1) return notes[0].piste.centre;
  return notes[0].note >= notes[1].note * SEPARATION ? notes[0].piste.centre : null;
}

/**
 * L'énergie du son, une valeur par échantillon d'image.
 *
 * Racine de la moyenne des carrés sur la fenêtre qui entoure chaque
 * échantillon — la même grandeur que le parcours complet mesure déjà sur le
 * mixage. Les fenêtres se touchent sans se recouvrir : deux fenêtres qui
 * partageraient des échantillons lisseraient l'attaque des syllabes, or c'est
 * exactement l'attaque qui distingue une bouche qui parle d'une tête qui bouge.
 */
export function energieParFenetre(
  canal: Float32Array,
  echantillonnage: number,
  parSeconde: number,
  fenetres: number,
): number[] {
  const largeur = Math.max(1, Math.round(echantillonnage / parSeconde));
  const sortie: number[] = [];
  for (let i = 0; i < fenetres; i++) {
    const debut = i * largeur;
    const fin = Math.min(canal.length, debut + largeur);
    if (debut >= canal.length) {
      sortie.push(0);
      continue;
    }
    let somme = 0;
    for (let k = debut; k < fin; k++) somme += canal[k] * canal[k];
    sortie.push(Math.sqrt(somme / (fin - debut)));
  }
  return sortie;
}


/**
 * Suit chaque visage sur une fenêtre de début de plan, et rend son remuement.
 *
 * On ne suit que le **début** : la question posée ici est « qui parle au moment
 * où la caméra doit choisir », pas « qui parle tout du long ». Une fois le sujet
 * choisi, c'est la continuité de `centreDuSujet` qui prend le relais, et elle
 * n'a besoin de personne. Borner la fenêtre évite aussi de faire porter à ce
 * calcul le suivi d'un plan de trente secondes, qu'il ferait mal — les visages
 * entrent et sortent, et une piste rompue puis reprise n'est pas la même
 * personne.
 *
 * L'appariement se fait au plus proche, borné par la **largeur du visage** : un
 * visage qui s'est déplacé de plus que sa propre largeur en un dixième de
 * seconde n'est pas le même. C'est une borne géométrique, sans réglage à
 * inventer.
 *
 * Une piste rompue s'arrête là : on préfère une piste courte et sûre à une
 * piste longue qui a changé de personne en route, laquelle corrélerait avec
 * n'importe quoi.
 *
 * **Le départ est rendu avec les pistes, et ce n'est pas une commodité.** Un
 * plan peut commencer sans personne dans le champ ; le suivi démarre alors au
 * premier échantillon qui porte un visage, et le remuement d'indice `j` décrit
 * la transition qui **finit** à l'échantillon `depart + 1 + j`. Sans cette
 * valeur, l'appelant aligne le son sur le début du plan, la corrélation compare
 * une bouche avec le son d'un autre instant, et elle s'effondre sans que rien
 * ne le signale — un décalage ne lève aucune erreur, il rend juste la mesure
 * muette.
 */
export function suivrePistes(
  parEchantillon: Mesure[][],
  fenetre: number,
): { depart: number; pistes: Piste[] } {
  const depart = parEchantillon.findIndex((m) => m.length > 0);
  if (depart === -1) return { depart: 0, pistes: [] };

  const fin = Math.min(parEchantillon.length, depart + fenetre);
  const pistes = parEchantillon[depart].map((m) => ({
    centre: m.centre,
    remuement: [] as number[],
    derniere: m,
    vivante: true,
  }));

  for (let i = depart + 1; i < fin; i++) {
    const vues = parEchantillon[i];
    // Un visage déjà apparié ne peut pas l'être une seconde fois : sans cela,
    // deux pistes voisines se colleraient au même visage et porteraient le
    // même remuement, donc la même corrélation — et le départage n'aurait
    // plus aucun sens.
    const pris = new Set<number>();

    for (const piste of pistes) {
      if (!piste.vivante) continue;

      let meilleur = -1;
      let distance = Infinity;
      for (let k = 0; k < vues.length; k++) {
        if (pris.has(k)) continue;
        const ecart = Math.abs(vues[k].centre - piste.derniere.centre);
        if (ecart < distance) {
          distance = ecart;
          meilleur = k;
        }
      }

      if (meilleur === -1 || distance > piste.derniere.largeur) {
        piste.vivante = false;
        continue;
      }
      pris.add(meilleur);
      piste.remuement.push(Math.abs(vues[meilleur].bouche - piste.derniere.bouche));
      piste.derniere = vues[meilleur];
    }
  }

  return {
    depart,
    pistes: pistes
      // Deux points ne font pas une corrélation ; sous quatre échantillons, le
      // hasard sépare mieux que le signal.
      .filter((p) => p.remuement.length >= 4)
      .map((p) => ({ centre: p.centre, remuement: p.remuement })),
  };
}

/**
 * Le son qui accompagne les remuements d'un suivi, aligné sur eux.
 *
 * Une fonction plutôt qu'un `slice` recopié chez l'appelant : c'est le seul
 * endroit où l'alignement se décide, et il n'a aucun symptôme quand il est
 * faux — la corrélation tombe, on croit que personne ne parle, et le pis-aller
 * reprend la main sans que rien ne paraisse cassé.
 */
export function sonAligne(energie: number[], depart: number, fenetre: number): number[] {
  return energie.slice(depart + 1, depart + fenetre);
}
