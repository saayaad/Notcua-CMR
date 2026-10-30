import { useEffect, useState } from 'react';
import { useApi, errorMessage } from '../context/ApiContext';
import { Spinner } from './ui';

type Settings = { enabled: boolean; semanticCache: boolean; rag: boolean; cacheDays: number; summaryEvery: number; systems: Record<string, boolean> };
type CacheItem = { id: string; question: string; answer: string; hits?: number; createdAt: string; approvedAt?: string };
const names: Record<string, string> = { autoReply: 'Autoatendimento e chatbot', copilot: 'Copiloto do vendedor', summaries: 'Resumos e passagem de turno', campaigns: 'Campanhas e testes A/B', training: 'Treinamento do vendedor', receipts: 'Comprovantes e auditoria', dailyDigest: 'Resumo diário de leads' };

export function EconomySettings() {
  const { request, notify } = useApi();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saved, setSaved] = useState({ today: { tokens: 0, requests: 0 }, month: { tokens: 0, requests: 0 } });
  const [items, setItems] = useState<CacheItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [ai, setAi] = useState<Record<string, unknown> | null>(null);
  const [proposal, setProposal] = useState<{ instructions: string; style: string } | null>(null);
  const refresh = async () => {
    const [data, cache, aiData] = await Promise.all([
      request<{ settings: Settings; saved: typeof saved }>('/operations/economy'),
      request<{ items: CacheItem[] }>('/operations/economy/cache'),
      request<Record<string, unknown>>('/operations/ai'),
    ]);
    setSettings(data.settings); setSaved(data.saved); setItems(cache.items); setAi(aiData);
  };
  useEffect(() => { void refresh().catch((error) => notify(errorMessage(error), true)).finally(() => setLoading(false)); }, [request, notify]);
  const saveSettings = async () => {
    if (!settings) return;
    setBusy(true);
    try { await request('/operations/economy', 'PUT', settings); notify('Preferências de economia salvas.'); }
    catch (error) { notify(errorMessage(error), true); }
    finally { setBusy(false); }
  };
  if (loading || !settings) return <Spinner />;
  const optimize = async () => {
    if (!ai) return;
    setBusy(true);
    try {
      setProposal(await request<{ instructions: string; style: string }>('/operations/economy/optimize-prompts', 'POST', { instructions: ai.instructions ?? '', style: ai.style ?? '' }));
    } catch (error) { notify(errorMessage(error), true); }
    finally { setBusy(false); }
  };
  const applyProposal = async () => {
    if (!ai || !proposal) return;
    setBusy(true);
    try {
      const { configured: _configured, usage: _usage, ...config } = ai;
      await request('/operations/ai', 'PUT', { ...config, instructions: proposal.instructions, style: proposal.style });
      setAi({ ...ai, ...proposal }); setProposal(null); notify('Regras atualizadas. Revise o resultado em Integração de IA.');
    } catch (error) { notify(errorMessage(error), true); }
    finally { setBusy(false); }
  };
  return <section className="surface ai-economy">
    <h2>Economia de tokens</h2>
    <p>Use respostas repetidas aprovadas, contexto menor e resumos para reduzir chamadas. A economia exibida é uma estimativa.</p>
    <div className="form-grid">
      <div className="notice"><strong>{saved.today.tokens.toLocaleString('pt-BR')}</strong> tokens estimados poupados hoje · {saved.today.requests.toLocaleString('pt-BR')} chamadas evitadas</div>
      <div className="notice"><strong>{saved.month.tokens.toLocaleString('pt-BR')}</strong> tokens estimados poupados este mês · {saved.month.requests.toLocaleString('pt-BR')} chamadas evitadas</div>
      <div className="notice">{items.length} respostas salvas no cache</div>
    </div>
    <label className="checkbox"><input type="checkbox" checked={settings.enabled} onChange={(event) => setSettings({ ...settings, enabled: event.target.checked })}/>Ativar técnicas de economia</label>
    <label className="checkbox"><input type="checkbox" checked={settings.semanticCache} onChange={(event) => setSettings({ ...settings, semanticCache: event.target.checked })}/>Reutilizar respostas semelhantes aprovadas sem chamar a IA</label>
    <label className="checkbox"><input type="checkbox" checked={settings.rag} onChange={(event) => setSettings({ ...settings, rag: event.target.checked })}/>Buscar apenas trechos relevantes da base aprovada</label>
    <div className="form-grid">
      <label>Validade do cache (dias)<input type="number" min={1} max={365} value={settings.cacheDays} onChange={(event) => setSettings({ ...settings, cacheDays: Number(event.target.value) })}/></label>
      <label>Atualizar resumo a cada mensagens<input type="number" min={5} max={100} value={settings.summaryEvery} onChange={(event) => setSettings({ ...settings, summaryEvery: Number(event.target.value) })}/></label>
    </div>
    <h3>Aplicar economia por sistema</h3>
    {Object.entries(names).map(([key, name]) => <label className="checkbox" key={key}><input type="checkbox" checked={settings.systems[key] !== false} onChange={(event) => setSettings({ ...settings, systems: { ...settings.systems, [key]: event.target.checked } })}/>{name}</label>)}
    <div className="modal-actions"><button className="button" disabled={busy} onClick={() => void optimize()}>{busy ? <Spinner/> : '⚡'}Otimizar regras e estilo com IA</button><button className="button primary" disabled={busy} onClick={() => void saveSettings()}>Salvar economia</button></div>
    {proposal && <div className="economy-proposal"><h3>Prévia das regras otimizadas</h3><label>Regras<textarea rows={7} value={proposal.instructions} onChange={(event) => setProposal({ ...proposal, instructions: event.target.value })}/></label><label>Estilo<textarea rows={4} value={proposal.style} onChange={(event) => setProposal({ ...proposal, style: event.target.value })}/></label><div className="modal-actions"><button className="button" onClick={() => setProposal(null)}>Descartar</button><button className="button primary" disabled={busy} onClick={() => void applyProposal()}>Revisado · aplicar</button></div></div>}
    <div className="economy-cache"><div className="section-heading"><h3>Respostas salvas no cache</h3><button className="button small danger" disabled={!items.length} onClick={async () => { try { await request('/operations/economy/cache', 'DELETE'); setItems([]); notify('Cache limpo.'); } catch (error) { notify(errorMessage(error), true); } }}>Limpar cache</button></div>
      {items.slice(0, 100).map((item) => <article key={item.id}><strong>{item.question}</strong><textarea rows={3} value={item.answer} onChange={(event) => setItems((current) => current.map((row) => row.id === item.id ? { ...row, answer: event.target.value, approvedAt: undefined } : row))}/><small>{item.approvedAt ? 'Aprovada para reutilização' : 'Pendente de revisão'} · {item.hits ?? 0} reutilizações</small><div><button className="button small" onClick={async () => { try { await request(`/operations/economy/cache/${encodeURIComponent(item.id)}`, 'PUT', { answer: item.answer }); setItems((current) => current.map((row) => row.id === item.id ? { ...row, approvedAt: undefined } : row)); notify('Rascunho salvo.'); } catch (error) { notify(errorMessage(error), true); } }}>Salvar rascunho</button> <button className="button small primary" onClick={async () => { try { await request(`/operations/economy/cache/${encodeURIComponent(item.id)}`, 'PUT', { answer: item.answer, approve: true }); setItems((current) => current.map((row) => row.id === item.id ? { ...row, approvedAt: new Date().toISOString() } : row)); notify('Resposta aprovada para reutilização.'); } catch (error) { notify(errorMessage(error), true); } }}>Revisado · aprovar</button> <button className="button small danger" onClick={async () => { try { await request(`/operations/economy/cache/${encodeURIComponent(item.id)}`, 'DELETE'); setItems((current) => current.filter((row) => row.id !== item.id)); } catch (error) { notify(errorMessage(error), true); } }}>Remover</button></div></article>)}
    </div>
    <small className="muted">Transcrições e descrições de mídia dependem dos modelos e permissões configurados. A IA pode errar; revise respostas do cache antes de habilitar envio automático.</small>
  </section>;
}
