export type TestMessage = { id: string; side: 'client' | 'agent' | 'note' | 'recovered'; text: string; kind: 'text' | 'audio' | 'image' | 'video'; url?: string };
export type TestContact = { id: string; name: string; label: string; days: number; value: number; assigned: string; messages: TestMessage[] };
export type TestResource = { id: string; name: string; kind: TestMessage['kind']; text: string; url?: string; category: string };
export type TestBatch = { id: string; name: string; ids: string[]; text: string; min: number; max: number; status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'CANCELLED' | 'COMPLETED'; sent: number; next: number };

export type SandboxState = {
  version: 1;
  contacts: TestContact[];
  labels: { id: string; name: string; color: string }[];
  team: { id: string; name: string; department: string; online: boolean }[];
  resources: TestResource[];
  agenda: { id: string; contact: string; text: string; at: string; done: boolean }[];
  batches: TestBatch[];
  flow: { enabled: boolean; keyword: string; answers: string[] };
  transfers: { id: string; contact: string; target: string; note: string; accepted: boolean }[];
};

export function emptySandbox(): SandboxState {
  return { version: 1, contacts: [], labels: [], team: [], resources: [], agenda: [], batches: [], transfers: [], flow: { enabled: false, keyword: 'oi', answers: [] } };
}

export function exampleSandbox(now = Date.now()): SandboxState {
  const image = '/sandbox-media/projeto.svg';
  const resources: TestResource[] = [
    { id: 'welcome', name: 'Boas-vindas', kind: 'text', text: 'Olá, #nome! Como podemos ajudar no seu projeto?', category: 'Atendimento' },
    { id: 'deadline', name: 'Prazo de entrega', kind: 'text', text: 'Após a aprovação, o prazo estimado é de 2 dias úteis.', category: 'Produção' },
    { id: 'voice', name: 'Áudio de demonstração', kind: 'audio', text: '[Sinal sonoro de demonstração: duas notas de teste, sem fala.]', url: '/sandbox-media/audio.wav', category: 'Atendimento' },
    { id: 'photo', name: 'Prévia de projeto', kind: 'image', text: 'Imagem ilustrativa de um projeto fictício.', url: image, category: 'Portfólio' },
    { id: 'video', name: 'Vídeo de demonstração', kind: 'video', text: 'Padrão de cores e movimento para testar o reprodutor.', url: '/sandbox-media/video.mp4', category: 'Portfólio' }
  ];
  return {
    version: 1,
    labels: [
      { id: 'rm1', name: 'RM1', color: '#7C35E9' },
      { id: 'rm2', name: 'RM2', color: '#e6a23c' },
      { id: 'rm3', name: 'Remarketing 3', color: '#35aa88' }
    ],
    team: [
      { id: 'ana', name: 'Ana Souza', department: 'Comercial', online: true },
      { id: 'bruno', name: 'Bruno Lima', department: 'Suporte', online: false },
      { id: 'carla', name: 'Carla Reis', department: 'Financeiro', online: true }
    ],
    resources,
    contacts: ['Marina Costa', 'Pedro Alves', 'Júlia Santos', 'Lucas Oliveira', 'Beatriz Lima', 'Rafael Rocha'].map((name, index): TestContact => ({
      id: `demo-${index}`,
      name,
      label: ['rm1', 'rm2', 'rm3'][index % 3] || 'rm1',
      days: [0, 10, 3, 15, 1, 20][index] ?? 0,
      value: [890, 350, 1200, 600, 250, 1500][index] ?? 0,
      assigned: ['ana', 'bruno', 'carla'][index % 3] || 'ana',
      messages: [
        { id: `hello-${index}`, side: 'client', kind: 'text', text: 'Olá! Gostaria de saber o prazo e os valores do projeto.' },
        { id: `reply-${index}`, side: 'agent', kind: 'text', text: `Olá, ${name.split(' ')[0] || ''}! Vamos preparar seu orçamento.` },
        ...resources.filter(resource => resource.kind !== 'text').map((resource): TestMessage => ({
          id: `${resource.id}-${index}`,
          side: 'agent',
          kind: resource.kind,
          text: resource.text,
          url: resource.url
        })),
        { id: `note-${index}`, side: 'note', kind: 'text', text: 'Nota interna: cliente prefere retorno pela tarde. Só a equipe vê esta anotação.' },
        { id: `deleted-${index}`, side: 'recovered', kind: 'text', text: 'Exemplo fictício de conteúdo preservado antes de uma exclusão: “Pode enviar o orçamento?”' }
      ]
    })),
    agenda: [{ id: 'reminder-demo', contact: 'demo-1', text: 'Retornar sobre o orçamento', at: new Date(now + 3600000).toISOString(), done: false }],
    batches: [],
    transfers: [],
    flow: { enabled: true, keyword: 'oi', answers: ['Olá! Sou o assistente virtual de teste.', 'Você quer falar sobre prazo ou orçamento?'] }
  };
}

export function sandboxAudience(state: SandboxState, label: string, days: number): TestContact[] {
  return state.contacts.filter(contact => (!label || contact.label === label) && contact.days >= days);
}

export function tickSandbox(state: SandboxState, now: number): SandboxState {
  let contacts = state.contacts;
  const batches = state.batches.map((batch): TestBatch => {
    if (batch.status !== 'ACTIVE' || batch.next > now) return batch;
    const contactId = batch.ids[batch.sent] || '';
    const contact = contacts.find(item => item.id === contactId);
    if (contact) {
      contacts = contacts.map(item => item.id === contactId ? {
        ...item,
        messages: [...item.messages, { id: `${batch.id}-${batch.sent}`, side: 'agent', kind: 'text', text: batch.text.replaceAll('{{nome}}', item.name.split(' ')[0] || '').replaceAll('#nome', item.name.split(' ')[0] || '') }]
      } : item);
    }
    const sent = batch.sent + 1;
    return { ...batch, sent, status: sent >= batch.ids.length ? 'COMPLETED' : 'ACTIVE', next: now + (batch.min + Math.floor(Math.random() * (batch.max - batch.min + 1))) * 1000 };
  });
  const agenda = state.agenda.map(item => {
    if (item.done || new Date(item.at).getTime() > now) return item;
    return { ...item, done: true };
  });
  return { ...state, contacts, batches, agenda };
}