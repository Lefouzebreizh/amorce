/**
 * Capability routing only. This registry neither installs nor starts a model.
 * Qualification evidence is supplied by the integration which measured it;
 * selecting an entry is not proof that the complete product is production ready.
 */
export type EngineManifest = {
  schemaVersion: 1;
  id: string;
  version: string;
  capabilities: string[];
  execution: 'deterministic_local' | 'local_model' | 'provider_api';
  installed: boolean;
  available: boolean;
  qualification: {
    status: 'tested' | 'untested';
    testedAt?: string;
    evidence?: string;
  };
  /** Requirements include runtime and selected context, not just model weights. */
  minimumRamMiB: number | null;
  /** Explicit zero declares a CPU route; null means not measured. */
  minimumVramMiB: number | null;
  /** Informational; never used as a proxy for quality or execution memory. */
  modelSizeMiB: number | null;
  locales: string[];
};

export type EngineResources = {
  availableRamMiB: number | null;
  availableVramMiB: number | null;
  ramReserveMiB: number;
  vramReserveMiB: number;
};

export type EngineRequest = {
  capability: string;
  locale: string;
  localOnly: boolean;
  /** Explicitly enables an unqualified experiment, never normal use. */
  allowUntestedForTrial?: boolean;
  /** Order is intentional. Unknown IDs do not trigger installation. */
  preferredEngineIds?: string[];
};

export type EngineRejectionCode =
  | 'capability_missing'
  | 'locale_unsupported'
  | 'not_installed'
  | 'not_available'
  | 'not_qualified'
  | 'remote_forbidden'
  | 'ram_requirement_unknown'
  | 'vram_requirement_unknown'
  | 'ram_available_unknown'
  | 'vram_available_unknown'
  | 'ram_insufficient'
  | 'vram_insufficient';

export type EngineSelection = {
  selected: EngineManifest | null;
  mode: 'qualified' | 'trial' | 'unavailable';
  rejections: { engineId: string; codes: EngineRejectionCode[]; reasons: string[] }[];
  eligibleEngineIds: string[];
};

const EXECUTIONS = ['deterministic_local', 'local_model', 'provider_api'] as const;
const LOCALE = /^(?:\*|[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*)$/;

function text(value: unknown, label: string, max = 200): asserts value is string {
  if (typeof value !== 'string' || !value.trim() || value.trim() !== value || value.length > max) {
    throw new Error(`${label} invalide.`);
  }
}

function memory(value: unknown, label: string, nullable: boolean): void {
  if (nullable && value === null) return;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} doit être un entier positif ou nul${nullable ? ', ou inconnu (null)' : ''}.`);
  }
}

function strings(value: unknown, label: string, max = 100): asserts value is string[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > max) throw new Error(`${label} invalide.`);
  const seen = new Set<string>();
  for (const entry of value) {
    text(entry, label);
    if (seen.has(entry)) throw new Error(`${label} contient un doublon.`);
    seen.add(entry);
  }
}

export function validateEngineRegistry(engines: readonly EngineManifest[]): void {
  if (!Array.isArray(engines) || engines.length > 200) throw new Error('Registre de moteurs invalide.');
  const ids = new Set<string>();
  for (const engine of engines) {
    if (!engine || typeof engine !== 'object' || engine.schemaVersion !== 1) throw new Error('Version de manifeste inconnue.');
    text(engine.id, 'Identifiant moteur', 100);
    text(engine.version, 'Version moteur', 100);
    if (ids.has(engine.id)) throw new Error('Identifiant moteur dupliqué.');
    ids.add(engine.id);
    strings(engine.capabilities, 'Capacités');
    if (!EXECUTIONS.includes(engine.execution)) throw new Error('Mode d’exécution moteur invalide.');
    if (typeof engine.installed !== 'boolean' || typeof engine.available !== 'boolean') throw new Error('Disponibilité moteur invalide.');
    memory(engine.minimumRamMiB, 'RAM requise', true);
    memory(engine.minimumVramMiB, 'VRAM requise', true);
    memory(engine.modelSizeMiB, 'Taille du modèle', true);
    strings(engine.locales, 'Langues');
    if (engine.locales.some((locale: string) => !LOCALE.test(locale))) throw new Error('Langue moteur invalide.');
    const q = engine.qualification;
    if (!q || !['tested', 'untested'].includes(q.status)) throw new Error('Qualification moteur invalide.');
    if (q.testedAt !== undefined && (typeof q.testedAt !== 'string' || !Number.isFinite(Date.parse(q.testedAt)))) {
      throw new Error('Date de qualification invalide.');
    }
    if (q.evidence !== undefined) text(q.evidence, 'Preuve de qualification', 2000);
    if (q.status === 'tested' && (!q.testedAt || !q.evidence)) throw new Error('Un moteur testé doit conserver sa date et sa preuve de qualification.');
  }
}

function acceptsLocale(locales: string[], requested: string): boolean {
  const locale = requested.toLowerCase();
  return locales.some(supported => {
    const candidate = supported.toLowerCase();
    return candidate === '*' || candidate === locale || locale.startsWith(`${candidate}-`);
  });
}

/**
 * Returns reasons rather than secretly downloading, upgrading or using a service.
 * The caller must revalidate live resources before execution and honour permissions
 * and cost approval separately; compatibility does not grant those permissions.
 */
export function selectEngine(
  request: EngineRequest,
  engines: readonly EngineManifest[],
  resources: EngineResources,
): EngineSelection {
  validateEngineRegistry(engines);
  if (!request || typeof request !== 'object') throw new Error('Demande moteur invalide.');
  text(request.capability, 'Capacité demandée');
  text(request.locale, 'Langue demandée');
  if (!LOCALE.test(request.locale) || request.locale === '*') throw new Error('Langue demandée invalide.');
  if (typeof request.localOnly !== 'boolean') throw new Error('Mode local requis.');
  if (request.allowUntestedForTrial !== undefined && typeof request.allowUntestedForTrial !== 'boolean') throw new Error('Mode essai invalide.');
  if (request.preferredEngineIds !== undefined && !Array.isArray(request.preferredEngineIds)) throw new Error('Préférences moteur invalides.');
  if (request.preferredEngineIds !== undefined && request.preferredEngineIds.length) strings(request.preferredEngineIds, 'Préférences moteur', 200);
  if (!resources || typeof resources !== 'object') throw new Error('Ressources machine invalides.');
  memory(resources.availableRamMiB, 'RAM disponible', true);
  memory(resources.availableVramMiB, 'VRAM disponible', true);
  memory(resources.ramReserveMiB, 'Réserve RAM', false);
  memory(resources.vramReserveMiB, 'Réserve VRAM', false);

  const eligible: EngineManifest[] = [];
  const rejections: EngineSelection['rejections'] = [];
  for (const engine of engines) {
    const codes: EngineRejectionCode[] = [];
    const reasons: string[] = [];
    const reject = (code: EngineRejectionCode, reason: string) => { codes.push(code); reasons.push(reason); };
    if (!engine.capabilities.includes(request.capability)) reject('capability_missing', 'La capacité demandée n’est pas déclarée par ce moteur.');
    if (!acceptsLocale(engine.locales, request.locale)) reject('locale_unsupported', 'La langue demandée n’est pas déclarée par ce moteur.');
    if (!engine.installed) reject('not_installed', 'Moteur ou adaptateur non installé ; aucun téléchargement lancé.');
    if (!engine.available) reject('not_available', 'Le moteur n’est pas disponible actuellement.');
    if (engine.qualification.status === 'untested' && !request.allowUntestedForTrial) reject('not_qualified', 'Moteur non qualifié ; un essai explicite est nécessaire.');
    if (request.localOnly && engine.execution === 'provider_api') reject('remote_forbidden', 'Le mode local interdit ce fournisseur distant.');

    if (engine.execution !== 'provider_api') {
      const check = (kind: 'ram' | 'vram', required: number | null, available: number | null, reserve: number) => {
        const label = kind === 'ram' ? 'RAM' : 'VRAM';
        if (required === null) reject(`${kind}_requirement_unknown`, `Besoin ${label} non mesuré pour cette configuration.`);
        else if (required > 0) {
          if (available === null) reject(`${kind}_available_unknown`, `${label} disponible inconnue.`);
          else if (required > Math.max(0, available - reserve)) reject(`${kind}_insufficient`, `${label} disponible insuffisante après réserve.`);
        }
      };
      check('ram', engine.minimumRamMiB, resources.availableRamMiB, resources.ramReserveMiB);
      check('vram', engine.minimumVramMiB, resources.availableVramMiB, resources.vramReserveMiB);
    }
    if (codes.length) rejections.push({ engineId: engine.id, codes, reasons });
    else eligible.push(engine);
  }

  const preferred = request.preferredEngineIds || [];
  const preference = (id: string) => { const i = preferred.indexOf(id); return i < 0 ? preferred.length : i; };
  const executionRank = (engine: EngineManifest) => EXECUTIONS.indexOf(engine.execution);
  const compareId = (a: string, b: string) => a === b ? 0 : a < b ? -1 : 1;
  eligible.sort((a, b) =>
    preference(a.id) - preference(b.id) ||
    Number(a.qualification.status === 'untested') - Number(b.qualification.status === 'untested') ||
    executionRank(a) - executionRank(b) || compareId(a.id, b.id));
  const selected = eligible[0] || null;
  return {
    selected,
    mode: selected ? selected.qualification.status === 'tested' ? 'qualified' : 'trial' : 'unavailable',
    rejections,
    eligibleEngineIds: eligible.map(engine => engine.id),
  };
}
