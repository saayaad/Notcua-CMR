import { Copy, Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import type { Dispatch, SetStateAction } from 'react';
import type { Asset } from '../types';
import { Select } from './Select';
import { CampaignMedia } from './CampaignMedia';
import {
  alternativeCharacters,
  duplicateAlternative,
  newAlternative,
  newAlternativeStep,
  type AlternativeDraft,
  type AlternativeStepDraft,
} from './campaign-alternatives';

export function CampaignAlternativesEditor({
  value,
  onChange,
  selectedId,
  onSelect,
  assets,
  onAssetCreated,
}: {
  value: AlternativeDraft[];
  onChange: Dispatch<SetStateAction<AlternativeDraft[]>>;
  selectedId: string;
  onSelect: (id: string) => void;
  assets: Asset[];
  onAssetCreated: (asset: Asset) => void;
}) {
  const selected = value.find((item) => item.id === selectedId) ?? value[0]!;
  const index = value.findIndex((item) => item.id === selected.id);
  const update = (changes: Partial<AlternativeDraft>) =>
    onChange(value.map((item) => (item.id === selected.id ? { ...item, ...changes } : item)));
  const updateStep = (id: string, changes: Partial<AlternativeStepDraft>) =>
    update({ steps: selected.steps.map((step) => (step.id === id ? { ...step, ...changes } : step)) });
  const move = (position: number, offset: number) => {
    const steps = [...selected.steps];
    [steps[position], steps[position + offset]] = [steps[position + offset]!, steps[position]!];
    update({ steps });
  };
  return (
    <section className="campaign-alternatives" aria-label="Alternativas da campanha">
      <div className="alternatives-heading">
        <h3>Alternativas completas</h3>
        <span role="status">{value.length} / 10 alternativas</span>
      </div>
      <p className="muted">
        Cada contato recebe uma alternativa inteira, em rodízio. As etapas seguem a ordem abaixo.
      </p>
      <label>
        Alternativa em edição e prévia
        <Select value={selected.id} onChange={(event) => onSelect(event.target.value)}>
          {value.map((item, i) => (
            <option key={item.id} value={item.id}>
              {i + 1}. {item.name || 'Sem nome'} · {alternativeCharacters(item)} caracteres ·{' '}
              {item.steps.length} etapas
            </option>
          ))}
        </Select>
      </label>
      <div className="operation-actions alternatives-actions">
        <button
          type="button"
          className="button"
          disabled={value.length >= 10}
          onClick={() => {
            if (value.length >= 10) return;
            const item = newAlternative(value.length + 1);
            onChange([...value, item]);
            onSelect(item.id);
          }}
        >
          <Plus size={15} />
          Adicionar alternativa
        </button>
        <button
          type="button"
          className="button"
          disabled={value.length >= 10}
          onClick={() => {
            if (value.length >= 10) return;
            const copy = duplicateAlternative(selected);
            onChange([...value.slice(0, index + 1), copy, ...value.slice(index + 1)]);
            onSelect(copy.id);
          }}
        >
          <Copy size={15} />
          Duplicar alternativa
        </button>
        <button
          type="button"
          className="button"
          disabled={value.length <= 1}
          onClick={() => {
            if (
              value.length <= 1 ||
              !window.confirm(`Remover a alternativa “${selected.name || index + 1}” e suas etapas?`)
            )
              return;
            const remaining = value.filter((item) => item.id !== selected.id);
            onChange(remaining);
            onSelect(remaining[Math.min(index, remaining.length - 1)]!.id);
          }}
        >
          <Trash2 size={15} />
          Remover alternativa
        </button>
      </div>
      <label>
        Nome da alternativa
        <input
          maxLength={60}
          required
          value={selected.name}
          onChange={(event) => update({ name: event.target.value })}
        />
      </label>
      <p className="muted" data-testid="alternative-summary">
        {alternativeCharacters(selected)} caracteres de texto · {selected.steps.length} etapas ·{' '}
        {selected.steps.reduce((sum, step) => sum + step.waitSeconds, 0)} s de espera
      </p>
      {selected.steps.map((step, position) => (
        <fieldset className="alternative-step" key={step.id}>
          <legend>Etapa {position + 1}</legend>
          <div className="form-grid">
            <label>
              Conteúdo da etapa {position + 1}
              <Select
                value={step.kind}
                onChange={(event) => updateStep(step.id, { kind: event.target.value as 'text' | 'asset' })}
              >
                <option value="text">Texto</option>
                <option value="asset">Mídia ou recurso da biblioteca</option>
              </Select>
            </label>
            <label>
              Espera antes da etapa {position + 1} (s)
              <input
                type="number"
                min={0}
                max={86400}
                step={1}
                required
                value={step.waitSeconds}
                onChange={(event) => updateStep(step.id, { waitSeconds: Number(event.target.value) })}
              />
            </label>
          </div>
          {step.kind === 'text' ? (
            <label>
              Texto da etapa {position + 1}
              <textarea
                aria-label={`Texto da etapa ${position + 1}`}
                required
                maxLength={10000}
                value={step.text}
                onChange={(event) => updateStep(step.id, { text: event.target.value })}
              />
              <small className="muted">{step.text.length} / 10.000 caracteres</small>
            </label>
          ) : (
            <label>
              Recurso da etapa {position + 1}
              <Select
                required
                value={step.assetId}
                onChange={(event) => updateStep(step.id, { assetId: event.target.value })}
              >
                <option value="">Selecione um recurso</option>
                {assets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.name}
                  </option>
                ))}
              </Select>
            </label>
          )}
          <div className="operation-actions">
            <button
              type="button"
              className="button small"
              aria-label={`Mover etapa ${position + 1} para cima`}
              disabled={position === 0}
              onClick={() => move(position, -1)}
            >
              <ArrowUp size={15} />
              Subir
            </button>
            <button
              type="button"
              className="button small"
              aria-label={`Mover etapa ${position + 1} para baixo`}
              disabled={position === selected.steps.length - 1}
              onClick={() => move(position, 1)}
            >
              <ArrowDown size={15} />
              Descer
            </button>
            <button
              type="button"
              className="button small"
              aria-label={`Remover etapa ${position + 1}`}
              disabled={selected.steps.length === 1}
              onClick={() => update({ steps: selected.steps.filter((item) => item.id !== step.id) })}
            >
              <Trash2 size={15} />
              Remover etapa
            </button>
          </div>
        </fieldset>
      ))}
      <button
        type="button"
        className="button"
        disabled={selected.steps.length >= 30}
        onClick={() => update({ steps: [...selected.steps, newAlternativeStep()] })}
      >
        <Plus size={15} />
        Adicionar etapa
      </button>
      <p className="muted">
        Use {'{{nome}}'}, {'{{saudacao}}'} ou #nome para personalizar. A espera pertence à etapa e acompanha
        sua posição.
      </p>
      <CampaignMedia
        onCreated={(asset) => {
          onAssetCreated(asset);
          onChange((current) =>
            current.map((item) =>
              item.id === selected.id && item.steps.length < 30
                ? {
                    ...item,
                    steps: [...item.steps, { ...newAlternativeStep(), kind: 'asset', assetId: asset.id }],
                  }
                : item,
            ),
          );
        }}
      />
    </section>
  );
}
