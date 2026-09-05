/**
 * L'application elle-même : du son au partage, et rien entre les deux.
 *
 * Elle n'a **aucune logique de décision** — elle branche des pièces déjà
 * éprouvées ailleurs : `adaptateurs/audio` ramène le son en 16 kHz mono,
 * `adaptateurs/yamnet` rend les 521 scores, `verdict.juger` décide,
 * `carte.enSvg` habille. Si une intention paraît fausse, ce n'est pas ici
 * qu'il faut chercher.
 *
 * Deux façons d'entrer, et elles ne se valent pas :
 *
 * - **le micro**, qui est l'usage réel, et dont le son passe par le
 *   rééchantillonnage du navigateur — la capture se fait à la fréquence de
 *   l'appareil, souvent 48 kHz ;
 * - **un fichier**, qui sert à éprouver : un WAV déjà en 16 kHz mono traverse
 *   sans être rééchantillonné, donc le navigateur et le Python peuvent être
 *   comparés sur les mêmes octets.
 *
 * Le §2 s'applique d'office et se voit dans la feuille de style : 18 px
 * minimum, cibles ≥ 44 px, `100dvh`, aucun autoplay, `prefers-reduced-motion`
 * respecté.
 */

import { fenetrer, versMono16k } from "./adaptateurs/audio.ts";
import { Oreille, type MoteurTflite, type Tenseur } from "./adaptateurs/yamnet.ts";
import { BAS_SUR, enSvg, HAUT_SUR, LARGEUR } from "./carte.ts";
import { habiller, Intention, Source } from "./intentions.ts";
import { palette } from "./palette.ts";
import { juger, type Verdict } from "./verdict.ts";

declare const tf: Tenseur;
declare const tflite: MoteurTflite;

const $ = (id: string) => document.getElementById(id) as HTMLElement;

let oreille: Oreille | null = null;
let dernierSvg = "";
let dernierVerdict: Verdict | null = null;
let nbFenetres = 0;

async function reveiller(): Promise<Oreille> {
  if (oreille) return oreille;
  dire("Réveil du modèle…");
  const etiquettes = await (await fetch("./donnees/etiquettes.json")).json();
  oreille = new Oreille(tf, tflite, {
    modele: "./modeles/yamnet.tflite",
    cheminWasm: "./wasm/",
    etiquettes,
  });
  await oreille.ouvrir();
  return oreille;
}

function dire(texte: string): void {
  $("etat").textContent = texte;
}

/** Le seul chemin qui mène à l'écran : un son entre, une carte sort. */
async function ecouter(donnees: ArrayBuffer): Promise<void> {
  const o = await reveiller();
  dire("J'écoute…");
  const echantillons = await versMono16k(donnees);
  const fenetres = fenetrer(echantillons);
  if (fenetres.length === 0) {
    dire("Rien à écouter — l'enregistrement est vide.");
    return;
  }
  nbFenetres = fenetres.length;
  const scores = await o.ecouterToutes(fenetres);
  montrer(juger(scores));
}

function montrer(verdict: Verdict): void {
  dernierVerdict = verdict;
  const parure = habiller(verdict.intention);
  // La carte n'existe que si la porte s'est ouverte. Sinon on montre la
  // raison, en français, telle que le noyau l'a écrite — c'est elle qui dit
  // « aucun son de chat entendu » plutôt que « ce n'est pas un chat », et la
  // nuance a été payée sur un vrai fichier.
  if (verdict.classeDominante === "") {
    $("carte").innerHTML = "";
    $("carte").hidden = true;
    $("telecharger").hidden = true;
    dire(verdict.raison);
    return;
  }
  dernierSvg = enSvg(verdict);
  $("carte").innerHTML = dernierSvg;
  $("carte").hidden = false;
  $("telecharger").hidden = false;
  dire(`${parure.titre} — ${verdict.raison}`);
}

// ── Le micro ───────────────────────────────────────────────────────────────
let enregistreur: MediaRecorder | null = null;
let morceaux: Blob[] = [];

async function basculerMicro(): Promise<void> {
  const bouton = $("micro") as HTMLButtonElement;
  if (enregistreur && enregistreur.state === "recording") {
    enregistreur.stop();
    return;
  }
  try {
    const flux = await navigator.mediaDevices.getUserMedia({ audio: true });
    morceaux = [];
    enregistreur = new MediaRecorder(flux);
    enregistreur.ondataavailable = (e) => morceaux.push(e.data);
    enregistreur.onstop = async () => {
      flux.getTracks().forEach((t) => t.stop());
      bouton.textContent = "Écouter mon chat";
      bouton.dataset.etat = "pret";
      await ecouter(await new Blob(morceaux).arrayBuffer());
    };
    enregistreur.start();
    bouton.textContent = "J'arrête";
    bouton.dataset.etat = "enregistre";
    dire("Enregistrement… appuie de nouveau quand il a fini.");
  } catch {
    // Un refus de micro n'est pas une panne : c'est un choix de l'utilisateur,
    // et le repli par fichier existe pour ça.
    dire("Le micro n'est pas accessible. Tu peux choisir un fichier son.");
  }
}

// ── Le fichier ─────────────────────────────────────────────────────────────
async function surFichier(e: Event): Promise<void> {
  const fichier = (e.target as HTMLInputElement).files?.[0];
  if (fichier) await ecouter(await fichier.arrayBuffer());
}

// ── Le partage ─────────────────────────────────────────────────────────────
function telecharger(): void {
  const lien = document.createElement("a");
  lien.href = URL.createObjectURL(new Blob([dernierSvg], { type: "image/svg+xml" }));
  lien.download = "mon-chat.svg";
  lien.click();
  URL.revokeObjectURL(lien.href);
}

$("micro").addEventListener("click", () => void basculerMicro());
$("fichier").addEventListener("change", (e) => void surFichier(e));
$("telecharger").addEventListener("click", telecharger);

// ── Les tiroirs : ce que l'application sait reconnaître, avant qu'on appuie ──
//
// Le défaut qu'ils réparent n'est sorti que du **regard**, et sur un vrai
// téléphone : toutes les mesures étaient vertes, l'épreuve conduisait la page
// de bout en bout — et l'écran d'accueil ne montrait rien. Un titre, deux
// boutons, « Prêt. », et six cents pixels de noir. Rien ne disait ce que
// l'outil cherche ni ce qu'il s'autorise à dire.
//
// Chaque tiroir porte **la carte réelle**, engendrée par le même `enSvg` que
// celle qu'on télécharge, et non une maquette dessinée à la main. Deux raisons,
// et la seconde compte plus que la première : on voit exactement ce qu'on
// obtiendra, et le jour où la carte change, les tiroirs changent avec elle
// sans que personne ait à y penser. Une capture d'écran, elle, se périme en
// silence.
//
// Les verdicts sont fabriqués ici en clair, ce que rien d'autre dans ce
// fichier ne fait — mais ils ne traversent jamais `juger` et ne touchent pas
// `dernierVerdict` : ce sont des **exemples**, pas des mesures. La garde qui
// compte tient toujours, et c'est `carte.enSvg` qui la porte : elle refuse
// d'afficher un pourcentage pour une source qui n'est pas `MESUREE`.
// `PROVISOIRE` a donc été choisi pour les trois cartes de la tête acoustique,
// parce que c'est ce que l'application rendra réellement — annoncer un score
// dans la vitrine et pas dans le produit serait une promesse en trop.
interface Tiroir {
  intention: Intention;
  son: string;
}

// L'ordre suit la fréquence attendue, pas l'alphabet : la demande est le cas
// le plus courant que l'application sache nommer, le doute ferme la marche
// parce qu'il est ce qu'on lit en dernier quand rien d'autre n'a pris.
//
// Les seuils cités — 400 Hz, 0,7 s — sont ceux de `traits.ts`
// (`FRONTIERE_AIGU`, `FRONTIERE_LONG`) et se disent ici en français plutôt
// qu'en nombres : « qui traîne » se comprend sur un quai de gare, pas
// « supérieur à sept dixièmes de seconde ».
const TIROIRS: Tiroir[] = [
  { intention: Intention.DEMANDE,
    son: "Un miaulement aigu qui traîne. Il réclame quelque chose — " +
         "la gamelle, la porte, de l'eau, la litière. L'application ne dira " +
         "jamais lequel : rien dans le son ne les sépare." },
  { intention: Intention.CONTENTEMENT,
    son: "Un miaulement aigu et court, ou un ronronnement. C'est le seul " +
         "cas où le modèle mesure vraiment quelque chose, et la carte affiche " +
         "alors son pourcentage." },
  { intention: Intention.STRESS,
    son: "Un miaulement grave. Il demande de l'espace, tout de suite. " +
         "Aucune classe du modèle ne porte le stress : c'est la hauteur seule " +
         "qui le dit, donc jamais avec un score." },
  { intention: Intention.INDECIS,
    son: "Un chat, mais une hauteur qu'on ne sait pas mesurer — trop court, " +
         "trop de bruit autour. Mieux vaut le dire que deviner." },
];

// La carte entière ne se montre pas en vignette, et c'est un défaut vu à
// l'écran plutôt que mesuré — le second de ce projet à ne sortir que du
// regard. Elle fait 1080 × 1920 et son texte vit entre 12 et 45 % de hauteur,
// le reste étant le vide réservé à la vidéo : réduite à la largeur d'un
// téléphone, elle rend un titre de moins de huit pixels au-dessus d'une vaste
// zone morte. Illisible, et laide pour la même raison.
//
// On la recadre donc sur **sa zone sûre**, qui est exactement la bande que le
// spectateur voit sur TikTok — ce n'est pas une image différente, c'est le
// même SVG vu par sa fenêtre utile. Le recadrage se fait sur la `viewBox`,
// donc sans toucher à `carte.ts` : le jour où la zone sûre bouge, les deux
// constantes ci-dessous viennent du même endroit qu'elle.
function recadrer(svg: string): string {
  const haut = HAUT_SUR - 40;                 // un peu d'air au-dessus du titre
  const hauteur = BAS_SUR - haut + 40;        // et en dessous du dernier bloc
  return svg.replace(
    /width="\d+" height="\d+" viewBox="[^"]*"/,
    `viewBox="0 ${haut} ${LARGEUR} ${hauteur}" preserveAspectRatio="xMidYMid slice"`,
  );
}

function monterLesTiroirs(): void {
  const hote = document.getElementById("savoir");
  if (!hote) return;
  for (const { intention, son } of TIROIRS) {
    const h = habiller(intention);
    const teintes = palette(intention);
    // Une carte d'exemple : même chemin que la vraie, source `PROVISOIRE`
    // pour les trois lectures acoustiques et `MESUREE` pour le ronronnement,
    // qui est le seul que le modèle chiffre.
    const mesuree = intention === Intention.CONTENTEMENT;
    const svg = enSvg({
      intention,
      source: mesuree ? Source.MESUREE : Source.PROVISOIRE,
      confiance: mesuree ? 0.59 : 0.5,
      raison: son,
      classeDominante: mesuree ? "Purr" : "Meow",
    });
    const bloc = document.createElement("details");
    bloc.innerHTML =
      `<summary>` +
      `<span class="pastille" style="background:${teintes.accent}"></span>` +
      `<span>${h.titre}</span><span class="chevron">▾</span></summary>` +
      `<div class="corps">${recadrer(svg)}` +
      `<p class="son">${son}</p>` +
      `</div>`;
    hote.appendChild(bloc);
  }
}
monterLesTiroirs();

// ── Ce qui est exposé pour l'épreuve, et pourquoi ce n'est pas une porte
// dérobée ────────────────────────────────────────────────────────────────────
//
// `ecouterOctets` est le chemin de l'utilisateur, appelé de l'extérieur : elle
// ne court-circuite rien.
//
// `jugerScores` entre par la **couture** — la même que `fabriquer_cartes.py`
// emprunte côté Python — et prend des scores YAMNet pour les faire traverser
// `juger` puis `montrer`. Elle ne permet pas de fabriquer un verdict : c'est
// `juger` qui décide, et `carte.enSvg` refuse toujours d'afficher un score que
// la source ne dit pas mesuré. Elle sert à montrer la carte d'un son mesuré
// sans avoir à rejouer le son.
const dehors = window as unknown as Record<string, unknown>;
dehors.ecouterOctets = ecouter;
dehors.jugerScores = (fenetres: Parameters<typeof juger>[0]) => {
  const v = juger(fenetres);
  montrer(v);
  return v;
};
dehors.dernierVerdict = () => dernierVerdict;
dehors.nbFenetres = () => nbFenetres;
dehors.svgCourant = () => dernierSvg;
dehors.appliPrete = true;
