import { useEffect, useRef, useState } from 'react';
import { FlaskConical, Sparkles, Trash2, Send, Plus, Settings2 } from 'lucide-react';
import { Modal, Avatar } from '../components/ui';
import { Select } from '../components/Select';
import { AudioTestInput } from '../components/AudioTestInput';
import { useApi } from '../context/ApiContext';
import { usePreferences } from '../context/PreferencesContext';
import { firebaseAuth } from '../auth/firebase';
import { emptySandbox, exampleSandbox, sandboxAudience, tickSandbox, type SandboxState, type TestResource, type TestMessage, type TestBatch } from '../context/sandbox';

type Field = { key: string; label: string; value?: string; type?: string; options?: { value: string; label: string }[] };
type Editor = { title: string; fields: Field[]; save: (values: Record<string, string>) => void };
const tabs = [['chat', 'Atendimento'], ['crm', 'Kanban e vendas'], ['campaigns', 'Campanhas'], ['agenda', 'Agenda'], ['library', 'Biblioteca e atalhos'], ['team', 'Equipe e transferências'], ['flow', 'Autoatendimento']] as const;

export function SandboxPage() {
  const { notify } = useApi();
  const { preferences } = usePreferences();
  const storage = `noctua:sandbox:v1:${(firebaseAuth as any)?.currentUser?.uid ?? 'local'}`;
  
  const [state, setState] = useState<SandboxState>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storage) || 'null');
      if (saved?.version === 1 && Array.isArray(saved.contacts) && Array.isArray(saved.resources) && Array.isArray(saved.batches) && Array.isArray(saved.labels) && Array.isArray(saved.team) && Array.isArray(saved.agenda) && Array.isArray(saved.transfers)) return saved;
    } catch {}
    return emptySandbox();
  });
  
  const [tab, setTab] = useState('chat');
  const [selected, setSelected] = useState('');
  const [text, setText] = useState('');
  const [side, setSide] = useState<'client' | 'agent' | 'note'>('client');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [label, setLabel] = useState('');
  const [days, setDays] = useState(0);
  const [chosen, setChosen] = useState<string[]>([]);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [clear, setClear] = useState(false);
  const [load, setLoad] = useState(false);
  const [preview, setPreview] = useState<TestResource | null>(null);
  const [presence, setPresence] = useState('');
  const [mobileChat, setMobileChat] = useState(false);
  const [panel, setPanel] = useState(true);
  const [mobileResources, setMobileResources] = useState(false);
  const [pinned, setPinned] = useState<string[]>([]);
  const [now, setNow] = useState(Date.now());
  const [dragged, setDragged] = useState('');
  
  const generation = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const log = useRef<HTMLDivElement>(null);
  const warned = useRef(false);
  
  useEffect(() => {
    try {
      localStorage.setItem(storage, JSON.stringify(state));
      warned.current = false;
    } catch {
      if (!warned.current) {
        notify('O armazenamento de teste está cheio. As últimas alterações ficam apenas nesta janela.', true);
        warned.current = true;
      }
    }
  }, [state, storage, notify]);
  
  useEffect(() => {
    const timer = setInterval(() => {
      const at = Date.now();
      setNow(at);
      setState(current => current.batches.some(b => b.status === 'ACTIVE' && b.next <= at) || current.agenda.some(a => !a.done && new Date(a.at).getTime() <= at) ? tickSandbox(current, at) : current);
    }, 1000);
    return () => {
      clearInterval(timer);
      generation.current++;
      timers.current.forEach(clearTimeout);
    };
  }, []);
  
  const chat = state.contacts.find(item => item.id === selected) || state.contacts[0];
  
  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight, behavior: 'smooth' });
  }, [chat?.messages.length, presence]);
  
  const change = (fn: (state: SandboxState) => SandboxState) => setState(fn);
  
  const clearTimers = () => {
    generation.current++;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setPresence('');
  };
  
  const append = (contactId: string, message: Omit<TestMessage, 'id'>) => change(current => ({ ...current, contacts: current.contacts.map(contact => contact.id === contactId ? { ...contact, messages: [...contact.messages, { ...message, id: crypto.randomUUID() } as TestMessage] } : contact) }));
  
  const send = () => {
    if (!chat || !text.trim()) return;
    const value = text.trim();
    append(chat.id, { side, kind: 'text', text: value });
    setText('');
    if (side === 'client' && state.flow.enabled && value.toLocaleLowerCase('pt-BR').includes(state.flow.keyword.toLocaleLowerCase('pt-BR'))) {
      const current = generation.current;
      const id = chat.id;
      state.flow.answers.forEach((answer, index) => {
        timers.current.push(setTimeout(() => {
          if (current !== generation.current) return;
          setPresence(index % 2 ? 'A gravar áudio…' : 'A escrever…');
        }, index * 1200));
        timers.current.push(setTimeout(() => {
          if (current !== generation.current) return;
          append(id, { side: 'agent', kind: 'text', text: answer.replaceAll('#nome', chat.name.split(' ')[0] || '') });
          setPresence('');
        }, index * 1200 + 700));
      });
    }
  };
  
  const resourceEdit = (item?: TestResource) => setEditor({
    title: item ? 'Editar recurso de teste' : 'Criar recurso de teste',
    fields: [
      { key: 'name', label: 'Título', value: item?.name },
      { key: 'kind', label: 'Tipo', value: item?.kind ?? 'text', options: ['text', 'audio', 'image', 'video'].map(value => ({ value, label: ({ text: 'Texto', audio: 'Áudio', image: 'Foto', video: 'Vídeo' } as Record<string, string>)[value]! })) },
      { key: 'category', label: 'Categoria', value: item?.category ?? 'Atendimento' },
      { key: 'text', label: 'Texto, legenda ou transcrição', value: item?.text, type: 'textarea' },
      { key: 'url', label: 'Substituir arquivo (até 2 MiB)', value: item?.url, type: 'file' }
    ],
    save: values => {
      if (values.kind !== 'text' && !values.url) {
        notify('Escolha um arquivo para este recurso.', true);
        return;
      }
      change(current => ({ ...current, resources: [...current.resources.filter(resource => resource.id !== item?.id), { ...values, id: item?.id ?? crypto.randomUUID() } as unknown as TestResource] }));
      setEditor(null);
      notify('Recurso salvo somente no teste.');
    }
  });
  
  const media = (item: { kind: TestMessage['kind']; url?: string; text: string }) => (
    <>
      {item.kind === 'audio' && item.url && <audio controls src={item.url} />}
      {item.kind === 'image' && item.url && <img src={item.url} alt={item.text} />}
      {item.kind === 'video' && item.url && <video controls preload="metadata" src={item.url} />}
      <p>{item.text}</p>
    </>
  );
  
  const audience = sandboxAudience(state, label, days);
  const actionButton = (name: string, action: () => void) => <button className="button small" onClick={action}>{name}</button>;
  
  return (
    <main className="workspace-page sandbox-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow"><FlaskConical size={14} /> AMBIENTE ISOLADO</p>
          <h1>Espaço de Teste</h1>
          <p>WhatsApp virtual · sem QR Code · nenhuma mensagem real · dados salvos só neste navegador.</p>
        </div>
        <div className="sandbox-actions">
          <button className="button primary" onClick={() => state.contacts.length ? setLoad(true) : (setState(exampleSandbox()), notify('Cenário fictício carregado.'))}>
            <Sparkles size={15} />Carregar dados de exemplo
          </button>
          <button className="button" onClick={() => setClear(true)}>
            <Trash2 size={15} />Limpar dados de exemplo
          </button>
        </div>
      </header>
      
      <nav className="sandbox-tabs" aria-label="Seções do espaço de teste">
        {tabs.map(([key, name]) => (
          <button key={key} className={`button small ${tab === key ? 'active' : ''}`} onClick={() => { setTab(key); setSearch(''); }}>{name}</button>
        ))}
      </nav>
      
      {!state.contacts.length && (
        <div className="surface sandbox-empty">
          <FlaskConical size={30} />
          <h2>Comece com um cenário de exemplo</h2>
          <p>Inclui seis clientes fictícios, áudio, foto, vídeo, notas internas, etiquetas, valores, equipe, agenda, biblioteca e um fluxo ativo.</p>
          <button className="button primary" onClick={() => setState(exampleSandbox())}>Carregar dados de exemplo</button>
          <button className="button" onClick={() => setEditor({
            title: 'Novo cliente fictício',
            fields: [{ key: 'name', label: 'Nome', value: 'Cliente de teste' }],
            save: values => {
              change(current => ({ ...current, contacts: [...current.contacts, { id: crypto.randomUUID(), name: values.name || '', label: '', days: 0, value: 0, assigned: '', messages: [] }] }));
              setEditor(null);
            }
          })}>Começar com cliente vazio</button>
        </div>
      )}
      
      {state.contacts.length > 0 && tab === 'chat' && (
        <div className={`sandbox-inbox ${mobileChat ? 'show-chat' : ''} ${mobileResources ? 'show-resources' : ''} ${!panel ? 'without-resources' : ''}`} style={{ '--test-list': `${Math.min((preferences as any)?.conversationListWidth || 17, 22)}rem` } as React.CSSProperties}>
          <section className="sandbox-contacts">
            <input aria-label="Buscar cliente fictício" placeholder="Buscar cliente…" value={search} onChange={e => setSearch(e.target.value)} />
            {state.contacts.filter(contact => contact.name.toLowerCase().includes(search.toLowerCase())).map(contact => (
              <button key={contact.id} className={contact.id === chat?.id ? 'active' : ''} onClick={() => { setSelected(contact.id); setMobileChat(true); }}>
                <Avatar contact={{ name: contact.name, profilePicture: null } as any} />
                <span><b>{contact.name}</b><small>{contact.days ? `${contact.days} dias sem interação` : 'Novo atendimento'}</small></span>
                {contact.days >= 10 && <i className="sla-dot" title="SLA de exemplo atrasado" />}
              </button>
            ))}
          </section>
          
          <section className="sandbox-chat">
            <header>
              <button className="button small sandbox-back" onClick={() => setMobileChat(false)}>Voltar</button>
              <Avatar contact={{ name: chat?.name || '', profilePicture: null } as any} />
              <strong>{chat?.name}</strong>
              <button className="button small" onClick={() => {
                const next = !panel;
                setPanel(next);
                setMobileResources(next && window.matchMedia('(max-width: 58rem)').matches);
              }}>
                <Settings2 size={14} />{panel ? 'Mensagens e recursos' : 'Mostrar recursos'}
              </button>
              <button className="button small" onClick={() => {
                clearTimers();
                change(current => ({ ...current, contacts: current.contacts.map(contact => contact.id === chat?.id ? { ...contact, messages: [] } : contact) }));
              }}>Reiniciar conversa</button>
            </header>
            
            <div className="test-chat-log" ref={log} role="log" aria-label="Conversa fictícia">
              {chat?.messages.map(message => (
                <div key={message.id} className={`test-bubble ${message.side === 'client' ? 'user' : message.side === 'agent' ? 'assistant' : message.side === 'note' ? 'note' : 'recovered'}`}>
                  {message.side === 'note' && <small>Nota interna · Modo Sussurro</small>}
                  {message.side === 'recovered' && <small>Mensagem apagada · exemplo preservado</small>}
                  {media(message)}
                </div>
              ))}
              {presence && <small role="status">{presence}</small>}
            </div>
            
            <div className="sandbox-composer">
              <Select aria-label="Enviar no teste como" value={side} onChange={e => setSide(e.target.value as typeof side)}>
                <option value="client">Cliente fictício (testar gatilho)</option>
                <option value="agent">Atendente</option>
                <option value="note">Nota interna · Sussurro</option>
              </Select>
              <AudioTestInput onAudio={url => {
                void fetch(url).then(response => response.blob()).then(blob => {
                  const reader = new FileReader();
                  reader.onload = () => append(chat!.id, { side, kind: 'audio', url: String(reader.result), text: 'Áudio anexado no teste. Edite a transcrição em uma nota para testar um gatilho por texto.' });
                  reader.readAsDataURL(blob);
                });
              }} />
              <form className="test-composer" onSubmit={e => { e.preventDefault(); send(); }}>
                <textarea aria-label="Mensagem no espaço de teste" rows={2} value={text} onChange={e => setText(e.target.value)} placeholder="Digite oi para testar o fluxo…" />
                <button className="button primary"><Send size={15} />Enviar no teste</button>
              </form>
            </div>
          </section>
          
          {panel && (
            <aside className="sandbox-resources">
              <div className="sandbox-resource-heading"><h2>Mensagens e atalhos</h2><button className="button small sandbox-resource-back" onClick={() => setMobileResources(false)}>Voltar à conversa</button></div>
              <Select aria-label="Categoria de teste" value={category} onChange={e => setCategory(e.target.value)}>
                <option value="">Todas as categorias</option>
                {[...new Set(state.resources.map(r => r.category))].map(value => <option key={value}>{value}</option>)}
              </Select>
              <button className="button small" onClick={() => resourceEdit()}><Plus size={14} />Criar resposta</button>
              {state.resources.filter(resource => !category || resource.category === category).sort((a, b) => Number(pinned.includes(b.id)) - Number(pinned.includes(a.id))).map(resource => (
                <article key={resource.id}>
                  <button className="resource-name" onClick={() => setPreview(resource)}>{resource.name}</button>
                  <small>{resource.category} · {resource.kind}</small>
                  <p>{resource.text}</p>
                  <div className="sandbox-actions">
                    {actionButton('Enviar', () => {
                      if (chat) {
                        append(chat.id, { side: 'agent', kind: resource.kind, url: resource.url, text: resource.text.replaceAll('#nome', chat.name.split(' ')[0] || '') });
                        notify('Enviado somente à conversa fictícia.');
                      }
                    })}
                    {actionButton(pinned.includes(resource.id) ? 'Desafixar' : 'Fixar', () => setPinned(current => current.includes(resource.id) ? current.filter(id => id !== resource.id) : [...current, resource.id]))}
                  </div>
                </article>
              ))}
            </aside>
          )}
        </div>
      )}
      
      {state.contacts.length > 0 && tab === 'crm' && (
        <>
          <p className="muted">Arraste os clientes entre as etiquetas. Clique no valor para editar a venda fictícia.</p>
          <div className="sandbox-kanban">
            {state.labels.map(column => (
              <section key={column.id} onDragOver={e => e.preventDefault()} onDrop={() => {
                change(current => ({ ...current, contacts: current.contacts.map(contact => contact.id === dragged ? { ...contact, label: column.id } : contact) }));
                setDragged('');
              }}>
                <h2 style={{ borderColor: column.color }}>{column.name}<small>R$ {state.contacts.filter(c => c.label === column.id).reduce((sum, c) => sum + c.value, 0).toFixed(2)}</small></h2>
                {state.contacts.filter(c => c.label === column.id).map(contact => (
                  <article key={contact.id} draggable onDragStart={() => setDragged(contact.id)}>
                    <strong>{contact.name}</strong><small>{contact.days} dias sem interação</small>
                    <button className="button small" onClick={() => setEditor({
                      title: 'Editar lead de teste',
                      fields: [
                        { key: 'value', label: 'Valor da venda (R$)', type: 'number', value: String(contact.value) },
                        { key: 'label', label: 'Etiqueta', value: contact.label, options: state.labels.map(l => ({ value: l.id, label: l.name })) },
                        { key: 'days', label: 'Dias sem interação', type: 'number', value: String(contact.days) }
                      ],
                      save: values => {
                        change(current => ({ ...current, contacts: current.contacts.map(c => c.id === contact.id ? { ...c, value: Number(values.value || 0), days: Number(values.days || 0), label: values.label || '' } : c) }));
                        setEditor(null);
                      }
                    })}>R$ {contact.value.toFixed(2)} · Editar</button>
                  </article>
                ))}
              </section>
            ))}
          </div>
          <h2>Ordem e cores das etiquetas</h2>
          {state.labels.map((item, index) => (
            <div className="sandbox-row" key={item.id}>
              <i style={{ background: item.color }} />{item.name}
              {actionButton('↑', () => change(current => {
                const labels = [...current.labels];
                if (index > 0) {
                  const prev = labels[index - 1];
                  const curr = labels[index];
                  if (prev && curr) {
                    labels[index - 1] = curr;
                    labels[index] = prev;
                  }
                }
                return { ...current, labels };
              }))}
              {actionButton('↓', () => change(current => {
                const labels = [...current.labels];
                if (index < labels.length - 1) {
                  const next = labels[index + 1];
                  const curr = labels[index];
                  if (next && curr) {
                    labels[index + 1] = curr;
                    labels[index] = next;
                  }
                }
                return { ...current, labels };
              }))}
              <input type="color" aria-label={`Cor ${item.name}`} value={item.color} onChange={e => change(current => ({ ...current, labels: current.labels.map(label => label.id === item.id ? { ...label, color: e.target.value } : label) }))} />
            </div>
          ))}
        </>
      )}
      
      {state.contacts.length > 0 && tab === 'campaigns' && (
        <>
          <section className="surface">
            <h2>Nova campanha fictícia</h2>
            <div className="form-grid">
              <label>Etiqueta
                <Select value={label} onChange={e => { setLabel(e.target.value); setChosen([]); }}>
                  <option value="">Todas</option>
                  {state.labels.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                </Select>
              </label>
              <label>Dias sem interação
                <input type="number" min="0" value={days} onChange={e => { setDays(Math.max(0, Number(e.target.value))); setChosen([]); }} />
              </label>
            </div>
            <p>{audience.length} clientes fictícios correspondem ao filtro</p>
            <div className="sandbox-leads">
              {audience.map(item => (
                <label className="checkbox" key={item.id}>
                  <input type="checkbox" checked={chosen.includes(item.id)} onChange={e => setChosen(current => e.target.checked ? [...current, item.id] : current.filter(id => id !== item.id))} />
                  {item.name}
                </label>
              ))}
            </div>
            <button className="button small" onClick={() => setChosen(audience.map(item => item.id))}>Selecionar todos os correspondentes</button>
            <button className="button primary" disabled={!chosen.length} onClick={() => setEditor({
              title: 'Salvar campanha fictícia',
              fields: [
                { key: 'name', label: 'Nome', value: 'Campanha de teste' },
                { key: 'text', label: 'Mensagem ({{nome}})', type: 'textarea', value: 'Olá, {{nome}}! Podemos conversar sobre seu projeto?' },
                { key: 'min', label: 'Intervalo mínimo (s)', type: 'number', value: '2' },
                { key: 'max', label: 'Intervalo máximo (s)', type: 'number', value: '4' }
              ],
              save: values => {
                if (Number(values.max || 0) < Number(values.min || 0)) {
                  notify('O máximo precisa ser maior ou igual ao mínimo.', true);
                  return;
                }
                change(current => ({ ...current, batches: [...current.batches, { id: crypto.randomUUID(), name: values.name || '', text: values.text || '', min: Math.max(1, Number(values.min || 1)), max: Math.max(1, Number(values.max || 1)), ids: chosen.filter(id => audience.some(c => c.id === id)), status: 'DRAFT', sent: 0, next: Date.now() } as TestBatch] }));
                setEditor(null);
              }
            })}>Criar rascunho</button>
          </section>
          {state.batches.map(batch => (
            <article className="surface" key={batch.id}>
              <h2>{batch.name}</h2>
              <p>{batch.status} · Enviados no teste: {batch.sent} de {batch.ids.length}</p>
              <progress value={batch.sent} max={Math.max(batch.ids.length, 1)} />
              {batch.status === 'ACTIVE' && <small>Próxima mensagem fictícia em {Math.max(0, Math.ceil((batch.next - now) / 1000))}s</small>}
              <div className="sandbox-actions">
                {!['COMPLETED', 'CANCELLED'].includes(batch.status) && actionButton(batch.status === 'ACTIVE' ? 'Pausar' : 'Iniciar / Retomar', () => change(current => ({ ...current, batches: current.batches.map(b => b.id === batch.id ? { ...b, status: b.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE', next: Date.now() + b.min * 1000 } : b) })))}
                {!['COMPLETED', 'CANCELLED'].includes(batch.status) && actionButton('Cancelar', () => change(current => ({ ...current, batches: current.batches.map(b => b.id === batch.id ? { ...b, status: 'CANCELLED' } : b) })))}
              </div>
            </article>
          ))}
        </>
      )}
      
      {state.contacts.length > 0 && tab === 'agenda' && (
        <section className="surface">
          <h2>Agenda fictícia</h2>
          <button className="button primary" onClick={() => setEditor({
            title: 'Agendar lembrete no teste',
            fields: [
              { key: 'contact', label: 'Cliente', value: chat?.id ?? '', options: state.contacts.map(c => ({ value: c.id, label: c.name })) },
              { key: 'text', label: 'Lembrete', type: 'textarea' },
              { key: 'at', label: 'Data e hora local', type: 'datetime-local' }
            ],
            save: values => {
              change(current => ({ ...current, agenda: [...current.agenda, { id: crypto.randomUUID(), contact: values.contact || '', text: values.text || '', at: new Date(values.at || Date.now()).toISOString(), done: false }] }));
              setEditor(null);
            }
          })}>Agendar lembrete</button>
          {state.agenda.map(item => (
            <div className="sandbox-row" key={item.id}>
              <div>
                <strong>{state.contacts.find(c => c.id === item.contact)?.name}</strong>
                <p>{item.text}</p>
                <small>{new Date(item.at).toLocaleString('pt-BR')} · {item.done ? 'Lembrete vencido / concluído' : 'Pendente'}</small>
              </div>
              {actionButton('Remover', () => change(current => ({ ...current, agenda: current.agenda.filter(a => a.id !== item.id) })))}
            </div>
          ))}
        </section>
      )}
      
      {state.contacts.length > 0 && tab === 'library' && (
        <section>
          <div className="sandbox-actions">
            <h2>Biblioteca do teste</h2>
            <button className="button primary" onClick={() => resourceEdit()}>Criar recurso</button>
          </div>
          <div className="sandbox-library">
            {state.resources.map(item => (
              <article className="surface" key={item.id}>
                <h2>{item.name}</h2>
                {media(item)}
                <div className="sandbox-actions">
                  {actionButton('Prévia', () => setPreview(item))}
                  {actionButton('Editar', () => resourceEdit(item))}
                  {actionButton('Duplicar', () => {
                    change(current => ({ ...current, resources: [...current.resources, { ...item, id: crypto.randomUUID(), name: `${item.name} · cópia` }] }));
                    notify('Cópia criada no teste.');
                  })}
                  {actionButton('Excluir', () => setEditor({
                    title: `Excluir ${item.name} do teste?`,
                    fields: [],
                    save: () => {
                      change(current => ({ ...current, resources: current.resources.filter(r => r.id !== item.id) }));
                      setEditor(null);
                      notify('Recurso removido somente do teste.');
                    }
                  }))}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
      
      {state.contacts.length > 0 && tab === 'team' && (
        <section className="surface">
          <h2>Equipe fictícia</h2>
          {state.team.map(member => (
            <div className="sandbox-row" key={member.id}>
              <Avatar contact={{ name: member.name, profilePicture: null } as any} />
              <div>
                <strong>{member.name}</strong>
                <small>{member.department} · {member.online ? 'Online' : 'Offline'}</small>
              </div>
              {actionButton('Alternar presença', () => change(current => ({ ...current, team: current.team.map(m => m.id === member.id ? { ...m, online: !m.online } : m) })))}
            </div>
          ))}
          <button className="button" onClick={() => setEditor({
            title: 'Cadastrar atendente fictício',
            fields: [{ key: 'name', label: 'Nome' }, { key: 'department', label: 'Setor' }],
            save: values => {
              change(current => ({ ...current, team: [...current.team, { id: crypto.randomUUID(), name: values.name || '', department: values.department || '', online: true }] }));
              setEditor(null);
            }
          })}>Cadastrar atendente</button>
          <button className="button primary" onClick={() => setEditor({
            title: 'Transferir atendimento fictício',
            fields: [
              { key: 'contact', label: 'Cliente', value: chat?.id ?? '', options: state.contacts.map(c => ({ value: c.id, label: c.name })) },
              { key: 'target', label: 'Atendente ou fila de setor', options: [...state.team.map(m => ({ value: m.id, label: `${m.name} · ${m.department} · ${m.online ? 'Online' : 'Offline'}` })), ...[...new Set(state.team.map(m => m.department))].map(department => ({ value: `setor:${department}`, label: `Fila: ${department}` }))] },
              { key: 'note', label: 'Observações', type: 'textarea' }
            ],
            save: values => {
              change(current => ({ ...current, transfers: [...current.transfers, { contact: values.contact || '', target: values.target || '', note: values.note || '', id: crypto.randomUUID(), accepted: false } as unknown as SandboxState['transfers'][number]] }));
              setEditor(null);
              notify('Transferência fictícia solicitada.');
            }
          })}>Solicitar transferência</button>
          {state.transfers.map(transfer => (
            <article className="sandbox-row" key={transfer.id}>
              <div>
                <strong>{state.contacts.find(c => c.id === transfer.contact)?.name}</strong>
                <p>{transfer.target.startsWith('setor:') ? transfer.target : state.team.find(m => m.id === transfer.target)?.name} · {transfer.note}</p>
                <small>{transfer.accepted ? 'Aceita' : 'Pendente'}</small>
              </div>
              {!transfer.accepted && actionButton('Aceitar no teste', () => change(current => ({ ...current, transfers: current.transfers.map(t => t.id === transfer.id ? { ...t, accepted: true } : t), contacts: current.contacts.map(c => c.id === transfer.contact ? { ...c, assigned: transfer.target } : c) })))}
            </article>
          ))}
        </section>
      )}
      
      {state.contacts.length > 0 && tab === 'flow' && (
        <section className="surface">
          <h2>Fluxo virtual de exemplo</h2>
          <p>O gatilho e as respostas abaixo funcionam na aba Atendimento, ao enviar como Cliente fictício. As etapas são aceleradas para visualização.</p>
          <form onSubmit={e => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            clearTimers();
            change(current => ({ ...current, flow: { enabled: data.get('enabled') === 'on', keyword: String(data.get('keyword')).trim(), answers: String(data.get('answers')).split('\n').map(s => s.trim()).filter(Boolean) } }));
            notify('Fluxo de teste atualizado.');
          }}>
            <label className="checkbox"><input name="enabled" type="checkbox" defaultChecked={state.flow.enabled} />Ativar fluxo no teste</label>
            <label>Palavra do gatilho<input name="keyword" required defaultValue={state.flow.keyword} /></label>
            <label>Respostas, uma por linha<textarea name="answers" required rows={5} defaultValue={state.flow.answers.join('\n')} /></label>
            <button className="button primary">Salvar fluxo de teste</button>
            <button className="button" type="button" onClick={() => setTab('chat')}>Testar no atendimento virtual</button>
          </form>
        </section>
      )}
      
      {editor && <TestEditor editor={editor} onClose={() => setEditor(null)} />}
      {preview && <Modal title={preview.name} onClose={() => setPreview(null)} wide><div className="sandbox-media-preview">{media(preview)}</div></Modal>}
      
      {(clear || load) && (
        <Modal title={clear ? 'Limpar apenas o Espaço de Teste?' : 'Substituir cenário de teste?'} onClose={() => { setClear(false); setLoad(false); }}>
          <p>{clear ? 'Remove conversas e configurações fictícias deste navegador.' : 'Substitui o cenário fictício atual pelos exemplos iniciais.'} Os dados reais do sistema permanecem preservados.</p>
          <div className="modal-actions">
            <button className="button" onClick={() => { setClear(false); setLoad(false); }}>Cancelar</button>
            <button className="button primary" onClick={() => {
              clearTimers();
              setState(clear ? emptySandbox() : exampleSandbox());
              setPinned([]);
              setSelected('');
              setClear(false);
              setLoad(false);
              notify('Ambiente de teste atualizado.');
            }}>Confirmar</button>
          </div>
        </Modal>
      )}
    </main>
  );
}

function TestEditor({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const { notify } = useApi();
  const [values, setValues] = useState<Record<string, string>>(Object.fromEntries(editor.fields.map(field => [field.key, field.value ?? field.options?.[0]?.value ?? ''])));
  
  return (
    <Modal title={editor.title} onClose={onClose}>
      <form onSubmit={e => { e.preventDefault(); editor.save(values); }}>
        {editor.fields.map(field => (
          <label key={field.key}>
            {field.label}
            {field.options ? (
              <Select required value={values[field.key]} onChange={e => setValues(v => ({ ...v, [field.key]: e.target.value }))}>
                {field.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </Select>
            ) : field.type === 'textarea' ? (
              <textarea required rows={3} value={values[field.key]} onChange={e => setValues(v => ({ ...v, [field.key]: e.target.value }))} />
            ) : field.type === 'file' ? (
              <input type="file" accept="audio/*,image/*,video/*" onChange={e => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 2 * 1024 * 1024) { notify('Use um arquivo de até 2 MiB no ambiente de teste.', true); return; }
                const reader = new FileReader();
                reader.onload = () => setValues(v => ({ ...v, [field.key]: String(reader.result) }));
                reader.readAsDataURL(file);
              }} />
            ) : (
              <input required type={field.type ?? 'text'} min={field.type === 'number' ? 0 : undefined} value={values[field.key] || ''} onChange={e => setValues(v => ({ ...v, [field.key]: e.target.value }))} />
            )}
          </label>
        ))}
        <div className="modal-actions">
          <button className="button" type="button" onClick={onClose}>Cancelar</button>
          <button className="button primary">Confirmar no teste</button>
        </div>
      </form>
    </Modal>
  );
}
