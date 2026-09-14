#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const MANIFEST_PATH = join(ROOT, 'projects.json');
const args = parseArgs(process.argv.slice(2));
const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));

validateManifest(manifest);

if (args.help) {
  printHelp();
  process.exit(0);
}
if (args.validate) {
  console.log(`Manifeste valide : ${Object.keys(manifest.projects).length} projets, ${manifest.viewports.length} écrans.`);
  process.exit(0);
}
if (args.list) {
  for (const [id, project] of Object.entries(manifest.projects)) console.log(`${id}\t${project.label}\t${project.baseUrl ?? 'URL à confirmer'}`);
  process.exit(0);
}

const projectId = args.project ?? args.name;
if (!projectId) failUsage('Indique --project <identifiant> ou --name <nom> avec --url.');

const configured = manifest.projects[projectId];
if (!configured && !args.url) failUsage(`Projet inconnu : ${projectId}. Utilise --list pour voir les identifiants.`);

const project = configured ?? {
  label: args.name,
  directory: null,
  routes: ['/'],
  browsers: ['chromium'],
  accentSelectors: ['[data-qa-accent]'],
};
const baseUrl = stripTrailingSlash(args.url ?? project.baseUrl ?? '');
if (!baseUrl) failUsage(`Aucune URL n'est enregistrée pour ${projectId}. Ajoute --url https://…`);

const routes = args.routes?.length ? args.routes : project.routes;
const selectedViewports = args.viewports?.length
  ? manifest.viewports.filter((viewport) => args.viewports.includes(viewport.id))
  : manifest.viewports;
const browserNames = args.browsers?.length ? args.browsers : project.browsers;
if (selectedViewports.length === 0) failUsage('Aucun écran ne correspond à --viewports.');

let playwright;
try {
  playwright = await import('playwright');
} catch (error) {
  console.error(`CONTRÔLE NON EXÉCUTÉ : Playwright est absent (${firstLine(error.message)}). Lance npm install.`);
  process.exit(3);
}

let axeSource = null;
try {
  axeSource = (await import('axe-core')).default.source;
} catch {
  // Le rapport conservera explicitement cet état non exécuté.
}

const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
const artifactRoot = join(ROOT, 'artifacts', `${stamp}-${slug(projectId)}`);
await mkdir(artifactRoot, { recursive: true });

const report = {
  schemaVersion: 1,
  project: projectId,
  label: project.label,
  baseUrl,
  startedAt: new Date().toISOString(),
  thresholds: manifest.thresholds,
  axe: 'not-executed',
  runs: [],
  summary: null,
};

for (const browserName of browserNames) {
  const browserType = playwright[browserName];
  if (!browserType) {
    report.runs.push(blockedRun(browserName, `Navigateur Playwright inconnu : ${browserName}`));
    continue;
  }

  let browser;
  try {
    browser = await browserType.launch({ headless: true, ...browserLaunchOptions(browserName) });
  } catch (error) {
    report.runs.push(blockedRun(browserName, `Navigateur indisponible : ${firstLine(error.message)}`));
    continue;
  }

  for (const viewport of selectedViewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: viewport.deviceScaleFactor,
      isMobile: viewport.isMobile,
      hasTouch: viewport.hasTouch,
      locale: 'fr-FR',
      reducedMotion: 'no-preference',
    });

    for (const route of routes) {
      let run;
      try {
        run = await auditPage({
          context,
          browserName,
          viewport,
          route,
          baseUrl,
          project,
          thresholds: manifest.thresholds,
          artifactRoot,
          axeSource,
          checkLinks: browserName === browserNames[0] && viewport.id === selectedViewports[0].id,
        });
      } catch (error) {
        run = {
          browser: browserName,
          viewport,
          route,
          url: buildUrl(baseUrl, route, null),
          status: 'failed',
          axe: 'not-executed',
          issues: [{ rule: 'runner-internal', severity: 'error', message: `Le contrôle a lui-même échoué : ${firstLine(error.stack ?? error.message)}` }],
        };
      }
      report.runs.push(run);
      process.stdout.write(`${run.status === 'passed' ? '✓' : run.status === 'blocked' ? '⊘' : '✗'} ${browserName} / ${viewport.label} / ${route}\n`);
    }
    await context.close();
  }
  await browser.close();
}

report.finishedAt = new Date().toISOString();
const completedRuns = report.runs.filter((run) => run.status !== 'blocked');
report.axe = completedRuns.length === 0
  ? 'not-executed'
  : completedRuns.every((run) => run.axe === 'executed') ? 'executed' : 'not-installed';
report.summary = summarize(report.runs, report.axe);
await writeFile(join(artifactRoot, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
await writeFile(join(artifactRoot, 'report.md'), markdownReport(report));

console.log(`\n${report.summary.verdict}`);
console.log(`Preuves : ${artifactRoot}`);
console.log(`${report.summary.errors} erreur(s), ${report.summary.warnings} avertissement(s), ${report.summary.blocked} contrôle(s) bloqué(s).`);
process.exit(report.summary.errors > 0 || report.summary.blocked > 0 ? 1 : 0);

async function auditPage(options) {
  const { context, browserName, viewport, route, baseUrl, project, thresholds, artifactRoot, axeSource, checkLinks } = options;
  const page = await context.newPage();
  const issues = [];
  const network = [];
  const consoleErrors = [];
  const url = buildUrl(baseUrl, route, args.cacheBust ? stamp : null);
  let axeStatus = 'not-executed';
  const prefix = `${browserName}-${viewport.id}-${route === '/' ? 'accueil' : slug(route)}`;

  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));
  page.on('requestfailed', (request) => network.push(`requête échouée ${request.method()} ${request.url()} — ${request.failure()?.errorText ?? 'raison inconnue'}`));
  page.on('response', (response) => {
    if (response.status() >= 400) network.push(`HTTP ${response.status()} ${response.url()}`);
  });
  page.on('dialog', async (dialog) => {
    add(issues, 'unexpected-dialog', 'warning', `Dialogue inattendu fermé automatiquement : ${dialog.type()} “${dialog.message().slice(0, 120)}”.`);
    await dialog.dismiss().catch(() => undefined);
  });

  let response;
  try {
    response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: args.timeout });
    await page.waitForLoadState('networkidle', { timeout: Math.min(args.timeout, 8_000) }).catch(() => {
      add(issues, 'network-idle', 'warning', 'Le réseau ne s’est pas stabilisé dans le délai prévu.');
    });
  } catch (error) {
    add(issues, 'navigation', 'error', `Page inaccessible : ${firstLine(error.message)}`);
  }

  if (response && response.status() >= 400) add(issues, 'document-http', 'error', `La page répond HTTP ${response.status()}.`);
  if (consoleErrors.length) add(issues, 'console', 'error', unique(consoleErrors).join(' | '));
  if (network.length) add(issues, 'network', 'error', unique(network).join(' | '));

  let measurements = null;
  if (!issues.some((issue) => issue.rule === 'navigation')) {
    measurements = await page.evaluate(inspectDom, {
      thresholds,
      accentSelectors: project.accentSelectors ?? [],
    });
    for (const issue of measurements.issues) issues.push(issue);

    const focus = await inspectFocus(page);
    for (const issue of focus) issues.push(issue);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForTimeout(150);
    const moving = await page.evaluate(() => document.getAnimations()
      .filter((animation) => animation.playState === 'running')
      .map((animation) => ({
        name: animation.animationName || '(sans nom)',
        duration: Number(animation.effect?.getTiming().duration ?? 0),
      }))
      .filter((animation) => animation.duration > 200));
    if (moving.length) add(issues, 'reduced-motion', 'error', `${moving.length} animation(s) longue(s) restent actives avec “réduire les animations”.`, moving.slice(0, 8));

    if (axeSource) {
      try {
        await page.addScriptTag({ content: axeSource });
        const axe = await page.evaluate(async () => window.axe.run(document, {
          runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
        }));
        for (const violation of axe.violations) {
          add(issues, `axe:${violation.id}`, violation.impact === 'minor' ? 'warning' : 'error', `${violation.help} — ${violation.nodes.length} élément(s).`, violation.nodes.slice(0, 5).map((node) => node.target.join(' ')));
        }
        axeStatus = 'executed';
      } catch (error) {
        add(issues, 'axe', 'error', `Axe était disponible mais son audit n’a pas pu s’exécuter : ${firstLine(error.message)}`);
      }
    } else {
      add(issues, 'axe', 'warning', 'Axe n’est pas installé : l’audit WCAG automatisé n’a pas été exécuté.');
      axeStatus = 'not-installed';
    }

    if (checkLinks) {
      const links = await page.evaluate(() => [...document.querySelectorAll('a[href]')]
        .filter((link) => link.getClientRects().length > 0)
        .map((link) => {
          const raw = link.getAttribute('href');
          const hashTargetExists = raw?.startsWith('#') && raw.length > 1
            ? document.getElementById(decodeURIComponent(raw.slice(1))) !== null
            : null;
          return { href: link.href, raw, text: link.textContent?.trim().slice(0, 80) ?? '', hashTargetExists };
        }));
      const linkIssues = await inspectLinks(context, links, new URL(baseUrl).origin, thresholds.maximumLinksPerPage);
      for (const issue of linkIssues) issues.push(issue);
    }
  }

  const screenshot = join(artifactRoot, `${prefix}.png`);
  await page.screenshot({ path: screenshot, fullPage: true, animations: 'disabled' }).catch((error) => {
    add(issues, 'screenshot', 'error', `Capture impossible : ${firstLine(error.message)}`);
  });

  await page.close();
  const errors = issues.filter((issue) => issue.severity === 'error').length;
  return {
    browser: browserName,
    viewport,
    route,
    url,
    status: errors ? 'failed' : 'passed',
    screenshot: screenshot.slice(artifactRoot.length + 1),
    measurements,
    axe: axeStatus,
    issues,
  };
}

function inspectDom({ thresholds, accentSelectors }) {
  const issues = [];
  const visible = (element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0 && rect.width > 0 && rect.height > 0 && !element.closest('[aria-hidden="true"]');
  };
  const colorContext = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  const parseColor = (color) => {
    colorContext.clearRect(0, 0, 1, 1);
    colorContext.fillStyle = '#000';
    colorContext.fillStyle = color;
    colorContext.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = colorContext.getImageData(0, 0, 1, 1).data;
    return [r, g, b, a / 255];
  };
  const over = (top, bottom) => {
    const alpha = top[3] + bottom[3] * (1 - top[3]);
    if (alpha === 0) return [255, 255, 255, 1];
    return [
      (top[0] * top[3] + bottom[0] * bottom[3] * (1 - top[3])) / alpha,
      (top[1] * top[3] + bottom[1] * bottom[3] * (1 - top[3])) / alpha,
      (top[2] * top[3] + bottom[2] * bottom[3] * (1 - top[3])) / alpha,
      alpha,
    ];
  };
  const background = (element, includeSelf = true) => {
    const layers = [];
    for (let node = includeSelf ? element : element.parentElement; node; node = node.parentElement) {
      layers.push(parseColor(getComputedStyle(node).backgroundColor));
    }
    let result = [255, 255, 255, 1];
    for (const layer of layers.reverse()) result = over(layer, result);
    return result;
  };
  const luminance = (color) => {
    const [r, g, b] = color.slice(0, 3).map((channel) => channel / 255).map((channel) =>
      channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (first, second) => {
    const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
    return (values[0] + 0.05) / (values[1] + 0.05);
  };
  const describe = (element) => {
    const id = element.id ? `#${element.id}` : '';
    const cls = typeof element.className === 'string' && element.className.trim() ? `.${element.className.trim().split(/\s+/).slice(0, 2).join('.')}` : '';
    const text = (element.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 60);
    return `${element.tagName.toLowerCase()}${id}${cls}${text ? ` “${text}”` : ''}`;
  };
  const push = (rule, severity, message, evidence) => issues.push({ rule, severity, message, evidence });

  const bodyText = document.body?.innerText.trim() ?? '';
  if (!bodyText) push('blank-page', 'error', 'La page ne contient aucun texte visible.');
  if (document.querySelector('[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay')) push('error-overlay', 'error', 'Une surcouche d’erreur du framework est visible.');

  const overflow = Math.max(0, document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > thresholds.maximumOverflowPx) {
    const offenders = [...document.querySelectorAll('body *')].filter(visible).filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.right > window.innerWidth + thresholds.maximumOverflowPx || rect.left < -thresholds.maximumOverflowPx;
    }).slice(0, 10).map(describe);
    push('horizontal-overflow', 'error', `La page déborde horizontalement de ${overflow}px.`, offenders);
  }

  const tinyTargets = [...document.querySelectorAll('a[href], button, input:not([type="hidden"]), select, textarea, [role="button"], [role="link"]')]
    .filter(visible)
    .map((element) => ({ element, rect: element.getBoundingClientRect() }))
    .filter(({ rect }) => rect.width < thresholds.minimumTargetPx || rect.height < thresholds.minimumTargetPx)
    .slice(0, 30)
    .map(({ element, rect }) => `${Math.round(rect.width)}×${Math.round(rect.height)} — ${describe(element)}`);
  if (tinyTargets.length) push('target-size', 'error', `${tinyTargets.length} cible(s) sous ${thresholds.minimumTargetPx}px dans l’échantillon.`, tinyTargets);

  const textElements = [...document.querySelectorAll('body *')].filter(visible).filter((element) =>
    [...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim()));
  const tinyText = textElements.filter((element) => parseFloat(getComputedStyle(element).fontSize) < thresholds.minimumBodyTextPx)
    .slice(0, 30)
    .map((element) => `${getComputedStyle(element).fontSize} — ${describe(element)}`);
  if (tinyText.length) push('font-size', 'error', `${tinyText.length} texte(s) sous ${thresholds.minimumBodyTextPx}px dans l’échantillon.`, tinyText);

  const lowContrast = [];
  const unmeasuredContrast = [];
  for (const element of textElements) {
    const style = getComputedStyle(element);
    let imageBehind = style.backgroundImage !== 'none';
    for (let parent = element.parentElement; parent && !imageBehind; parent = parent.parentElement) {
      imageBehind = getComputedStyle(parent).backgroundImage !== 'none';
    }
    if (imageBehind) {
      unmeasuredContrast.push(describe(element));
      continue;
    }
    const backdrop = background(element);
    const foreground = over(parseColor(style.color), backdrop);
    const ratio = contrast(foreground, backdrop);
    const size = parseFloat(style.fontSize);
    const large = size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700);
    const minimum = large ? thresholds.contrastLarge : thresholds.contrastNormal;
    if (ratio < minimum) lowContrast.push(`${ratio.toFixed(2)}:1 (min ${minimum}) — ${describe(element)}`);
  }
  if (lowContrast.length) push('text-contrast', 'error', `${lowContrast.length} texte(s) sous le contraste minimal.`, lowContrast.slice(0, 30));
  if (unmeasuredContrast.length) push('text-contrast-unmeasured', 'warning', `${unmeasuredContrast.length} texte(s) sur image ou dégradé demandent une vérification visuelle.`, unmeasuredContrast.slice(0, 15));

  const missingAlt = [...document.querySelectorAll('img:not([alt]), [role="img"]:not([aria-label]):not([aria-labelledby])')].filter(visible).slice(0, 30).map(describe);
  if (missingAlt.length) push('image-alt', 'error', `${missingAlt.length} image(s) sans alternative.`, missingAlt);

  const controls = [...document.querySelectorAll('input:not([type="hidden"]), select, textarea')].filter(visible);
  const unlabeled = controls.filter((control) => {
    const explicit = control.id && document.querySelector(`label[for="${CSS.escape(control.id)}"]`);
    return !explicit && !control.closest('label') && !control.getAttribute('aria-label') && !control.getAttribute('aria-labelledby');
  }).slice(0, 30).map(describe);
  if (unlabeled.length) push('form-label', 'error', `${unlabeled.length} champ(s) sans libellé associé.`, unlabeled);

  const headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(visible);
  if (!headings.some((heading) => heading.tagName === 'H1')) push('headings', 'error', 'Aucun titre h1 visible.');
  const jumps = [];
  let previous = 0;
  for (const heading of headings) {
    const level = Number(heading.tagName.slice(1));
    if (previous && level > previous + 1) jumps.push(`${heading.tagName.toLowerCase()} après h${previous} — ${describe(heading)}`);
    previous = level;
  }
  if (jumps.length) push('headings', 'error', 'La hiérarchie des titres saute un niveau.', jumps);

  const emptyLinks = [...document.querySelectorAll('a[href]')].filter(visible).filter((link) => !(link.textContent ?? '').trim() && !link.getAttribute('aria-label') && !link.querySelector('img[alt]')).slice(0, 20).map(describe);
  if (emptyLinks.length) push('link-name', 'error', `${emptyLinks.length} lien(s) sans nom accessible.`, emptyLinks);

  const autoplay = [...document.querySelectorAll('audio[autoplay], video[autoplay]')].filter(visible).map(describe);
  if (autoplay.length) push('autoplay', 'error', 'Lecture automatique interdite par la charte.', autoplay);

  if (location.protocol === 'https:') {
    const mixed = performance.getEntriesByType('resource').map((entry) => entry.name).filter((url) => url.startsWith('http://'));
    if (mixed.length) push('mixed-content', 'error', `${mixed.length} ressource(s) non HTTPS sur une page HTTPS.`, mixed.slice(0, 20));
  }

  const viewportHeight = getComputedStyle(document.documentElement).getPropertyValue('--qa-unused');
  void viewportHeight;
  const forbidden100vh = [...document.styleSheets].flatMap((sheet) => {
    try { return [...sheet.cssRules].map((rule) => rule.cssText).filter((text) => /(^|[^d])100vh\b/.test(text)); } catch { return []; }
  }).slice(0, 10);
  if (forbidden100vh.length) push('viewport-unit', 'warning', 'Des règles 100vh ont été trouvées ; la charte demande 100dvh sur mobile.', forbidden100vh);

  const accents = accentSelectors.flatMap((selector) => {
    try { return [...document.querySelectorAll(selector)]; } catch { return []; }
  }).filter(visible);
  if (accents.length === 0) push('accent-contrast', 'warning', 'Aucun élément d’accent marqué n’a été trouvé ; le seuil maison de 7:1 n’a pas pu être mesuré. Ajoute data-qa-accent aux actions principales.');
  const weakAccents = accents.map((element) => {
    const style = getComputedStyle(element);
    const accent = parseColor(style.backgroundColor)[3] > 0 ? over(parseColor(style.backgroundColor), background(element, false)) : over(parseColor(style.color), background(element, false));
    const ratio = contrast(accent, background(element, false));
    return { element, ratio };
  }).filter(({ ratio }) => ratio < thresholds.accentContrast)
    .slice(0, 20)
    .map(({ element, ratio }) => `${ratio.toFixed(2)}:1 (min ${thresholds.accentContrast}) — ${describe(element)}`);
  if (weakAccents.length) push('accent-contrast', 'error', `${weakAccents.length} accent(s) sous le seuil maison.`, weakAccents);

  return {
    issues,
    title: document.title,
    bodyCharacters: bodyText.length,
    links: document.querySelectorAll('a[href]').length,
    headings: headings.map((heading) => ({ level: Number(heading.tagName.slice(1)), text: heading.textContent.trim().slice(0, 100) })),
    overflowPx: overflow,
    accentCandidates: accents.length,
  };
}

async function inspectFocus(page) {
  const issues = [];
  const count = await page.locator('a[href], button, input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])').count();
  if (count === 0) return [{ rule: 'keyboard-focus', severity: 'warning', message: 'Aucun élément interactif à tester au clavier.' }];
  await page.evaluate(() => document.activeElement?.blur?.()).catch(() => undefined);
  const missing = [];
  const seen = new Set();
  for (let index = 0; index < Math.min(count, 20); index += 1) {
    await page.keyboard.press('Tab');
    const state = await page.evaluate(() => {
      const element = document.activeElement;
      if (!element || element === document.body) return { key: 'body', visible: false, label: 'body' };
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const key = `${element.tagName}#${element.id}.${element.className}`;
      const visible = (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0)
        || style.boxShadow !== 'none'
        || style.textDecorationLine.includes('underline');
      return { key, visible, label: `${element.tagName.toLowerCase()} “${(element.textContent ?? element.getAttribute('aria-label') ?? '').trim().slice(0, 50)}”`, rect: { x: rect.x, y: rect.y } };
    });
    if (seen.has(state.key)) break;
    seen.add(state.key);
    if (!state.visible) missing.push(state.label);
  }
  if (seen.size === 0 || seen.has('body')) issues.push({ rule: 'keyboard-focus', severity: 'error', message: 'Tab ne déplace pas le focus vers un contrôle.' });
  if (missing.length) issues.push({ rule: 'focus-visible', severity: 'error', message: `${missing.length} contrôle(s) sans focus visible dans l’échantillon.`, evidence: missing });
  return issues;
}

async function inspectLinks(context, links, origin, maximum) {
  const issues = [];
  const uniqueLinks = [...new Map(links.map((link) => [link.href, link])).values()].slice(0, maximum);
  for (const link of uniqueLinks) {
    if (!link.raw || link.raw === '#' || /^javascript:/i.test(link.raw)) {
      issues.push({ rule: 'link-destination', severity: 'error', message: `Lien sans destination réelle : “${link.text || link.raw}”.`, evidence: link.raw });
      continue;
    }
    if (link.raw.startsWith('#')) {
      if (!link.hashTargetExists) issues.push({ rule: 'link-anchor', severity: 'error', message: `Ancre introuvable : ${link.raw} (“${link.text}”).` });
      continue;
    }
    if (/^(mailto|tel|sms):/i.test(link.href)) continue;
    let parsed;
    try { parsed = new URL(link.href); } catch { continue; }
    if (!/^https?:$/.test(parsed.protocol)) continue;
    if (/(logout|log-out|signout|sign-out|delete|remove|unsubscribe|deconnexion|déconnexion|supprimer|desabonner|désabonner)/i.test(parsed.pathname)) {
      issues.push({ rule: 'link-skipped-safety', severity: 'warning', message: `Lien non sondé par sécurité : ${parsed.href}` });
      continue;
    }
    try {
      const response = await context.request.get(parsed.href, { timeout: 10_000, maxRedirects: 5, failOnStatusCode: false });
      if (response.status() >= 400) issues.push({
        rule: 'link-http',
        severity: parsed.origin === origin ? 'error' : 'warning',
        message: `Le lien ${parsed.href} répond HTTP ${response.status()}.`,
      });
    } catch (error) {
      issues.push({
        rule: 'link-network',
        severity: parsed.origin === origin ? 'error' : 'warning',
        message: `Lien injoignable : ${parsed.href} — ${firstLine(error.message)}`,
      });
    }
  }
  if (links.length > maximum) issues.push({ rule: 'link-limit', severity: 'warning', message: `${links.length - maximum} lien(s) non sondé(s), plafond de ${maximum} atteint.` });
  return issues;
}

function parseArgs(values) {
  const parsed = { timeout: 30_000, cacheBust: false };
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === '--help' || value === '-h') parsed.help = true;
    else if (value === '--validate') parsed.validate = true;
    else if (value === '--list') parsed.list = true;
    else if (value === '--cache-bust') parsed.cacheBust = true;
    else if (value === '--project') parsed.project = values[++index];
    else if (value === '--name') parsed.name = values[++index];
    else if (value === '--url') parsed.url = values[++index];
    else if (value === '--routes') parsed.routes = values[++index]?.split(',').map(normalizeRoute);
    else if (value === '--viewports') parsed.viewports = values[++index]?.split(',');
    else if (value === '--browsers') parsed.browsers = values[++index]?.split(',');
    else if (value === '--timeout') parsed.timeout = Number(values[++index]);
    else failUsage(`Option inconnue : ${value}`);
  }
  return parsed;
}

function validateManifest(value) {
  if (value.version !== 1) throw new Error('Version de manifeste non prise en charge.');
  if (!value.thresholds || !value.projects || !Array.isArray(value.viewports)) throw new Error('Manifeste incomplet.');
  for (const key of ['minimumBodyTextPx', 'minimumTargetPx', 'contrastNormal', 'contrastLarge', 'accentContrast', 'maximumOverflowPx']) {
    if (!Number.isFinite(value.thresholds[key])) throw new Error(`Seuil invalide : ${key}`);
  }
  const ids = new Set();
  for (const viewport of value.viewports) {
    if (!viewport.id || ids.has(viewport.id) || viewport.width <= 0 || viewport.height <= 0) throw new Error(`Écran invalide : ${viewport.id ?? '(sans nom)'}`);
    ids.add(viewport.id);
  }
  for (const [id, project] of Object.entries(value.projects)) {
    if (!project.label || !Array.isArray(project.routes) || project.routes.some((route) => !route.startsWith('/'))) throw new Error(`Projet invalide : ${id}`);
  }
}

function summarize(runs, axe) {
  const issues = runs.flatMap((run) => run.issues ?? []);
  const errors = issues.filter((issue) => issue.severity === 'error').length;
  const warnings = issues.filter((issue) => issue.severity === 'warning').length;
  const blocked = runs.filter((run) => run.status === 'blocked').length;
  return {
    errors,
    warnings,
    blocked,
    verdict: errors || blocked ? 'À CORRIGER AVANT LANCEMENT' : axe !== 'executed' ? 'CONFORME SUR LES CONTRÔLES EXÉCUTÉS — AXE NON EXÉCUTÉ' : 'PRÊT POUR LA REVUE HUMAINE FINALE',
  };
}

function markdownReport(value) {
  const lines = [
    `# Sas de sortie — ${value.label}`,
    '',
    `**Verdict : ${value.summary.verdict}**`,
    '',
    `URL vérifiée : ${value.baseUrl}`,
    '',
    `Axe : ${value.axe === 'executed' ? 'exécuté' : 'non exécuté'}`,
    '',
    `Bilan : ${value.summary.errors} erreur(s), ${value.summary.warnings} avertissement(s), ${value.summary.blocked} contrôle(s) bloqué(s).`,
    '',
    '## Parcours',
    '',
  ];
  for (const run of value.runs) {
    lines.push(`### ${run.browser} — ${run.viewport?.label ?? 'écran inconnu'} — ${run.route ?? '/'}`, '', `État : **${run.status}**`, '');
    if (run.screenshot) lines.push(`Preuve : [${run.screenshot}](${run.screenshot})`, '');
    if (!run.issues?.length) lines.push('- ✅ Aucun défaut automatisé détecté.', '');
    for (const issue of run.issues ?? []) {
      lines.push(`- ${issue.severity === 'error' ? '❌' : '⚠️'} **${issue.rule}** — ${issue.message}`);
      for (const evidence of Array.isArray(issue.evidence) ? issue.evidence : issue.evidence ? [issue.evidence] : []) lines.push(`  - ${String(evidence)}`);
    }
    lines.push('');
  }
  lines.push('## Limite importante', '', 'Ce sas automatise des mesures et fournit les captures. Il ne remplace pas la revue humaine complète exigée par `CLAUDE.md` : chaque capture et chaque parcours métier doivent encore être regardés avant de déclarer le produit prêt.', '');
  return `${lines.join('\n')}\n`;
}

function blockedRun(browser, message) {
  return { browser, viewport: null, route: null, status: 'blocked', issues: [{ rule: 'browser', severity: 'error', message }] };
}
function browserLaunchOptions(browserName) {
  if (browserName !== 'chromium') return {};
  const explicit = process.env.QA_CHROMIUM || process.env.CHROMIUM || process.env.AMORCE_CHROMIUM;
  if (explicit && existsSync(explicit)) return { executablePath: explicit };
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  if (!existsSync(root)) return {};
  for (const directory of readdirSync(root).filter((name) => name.startsWith('chromium'))) {
    for (const relative of ['chrome-linux/headless_shell', 'chrome-linux/chrome', 'chrome-linux64/chrome', 'chrome-headless-shell-linux64/chrome-headless-shell']) {
      const candidate = join(root, directory, relative);
      if (existsSync(candidate)) return { executablePath: candidate };
    }
  }
  return {};
}
function add(issues, rule, severity, message, evidence) { issues.push({ rule, severity, message, ...(evidence ? { evidence } : {}) }); }
function stripTrailingSlash(value) { return value.replace(/\/$/, ''); }
function normalizeRoute(value) { return value.startsWith('/') ? value : `/${value}`; }
function buildUrl(base, route, cacheBust) {
  const url = new URL(normalizeRoute(route), `${base}/`);
  if (cacheBust) url.searchParams.set('qa', cacheBust);
  return url.href;
}
function unique(values) { return [...new Set(values)]; }
function slug(value) { return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'page'; }
function firstLine(value) { return String(value).split('\n')[0]; }
function failUsage(message) { console.error(`${message}\nUtilise --help pour voir les exemples.`); process.exit(2); }
function printHelp() {
  console.log(`Sas de sortie Lefouzèbreizh

Usage :
  npm run qa -- --project artisan-express --url http://localhost:3000
  npm run qa -- --name mon-site --url https://exemple.fr --routes /,/contact

Options :
  --project ID          projet du manifeste
  --name NOM            audit ponctuel hors manifeste
  --url URL             adresse exacte à vérifier
  --routes /,/contact   routes séparées par des virgules
  --viewports ID,ID     sous-ensemble des quatre écrans
  --browsers chromium,webkit
  --cache-bust          ajoute ?qa=… pour éviter un cache de production
  --timeout MS          délai de navigation (30000 par défaut)
  --list                liste les projets
  --validate            valide le manifeste sans navigateur`);
}
