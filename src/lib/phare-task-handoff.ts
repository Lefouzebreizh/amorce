/** Bounded bridge to the existing Python scheduler. No worker starts on import.
 * Only one synthetic reference-audit step is supported by this first integration.
 */
import { createHash } from 'node:crypto';
import { compileRecipePlan } from './phare-recipes.ts';
import type { RecipePlanInput } from './phare-recipes.ts';
import { assertPlanExecutable } from './phare-orchestration.ts';

export const SCHEDULER_SOURCE_SHA256 = '70ee094adaa5a32701741ee71842cb9c391609da3b4b3b485076457db418aaa6';
export const HANDOFF_HANDLER = 'phare_synthetic_reference_audit_v1';
export type TaskHandoff = {
  format: 'phare-task-handoff'; version: 1; schedulerSourceSha256: string;
  projet: string; nom: typeof HANDOFF_HANDLER; lourd: false; delai_secondes: 5;
  payload: {
    format: 'phare-synthetic-reference-audit'; version: 1;
    task: { id: string; ownerId: string; projectId: string; idempotencyKey: string };
    recipe: { id: string; version: string };
    stepId: string; capability: 'fixtures.verify'; permissions: ['read_task'];
    sourceRefs: string[]; engine: { id: string; version: string; execution: 'deterministic_local' };
  };
};
export type SchedulerRow = {
  id: string; projet: string; type: string; payload: unknown;
  etat: 'en_attente' | 'en_cours' | 'terminee' | 'erreur' | 'annulee' | 'interrompue';
  checkpoint: unknown; resultat: unknown; erreur: unknown; date: string;
};
const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => JSON.stringify(k) + ':' + canonical(v)).join(',') + '}';
  return JSON.stringify(value);
};
function text(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$/.test(value)) throw new Error(label + ' invalide.');
}
export function handoffDigest(handoff: TaskHandoff): string {
  return createHash('sha256').update(canonical(handoff)).digest('hex');
}

/** Recompiles with current application permissions/resources. The returned value
 * is data for the local bridge, not evidence that a task was submitted or run.
 */
export function prepareTaskHandoff(recipe: unknown, input: RecipePlanInput): TaskHandoff {
  if (input.environment.allowUntestedForTrial) throw new Error('Ce raccord exige un moteur déterministe qualifié, hors mode essai.');
  const prepared = compileRecipePlan(recipe, input);
  assertPlanExecutable(input.task, prepared.plan, input.definitions);
  if (prepared.plan.mayCost || prepared.plan.estimatedCostMinor !== 0) throw new Error('Ce raccord gratuit n’accepte aucun coût payant ou inconnu.');
  if (prepared.plan.steps.length !== 1) throw new Error('Ce raccord ne prend en charge qu’une étape ; aucun graphe partiellement exécuté.');
  const step = prepared.plan.steps[0], description = prepared.preflight.recipe.steps[0];
  const selected = prepared.preflight.steps[0].selection;
  if (description.capability !== 'fixtures.verify' || description.outputKind !== 'fixture-audit' || selected.mode !== 'qualified' || selected.selected?.execution !== 'deterministic_local') throw new Error('Capacité ou moteur non pris en charge par ce handler.');
  if (step.permissions.length !== 1 || step.permissions[0] !== 'read_task') throw new Error('Le raccord refuse toute permission non prise en charge.');
  if (step.dependsOn.length || !step.inputRefs.length || step.inputRefs.length > 32) throw new Error('Références ou dépendances non prises en charge.');
  for (const [label, value] of Object.entries({ tâche: input.task.id, propriétaire: input.task.ownerId, projet: input.task.projectId, idempotence: input.task.idempotencyKey, étape: step.id })) text(value, label);
  for (const ref of step.inputRefs) text(ref, 'Référence');
  return {
    format: 'phare-task-handoff', version: 1, schedulerSourceSha256: SCHEDULER_SOURCE_SHA256,
    projet: input.task.projectId!, nom: HANDOFF_HANDLER, lourd: false, delai_secondes: 5,
    payload: {
      format: 'phare-synthetic-reference-audit', version: 1,
      task: { id: input.task.id, ownerId: input.task.ownerId, projectId: input.task.projectId!, idempotencyKey: input.task.idempotencyKey },
      recipe: { ...prepared.recipeRef }, stepId: step.id, capability: 'fixtures.verify', permissions: ['read_task'], sourceRefs: [...step.inputRefs],
      engine: { id: selected.selected.id, version: selected.selected.version, execution: 'deterministic_local' },
    },
  };
}

/** Actual liste() rows already contain decoded JSON. A scheduler's terminee is
 * only a report; physical verification is provided separately by the bridge.
 */
export function readSchedulerRow(value: unknown, expected: TaskHandoff) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('État SQLite illisible.');
  const row = value as SchedulerRow;
  const keys = ['id', 'projet', 'type', 'payload', 'etat', 'checkpoint', 'resultat', 'erreur', 'date'];
  if (Object.keys(row).length !== keys.length || Object.keys(row).some(key => !keys.includes(key)) || typeof row.id !== 'string' || !row.id || typeof row.date !== 'string' || !Number.isFinite(Date.parse(row.date))) throw new Error('Schéma SQLite incompatible.');
  if (row.projet !== expected.projet || row.type !== expected.nom || canonical(row.payload) !== canonical(expected.payload)) throw new Error('État étranger au propriétaire, au projet ou à la tâche.');
  const states = { en_attente: 'prepared', en_cours: 'running', terminee: 'needs_verification', erreur: 'failed', annulee: 'cancelled', interrompue: 'interrupted' } as const;
  if (!Object.hasOwn(states, row.etat)) throw new Error('État SQLite inconnu.');
  return { state: states[row.etat], schedulerTaskId: row.id, result: row.resultat, checkpoint: row.checkpoint, error: row.erreur };
}

/** Receipt from the trusted local bridge, not from a recipe or model. This
 * concordance check is not authentication of a remote endpoint or a signature.
 */
export function readVerifiedHandoff(value: unknown, expected: TaskHandoff) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Reçu du raccord illisible.');
  const receipt = value as { state: string; verified: boolean; signature: string; row: SchedulerRow; newTasks: number };
  const row = readSchedulerRow(receipt.row, expected);
  if (!['succeeded', 'deduplicated'].includes(receipt.state) || receipt.verified !== true || receipt.signature !== handoffDigest(expected) || row.state !== 'needs_verification' || receipt.newTasks !== (receipt.state === 'succeeded' ? 1 : 0)) throw new Error('Reçu non vérifié ou incompatible.');
  const result = row.result as { format?: unknown; version?: unknown; taskId?: unknown; ownerId?: unknown; projectId?: unknown; stepId?: unknown; sources?: unknown; networkUsed?: unknown; originalsChanged?: unknown; synthetic?: unknown };
  if (!result || result.format !== 'phare-synthetic-reference-audit-result' || result.version !== 1 || result.taskId !== expected.payload.task.id || result.ownerId !== expected.payload.task.ownerId || result.projectId !== expected.projet || result.stepId !== expected.payload.stepId || result.networkUsed !== false || result.originalsChanged !== false || result.synthetic !== true || !Array.isArray(result.sources) || result.sources.length !== expected.payload.sourceRefs.length) throw new Error('Résultat du raccord incompatible.');
  const refs = new Set<string>();
  for (const source of result.sources) {
    if (!source || typeof source !== 'object' || typeof source.ref !== 'string' || !expected.payload.sourceRefs.includes(source.ref) || refs.has(source.ref) || !/^[a-f0-9]{64}$/.test(source.sha256) || !Number.isSafeInteger(source.size) || source.size < 0 || source.size > 1048576) throw new Error('Référence de résultat invalide.');
    refs.add(source.ref);
  }
  return { state: 'completed' as const, schedulerTaskId: row.schedulerTaskId, result, reused: receipt.state === 'deduplicated' };
}
