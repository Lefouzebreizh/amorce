'use client';

import { useEffect, useId, useRef, useState } from 'react';
import {
  afficherEuros, erreursDevis, EXEMPLE_DEVIS_VOCAL, ligneVide, MAX_LIGNES_DEVIS,
  MAX_TEXTE_DEVIS, structurerDictee, totalDevisCentimes, totalLigneCentimes,
  type BrouillonDevisVocal, type LigneDevisVocal,
} from '@/lib/devis-vocal';
import { ChoisirService } from '@/components/ChoisirService';
import styles from './DevisVocal.module.css';

/** Types locaux : l’API vocale n’est pas disponible dans tous les navigateurs. */
type ResultatVocal = { isFinal: boolean; [index: number]: { transcript: string } };
type ReconnaissanceVocale = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results: { length: number; [index: number]: ResultatVocal } }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type ConstructeurVocal = new () => ReconnaissanceVocale;
type FenetreVocale = Window & { SpeechRecognition?: ConstructeurVocal; webkitSpeechRecognition?: ConstructeurVocal };

const ERREURS_MICRO: Record<string, string> = {
  'not-allowed': 'Le micro est refusé. Autorise-le dans ton navigateur, ou écris simplement ton texte.',
  'service-not-allowed': 'La dictée est indisponible dans ce navigateur. Tu peux continuer au clavier.',
  'audio-capture': 'Aucun microphone disponible. Branche-le ou continue au clavier.',
  'no-speech': 'Aucune parole reconnue. Réessaie ou utilise le texte d’exemple.',
  network: 'La reconnaissance vocale ne répond pas. Vérifie ta connexion ou continue au clavier.',
};

export function DevisVocal() {
  const id = useId();
  const [texte, setTexte] = useState('');
  const [ecoute, setEcoute] = useState(false);
  const [intermediaire, setIntermediaire] = useState('');
  const [message, setMessage] = useState('');
  const [brouillon, setBrouillon] = useState<BrouillonDevisVocal | null>(null);
  const reconnaissance = useRef<ReconnaissanceVocale | null>(null);
  const prochainId = useRef(MAX_LIGNES_DEVIS + 1);
  const apercu = useRef<HTMLDivElement>(null);

  useEffect(() => () => {
    const courant = reconnaissance.current;
    if (courant) {
      courant.onend = null;
      courant.onresult = null;
      courant.onerror = null;
      courant.abort();
    }
  }, []);

  function arreterMicro() {
    reconnaissance.current?.stop();
  }

  function dicter() {
    if (ecoute) { arreterMicro(); return; }
    const fenetre = window as FenetreVocale;
    const Constructeur = fenetre.SpeechRecognition ?? fenetre.webkitSpeechRecognition;
    if (!Constructeur) {
      setMessage('Ce navigateur ne propose pas la dictée. Écris ton texte ou teste l’exemple : les autres fonctions restent disponibles.');
      return;
    }
    const service = new Constructeur();
    reconnaissance.current = service;
    service.lang = 'fr-FR';
    service.continuous = false;
    service.interimResults = true;
    const precedent = texte.trim();
    service.onresult = (evenement) => {
      let definitif = '';
      let temporaire = '';
      for (let index = 0; index < evenement.results.length; index += 1) {
        const resultat = evenement.results[index];
        if (!resultat) continue;
        if (resultat.isFinal) definitif += ` ${resultat[0]?.transcript ?? ''}`;
        else temporaire += ` ${resultat[0]?.transcript ?? ''}`;
      }
      if (definitif.trim()) setTexte(`${precedent} ${definitif.trim()}`.trim().slice(0, MAX_TEXTE_DEVIS));
      setIntermediaire(temporaire.trim());
    };
    service.onerror = (evenement) => {
      if (evenement.error !== 'aborted') setMessage(ERREURS_MICRO[evenement.error] ?? 'La dictée s’est interrompue. Ton texte reste disponible ; tu peux continuer au clavier.');
      setEcoute(false);
      setIntermediaire('');
    };
    service.onend = () => {
      if (reconnaissance.current === service) reconnaissance.current = null;
      setEcoute(false);
      setIntermediaire('');
    };
    try {
      setMessage('');
      service.start();
      setEcoute(true);
    } catch {
      reconnaissance.current = null;
      setEcoute(false);
      setMessage('Impossible de démarrer le micro. Utilise le clavier ou le texte d’exemple.');
    }
  }

  function structurer() {
    if (!texte.trim()) { setMessage('Décris au moins une prestation avant de préparer le brouillon.'); return; }
    setBrouillon(structurerDictee(texte));
    setMessage('Brouillon prêt. Relis les prestations et complète tes prix : aucun tarif n’a été inventé.');
    requestAnimationFrame(() => apercu.current?.focus({ preventScroll: true }));
  }

  function changerLigne(ligneId: number, champ: keyof Omit<LigneDevisVocal, 'id'>, valeur: string) {
    setBrouillon((courant) => courant ? {
      ...courant,
      lignes: courant.lignes.map((ligne) => ligne.id === ligneId ? { ...ligne, [champ]: valeur } : ligne),
    } : null);
  }

  async function telecharger() {
    if (!brouillon) return;
    try {
      const { creerPdfDevis } = await import('@/lib/devis-pdf');
      const octets = creerPdfDevis(brouillon);
      const fichier = new Blob([new Uint8Array(octets)], { type: 'application/pdf' });
      const adresse = URL.createObjectURL(fichier);
      const lien = document.createElement('a');
      lien.href = adresse;
      lien.download = 'artisan-express-brouillon-devis-demo.pdf';
      document.body.appendChild(lien);
      lien.click();
      lien.remove();
      window.setTimeout(() => URL.revokeObjectURL(adresse), 10_000);
      setMessage('PDF préparé pour le téléchargement. Il porte la mention « démonstration non contractuelle ».');
    } catch (erreur) {
      setMessage(erreur instanceof Error ? erreur.message : 'Le PDF n’a pas pu être préparé. Vérifie les prestations et réessaie.');
    }
  }

  const erreurs = brouillon ? erreursDevis(brouillon, true) : [];
  const total = brouillon ? totalDevisCentimes(brouillon) : null;

  return (
    <section className={styles.section} id="devis-vocal" aria-labelledby={`${id}-titre`}>
      <div className={styles.introduction}>
        <p className={styles.kicker}>02 / Moins de paperasse</p>
        <h2 id={`${id}-titre`}>Tu le dis.<br /><span>Ton devis prend forme.</span></h2>
        <p>Dicte ton intervention entre deux chantiers. Retrouve un brouillon clair, ajuste tes prix et récupère un PDF.</p>
        <p className={styles.precision}>Démo gratuite · structuration locale simulée, sans appel à une IA.</p>
      </div>

      <div className={styles.atelier}>
        <div className={styles.saisie}>
          <span className={styles.etape}>1. Décris ton intervention</span>
          <label htmlFor={`${id}-dictee`}>À la voix ou au clavier</label>
          <textarea id={`${id}-dictee`} value={texte} maxLength={MAX_TEXTE_DEVIS} rows={6}
            onChange={(event) => setTexte(event.target.value)} disabled={ecoute}
            placeholder={EXEMPLE_DEVIS_VOCAL} aria-describedby={`${id}-confidentialite`} />
          {intermediaire ? <p className={styles.intermediaire} aria-live="polite">{intermediaire}</p> : null}
          <div className={styles.actions}>
            <button type="button" className={`${styles.bouton} ${ecoute ? styles.enregistrement : ''}`} onClick={dicter} aria-pressed={ecoute}>
              <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8" /></svg>
              {ecoute ? 'Arrêter la dictée' : 'Dicter mon intervention'}
            </button>
            <button type="button" className={styles.lien} disabled={ecoute} onClick={() => {
              setTexte(EXEMPLE_DEVIS_VOCAL);
              setMessage('Exemple chargé. Tu peux le modifier avant de préparer le brouillon.');
            }}>Utiliser un exemple</button>
          </div>
          <p id={`${id}-confidentialite`} className={styles.aide}>Le micro démarre uniquement à ta demande. Selon le navigateur, la reconnaissance vocale peut utiliser son service en ligne. Le texte et le PDF restent dans cette page ; rien n’est envoyé à un client.</p>
          <button type="button" className={`${styles.bouton} ${styles.principal}`} onClick={structurer} disabled={ecoute || !texte.trim()}>Préparer mon brouillon <span aria-hidden="true">↗</span></button>
          <p className={styles.statut} role="status">{ecoute ? 'Micro actif. Parle, puis arrête la dictée pour relire.' : message}</p>
        </div>

        <div className={styles.apercu} ref={apercu} tabIndex={-1} aria-label="Aperçu du brouillon de devis">
          <div className={styles.entete}><span>ARTISAN EXPRESS</span><span className={styles.badge}>DÉMONSTRATION</span></div>
          <h3>Ton brouillon de devis</h3>
          {brouillon ? <>
            <label className={styles.client} htmlFor={`${id}-client`}>Client
              <input id={`${id}-client`} value={brouillon.client} maxLength={120} placeholder="Nom du client à compléter"
                onChange={(event) => setBrouillon({ ...brouillon, client: event.target.value })} />
            </label>
            <ol className={styles.lignes}>
              {brouillon.lignes.map((ligne, index) => <li key={ligne.id}>
                <div className={styles.ligneEntete}><span>Prestation {index + 1}</span>
                  <button type="button" disabled={brouillon.lignes.length === 1} className={styles.supprimer}
                    aria-label={`Supprimer la prestation ${index + 1}`} onClick={() => setBrouillon({ ...brouillon, lignes: brouillon.lignes.filter((item) => item.id !== ligne.id) })}>Retirer</button>
                </div>
                <label htmlFor={`${id}-designation-${ligne.id}`}>Prestation
                  <input id={`${id}-designation-${ligne.id}`} value={ligne.designation} maxLength={240} onChange={(event) => changerLigne(ligne.id, 'designation', event.target.value)} />
                </label>
                <div className={styles.chiffres}>
                  <label htmlFor={`${id}-quantite-${ligne.id}`}>Quantité
                    <input id={`${id}-quantite-${ligne.id}`} inputMode="decimal" value={ligne.quantite} maxLength={10} onChange={(event) => changerLigne(ligne.id, 'quantite', event.target.value)} />
                  </label>
                  <label htmlFor={`${id}-unite-${ligne.id}`}>Unité
                    <input id={`${id}-unite-${ligne.id}`} value={ligne.unite} maxLength={20} onChange={(event) => changerLigne(ligne.id, 'unite', event.target.value)} />
                  </label>
                  <label htmlFor={`${id}-prix-${ligne.id}`}>Prix unitaire HT (€)
                    <input id={`${id}-prix-${ligne.id}`} inputMode="decimal" value={ligne.prixUnitaire} maxLength={12} placeholder="À compléter" onChange={(event) => changerLigne(ligne.id, 'prixUnitaire', event.target.value)} />
                  </label>
                </div>
                <p className={styles.sousTotal}>Montant HT <strong>{totalLigneCentimes(ligne) === null ? 'À compléter' : afficherEuros(totalLigneCentimes(ligne)!)}</strong></p>
              </li>)}
            </ol>
            <button type="button" className={styles.ajouter} disabled={brouillon.lignes.length >= MAX_LIGNES_DEVIS} onClick={() => {
              const nouvelle = ligneVide(prochainId.current++);
              setBrouillon({ ...brouillon, lignes: [...brouillon.lignes, nouvelle] });
            }}>+ Ajouter une prestation {brouillon.lignes.length >= MAX_LIGNES_DEVIS ? '(12 maximum)' : ''}</button>
            <div className={styles.total}><span>Total indicatif HT</span><strong>{total === null ? 'À compléter' : afficherEuros(total)}</strong></div>
            <p className={styles.note}>Prix à vérifier par tes soins. TVA non définie, total TTC non calculé. Ce brouillon ne constitue pas un devis à envoyer en l’état.</p>
            {erreurs.length ? <ul className={styles.erreurs} aria-label="Champs à corriger">{erreurs.map((erreur) => <li key={erreur}>{erreur}</li>)}</ul> : null}
            <button type="button" className={`${styles.bouton} ${styles.pdf}`} disabled={erreurs.length > 0} onClick={telecharger}>Télécharger le brouillon PDF <span aria-hidden="true">↓</span></button>
            <p className={styles.note}>Les tarifs non renseignés apparaissent « À compléter » dans le PDF.</p>
          </> : <div className={styles.vide}>
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M12 5h17l8 8v30H12zM29 5v9h8M18 23h13M18 29h13M18 35h8" /></svg>
            <p><strong>Une note de chantier.<br />Un document lisible.</strong></p>
            <p>Ton aperçu apparaîtra ici après la structuration. Tu gardes la main sur chaque ligne et chaque prix.</p>
            <span>2. Relis · 3. Ajuste · 4. Télécharge</span>
          </div>}
        </div>
      </div>
      <div className="outil-actions"><ChoisirService besoin="devis">Parler de mes devis ↗</ChoisirService></div>
    </section>
  );
}
