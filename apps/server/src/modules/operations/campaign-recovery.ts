export const RECOVERY_STATUSES = ['unreplied', 'delivery', 'pending', 'replied'] as const;
export type RecoveryStatus = (typeof RECOVERY_STATUSES)[number];

export type RecoveryCandidate = {
  id: string;
  name: string;
  phoneNumber: string;
  taskStatus: string;
  replied: boolean;
  optedOut?: boolean;
  blocked?: boolean;
  purchased?: boolean;
  pendingOrder?: boolean;
  activeElsewhere?: boolean;
  latestSentAt?: string | Date | null;
  recoveryCount?: number;
  latestRecoveryAt?: string | Date | null;
};

export type RecoveryExclusion = 'respondeu' | 'pediu para parar' | 'bloqueado' | 'comprou/venda vinculada' |
  'pedido ou vídeo pendente' | 'número inválido' | 'número duplicado' | 'outra campanha ativa/pausada' |
  'intervalo mínimo' | 'limite de tentativas' | 'status não selecionado';

export function countRecoveryFilters(candidates: RecoveryCandidate[]) {
  return {
    unreplied: candidates.filter((item) => ['SENT', 'COMPLETED'].includes(item.taskStatus) && !item.replied).length,
    delivery: candidates.filter((item) => ['VERIFY', 'FAILED'].includes(item.taskStatus)).length,
    pending: candidates.filter((item) => ['QUEUED', 'PENDING', 'RUNNING'].includes(item.taskStatus)).length,
    replied: candidates.filter((item) => item.replied).length,
  };
}

export function planCampaignRecovery(
  candidates: RecoveryCandidate[],
  options: { statuses: RecoveryStatus[]; minIntervalDays: number; maxRecoveries: number; now?: Date },
) {
  const now = options.now ?? new Date();
  const selected = new Set(options.statuses);
  const seenPhones = new Set<string>();
  const eligible: RecoveryCandidate[] = [];
  const excluded: { id: string; name: string; phoneNumber: string; reason: RecoveryExclusion }[] = [];
  const statusMatches = (candidate: RecoveryCandidate) => {
    const status = candidate.taskStatus.toUpperCase();
    return (selected.has('unreplied') && ['SENT', 'COMPLETED'].includes(status) && !candidate.replied) ||
      (selected.has('delivery') && ['VERIFY', 'FAILED'].includes(status)) ||
      (selected.has('pending') && ['QUEUED', 'PENDING', 'RUNNING'].includes(status)) ||
      (selected.has('replied') && candidate.replied);
  };
  const reasonFor = (candidate: RecoveryCandidate): RecoveryExclusion | undefined => {
    if (candidate.replied && !selected.has('replied')) return 'respondeu';
    if (candidate.optedOut) return 'pediu para parar';
    if (candidate.blocked) return 'bloqueado';
    if (candidate.purchased) return 'comprou/venda vinculada';
    if (candidate.pendingOrder) return 'pedido ou vídeo pendente';
    if (!/^[1-9]\d{7,14}$/.test(candidate.phoneNumber)) return 'número inválido';
    if (seenPhones.has(candidate.phoneNumber)) return 'número duplicado';
    if (candidate.activeElsewhere) return 'outra campanha ativa/pausada';
    if ((candidate.recoveryCount ?? 0) >= options.maxRecoveries) return 'limite de tentativas';
    const lastSent = candidate.latestSentAt ? new Date(candidate.latestSentAt).getTime() : 0;
    const lastRecovery = candidate.latestRecoveryAt ? new Date(candidate.latestRecoveryAt).getTime() : 0;
    const latest = Math.max(lastSent, lastRecovery);
    if (latest && now.getTime() - latest < options.minIntervalDays * 86_400_000) return 'intervalo mínimo';
    if (!statusMatches(candidate)) return 'status não selecionado';
    return undefined;
  };
  for (const candidate of candidates) {
    const validNumber = /^[1-9]\d{7,14}$/.test(candidate.phoneNumber);
    const reason = reasonFor(candidate);
    if (reason) excluded.push({ id: candidate.id, name: candidate.name, phoneNumber: candidate.phoneNumber, reason });
    else {
      eligible.push(candidate);
    }
    if (validNumber) seenPhones.add(candidate.phoneNumber);
  }
  const counts: Record<string, number> = {};
  for (const row of excluded) counts[row.reason] = (counts[row.reason] ?? 0) + 1;
  return { eligible, excluded, counts };
}
