import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, KeyRound, Plus, Trash2 } from 'lucide-react';
import { errorMessage, useApi } from '../context/ApiContext';

type KeyInfo = { id: string; label: string; enabled: boolean; dailyQuotaExhausted: boolean };
type KeyState = { provider: string; primary: { configured: boolean; dailyQuotaExhausted: boolean }; items: KeyInfo[]; lastUsed: { label: string; usedAt: string } | null };

export function AiKeyManager() {
  const { request, notify } = useApi();
  const [state, setState] = useState<KeyState | null>(null);
  const [label, setLabel] = useState('Chave 2');
  const [apiKey, setApiKey] = useState('');
  const [busy, setBusy] = useState(false);
  const refresh = () => request<KeyState>('/operations/ai/keys').then(setState).catch((error) => notify(errorMessage(error), true));
  useEffect(() => { void refresh(); }, []);
  const perform = async (action: () => Promise<unknown>, message: string) => {
    setBusy(true);
    try { await action(); await refresh(); notify(message); return true; }
    catch (error) { notify(errorMessage(error), true); return false; }
    finally { setBusy(false); }
  };
  if (!state) return <section className="surface"><p className="muted">Carregando chaves…</p></section>;
  const move = (index: number, offset: number) => {
    const next = [...state.items];
    const target = index + offset;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    void perform(() => request('/operations/ai/keys/order', 'PUT', { ids: next.map((item) => item.id) }), 'Ordem das chaves atualizada.');
  };
  return <section className="surface ai-key-manager">
    <h2><KeyRound size={18} /> Configurações de Chaves de API</h2>
    <p className="muted">A chave principal é a primeira. As chaves abaixo são tentadas na ordem cadastrada, somente quando a Gemini confirmar esgotamento da cota diária.</p>
    {state.provider !== 'gemini' && <p className="notice">Selecione Google · Gemini e salve a integração para habilitar várias chaves.</p>}
    <div className="ai-key-entry">
      <div className="ai-key-row"><div><strong>1 · Chave principal</strong><small>{state.primary.configured ? state.primary.dailyQuotaExhausted ? 'Cota diária esgotada' : 'Configurada' : 'Não configurada'}</small></div>
        {state.primary.configured && <button type="button" className="button danger" disabled={busy} onClick={() => { if (window.confirm('Excluir a chave principal? A IA será desativada se não houver outra chave ativa.')) void perform(() => request('/operations/ai/keys/primary', 'DELETE'), 'Chave principal excluída.'); }}><Trash2 size={15} /> Excluir</button>}
      </div>
      <form className="ai-key-edit" onSubmit={(event) => { event.preventDefault(); const target = event.currentTarget; const key = new FormData(target).get('apiKey'); if (!key) return; void perform(() => request('/operations/ai/keys/primary', 'PUT', { apiKey: key }), 'Chave principal substituída.').then((saved) => { if (saved) target.reset(); }); }}>
        <label>{state.primary.configured ? 'Substituir chave principal' : 'Cadastrar chave principal'}<input name="apiKey" type="password" autoComplete="new-password" required minLength={20} maxLength={500} placeholder="Insira uma chave nova; a atual nunca é exibida" /></label>
        <button type="submit" className="button" disabled={busy || state.provider !== 'gemini'}>Salvar chave principal</button>
      </form>
    </div>
    {state.items.map((item, index) => <div className="ai-key-entry" key={`${item.id}:${item.label}`}>
      <div className="ai-key-row">
        <div><strong>{index + 2} · {item.label}</strong><small>{item.dailyQuotaExhausted ? 'Cota diária esgotada; ignorada temporariamente' : item.enabled ? 'Ativa' : 'Desativada'}</small></div>
        <div className="ai-key-actions">
          <button type="button" className="button" disabled={busy || index === 0} aria-label="Mover chave para cima" onClick={() => move(index, -1)}><ArrowUp size={15} /></button>
          <button type="button" className="button" disabled={busy || index === state.items.length - 1} aria-label="Mover chave para baixo" onClick={() => move(index, 1)}><ArrowDown size={15} /></button>
          <label className="checkbox"><input type="checkbox" checked={item.enabled} disabled={busy} onChange={(event) => void perform(() => request(`/operations/ai/keys/${item.id}`, 'PATCH', { enabled: event.target.checked }), 'Chave atualizada.')} /> Ativa</label>
          <button type="button" className="button danger" disabled={busy} aria-label={`Remover ${item.label}`} onClick={() => { if (window.confirm(`Remover ${item.label}?`)) void perform(() => request(`/operations/ai/keys/${item.id}`, 'DELETE'), 'Chave removida.'); }}><Trash2 size={15} /> Remover</button>
        </div>
      </div>
      <form className="ai-key-edit" onSubmit={(event) => { event.preventDefault(); const target = event.currentTarget; const form = new FormData(target); const replacement = String(form.get('apiKey') ?? '').trim(); void perform(() => request(`/operations/ai/keys/${item.id}`, 'PUT', { label: form.get('label'), ...(replacement ? { apiKey: replacement } : {}) }), 'Chave atualizada.').then((saved) => { if (saved) target.reset(); }); }}>
        <label>Nome da chave<input name="label" defaultValue={item.label} maxLength={80} required /></label>
        <label>Trocar segredo (opcional)<input name="apiKey" type="password" autoComplete="new-password" minLength={20} maxLength={500} placeholder="Deixe vazio para manter a chave atual" /></label>
        <button type="submit" className="button" disabled={busy}>Salvar edição</button>
      </form>
    </div>)}
    {state.lastUsed && <p className="muted">Última chave usada: {state.lastUsed.label} · {new Date(state.lastUsed.usedAt).toLocaleString('pt-BR')}</p>}
    <form className="ai-key-add" onSubmit={(event) => { event.preventDefault(); void perform(() => request('/operations/ai/keys', 'POST', { label, apiKey }), 'Chave adicional salva de forma protegida.').then((saved) => { if (saved) { setApiKey(''); setLabel(`Chave ${state.items.length + 2}`); } }); }}>
      <label>Nome para identificar a chave<input value={label} maxLength={80} onChange={(event) => setLabel(event.target.value)} required placeholder="Ex.: Projeto Google 2" /></label>
      <label>Nova chave Gemini<input type="password" value={apiKey} autoComplete="new-password" onChange={(event) => setApiKey(event.target.value)} required minLength={20} maxLength={500} placeholder="A chave não será exibida após salvar" /></label>
      <button className="button primary" type="submit" disabled={busy || state.provider !== 'gemini' || !apiKey.trim()}><Plus size={15} /> Adicionar chave</button>
    </form>
    <small className="muted">Cadastre chaves de projetos Google AI diferentes para obter cotas independentes. Chaves do mesmo projeto compartilham a cota.</small>
  </section>;
}
