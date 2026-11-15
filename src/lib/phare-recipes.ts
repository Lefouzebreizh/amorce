/** Portable methods only: importing, inspecting or exporting a recipe never runs it.
 * No project, memory, credential, engine ID or permission fields are accepted.
 * Caller-selected source references are bound during preparation, outside the pack.
 * Free-text titles/authors/instructions still need review before sharing: this
 * structural validator is not an anonymiser or a malicious-prompt detector.
 */
import { selectEngine } from './phare-engine-registry.ts';
import type { EngineManifest, EngineResources, EngineSelection } from './phare-engine-registry.ts';
import { validateOrchestrationPlan } from './phare-orchestration.ts';
import type { AgentDefinition, AgentPermission, OrchestrationPlan, PhareTask } from './phare-orchestration.ts';

export const RECIPE_LIMITS = { bytes: 64 * 1024, inputs: 20, steps: 12, instructions: 2000, refs: 100 } as const;
export type RecipeInput = { id: string; title: string; type: 'source_ref'; required: boolean };
export type RecipeStep = {
  id: string; capability: string; dependsOn: string[]; inputIds: string[];
  instructions: string; outputKind: string;
};
export type PhareRecipe = {
  format: 'le-phare-recipe'; version: 1;
  manifest: { id: string; title: string; version: string; author: string; license: string };
  inputs: RecipeInput[]; steps: RecipeStep[];
};
export type RecipeBindings = Readonly<Record<string, readonly string[]>>;
export type RecipeEnvironment = {
  allowedCapabilities: readonly string[]; engines: readonly EngineManifest[];
  resources: EngineResources; locale: string; localOnly: boolean;
  allowUntestedForTrial?: boolean;
};
export type RecipePreflightInput = RecipeEnvironment & {
  sourceRefs: readonly string[]; bindings: RecipeBindings;
};
export type RecipePreflight = {
  recipe: PhareRecipe;
  /** Compatibility for a plan, never authorisation or proof of an executed result. */
  state: 'qualified' | 'trial' | 'blocked';
  steps: { id: string; capability: string; inputRefs: string[]; selection: EngineSelection }[];
  blockedStepIds: string[];
};

function invalid(message = 'Recette invalide. Aucun parcours activé.'): never { throw new Error(message); }
function record(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return invalid();
  const actual = Object.keys(value);
  if (actual.length !== keys.length || actual.some(key => !keys.includes(key))) return invalid('Champ de recette inconnu ou manquant. Aucun code, moteur ou droit ne peut être importé.');
  return value as Record<string, unknown>;
}
function text(value: unknown, max: number): string {
  if (typeof value !== 'string' || !value.trim() || value.trim() !== value || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) return invalid();
  return value;
}
function identifier(value: unknown): string {
  const result = text(value, 100);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(result) || ['__proto__', 'prototype', 'constructor'].includes(result)) return invalid('Identifiant de recette invalide.');
  return result;
}
function identifiers(value: unknown, maximum: number): string[] {
  if (!Array.isArray(value) || value.length > maximum) return invalid();
  const result = value.map(identifier);
  if (new Set(result).size !== result.length) return invalid('Identifiant répété dans la recette.');
  return result;
}

/** Strict declarative schema. Text instructions are inert data, never eval/commands.
 * Author and licence are declarations, not authentication or legal qualification.
 */
export function validateRecipe(value: unknown, allowedCapabilities: readonly string[]): PhareRecipe {
  const root = record(value, ['format', 'version', 'manifest', 'inputs', 'steps']);
  if (root.format !== 'le-phare-recipe' || root.version !== 1) return invalid('Format ou version de recette non pris en charge.');
  if (!Array.isArray(allowedCapabilities) || allowedCapabilities.length > 200 || allowedCapabilities.some(capability => typeof capability !== 'string')) return invalid('Catalogue de capacités invalide.');
  const m = record(root.manifest, ['id', 'title', 'version', 'author', 'license']);
  const revision = text(m.version, 40);
  if (!/^\d{1,5}\.\d{1,5}\.\d{1,5}$/.test(revision)) return invalid('Version de méthode invalide.');
  const manifest = { id: identifier(m.id), title: text(m.title, 200), version: revision, author: text(m.author, 200), license: text(m.license, 200) };
  if (!Array.isArray(root.inputs) || !root.inputs.length || root.inputs.length > RECIPE_LIMITS.inputs) return invalid('Nombre de paramètres de recette invalide.');
  const inputIds = new Set<string>();
  const inputs = root.inputs.map(raw => {
    const input = record(raw, ['id', 'title', 'type', 'required']), id = identifier(input.id);
    if (inputIds.has(id) || input.type !== 'source_ref' || typeof input.required !== 'boolean') return invalid('Paramètre de recette invalide : seules les références sont admises.');
    inputIds.add(id);
    return { id, title: text(input.title, 200), type: 'source_ref' as const, required: input.required };
  });
  if (!Array.isArray(root.steps) || !root.steps.length || root.steps.length > RECIPE_LIMITS.steps) return invalid('Une recette doit comporter de 1 à 12 étapes.');
  const stepIds = new Set<string>();
  const steps = root.steps.map(raw => {
    const step = record(raw, ['id', 'capability', 'dependsOn', 'inputIds', 'instructions', 'outputKind']);
    const id = identifier(step.id), capability = identifier(step.capability);
    if (stepIds.has(id)) return invalid('Identifiant d’étape dupliqué.');
    stepIds.add(id);
    if (!allowedCapabilities.includes(capability)) return invalid('La recette demande une capacité non autorisée par cette application.');
    const requiredInputs = identifiers(step.inputIds, RECIPE_LIMITS.inputs);
    if (requiredInputs.some(input => !inputIds.has(input))) return invalid('Paramètre d’étape introuvable.');
    return { id, capability, dependsOn: identifiers(step.dependsOn, RECIPE_LIMITS.steps), inputIds: requiredInputs, instructions: text(step.instructions, RECIPE_LIMITS.instructions), outputKind: identifier(step.outputKind) };
  });
  const visiting = new Set<string>(), visited = new Set<string>(), byId = new Map(steps.map(step => [step.id, step]));
  function visit(id: string): void {
    if (visiting.has(id)) return invalid('Dépendance circulaire dans la recette.');
    if (visited.has(id)) return;
    const step = byId.get(id);
    if (!step) return invalid('Dépendance d’étape introuvable.');
    visiting.add(id);
    for (const dependency of step.dependsOn) visit(dependency);
    visiting.delete(id); visited.add(id);
  }
  for (const step of steps) visit(step.id);
  const result: PhareRecipe = { format: 'le-phare-recipe', version: 1, manifest, inputs, steps };
  if (new TextEncoder().encode(JSON.stringify(result)).length > RECIPE_LIMITS.bytes) return invalid('Recette limitée à 64 Kio.');
  return result;
}

export function importRecipe(raw: string, allowedCapabilities: readonly string[]): PhareRecipe {
  if (typeof raw !== 'string' || new TextEncoder().encode(raw).length > RECIPE_LIMITS.bytes) return invalid('Recette limitée à 64 Kio.');
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return invalid('Recette JSON illisible.'); }
  return validateRecipe(value, allowedCapabilities);
}
export function exportRecipe(recipe: unknown, allowedCapabilities: readonly string[]): string {
  const normalized = validateRecipe(recipe, allowedCapabilities);
  const readable = JSON.stringify(normalized, null, 2);
  // Formatting must not make an otherwise valid method impossible to reimport.
  return new TextEncoder().encode(readable).length <= RECIPE_LIMITS.bytes ? readable : JSON.stringify(normalized);
}

function boundSources(recipe: PhareRecipe, bindings: RecipeBindings, sourceRefs: readonly string[]): Map<string, string[]> {
  if (!bindings || typeof bindings !== 'object' || Array.isArray(bindings) || !Array.isArray(sourceRefs) || sourceRefs.length > RECIPE_LIMITS.refs) return invalid('Références de préparation invalides.');
  const source = new Set<string>();
  for (const ref of sourceRefs) { text(ref, 500); if (source.has(ref)) return invalid('Référence source dupliquée.'); source.add(ref); }
  if (Object.keys(bindings).some(key => !recipe.inputs.some(input => input.id === key))) return invalid('Paramètre lié inconnu.');
  const result = new Map<string, string[]>();
  for (const input of recipe.inputs) {
    const refs = Object.hasOwn(bindings, input.id) ? bindings[input.id] : [];
    if (!Array.isArray(refs) || refs.length > RECIPE_LIMITS.refs || (input.required && !refs.length)) return invalid('Une référence requise manque dans la préparation.');
    for (const ref of refs) if (typeof ref !== 'string' || !source.has(ref)) return invalid('Source hors du périmètre choisi pour cette tâche.');
    if (new Set(refs).size !== refs.length) return invalid('Référence liée dupliquée.');
    result.set(input.id, [...refs]);
  }
  return result;
}

/** Does not install, connect, schedule or execute anything. All missing steps block
 * the complete method; partial compatibility is not presented as a ready pipeline.
 */
export function preflightRecipe(value: unknown, input: RecipePreflightInput): RecipePreflight {
  const recipe = validateRecipe(value, input.allowedCapabilities);
  const bindings = boundSources(recipe, input.bindings, input.sourceRefs);
  const steps = recipe.steps.map(step => ({
    id: step.id, capability: step.capability,
    inputRefs: [...new Set(step.inputIds.flatMap(id => bindings.get(id)!))],
    selection: selectEngine({ capability: step.capability, locale: input.locale, localOnly: input.localOnly, allowUntestedForTrial: input.allowUntestedForTrial }, input.engines, input.resources),
  }));
  const blockedStepIds = steps.filter(step => !step.selection.selected).map(step => step.id);
  return { recipe, state: blockedStepIds.length ? 'blocked' : steps.some(step => step.selection.mode === 'trial') ? 'trial' : 'qualified', steps, blockedStepIds };
}

export type RecipePlanInput = {
  task: PhareTask;
  environment: Omit<RecipeEnvironment, 'localOnly'>;
  bindings: RecipeBindings;
  definitions: readonly AgentDefinition[];
  /** Bindings and permissions are application-owned, never read from a recipe. */
  assignments: Readonly<Record<string, { agentId: string; engineId: string; permissions: AgentPermission[] }>>;
  cost: { mayCost: boolean; estimatedCostMinor: number | null; currency: string | null };
};
export type PreparedRecipePlan = {
  state: 'prepared_only';
  recipeRef: { id: string; version: string };
  preflight: RecipePreflight;
  plan: OrchestrationPlan;
  engineBindings: { stepId: string; engineId: string; engineVersion: string }[];
  /** Future executor treats these strings as task text, never shell/code. */
  instructions: { stepId: string; text: string }[];
};

/** Compile into the existing contract; no second runner/store is introduced.
 * assertPlanExecutable and live resource checks remain required by the executor.
 */
export function compileRecipePlan(value: unknown, input: RecipePlanInput): PreparedRecipePlan {
  const preflight = preflightRecipe(value, { ...input.environment, localOnly: input.task.privacyMode === 'local_only', bindings: input.bindings, sourceRefs: input.task.sourceRefs });
  if (preflight.state === 'blocked') return invalid('Une ou plusieurs étapes sont indisponibles. Aucun plan exécutable préparé.');
  const recipe = preflight.recipe;
  if (Object.keys(input.assignments).length !== recipe.steps.length || Object.keys(input.assignments).some(id => !recipe.steps.some(step => step.id === id))) return invalid('Affectations d’étapes incomplètes ou inconnues.');
  const steps = recipe.steps.map(step => {
    const assignment = Object.hasOwn(input.assignments, step.id) ? input.assignments[step.id] : undefined;
    const selected = preflight.steps.find(item => item.id === step.id)!.selection.selected!;
    const definition = assignment && input.definitions.find(agent => agent.id === assignment.agentId);
    if (!assignment || assignment.engineId !== selected.id || !definition || definition.execution !== selected.execution || !Array.isArray(assignment.permissions)) return invalid('Le raccord d’agent ne correspond pas au moteur retenu.');
    return { id: step.id, agentId: assignment.agentId, dependsOn: [...step.dependsOn], inputRefs: [...preflight.steps.find(item => item.id === step.id)!.inputRefs], permissions: [...assignment.permissions], outputKind: step.outputKind };
  });
  if (preflight.steps.some(step => step.selection.selected!.execution === 'provider_api') && !input.cost.mayCost) return invalid('Le coût du fournisseur distant doit être qualifié avant exécution.');
  const plan: OrchestrationPlan = { version: 1, taskId: input.task.id, ownerId: input.task.ownerId, steps, mayCost: input.cost.mayCost, estimatedCostMinor: input.cost.estimatedCostMinor, currency: input.cost.currency };
  validateOrchestrationPlan(input.task, plan, input.definitions);
  return {
    state: 'prepared_only', recipeRef: { id: recipe.manifest.id, version: recipe.manifest.version }, preflight, plan,
    engineBindings: preflight.steps.map(step => ({ stepId: step.id, engineId: step.selection.selected!.id, engineVersion: step.selection.selected!.version })),
    instructions: recipe.steps.map(step => ({ stepId: step.id, text: step.instructions })),
  };
}
