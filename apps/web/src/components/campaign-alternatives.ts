export interface AlternativeStepDraft {
  id: string;
  kind: 'text' | 'asset';
  text: string;
  assetId: string;
  waitSeconds: number;
}
export interface AlternativeDraft {
  id: string;
  name: string;
  steps: AlternativeStepDraft[];
}
export const newAlternativeStep = (): AlternativeStepDraft => ({
  id: crypto.randomUUID(),
  kind: 'text',
  text: '',
  assetId: '',
  waitSeconds: 0,
});
export const newAlternative = (number: number): AlternativeDraft => ({
  id: crypto.randomUUID(),
  name: `Alternativa ${number}`,
  steps: [newAlternativeStep()],
});
export const duplicateAlternative = (source: AlternativeDraft): AlternativeDraft => ({
  ...source,
  id: crypto.randomUUID(),
  name: `${source.name.slice(0, 52)} (cópia)`,
  steps: source.steps.map((step) => ({ ...step, id: crypto.randomUUID() })),
});
export const alternativeCharacters = (alternative: AlternativeDraft) =>
  alternative.steps.reduce((total, step) => total + (step.kind === 'text' ? step.text.length : 0), 0);
export function alternativesError(alternatives: AlternativeDraft[], assetIds: Set<string>) {
  if (alternatives.length < 1 || alternatives.length > 10) return 'Use de 1 a 10 alternativas.';
  for (const [index, alternative] of alternatives.entries()) {
    const name = alternative.name.trim() || `Alternativa ${index + 1}`;
    if (!alternative.name.trim() || alternative.name.length > 60)
      return `Preencha o nome da alternativa ${index + 1} (até 60 caracteres).`;
    if (!alternative.steps.length || alternative.steps.length > 30) return `${name}: use de 1 a 30 etapas.`;
    for (const [position, step] of alternative.steps.entries()) {
      if (step.kind === 'text' && (!step.text.trim() || step.text.length > 10000))
        return `${name}, etapa ${position + 1}: escreva um texto de até 10.000 caracteres.`;
      if (step.kind === 'asset' && !assetIds.has(step.assetId))
        return `${name}, etapa ${position + 1}: escolha uma mídia ou recurso disponível.`;
      if (!Number.isInteger(step.waitSeconds) || step.waitSeconds < 0 || step.waitSeconds > 86400)
        return `${name}, etapa ${position + 1}: use uma espera entre 0 e 86.400 segundos.`;
    }
  }
  return '';
}
export function alternativesPayload(alternatives: AlternativeDraft[], speed: number) {
  return alternatives.map((alternative) => ({
    name: alternative.name.trim(),
    delivery: {
      kind: 'sequence' as const,
      steps: alternative.steps.map((step) => ({
        kind: step.kind,
        text: step.kind === 'text' ? step.text : undefined,
        assetId: step.kind === 'asset' ? step.assetId : undefined,
        waitSeconds: Math.max(0, Math.floor(step.waitSeconds / speed)),
      })),
    },
  }));
}
