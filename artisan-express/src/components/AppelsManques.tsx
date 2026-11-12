'use client';

import { useState } from 'react';
import { METIERS_SMS, messageAppelManque, qualifierReponse } from '@/lib/sms';
import { ChoisirService } from '@/components/ChoisirService';

export function AppelsManques() {
  const [metier, setMetier] = useState<string>('Plombier');
  const [etape, setEtape] = useState(0);
  const [besoin, setBesoin] = useState('Mon chauffe-eau fuit, je n’ai plus d’eau chaude.');
  const [commune, setCommune] = useState('Rennes');
  const [urgence, setUrgence] = useState('Dans la journée');
  const [erreur, setErreur] = useState('');
  const reponse = qualifierReponse(besoin, commune, urgence);

  function recommencer() { setEtape(0); setErreur(''); }

  return <section id="appels-manques" className="outil-section" aria-labelledby="appels-titre">
    <div className="outil-entete">
      <p className="artisan-kicker"><span>01</span> Le contact ne s’arrête pas à la sonnerie</p>
      <h2 id="appels-titre">Les mains occupées.<br /><span>Le client accompagné.</span></h2>
      <p>Un appel sans réponse peut devenir une demande claire. Essaie le scénario : tu es sur un chantier, ton client cherche à te joindre.</p>
    </div>
    <div className="outil-grille">
      <div className="outil-panel">
        <span className="outil-mode">Simulateur · aucun SMS envoyé</span>
        <label className="outil-label" htmlFor="sms-metier">Ton métier</label>
        <select className="outil-champ" id="sms-metier" value={metier} onChange={(e) => { setMetier(e.target.value); recommencer(); }}>
          {METIERS_SMS.map((nom) => <option key={nom}>{nom}</option>)}
        </select>
        <ol className="outil-etapes" aria-label="Parcours de la démonstration">
          {['Appel sans réponse', 'SMS de prise de contact', 'Besoin prêt à rappeler'].map((nom, index) => <li key={nom} aria-current={etape === index ? 'step' : undefined} className={etape >= index ? 'est-active' : ''}><span>0{index + 1}</span>{nom}</li>)}
        </ol>
        <div className="outil-actions">
          <button className="outil-bouton outil-bouton--principal" disabled={etape !== 0} onClick={() => setEtape(1)}>Simuler un appel manqué</button>
          {etape > 0 && <button className="outil-bouton" onClick={recommencer}>Recommencer</button>}
        </div>
        <p className="outil-note">En service connecté : un numéro compatible ou un renvoi d’appel et un prestataire SMS sont nécessaires. Ce site ne lit pas le journal d’appels de ton téléphone.</p>
        <ChoisirService besoin="appels">Étudier mon installation ↗</ChoisirService>
      </div>
      <div className="outil-conversation" aria-live="polite" aria-atomic="false">
        <div className="outil-conversation__barre"><span className="outil-point" /> Conversation d’exemple <span>Démo</span></div>
        {etape === 0 ? <div className="outil-vide"><span aria-hidden="true">↙</span><h3>Un client appelle…</h3><p>Tu es en intervention. Lance la simulation pour voir le message qu’il recevrait.</p></div> : <>
          <p className="outil-appel">↙ Appel manqué · scénario simulé</p>
          <div className="outil-bulle outil-bulle--sortante"><small>Ton message automatique simulé</small><p>{messageAppelManque(metier)}</p></div>
          {etape === 1 ? <form className="outil-reponse" onSubmit={(e) => {
            e.preventDefault();
            if (!reponse.besoin || !reponse.commune) { setErreur('Précise le besoin et la commune pour préparer le rappel.'); return; }
            setErreur(''); setEtape(2);
          }}>
            <h3>Joue maintenant le client</h3>
            <label className="outil-label" htmlFor="sms-besoin">Son besoin</label>
            <textarea className="outil-champ" id="sms-besoin" maxLength={500} value={besoin} onChange={(e) => setBesoin(e.target.value)} />
            <div className="outil-deux-champs">
              <label className="outil-label">Sa commune<input className="outil-champ" maxLength={80} value={commune} onChange={(e) => setCommune(e.target.value)} /></label>
              <label className="outil-label">Son délai souhaité<select className="outil-champ" value={urgence} onChange={(e) => setUrgence(e.target.value)}><option>Dans la journée</option><option>Cette semaine</option><option>À planifier</option></select></label>
            </div>
            {erreur && <p role="alert" className="outil-erreur">{erreur}</p>}
            <button className="outil-bouton outil-bouton--principal" type="submit">Simuler sa réponse</button>
          </form> : <>
            <div className="outil-bulle"><small>Réponse du client simulée</small><p>{reponse.besoin} À {reponse.commune}. {reponse.urgence}.</p></div>
            <div className="outil-rappel"><span>À rappeler quand tu es disponible</span><h3>Une demande, déjà qualifiée.</h3><dl><div><dt>Besoin</dt><dd>{reponse.besoin}</dd></div><div><dt>Secteur</dt><dd>{reponse.commune}</dd></div><div><dt>Délai demandé</dt><dd>{reponse.urgence}</dd></div></dl><p>Aucun rendez-vous ni délai d’intervention n’a été promis.</p></div>
          </>}
        </>}
      </div>
    </div>
  </section>;
}
