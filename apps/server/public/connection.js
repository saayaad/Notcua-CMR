/* global io */
'use strict';
const element = (id) => document.getElementById(id);
const statusNames = { DISCONNECTED: 'Desconectado', CONNECTING: 'Conectando…', AWAITING_QR: 'Aguardando leitura', CONNECTED: 'Conectado' };
let sessions = [];
let selected = '';
let socket;
let busy = false;
let refreshTimer;
let selectionVersion = 0;
let feedbackSource = 'action';

function feedback(message, isError = false, source = 'action') {
  feedbackSource = source;
  element('feedback').textContent = message;
  element('feedback').classList.toggle('error', isError);
  element('feedback').hidden = !message;
}

async function api(path, method = 'GET', body) {
  const token = element('token').value.trim();
  const response = await fetch(`/api/whatsapp${path}`, {
    method, headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'Não foi possível concluir a operação.');
  return data;
}

async function action(task) {
  if (busy) return;
  busy = true;
  document.querySelectorAll('button').forEach((button) => { button.disabled = true; });
  try { feedback(''); await task(); }
  catch (error) { feedback(error.message || 'Não foi possível concluir a operação.', true); }
  finally { busy = false; document.querySelectorAll('button').forEach((button) => { button.disabled = false; }); render(); }
}

function drawOptions() {
  const select = element('sessions');
  select.replaceChildren(new Option('Selecione uma conexão', ''));
  for (const session of sessions) select.add(new Option(session.name, session.id));
  select.value = selected;
}

function render() {
  const session = sessions.find((entry) => entry.id === selected);
  element('connection').hidden = !session;
  element('automation').hidden = !session;
  if (!session) return;
  element('status').textContent = statusNames[session.status] || session.status;
  element('status').classList.toggle('connected', session.status === 'CONNECTED');
  const connected = session.status === 'CONNECTED';
  element('connection-message').textContent = connected
    ? `WhatsApp conectado${session.phoneNumber ? ` · ${session.phoneNumber}` : ''}. Não é necessário escanear outro QR Code.`
    : session.error || (session.status === 'AWAITING_QR' ? 'Escaneie o QR Code com o WhatsApp do celular.'
      : session.status === 'CONNECTING' ? 'Preparando a conexão. Aguarde alguns instantes…' : 'Clique em Conectar para gerar um QR Code.');
  element('qr-instructions').textContent = connected
    ? 'Esta conexão já está vinculada. O QR Code aparece somente quando é necessário vincular a conta.'
    : 'No WhatsApp do celular, abra Aparelhos conectados → Conectar um aparelho e escaneie o código acima.';
  element('connection-warning').hidden = !connected || !session.error;
  element('connection-warning').textContent = session.error ? `A conexão continua ativa. ${session.error}` : '';
  const freshQr = session.qrDataUrl && session.qrExpiresAt && Date.parse(session.qrExpiresAt) > Date.now();
  element('qr').hidden = !freshQr;
  element('qr-empty').hidden = Boolean(freshQr);
  if (freshQr) element('qr').src = session.qrDataUrl;
  else element('qr').removeAttribute('src');
  element('qr-empty').textContent = session.status === 'CONNECTED' ? 'Seu WhatsApp está conectado.' : 'O QR Code aparecerá aqui.';
  element('connect').disabled = busy || session.status !== 'DISCONNECTED';
  element('disconnect').disabled = busy || session.status === 'DISCONNECTED';
  element('resync').disabled = busy || session.status !== 'CONNECTED';
}

async function loadDetails(loadSettings = false) {
  if (!selected) return;
  const target = selected;
  const version = selectionVersion;
  const [summary, labels, settings] = await Promise.all([
    api(`/sessions/${target}/summary`), api(`/sessions/${target}/labels`), loadSettings ? api(`/sessions/${target}/settings`) : Promise.resolve(null),
  ]);
  if (selected !== target || selectionVersion !== version) return;
  element('chats-count').textContent = String(summary.conversations);
  element('messages-count').textContent = String(summary.messages);
  element('labels-count').textContent = String(summary.labels);
  element('job-message').textContent = summary.failedLabelJobs ? `${summary.failedLabelJobs} aplicação(ões) de etiqueta não confirmada(s) no WhatsApp. O vínculo local foi preservado.` : summary.pendingLabelJobs ? `${summary.pendingLabelJobs} etiqueta(s) aguardando confirmação no WhatsApp.` : '';
  const select = element('labels');
  const value = settings ? settings.firstMessageLabelId : select.value;
  select.replaceChildren(new Option('Selecione uma etiqueta', ''));
  for (const label of labels.items) select.add(new Option(`${label.name}${label.whatsappId ? ' · WhatsApp' : ' · CRM'}`, label.id));
  select.value = value || '';
  if (settings) element('auto-label').checked = settings.autoLabelFirstMessage;
}

function realtime() {
  if (typeof io !== 'function') { feedback('O serviço em tempo real não carregou. Reinicie o servidor e atualize a página.', true); return; }
  if (socket) socket.disconnect();
  socket = io({ auth: { token: element('token').value.trim() }, reconnectionAttempts: 5 });
  socket.on('connect_error', () => feedback('Não foi possível abrir a atualização em tempo real. Confira o servidor e o token, se configurado.', true));
  socket.on('whatsapp:state', (state) => {
    const index = sessions.findIndex((entry) => entry.id === state.id);
    if (index < 0) { sessions.push(state); drawOptions(); }
    else sessions[index] = state;
    if (state.id === selected && !state.error && feedbackSource === 'whatsapp') feedback('');
    render();
  });
  socket.on('whatsapp:sync', (notice) => {
    if (notice.sessionId !== selected) return;
    element('sync-message').textContent = notice.kind === 'history' && notice.progress != null ? `Histórico recebido: ${notice.progress}%.` : 'Dados recebidos. A sincronização continua automaticamente.';
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => { void loadDetails().catch((error) => feedback(error.message, true)); }, 600);
  });
  socket.on('whatsapp:error', (event) => { if (event.sessionId === selected) feedback(event.message, true, 'whatsapp'); });
}

async function load() {
  const data = await api('/sessions');
  sessions = data.items;
  if (!sessions.some((entry) => entry.id === selected)) selected = sessions[0]?.id || '';
  selectionVersion++;
  drawOptions(); render();
  await loadDetails(true);
  realtime();
}

element('sessions').addEventListener('change', () => {
  selected = element('sessions').value;
  selectionVersion++;
  render(); void action(() => loadDetails(true));
});
element('refresh').addEventListener('click', () => { void action(load); });
element('authenticate').addEventListener('click', () => { void action(load); });
element('create-session').addEventListener('submit', (event) => {
  event.preventDefault();
  void action(async () => {
    const session = await api('/sessions', 'POST', { name: element('name').value.trim() });
    selected = session.id; element('name').value = '';
    await load(); feedback('Conexão criada. Clique em Conectar para gerar o QR Code.');
  });
});
for (const operation of ['connect', 'disconnect', 'logout', 'resync']) {
  element(operation).addEventListener('click', () => {
    if (!selected) return;
    if (operation === 'logout' && !window.confirm('Desvincular esta sessão? Para conectar novamente será necessário escanear outro QR Code.')) return;
    void action(async () => {
      await api(`/sessions/${selected}/${operation === 'resync' ? 'resync-labels' : operation}`, 'POST');
      await load();
      feedback(operation === 'connect' ? 'Conexão solicitada. Aguarde o QR Code.' : operation === 'resync' ? 'Sincronização de etiquetas solicitada.' : 'Conexão encerrada.');
    });
  });
}
element('save-settings').addEventListener('submit', (event) => {
  event.preventDefault();
  void action(async () => {
    await api(`/sessions/${selected}/settings`, 'PUT', { autoLabelFirstMessage: element('auto-label').checked, firstMessageLabelId: element('labels').value || null });
    feedback('Regra salva. Ela será aplicada às próximas primeiras mensagens de novas conversas.');
  });
});
element('create-label').addEventListener('submit', (event) => {
  event.preventDefault();
  void action(async () => {
    const label = await api(`/sessions/${selected}/labels`, 'POST', { name: element('label-name').value.trim() });
    element('label-name').value = ''; await loadDetails(); element('labels').value = label.id;
    feedback('Etiqueta local criada. Para usá-la na automação, ative e salve a regra.');
  });
});
setInterval(render, 1000);
void action(load);
