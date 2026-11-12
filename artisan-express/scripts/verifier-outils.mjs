/** Recette locale après npm run build. Playwright est une devDependency du monorepo.
 * Lance son propre serveur local, sans clé ni envoi externe. Ne pas lui injecter de secrets de production. */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
const require = createRequire(import.meta.url);
const {chromium}=require(process.env.ARTISAN_PLAYWRIGHT_MODULE ?? 'playwright');
const {spawn}=require('node:child_process');const fs=require('node:fs');const assert=require('node:assert/strict');
const projet=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root=process.env.ARTISAN_QA_DIR ?? fs.mkdtempSync(path.join(os.tmpdir(),'artisan-qa-'));
fs.mkdirSync(root,{recursive:true});
const serveur=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','33585'],{cwd:projet,stdio:'pipe',env:{...process.env,RESEND_API_KEY:'',DEVIS_DESTINATAIRE:''}});
(async()=>{
 for(let i=0;i<60;i++){try{if((await fetch('http://127.0.0.1:33585')).ok)break}catch{}await new Promise(r=>setTimeout(r,250));}
 const navigateur=await chromium.launch({executablePath:process.env.ARTISAN_CHROMIUM,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--no-zygote','--single-process','--disable-gpu','--use-gl=disabled','--disable-software-rasterizer','--disable-webgl']});
 const contexte=await navigateur.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
 await contexte.grantPermissions(['clipboard-read','clipboard-write']);
 const page=await contexte.newPage();const erreurs=[];page.on('pageerror',e=>erreurs.push(e.message));
 await page.goto('http://127.0.0.1:33585',{waitUntil:'networkidle'});
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.screenshot({path:root+'/qa-hero-bureau.png'});
 // SMS : début, erreur, qualification, reprise, changement de métier.
 await page.getByRole('button',{name:'Simuler un appel manqué',exact:true}).click();
 await page.locator('#sms-besoin').fill('');await page.getByRole('button',{name:'Simuler sa réponse'}).click();
 assert.match(await page.locator('[role=alert]').first().innerText(),/Précise/);
 await page.locator('#sms-besoin').fill('Remplacement tableau électrique');
 await page.getByRole('button',{name:'Simuler sa réponse'}).click();
 assert.match(await page.locator('.outil-rappel').innerText(),/Remplacement tableau/);
 await page.locator('#appels-manques').screenshot({path:root+'/qa-sms.png'});
 await page.getByRole('button',{name:'Recommencer',exact:true}).click();
 await page.locator('#sms-metier').selectOption('Électricien');
 await page.getByRole('button',{name:'Simuler un appel manqué',exact:true}).click();
 assert.match(await page.locator('.outil-bulle--sortante').innerText(),/électricien/);
 // Devis : exemple, édition, prix, ajout, suppression, PDF réel.
 await page.getByRole('button',{name:'Utiliser un exemple'}).click();
 await page.getByRole('button',{name:'Préparer mon brouillon'}).click();
 const devis=page.locator('#devis-vocal');
 const prix=devis.getByRole('textbox',{name:'Prix unitaire HT (€)',exact:true});
 await prix.nth(0).fill('650,50');await prix.nth(1).fill('59,90');
 assert.match(await devis.innerText(),/830,20/);
 await devis.getByRole('button',{name:/Ajouter une prestation/}).click();
 await devis.getByRole('button',{name:'Supprimer la prestation 3',exact:true}).click();
 const [download]=await Promise.all([page.waitForEvent('download'),devis.getByRole('button',{name:'Télécharger le brouillon PDF'}).click()]);
 await download.saveAs(root+'/qa-devis-telecharge.pdf');assert.equal(fs.readFileSync(root+'/qa-devis-telecharge.pdf').subarray(0,8).toString(),'%PDF-1.4');
 await prix.nth(1).fill('-1');assert.equal(await devis.getByRole('button',{name:'Télécharger le brouillon PDF'}).isDisabled(),true);
 await prix.nth(1).fill('59,90');await devis.screenshot({path:root+'/qa-devis.png'});
 // Fallback vocal puis refus simulé sans microphone ni audio réel.
 await page.evaluate(()=>{window.SpeechRecognition=undefined;window.webkitSpeechRecognition=undefined;});
 await devis.getByRole('button',{name:'Dicter mon intervention'}).click();assert.match(await devis.getByRole('status').innerText(),/ne propose pas la dictée/);
 await page.evaluate(()=>{window.SpeechRecognition=class {start(){setTimeout(()=>this.onerror?.({error:'not-allowed'}),50)} stop(){this.onend?.()} abort(){}}});
 await devis.getByRole('button',{name:'Dicter mon intervention'}).click();
 await page.waitForTimeout(80);assert.match(await devis.getByRole('status').innerText(),/refusé/);
 // Avis : rejet d’un lien tiers et copie sans transmission.
 await page.locator('#avis-lien').fill('https://example.com');assert.equal(await page.getByRole('button',{name:'Copier mon message'}).isDisabled(),true);
 await page.locator('#avis-entreprise').fill('Atelier Démonstration');
 await page.locator('#avis-lien').fill('https://g.page/r/EXEMPLE/review');
 await page.getByRole('button',{name:'Copier mon message'}).click();
 const copie=await page.evaluate(()=>navigator.clipboard.readText());assert.match(copie,/Atelier Démonstration/);assert.doesNotMatch(copie,/5 étoiles/);
 await page.locator('#presence-locale').screenshot({path:root+'/qa-local.png'});
 // Le service choisi arrive dans le formulaire, puis repli local 503 sans envoi réel.
 await page.getByRole('link',{name:'Parler de ma présence locale'}).click();assert.equal(await page.locator('#contact-besoin').inputValue(),'local');
 const form=page.locator('#formulaire form');await form.getByRole('button',{name:'J’envoie, et tu me rappelles'}).click();assert.match(await form.innerText(),/À remplir/);
 await form.getByRole('textbox',{name:'Ton nom',exact:true}).fill('Client Démo');await form.getByRole('combobox',{name:'Ton métier',exact:true}).fill('Plombier');
 await form.getByRole('textbox',{name:'Ta ville',exact:true}).fill('Rennes');await form.getByRole('textbox',{name:'Ton téléphone',exact:true}).fill('0612345678');
 await form.getByRole('button',{name:'J’envoie, et tu me rappelles'}).click();
 await page.getByRole('link',{name:'J’envoie depuis ma messagerie'}).waitFor();
 const mailto=await page.getByRole('link',{name:'J’envoie depuis ma messagerie'}).getAttribute('href');assert.match(decodeURIComponent(mailto),/Présence locale/);assert.doesNotMatch(decodeURIComponent(mailto),/Offre choisie/);
 // Succès simulé pour exercer le retour sans appel externe.
 await page.route('**/api/devis',r=>r.fulfill({status:200,contentType:'application/json',body:'{"statut":"recu"}'}));
 await form.getByRole('button',{name:'J’envoie, et tu me rappelles'}).click();await page.getByRole('heading',{name:'C’est envoyé.'}).waitFor();
 await page.unroute('**/api/devis');
 await page.getByRole('button',{name:'Faire une autre demande'}).click();
 await page.getByRole('link',{name:'Choisir Métier',exact:true}).click();
 assert.equal(await page.locator('#contact-besoin').inputValue(),'site');
 assert.equal(await page.locator('input[name=offre]:checked').inputValue(),'metier');
 // Liens des modèles et vraies iframes : défilement pour charger les ressources différées.
 await page.locator('#galerie').scrollIntoViewIfNeeded();await page.waitForTimeout(500);
 assert.equal(await page.locator('#galerie a.artisan-galerie__card').count(),6);
 for(const lien of await page.locator('#galerie a.artisan-galerie__card').evaluateAll(els=>els.map(e=>e.getAttribute('href')))) assert.equal((await page.request.get(new URL(lien,'http://127.0.0.1:33585').href)).status(),200);
 await page.locator('#galerie').screenshot({path:root+'/qa-galerie.png'});
 // Écrans 393 / 768 / 1440 et mouvement réduit : pas de débordement.
 const tailles=[];
 for(const largeur of [393,768,1440]){
  await page.setViewportSize({width:largeur,height:900});await page.goto('http://127.0.0.1:33585',{waitUntil:'networkidle'});
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`débordement ${largeur}`);
  await page.screenshot({path:root+`/qa-accueil-${largeur}.png`});
  await page.getByRole('button',{name:'Simuler un appel manqué',exact:true}).click();
  await page.locator('#appels-manques').screenshot({path:root+`/qa-appels-${largeur}.png`});
  await page.getByRole('button',{name:'Utiliser un exemple'}).click();await page.getByRole('button',{name:'Préparer mon brouillon'}).click();
  await page.locator('#devis-vocal').screenshot({path:root+`/qa-devis-${largeur}.png`});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  tailles.push(largeur);
 }
 assert.deepEqual(erreurs,[]);fs.writeFileSync(root+'/qa-artisan.json',JSON.stringify({parcours:'SMS, devis, PDF, vocal fallback/refus simulé, avis, contact panne/succès simulé, galerie',tailles,erreurs},null,2));
 console.log('PARCOURS OK',tailles,'sans erreur JS');console.log('Preuves :',root);await contexte.close();await navigateur.close();serveur.kill();
})().catch(e=>{console.error(e);serveur.kill();process.exit(1)});
