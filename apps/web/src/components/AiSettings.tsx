import { ConversationSimulator } from './ConversationSimulator';
import {Select} from './Select';
import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { useApi, errorMessage } from '../context/ApiContext';
import { Spinner } from './ui';
export function AiSettings() {
  const { request, notify } = useApi();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [simulation,setSimulation]=useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [provider, setProvider] = useState('openai');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    void request<Record<string, unknown>>('/operations/ai')
      .then((result) => {
        setData(result);
        setProvider(String(result.provider ?? 'openai'));
      })
      .catch((error) => setError(errorMessage(error)));
  }, [request, notify]);
  if (error)
    return (
      <p className="notice" role="alert">
        {error}
      </p>
    );
  if (!data) return <Spinner />;
  const usage = data.usage as
    { todayTokens: number; todayRequests: number; monthCost: number; unconfirmed: number } | undefined;
  const number = (name: string, label: string, fallback: number, max: number, step = '1') => (
    <label>
      {label}
      <input
        name={name}
        type="number"
        min={name === 'dailyLimit' ? 1 : name === 'maxOutputTokens' ? 100 : 0}
        max={max}
        step={step}
        defaultValue={Number(data[name] ?? fallback)}
      />
    </label>
  );
  return (
    <section className="surface">
      <h2>Assistente de IA</h2><button className="button primary" onClick={()=>setSimulation(true)}>🧪 Testar / Simular atendimento</button>{simulation&&<ConversationSimulator aiOnly onClose={()=>setSimulation(false)}/>}
      <p>
        Defina as regras, escolha o provedor e acompanhe o consumo. Cada conversa tem seu próprio controle de
        pausa.
      </p>
      <div className="form-grid">
        <div className="notice">
          <strong>{usage?.todayTokens.toLocaleString('pt-BR') ?? 0}</strong> tokens hoje ·{' '}
          {usage?.todayRequests ?? 0} solicitações
        </div>
        <div className="notice">
          Estimativa no mês: US$ {(usage?.monthCost ?? 0).toFixed(4)}
          {Boolean(usage?.unconfirmed) && <small> · inclui reservas de solicitações sem confirmação</small>}
        </div>
      </div>
      <form
        key={revision}
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const body: Record<string, unknown> = {};
          for (const key of [
            'model',
            'instructions',
            'knowledge',
            'style',
            'fallbackText',
            'mediaModel',
            'transcriptionModel',
          ])
            body[key] = String(form.get(key) ?? '');
          for (const key of [
            'dailyLimit',
            'dailyTokenLimit',
            'maxOutputTokens',
            'monthlyBudget',
            'inputPrice',
            'outputPrice',
          ])
            body[key] = Number(form.get(key) ?? 0);
          Object.assign(body, {
            provider,
            apiKey: form.get('apiKey') || undefined,
            enabled: form.has('enabled'),
            mediaEnabled: form.has('mediaEnabled'),
          });
          setBusy(true);
          void request('/operations/ai', 'PUT', body)
            .then(() => request<Record<string, unknown>>('/operations/ai'))
            .then((result) => {
              setData(result);
              setRevision((value) => value + 1);
              notify('Integração de IA salva.');
            })
            .catch((error) => notify(errorMessage(error), true))
            .finally(() => setBusy(false));
        }}
      >
        <div className="form-grid">
          <label>
            Provedor
            <Select value={provider} onChange={(event) => setProvider(event.target.value)}>
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic · Claude</option>
              <option value="gemini">Google · Gemini</option>
            </Select>
          </label>
          <label>
            Modelo de atendimento
            <input
              name="model"
              required
              maxLength={100}
              defaultValue={String(data.model ?? '')}
              placeholder="Identificador do modelo da sua conta"
            />
          </label>
        </div>
        <label>
          Chave de API
          <input
            name="apiKey"
            type="password"
            autoComplete="new-password"
            maxLength={500}
            required={provider !== String(data.provider ?? 'openai')}
            placeholder={
              data.configured
                ? 'Salva de forma cifrada. Preencha para substituir.'
                : 'Configure quando estiver pronto'
            }
          />
        </label>
        <label className="checkbox">
          <input name="enabled" type="checkbox" defaultChecked={Boolean(data.enabled)} />
          Ativar respostas automáticas para novas mensagens sem fluxo ativo
        </label>
        <h3>Regras e estilo</h3>
        <label>
          Regras absolutas do administrador
          <textarea
            name="instructions"
            rows={5}
            maxLength={12000}
            defaultValue={String(data.instructions ?? '')}
            placeholder="Preços permitidos, limites de negociação, quando encaminhar ao atendente..."
          />
        </label>
        <label>
          Tom de voz e sequência do atendimento
          <textarea name="style" rows={3} maxLength={6000} defaultValue={String(data.style ?? '')} />
        </label>
        <label>
          Base de conhecimento aprovada
          <textarea
            name="knowledge"
            rows={6}
            maxLength={100000}
            defaultValue={String(data.knowledge ?? '')}
          />
        </label>
        <p className="muted">
          Diálogos aprovados no histórico são consultados por relevância, preservando a ordem das falas. Isso
          orienta o estilo de escrita; não clona a voz nem treina os pesos do modelo.
        </p>
        <label>
          Resposta de contingência
          <textarea
            name="fallbackText"
            rows={2}
            maxLength={2000}
            defaultValue={String(data.fallbackText ?? '')}
            placeholder="Ex.: Vou encaminhar seu atendimento para nossa equipe."
          />
          <small>
            Usada quando a geração falhar, seguida de pausa da IA e aviso ao atendente. Deixe vazio para
            apenas encaminhar.
          </small>
        </label>
        <h3>Limites e consumo</h3>
        <div className="form-grid">
          {number('dailyLimit', 'Respostas automáticas por dia', 100, 5000)}
          {number('dailyTokenLimit', 'Tokens por dia · 0 sem limite', 0, 100000000)}
          {number('maxOutputTokens', 'Máximo de tokens por resposta', 1200, 16000)}
          {number('monthlyBudget', 'Orçamento mensal estimado em US$ · 0 sem limite', 0, 1000000, '0.01')}
          {number('inputPrice', 'US$ por milhão de tokens de entrada', 0, 10000, '0.0001')}
          {number('outputPrice', 'US$ por milhão de tokens de saída', 0, 10000, '0.0001')}
        </div>
        <p className="muted">
          Informe as tarifas do seu provedor. A reserva antes da chamada é conservadora; a fatura oficial pode
          incluir modalidades e custos diferentes. Configure também o limite na conta do provedor.
        </p>
        <h3>Áudio, imagens e vídeos</h3>
        <label>
          Modelo de análise de mídia
          <input
            name="mediaModel"
            maxLength={100}
            defaultValue={String(data.mediaModel ?? '')}
            placeholder="Modelo com suporte às mídias escolhidas"
          />
        </label>
        {provider === 'openai' && (
          <label>
            Modelo de transcrição de áudio
            <input
              name="transcriptionModel"
              maxLength={100}
              defaultValue={String(data.transcriptionModel ?? '')}
            />
          </label>
        )}
        <label className="checkbox">
          <input type="checkbox" name="mediaEnabled" defaultChecked={Boolean(data.mediaEnabled)} />
          Autorizar análise automática das mídias novas recebidas pela IA
        </label>
        <p className="muted">
          Gemini: áudio, imagens e vídeos. OpenAI: áudio e imagens. Claude: imagens. Arquivos de até 12 MiB
          são enviados ao provedor escolhido; o modelo precisa aceitar o formato. As análises ficam salvas
          para revisão e exportação.
        </p>
        <button className="button primary" disabled={busy}>
          {busy ? <Spinner /> : <Save size={16} />}Salvar integração
        </button>
      </form>
    </section>
  );
}
