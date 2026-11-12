'use client';

import { useState } from 'react';
import { lienAvisValide, messageAvis } from '@/lib/sms';
import { ChoisirService } from '@/components/ChoisirService';

export function PresenceLocale() {
  const [entreprise, setEntreprise] = useState('Mon entreprise');
  const [lien, setLien] = useState('');
  const [retour, setRetour] = useState('');
  const valide = lienAvisValide(lien);
  const message = messageAvis(entreprise, lien);

  async function copier() {
    try { await navigator.clipboard.writeText(message); setRetour('Message copié. Aucun SMS n’a été envoyé.'); }
    catch { setRetour('La copie est indisponible ici. Sélectionne le message ci-dessous pour le copier.'); }
  }

  return <section className="outil-section outil-section--locale" id="presence-locale" aria-labelledby="local-titre">
    <div className="outil-entete"><p className="artisan-kicker"><span>03</span> Présence locale & avis</p><h2 id="local-titre">Ton travail mérite<br /><span>d’être trouvé.</span></h2><p>Une fiche Google Business Profile à jour, des réalisations visibles et une demande d’avis simple après l’intervention.</p></div>
    <div className="outil-grille">
      <div className="outil-pack">
        <p className="outil-sur-titre">Un kit, trois actions concrètes</p>
        <ol className="outil-liste-pack">
          <li><span>01</span><div><h3>Remettre ta fiche au carré</h3><p>Catégorie, zone d’intervention, horaires, services et coordonnées : on vérifie ce qui aide un client à te choisir.</p></div></li>
          <li><span>02</span><div><h3>Montrer le travail réalisé</h3><p>Photos de chantiers et présentation claire. Ton site existant reste utile et peut être relié à ta fiche.</p></div></li>
          <li><span>03</span><div><h3>Faciliter les avis authentiques</h3><p>Un lien direct et un SMS prêt à utiliser, proposé à tous tes clients après l’intervention. Chacun choisit sa note et ses mots.</p></div></li>
        </ol>
        <p className="outil-note">Accompagnement sur devis. Tu conserves la propriété de ta fiche. Aucun classement ni nombre d’étoiles garanti.</p>
        <ChoisirService besoin="local" className="outil-bouton outil-bouton--principal">Parler de ma présence locale ↗</ChoisirService>
      </div>
      <div className="outil-panel">
        <span className="outil-mode">Préparateur de message · sans envoi</span>
        <h3>Après le chantier, un petit message.</h3>
        <label className="outil-label" htmlFor="avis-entreprise">Nom de ton entreprise</label>
        <input className="outil-champ" id="avis-entreprise" maxLength={80} value={entreprise} onChange={(e) => { setEntreprise(e.target.value); setRetour(''); }} />
        <label className="outil-label" htmlFor="avis-lien">Ton lien de demande d’avis Google</label>
        <input className="outil-champ" id="avis-lien" type="url" maxLength={500} placeholder="https://g.page/r/…/review" value={lien} aria-invalid={lien !== '' && !valide} aria-describedby="avis-aide" onChange={(e) => { setLien(e.target.value); setRetour(''); }} />
        <p className="outil-note" id="avis-aide">Depuis ta fiche Google, utilise « Demander des avis ». Formats acceptés : g.page/r/…/review ou search.google.com/local/writereview?placeid=…</p>
        {lien !== '' && !valide && <p className="outil-erreur">Colle un lien de demande d’avis Google au format indiqué.</p>}
        <div className="outil-bulle outil-message-avis"><p>{message}</p></div>
        <button className="outil-bouton outil-bouton--principal" disabled={!valide || !entreprise.trim()} onClick={copier}>Copier mon message</button>
        <p role="status" className="outil-note">{retour || 'Ajoute ton lien pour copier un message prêt à utiliser. Aucun compte Google n’est connecté.'}</p>
      </div>
    </div>
  </section>;
}
