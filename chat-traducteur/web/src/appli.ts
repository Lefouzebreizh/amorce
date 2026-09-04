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
import { enSvg } from "./carte.ts";
import { habiller } from "./intentions.ts";
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
