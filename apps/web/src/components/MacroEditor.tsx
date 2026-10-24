import { useEffect, useState } from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import type { Label, Library } from '../types';
import { useApi, errorMessage } from '../context/ApiContext';
import { Modal } from './ui';
import { ResourcePicker } from './ResourcePicker';
interface Action {
  uiId: string;
  type: 'TEXT' | 'ASSET' | 'ADD_LABEL' | 'REMOVE_LABEL' | 'UTILITY' | 'IMPORTED';
  actionId: string;
  text: string;
  assetId: string;
  labelId: string;
  delayMs: number;
  composingMs: number;
  command: string;
  target: string;
  presence: string;
}
const blank = (): Action => ({
  uiId: crypto.randomUUID(),
  type: 'TEXT',
  actionId: '',
  text: '',
  assetId: '',
  labelId: '',
  delayMs: 1000,
  composingMs: 1000,
  command: 'WAIT',
  target: '',
  presence: 'none',
});
export function MacroEditor({
  initialId,
  sessionId,
  library,
  onClose,
  onSaved,
}: {
  initialId?: string;
  sessionId: string;
  library: Library;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { request, notify } = useApi();
  const [name, setName] = useState('');
  const [actions, setActions] = useState<Action[]>([blank()]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (sessionId)
      void request<{ items: Label[] }>(`/whatsapp/sessions/${sessionId}/labels`)
        .then((data) => setLabels(data.items))
        .catch((error) => notify(errorMessage(error), true));
    if (initialId)
      void request<{ name: string; actions: Action[] }>(`/operations/macros/${encodeURIComponent(initialId)}`)
        .then((data) => {
          setName(data.name);
          setActions(data.actions.map((action) => ({ ...blank(), ...action })));
        })
        .catch((error) => notify(errorMessage(error), true));
  }, [initialId, sessionId, request, notify]);
  const update = (index: number, data: Partial<Action>) =>
    setActions((items) => items.map((action, i) => (i === index ? { ...action, ...data } : action)));
  const move = (index: number, by: number) =>
    setActions((items) => {
      const next = [...items];
      const other = index + by;
      if (next[other]) [next[index], next[other]] = [next[other]!, next[index]!];
      return next;
    });
  return (
    <Modal
      title={initialId ? 'Editar macro de atendimento' : 'Criar macro de atendimento'}
      onClose={onClose}
      wide
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setBusy(true);
          void request(
            initialId ? `/operations/macros/${encodeURIComponent(initialId)}` : '/operations/macros',
            initialId ? 'PUT' : 'POST',
            { name, actions },
          )
            .then(onSaved)
            .catch((error) => notify(errorMessage(error), true))
            .finally(() => setBusy(false));
        }}
      >
        <label>
          Nome da macro
          <input required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <p className="muted">
          Combine mensagens, recursos, etiquetas e ações da operação. Revise a sequência antes de usar no
          atendimento.
        </p>
        {actions.map((action, index) => (
          <section className="macro-action" key={action.uiId}>
            <header>
              <strong>Ação {index + 1}</strong>
              <span>
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Subir ação"
                  disabled={!index}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Descer ação"
                  disabled={index === actions.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDown size={14} />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Remover ação"
                  disabled={actions.length === 1}
                  onClick={() => setActions((items) => items.filter((_, i) => i !== index))}
                >
                  <Trash2 size={14} />
                </button>
              </span>
            </header>
            <label>
              Tipo de ação
              <select
                value={action.type}
                onChange={(event) => update(index, { type: event.target.value as Action['type'] })}
              >
                <option value="TEXT">Enviar texto</option>
                <option value="ASSET">Enviar recurso da biblioteca</option>
                {action.type === 'IMPORTED' && <option value="IMPORTED">Arquivo original importado</option>}
                <option value="ADD_LABEL">Adicionar etiqueta / etapa do CRM</option>
                <option value="REMOVE_LABEL">Remover etiqueta / etapa do CRM</option>
                <option value="UTILITY">Temporizador ou utilitário</option>
              </select>
            </label>
            {action.type === 'TEXT' && (
              <label>
                Mensagem
                <textarea
                  rows={3}
                  required
                  maxLength={20000}
                  value={action.text}
                  onChange={(event) => update(index, { text: event.target.value })}
                  placeholder="Use #nome para personalizar"
                />
              </label>
            )}
            {action.type === 'IMPORTED' && (
              <p className="notice">
                O arquivo original desta macro será preservado. Para substituí-lo, escolha Enviar recurso da
                biblioteca.
              </p>
            )}
            {action.type === 'ASSET' && (
              <ResourcePicker
                library={library}
                value={action.assetId}
                onChange={(assetId) => update(index, { assetId })}
              />
            )}
            {['ADD_LABEL', 'REMOVE_LABEL'].includes(action.type) && (
              <label>
                Etiqueta
                <select
                  required
                  value={action.labelId}
                  onChange={(event) => update(index, { labelId: event.target.value })}
                >
                  <option value="">Selecione</option>
                  {labels.map((label) => (
                    <option key={label.id} value={label.id}>
                      {label.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {action.type === 'UTILITY' && (
              <>
                <label>
                  Utilitário
                  <select
                    value={action.command}
                    onChange={(event) => update(index, { command: event.target.value })}
                  >
                    {[
                      ['WAIT', 'Somente aguardar'],
                      ['ARCHIVE', 'Encerrar atendimento'],
                      ['UNARCHIVE', 'Reabrir atendimento'],
                      ['PIN', 'Fixar conversa na operação'],
                      ['UNPIN', 'Desafixar conversa'],
                      ['MARK_UNREAD', 'Marcar como não lida'],
                      ['CLEAR_LABELS', 'Remover todas as etiquetas desta conexão'],
                      ['TRANSFER', 'Atribuir atendimento'],
                    ].map(([value, title]) => (
                      <option key={value} value={value}>
                        {title}
                      </option>
                    ))}
                  </select>
                </label>
                {action.command === 'WAIT' && (
                  <label>
                    Durante a espera
                    <select
                      value={action.presence}
                      onChange={(event) => update(index, { presence: event.target.value })}
                    >
                      <option value="none">Sem presença</option>
                      <option value="composing">Mostrar digitando</option>
                      <option value="recording">Mostrar gravando áudio</option>
                    </select>
                  </label>
                )}
                {action.command === 'TRANSFER' && (
                  <label>
                    Responsável
                    <input
                      type="email"
                      required
                      value={action.target}
                      onChange={(event) => update(index, { target: event.target.value })}
                      placeholder="E-mail da equipe"
                    />
                  </label>
                )}
              </>
            )}
            <div className="form-grid">
              <label>
                Esperar antes desta ação (s)
                <input
                  type="number"
                  min={0}
                  max={86400}
                  step={0.1}
                  value={action.delayMs / 1000}
                  onChange={(event) =>
                    update(index, { delayMs: Math.round(Number(event.target.value) * 1000) })
                  }
                />
              </label>
              {['TEXT', 'ASSET', 'IMPORTED'].includes(action.type) && (
                <label>
                  Digitação antes do envio (s)
                  <input
                    type="number"
                    min={0}
                    max={30}
                    step={0.1}
                    value={action.composingMs / 1000}
                    onChange={(event) =>
                      update(index, { composingMs: Math.round(Number(event.target.value) * 1000) })
                    }
                  />
                </label>
              )}
            </div>
          </section>
        ))}
        <button type="button" className="button" onClick={() => setActions((items) => [...items, blank()])}>
          <Plus size={15} />
          Adicionar ação
        </button>
        <div className="modal-actions">
          <button type="button" className="button" onClick={onClose}>
            Cancelar
          </button>
          <button className="button primary" disabled={busy}>
            Salvar macro
          </button>
        </div>
      </form>
    </Modal>
  );
}
