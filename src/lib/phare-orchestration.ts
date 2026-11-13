/**
 * Contracts for the future Le Phare coordinator and specialist agents.
 *
 * This module validates task transitions and plans only. It does not persist
 * tasks, start agents, call providers, or claim that these agents are active.
 */
export const PHARE_TASK_STATES = [
  'prepared',
  'needs_clarification',
  'needs_approval',
  'running',
  'completed',
  'failed',
  'cancelled',
  'interrupted',
] as const;

export type PhareTaskState = (typeof PHARE_TASK_STATES)[number];

export type AgentPermission =
  | 'read_task'
  | 'read_project'
  | 'read_profile'
  | 'read_local_knowledge'
  | 'network'
  | 'provider_call'
  | 'write_draft'
  | 'write_project'
  | 'send_external'
  | 'delete'
  | 'payment';

export type AgentExecution =
  | 'deterministic_local'
  | 'local_model'
  | 'provider_api'
  | 'external_site';

export type AgentDefinition = {
  id: string;
  role: string;
  state: 'planned' | 'available' | 'disabled';
  execution: AgentExecution;
  permissions: AgentPermission[];
  /** Maximum concurrent runs for this agent, bounded to 1–4. */
  maxParallelRuns: number;
  /** Data supplied to the agent; never inferred from its role. */
  dataScope: 'task_only' | 'current_project' | 'explicit_references';
};

export type AgentStep = {
  id: string;
  agentId: string;
  dependsOn: string[];
  inputRefs: string[];
  permissions: AgentPermission[];
  outputKind: string;
};

export type OrchestrationPlan = {
  version: 1;
  taskId: string;
  ownerId: string;
  steps: AgentStep[];
  mayCost: boolean;
  /** Null means no reliable estimate is available. */
  estimatedCostMinor: number | null;
  currency: string | null;
};

export type VerifiedTaskResult = {
  summary: string;
  outputRefs: string[];
  verification: 'verified';
  verifiedBy: string;
  verifiedAt: string;
};

export type TaskApproval = {
  state: 'not_required' | 'pending' | 'approved' | 'denied';
  scopes: AgentPermission[];
  decidedBy?: string;
  decidedAt?: string;
  /** The user-approved maximum, in minor currency units. */
  costCeilingMinor?: number | null;
};

export type PhareTask = {
  id: string;
  idempotencyKey: string;
  ownerId: string;
  projectId: string | null;
  goal: string;
  sourceRefs: string[];
  state: PhareTaskState;
  privacyMode: 'local_only' | 'connected_allowed';
  allowedPermissions: AgentPermission[];
  approval: TaskApproval;
  estimatedCostMinor: number | null;
  costCeilingMinor: number | null;
  attempt: number;
  runId?: string;
  result?: VerifiedTaskResult;
  error?: { code: string; message: string; retryable: boolean };
  createdAt: string;
  updatedAt: string;
};

const TASK_TRANSITIONS: Record<PhareTaskState, readonly PhareTaskState[]> = {
  prepared: ['needs_clarification', 'needs_approval', 'running', 'cancelled'],
  needs_clarification: ['prepared', 'cancelled'],
  needs_approval: ['prepared', 'cancelled'],
  running: ['completed', 'failed', 'interrupted', 'cancelled'],
  completed: [],
  failed: ['prepared', 'cancelled'],
  cancelled: [],
  interrupted: ['prepared', 'cancelled'],
};

const HIGH_IMPACT_PERMISSIONS: readonly AgentPermission[] = [
  'write_project',
  'send_external',
  'delete',
  'payment',
];

const REMOTE_PERMISSIONS: readonly AgentPermission[] = ['network', 'provider_call'];

export function canTransitionTask(from: PhareTaskState, to: PhareTaskState): boolean {
  return TASK_TRANSITIONS[from].includes(to);
}

function hasPermission(
  available: readonly AgentPermission[],
  requested: AgentPermission,
): boolean {
  return available.includes(requested);
}

function isRemoteAgent(agent: AgentDefinition, step: AgentStep): boolean {
  return (
    agent.execution === 'provider_api' ||
    agent.execution === 'external_site' ||
    step.permissions.some((permission) => REMOTE_PERMISSIONS.includes(permission))
  );
}

function assertPlanGraph(plan: OrchestrationPlan): void {
  if (!plan.steps.length || plan.steps.length > 12) {
    throw new Error('Un plan doit contenir de 1 à 12 étapes.');
  }

  const ids = new Set<string>();
  for (const step of plan.steps) {
    if (!step.id.trim() || step.id.length > 100 || ids.has(step.id)) {
      throw new Error('Identifiant d’étape vide, trop long ou dupliqué.');
    }
    ids.add(step.id);
    if (step.dependsOn.length > 12 || step.inputRefs.length > 100) {
      throw new Error('Plan trop volumineux.');
    }
  }

  const byId = new Map(plan.steps.map((step) => [step.id, step]));
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function visit(id: string): void {
    if (visiting.has(id)) throw new Error('Le plan contient une dépendance circulaire.');
    if (visited.has(id)) return;
    const step = byId.get(id);
    if (!step) throw new Error('Étape de dépendance introuvable.');
    visiting.add(id);
    for (const dependency of step.dependsOn) {
      if (dependency === id || !byId.has(dependency)) {
        throw new Error('Dépendance d’étape invalide.');
      }
      visit(dependency);
    }
    visiting.delete(id);
    visited.add(id);
  }

  for (const step of plan.steps) visit(step.id);
}

export function validateOrchestrationPlan(
  task: PhareTask,
  plan: OrchestrationPlan,
  definitions: readonly AgentDefinition[],
): void {
  if (plan.version !== 1 || plan.taskId !== task.id || plan.ownerId !== task.ownerId) {
    throw new Error('Le plan ne correspond pas à cette tâche et à son propriétaire.');
  }
  assertPlanGraph(plan);

  const definitionMap = new Map<string, AgentDefinition>();
  for (const definition of definitions) {
    if (definitionMap.has(definition.id)) {
      throw new Error('Définition d’agent dupliquée.');
    }
    if (!Number.isInteger(definition.maxParallelRuns) || definition.maxParallelRuns < 1 || definition.maxParallelRuns > 4) {
      throw new Error('Limite de parallélisme invalide.');
    }
    definitionMap.set(definition.id, definition);
  }

  for (const step of plan.steps) {
    const agent = definitionMap.get(step.agentId);
    if (!agent || agent.state !== 'available') {
      throw new Error('Une étape référence un agent qui n’est pas disponible.');
    }
    if (step.inputRefs.some((ref) => !task.sourceRefs.includes(ref))) {
      throw new Error('Une étape demande une source hors du périmètre autorisé de la tâche.');
    }
    for (const permission of step.permissions) {
      if (
        !hasPermission(agent.permissions, permission) ||
        !hasPermission(task.allowedPermissions, permission)
      ) {
        throw new Error('Une étape dépasse les permissions de l’agent ou de la tâche.');
      }
    }
    if (task.privacyMode === 'local_only' && isRemoteAgent(agent, step)) {
      throw new Error('Le mode local seulement interdit cet agent distant.');
    }
  }

  if (
    plan.estimatedCostMinor !== null &&
    (!Number.isInteger(plan.estimatedCostMinor) || plan.estimatedCostMinor < 0)
  ) {
    throw new Error('Estimation de coût invalide.');
  }
  if (!plan.mayCost && plan.estimatedCostMinor !== null && plan.estimatedCostMinor > 0) {
    throw new Error('Le plan indique un coût sans le déclarer.');
  }
  if (plan.currency !== null && !/^[A-Z]{3}$/.test(plan.currency)) {
    throw new Error('Code de devise invalide.');
  }
  if (plan.mayCost && plan.estimatedCostMinor !== null && !plan.currency) {
    throw new Error('La devise du coût estimé est obligatoire.');
  }
  for (const ceiling of [task.costCeilingMinor, task.approval.costCeilingMinor]) {
    if (ceiling !== null && ceiling !== undefined && (!Number.isSafeInteger(ceiling) || ceiling < 0)) {
      throw new Error('Plafond de coût invalide.');
    }
  }
  if (
    plan.estimatedCostMinor !== null &&
    task.costCeilingMinor !== null &&
    plan.estimatedCostMinor > task.costCeilingMinor
  ) {
    throw new Error('Le coût estimé dépasse le plafond autorisé.');
  }
}

export function assertPlanExecutable(
  task: PhareTask,
  plan: OrchestrationPlan,
  definitions: readonly AgentDefinition[],
): void {
  validateOrchestrationPlan(task, plan, definitions);
  if (task.state !== 'prepared') {
    throw new Error('La tâche doit être préparée avant son exécution.');
  }

  const agents = new Map(definitions.map((agent) => [agent.id, agent]));
  const requiredApprovalScopes = new Set<AgentPermission>();

  for (const step of plan.steps) {
    const agent = agents.get(step.agentId);
    if (!agent) throw new Error('Agent introuvable.');
    const remote = isRemoteAgent(agent, step);

    if (remote) {
      requiredApprovalScopes.add('transmit_data');
      if (agent.execution === 'provider_api') requiredApprovalScopes.add('provider_call');
      else requiredApprovalScopes.add('network');

      const declaredRemotePermission =
        (agent.execution === 'provider_api' && step.permissions.includes('provider_call')) ||
        (agent.execution === 'external_site' && step.permissions.includes('network')) ||
        step.permissions.some((permission) => REMOTE_PERMISSIONS.includes(permission));
      if (!declaredRemotePermission || !step.permissions.includes('transmit_data')) {
        throw new Error('Un agent distant doit déclarer l’appel réseau et le transfert de données.');
      }
    }

    for (const permission of step.permissions) {
      if (REMOTE_PERMISSIONS.includes(permission) || HIGH_IMPACT_PERMISSIONS.includes(permission)) {
        requiredApprovalScopes.add(permission);
      }
    }
  }

  const requiresApproval = requiredApprovalScopes.size > 0;
  if (requiresApproval && task.approval.state !== 'approved') {
    throw new Error('Une confirmation explicite est requise avant cet appel ou cette action.');
  }
  for (const permission of requiredApprovalScopes) {
    if (!task.approval.scopes.includes(permission)) {
      throw new Error(`La confirmation ne couvre pas la permission « ${permission} ».`);
    }
  }

  if (plan.mayCost) {
    if (
      plan.estimatedCostMinor === null ||
      task.costCeilingMinor === null ||
      task.approval.costCeilingMinor === null ||
      task.approval.costCeilingMinor === undefined ||
      plan.estimatedCostMinor > task.costCeilingMinor ||
      plan.estimatedCostMinor > task.approval.costCeilingMinor
    ) {
      throw new Error('Un coût estimé et un plafond approuvé sont requis avant une tâche payante.');
    }
  }
}

export function advanceTask(
  task: PhareTask,
  nextState: PhareTaskState,
  patch: Partial<Omit<PhareTask, 'id' | 'idempotencyKey' | 'ownerId' | 'projectId' | 'state' | 'createdAt' | 'updatedAt'>>,
  now = new Date().toISOString(),
  execution?: { plan: OrchestrationPlan; definitions: readonly AgentDefinition[] },
): PhareTask {
  if (!canTransitionTask(task.state, nextState)) {
    throw new Error(`Transition interdite : ${task.state} → ${nextState}.`);
  }

  if (nextState === 'running') {
    if (!execution) throw new Error('Un plan validé est requis avant le lancement.');
    assertPlanExecutable(task, execution.plan, execution.definitions);
    if (task.approval.state === 'pending' || task.approval.state === 'denied') {
      throw new Error('La tâche attend une autorisation explicite.');
    }
  }

  const next = { ...task, ...patch, state: nextState, updatedAt: now };
  if (nextState === 'running') next.attempt = task.attempt + 1;
  if (nextState === 'completed') {
    if (!patch.result || patch.result.verification !== 'verified' || !patch.result.verifiedBy || !patch.result.verifiedAt) {
      throw new Error('Une tâche ne peut être terminée avant vérification du résultat.');
    }
  }
  if (nextState === 'failed' && !patch.error) {
    throw new Error('Une tâche en échec doit conserver une erreur explicite.');
  }
  if (nextState === 'cancelled') next.runId = undefined;
  return next;
}
