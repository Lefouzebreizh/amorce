import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const LOT = join(process.cwd(), '.fixtures', 'lot12');
const fichiers = readdirSync(LOT).sort().map((f) => join(LOT, f));
const navigateur = await chromium.launch({ executablePath: process.env.AMORCE_CHROMIUM || undefined });

console.log('\n  douze rushes, montage express, export complet\n');

for (const [bridage, definition] of [[1, 'full'], [4, 'full'], [4, 'light'], [6, 'full']]) {
  const contexte = await navigateur.newContext({
    viewport: { width: 390, height: 640 },
    deviceScaleFactor: 2, isMobile: true, hasTouch: true, acceptDownloads: true,
  });
  const page = await contexte.newPage();
  const cdp = await contexte.newCDPSession(page);

  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.setInputFiles('input[type=file][accept*="video/*"]', fichiers);
  for (let i = 0; i < 180; i += 1) {
    if (await page.locator('button:has-text("Monter automatiquement (")').count()) break;
    await page.waitForTimeout(1000);
  }
  await page.waitForTimeout(3000);
  await page.locator('button:has-text("Monter automatiquement (")').first().click();
  await page.waitForTimeout(5000);

  const section = page.locator('#etape-export');
  await section.waitFor({ state: 'attached' });
  await section.scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);

  if (definition === 'light') {
    const sept = page.locator('button:has-text("720 × 1280")').first();
    if (await sept.count()) { await sept.click(); await page.waitForTimeout(600); }
  }
  const duree = await page.evaluate(() => {
    const m = document.body.innerText.match(/Durée\s*(\d+):(\d+\.\d)/);
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  });

  await cdp.send('Emulation.setCPUThrottlingRate', { rate: bridage });

  const exporter = page.locator('button:has-text("⬇ Exporter la vidéo")');
  await exporter.scrollIntoViewIfNeeded();
  const attente = page.waitForEvent('download', { timeout: 1200000 });
  const depart = Date.now();
  await exporter.click();
  try {
    await attente;
    const s = (Date.now() - depart) / 1000;
    console.log(`  ×${bridage}  ${definition === 'full' ? '1080×1920' : ' 720×1280'}  film ${duree} s  →  ${s.toFixed(1)} s  (${(s / duree).toFixed(1)}× la durée)`);
  } catch (e) {
    console.log(`  ×${bridage}  ${definition}  →  ÉCHEC ${String(e).slice(0, 70)}`);
  }
  await contexte.close();
}
await navigateur.close();
