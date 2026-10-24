import { X, Plus, Trash2, ArrowRight } from 'lucide-react';
import type { Label, Library } from '../../types';
import { blockNames, type BlockData, type GraphBlock } from './flow.types';

export function FlowInspector({
  node,
  all,
  library,
  labels,
  update,
  target,
  setTarget,
  remove,
  close,
  busy,
}: {
  labels: Label[];
  node: GraphBlock;
  all: GraphBlock[];
  library: Library;
  update: (data: Partial<BlockData>) => void;
  target: (handle: string) => string;
  setTarget: (handle: string, id: string) => void;
  remove: () => void;
  close: () => void;
  busy: boolean;
}) {
  const data = node.data;
  const resources = library.assets.filter((asset) =>
    node.type === 'text'
      ? asset.kind === 'MESSAGE'
      : node.type === 'audio'
        ? asset.kind === 'AUDIO'
        : node.type === 'document'
          ? asset.kind === 'DOCUMENT'
          : asset.kind === 'MEDIA',
  );
  const route = (handle: string, label: string) => (
    <label>
      {label}
      <select value={target(handle)} onChange={(event) => setTarget(handle, event.target.value)}>
        <option value="">Encerrar este caminho</option>
        {all
          .filter((item) => item.id !== node.id && item.type !== 'start')
          .map((item) => (
            <option key={item.id} value={item.id}>
              {item.data.title || blockNames[item.type]}
            </option>
          ))}
      </select>
    </label>
  );
  return (
    <aside className="flow-inspector">
      <header>
        <div>
          <small>CONFIGURAR BLOCO</small>
          <h2>{blockNames[node.type]}</h2>
        </div>
        <button className="icon-button" aria-label="Fechar configuração do bloco" onClick={close}>
          <X size={18} />
        </button>
      </header>
      <fieldset disabled={busy}>
        <label>
          Nome do bloco
          <input
            maxLength={100}
            value={data.title ?? ''}
            onChange={(event) => update({ title: event.target.value })}
            placeholder={blockNames[node.type]}
          />
        </label>
        {node.type === 'start' && (
          <>
            <label>
              Quando iniciar
              <select
                value={data.triggerMode ?? 'keyword'}
                onChange={(event) => update({ triggerMode: event.target.value as typeof data.triggerMode })}
              >
                <option value="keyword">Por palavra-chave</option>
                <option value="any">Qualquer nova mensagem</option>
                <option value="first">Primeira mensagem do cliente</option>
                <option value="first-day">Primeira mensagem do dia</option>
                <option value="manual">Somente início manual</option>
              </select>
            </label>
            <label>
              Etiquetar ao iniciar
              <select
                value={data.startLabelId ?? ''}
                onChange={(event) => update({ startLabelId: event.target.value || undefined })}
              >
                <option value="">Não aplicar etiqueta</option>
                {labels.map((label) => (
                  <option key={label.id} value={label.id}>
                    {label.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Responder somente a esta etiqueta
              <select
                value={data.allowedLabelIds?.[0] ?? ''}
                onChange={(event) =>
                  update({ allowedLabelIds: event.target.value ? [event.target.value] : [] })
                }
              >
                <option value="">Sem restrição</option>
                {labels.map((label) => (
                  <option key={label.id} value={label.id}>
                    {label.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Não responder a esta etiqueta
              <select
                value={data.excludedLabelIds?.[0] ?? ''}
                onChange={(event) =>
                  update({ excludedLabelIds: event.target.value ? [event.target.value] : [] })
                }
              >
                <option value="">Sem exclusão</option>
                {labels.map((label) => (
                  <option key={label.id} value={label.id}>
                    {label.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flow-inspector-title">Palavras-chave</div>
            <p className="flow-field-help">
              O fluxo começa quando uma mensagem nova corresponde a uma destas regras.
            </p>
            {(data.keywordRules ?? []).map((rule, index) => (
              <div className="keyword-rule" key={index}>
                <select
                  aria-label={`Regra ${index + 1}`}
                  value={rule.rule}
                  onChange={(event) =>
                    update({
                      keywordRules: data.keywordRules!.map((item, i) =>
                        i === index
                          ? {
                              ...item,
                              rule: event.target.value as 'equals' | 'contains' | 'starts' | 'not-contains',
                            }
                          : item,
                      ),
                    })
                  }
                >
                  <option value="equals">É igual a</option>
                  <option value="contains">Contém</option>
                  <option value="starts">Começa com</option>
                  <option value="not-contains">Não contém</option>
                </select>
                <input
                  aria-label={`Palavra-chave ${index + 1}`}
                  maxLength={100}
                  value={rule.keyword}
                  onChange={(event) =>
                    update({
                      keywordRules: data.keywordRules!.map((item, i) =>
                        i === index ? { ...item, keyword: event.target.value } : item,
                      ),
                    })
                  }
                />
                <button
                  className="icon-button"
                  aria-label={`Remover regra ${index + 1}`}
                  onClick={() => update({ keywordRules: data.keywordRules!.filter((_, i) => i !== index) })}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <button
              className="button small"
              onClick={() =>
                update({ keywordRules: [...(data.keywordRules ?? []), { rule: 'contains', keyword: '' }] })
              }
            >
              <Plus size={14} />
              Adicionar regra
            </button>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={data.isCaseSensitive ?? false}
                onChange={(event) => update({ isCaseSensitive: event.target.checked })}
              />
              Diferenciar maiúsculas e minúsculas
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={data.sendToContacts ?? true}
                onChange={(event) => update({ sendToContacts: event.target.checked })}
              />
              Permitir contatos salvos
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={data.sendToGroups ?? false}
                onChange={(event) => update({ sendToGroups: event.target.checked })}
              />
              Permitir grupos
            </label>
            <label>
              Intervalo para iniciar novamente (min)
              <input
                type="number"
                min={0}
                max={1440}
                step={1}
                value={(data.cooldownMs ?? 60000) / 60000}
                onChange={(event) => update({ cooldownMs: Math.round(Number(event.target.value) * 60000) })}
              />
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={Boolean(data.schedule)}
                onChange={(event) =>
                  update({
                    schedule: event.target.checked
                      ? { days: [1, 2, 3, 4, 5], minTime: '08:00', maxTime: '18:00' }
                      : undefined,
                  })
                }
              />
              Limitar horário de funcionamento
            </label>
            {data.schedule && (
              <>
                <div className="schedule-days">
                  {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day, index) => (
                    <button
                      key={day}
                      aria-pressed={data.schedule!.days.includes(index)}
                      onClick={() =>
                        update({
                          schedule: {
                            ...data.schedule!,
                            days: data.schedule!.days.includes(index)
                              ? data.schedule!.days.filter((value) => value !== index)
                              : [...data.schedule!.days, index],
                          },
                        })
                      }
                    >
                      {day}
                    </button>
                  ))}
                </div>
                <div className="form-grid">
                  <label>
                    Das
                    <input
                      type="time"
                      value={data.schedule.minTime}
                      onChange={(event) =>
                        update({ schedule: { ...data.schedule!, minTime: event.target.value } })
                      }
                    />
                  </label>
                  <label>
                    Até
                    <input
                      type="time"
                      value={data.schedule.maxTime}
                      onChange={(event) =>
                        update({ schedule: { ...data.schedule!, maxTime: event.target.value } })
                      }
                    />
                  </label>
                </div>
                <p className="flow-field-help">
                  Horário de São Paulo. Uma janela como 22:00–06:00 atravessa a madrugada.
                </p>
              </>
            )}
          </>
        )}
        {['text', 'audio', 'media', 'document'].includes(node.type) && (
          <>
            <label>
              Recurso da biblioteca
              <select value={data.itemId ?? ''} onChange={(event) => update({ itemId: event.target.value })}>
                <option value="">Selecione um recurso</option>
                {resources.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.name}
                  </option>
                ))}
              </select>
            </label>
            {data.itemId && (
              <div className="flow-resource-preview">
                {library.assets.find((asset) => asset.id === data.itemId)?.text ||
                  library.assets.find((asset) => asset.id === data.itemId)?.file?.filename}
              </div>
            )}
            <label>
              Simulação antes do envio (s)
              <input
                type="number"
                min={0}
                max={86400}
                step={0.1}
                value={(data.simulationDelay ?? 1000) / 1000}
                onChange={(event) =>
                  update({ simulationDelay: Math.round(Number(event.target.value) * 1000) })
                }
              />
            </label>
            <p className="flow-field-help">
              Mostra “digitando” ou “gravando áudio” enquanto aguarda. A mensagem usa a versão do recurso
              congelada na publicação.
            </p>
          </>
        )}
        {node.type === 'delay' && (
          <>
            <label>
              Tempo de espera (s)
              <input
                type="number"
                min={0}
                max={2147483}
                step={1}
                value={(data.delayInMs ?? 1000) / 1000}
                onChange={(event) => update({ delayInMs: Math.round(Number(event.target.value) * 1000) })}
              />
            </label>
            <p className="flow-field-help">A execução fica salva no banco durante a espera.</p>
          </>
        )}
        {node.type === 'user-input' && (
          <>
            <label>
              Aceitar resposta
              <select
                value={data.compareRule ?? 'anything'}
                onChange={(event) => update({ compareRule: event.target.value as 'anything' | 'contains' })}
              >
                <option value="anything">Qualquer mensagem</option>
                <option value="contains">Contém uma resposta esperada</option>
              </select>
            </label>
            {data.compareRule === 'contains' && (
              <label>
                Respostas esperadas (uma por linha)
                <textarea
                  rows={4}
                  value={(data.expectedMessages ?? []).join('\n')}
                  onChange={(event) => update({ expectedMessages: event.target.value.split('\n') })}
                  placeholder={'sim\nquero saber mais'}
                />
              </label>
            )}
            <label className="checkbox">
              <input
                type="checkbox"
                checked={data.isCaseSensitive ?? false}
                onChange={(event) => update({ isCaseSensitive: event.target.checked })}
              />
              Diferenciar maiúsculas e minúsculas
            </label>
            <label>
              Tempo limite de resposta (min)
              <input
                type="number"
                min={0}
                max={35791}
                step={0.1}
                value={(data.expirationTimeoutInMs ?? data.followUpData?.expirationTimeoutInMs ?? 0) / 60000}
                onChange={(event) =>
                  update({ expirationTimeoutInMs: Math.round(Number(event.target.value) * 60000) })
                }
              />
            </label>
            <p className="flow-field-help">
              Use 0 para aguardar sem prazo. Uma nova mensagem será consumida como resposta deste bloco.
            </p>
            <label>
              Follow-up ao esgotar o prazo
              <select
                value={data.followUpData?.itemId ?? ''}
                onChange={(event) =>
                  update({
                    followUpData: event.target.value
                      ? { enabled: true, itemId: event.target.value, simulationDelay: 1000 }
                      : undefined,
                  })
                }
              >
                <option value="">Sem mensagem de follow-up</option>
                {library.assets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.name}
                  </option>
                ))}
              </select>
            </label>
            {route('different', 'Se a resposta for diferente')}
            {route('timeout', 'Se não houver resposta no prazo')}
          </>
        )}
        <div className="flow-inspector-title">
          <ArrowRight size={14} />
          {node.type === 'user-input' ? 'Resposta aceita' : 'Continuar para'}
        </div>
        {route('next', node.type === 'user-input' ? 'Próximo bloco após resposta aceita' : 'Próximo bloco')}
        {node.type !== 'start' && (
          <button className="button danger flow-remove" onClick={remove}>
            <Trash2 size={15} />
            Remover bloco
          </button>
        )}
      </fieldset>
    </aside>
  );
}
