import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ApiProvider } from './context/ApiContext';
import { PreferencesProvider } from './context/PreferencesContext';
import { usePreferences } from './context/PreferencesContext';
import { AttendanceDock } from './components/AttendanceDock';
import { ConversationList } from './components/ConversationList';
import { MessageRevision } from './components/MessageRevision';
import './styles.css';
import './attendance.css';
import './attendance-layout-preview.css';
import './components/MessageRevision.css';

const settingsKey = 'noctua-attendance-layout-fixture';
const fetchLocal = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (!new URL(href, location.href).pathname.endsWith('/api/operations/settings/preferences'))
    return fetchLocal(input, init);
  if (init?.method === 'PUT') {
    localStorage.setItem(settingsKey, String(init.body ?? '{}'));
    return new Response(String(init.body ?? '{}'), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  return new Response(localStorage.getItem(settingsKey) ?? '{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
};

function Preview() {
  const [toolsOpen, setToolsOpen] = useState(true);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [label, setLabel] = useState('');
  const [page, setPage] = useState(1);
  const { preferences, updatePreferences } = usePreferences();
  document.documentElement.dataset.theme = theme;
  const openLayout = () => window.dispatchEvent(new Event('noctua:dock-edit'));
  const content = {
    list: <div data-fixture-panel="list"><ConversationList
      sort={preferences.leadSort}
      response={preferences.leadResponse}
      onSort={(leadSort) => updatePreferences({ leadSort })}
      onResponse={(leadResponse) => updatePreferences({ leadResponse })}
      chats={[]}
      total={0}
      active=""
      onSelect={() => undefined}
      search={search}
      setSearch={setSearch}
      filter={filter}
      setFilter={setFilter}
      label={label}
      setLabel={setLabel}
      labels={[]}
      page={page}
      setPage={setPage}
      loading={false}
      onNew={() => undefined}
    /></div>,
    chat: <div className="dock-fixture-panel" data-fixture-panel="chat"><strong>Conversa</strong><p>Mensagens fictícias, nenhum contato ou envio real</p>
      <div className="attendance-message-fixture" aria-label="Mensagens de demonstração">
        <div className="message-row"><div className="message-bubble" data-fixture-message="edited-text"><MessageRevision editedAt="2026-11-13T12:00:00.000Z" editedByClient originalText="Texto original enviado pelo cliente." /><div className="message-text">Texto atualizado pelo cliente.</div></div></div>
        <div className="message-row"><div className="message-bubble message-deleted-by-client" data-fixture-message="deleted-text"><MessageRevision deleted /><div className="message-text">Mensagem fictícia apagada pelo cliente.</div></div></div>
      </div>
    </div>,
    tools: <div className="dock-fixture-panel" data-fixture-panel="tools"><strong>Biblioteca e fixados</strong><p>Conteúdo local de demonstração</p></div>,
  };
  return (
    <main className="dock-fixture-app">
      <header className="dock-fixture-toolbar">
        <strong>Fixture local · Atendimento</strong>
        <span>Dados fictícios · nenhuma fila ou mensagem real</span>
        <button className="button small" onClick={() => setTheme((value) => value === 'dark' ? 'light' : 'dark')}>Tema {theme === 'dark' ? 'claro' : 'escuro'}</button>
        <button className="button small" onClick={openLayout}>Organizar painéis</button>
      </header>
      <AttendanceDock
        toolsOpen={toolsOpen}
        onToolsChange={setToolsOpen}
        onClassic={() => undefined}
      >
        {content}
      </AttendanceDock>
    </main>
  );
}

createRoot(document.getElementById('attendance-layout-preview-root')!).render(
  <ApiProvider><PreferencesProvider><Preview /></PreferencesProvider></ApiProvider>,
);
