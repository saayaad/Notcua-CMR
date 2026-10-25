import { BookOpen, ArrowRight, Wifi, Workflow, Send, Users, Library, Settings } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Dispatch, SetStateAction } from 'react';

const guides: {
  id: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  steps: string[];
  route: 'connections' | 'flows' | 'campaigns' | 'inbox' | 'library' | 'settings';
}[] = [
  {
    id: 'connections',
    title: 'Conexões',
    subtitle: 'Vincule e acompanhe suas sessões do WhatsApp.',
    icon: Wifi,
    route: 'connections',
    steps: [
      'Abra Conexões e escolha uma sessão.',
      'Clique em Conectar e leia o QR Code com o WhatsApp em Aparelhos conectados.',
      'Aguarde a sincronização terminar antes de começar a enviar.',
    ],
  },
  {
    id: 'automation',
    title: 'Autoatendimento e IA',
    subtitle: 'Configure regras e caminhos de atendimento.',
    icon: Workflow,
    route: 'flows',
    steps: [
      'Crie um fluxo e escolha as palavras que iniciam a conversa.',
      'Adicione mensagens, esperas e perguntas na ordem desejada.',
      'Use Simular fluxo para revisar o percurso sem enviar mensagens reais.',
      'Em Integração de IA, configure o provedor e as regras do vendedor.',
    ],
  },
  {
    id: 'campaigns',
    title: 'Campanhas e remarketing',
    subtitle: 'Revise o público antes de criar um envio.',
    icon: Send,
    route: 'campaigns',
    steps: [
      'Importe uma planilha na área Contatos.',
      'Escolha listas e etiquetas para filtrar os contatos.',
      'Clique em Conferir público e revise a quantidade e a amostra.',
      'Salve como rascunho. Ative o lote somente depois de conferir o conteúdo e os intervalos.',
    ],
  },
  {
    id: 'team',
    title: 'Atendimento, equipe e tela',
    subtitle: 'Organize os responsáveis e personalize as ferramentas.',
    icon: Users,
    route: 'inbox',
    steps: [
      'Cadastre pessoas e departamentos em Configurações → Equipe.',
      'Abra uma conversa e use as abas do painel lateral para consultar cliente, notas e transferências.',
      'Personalize o menu, os atalhos e o tamanho do painel em Configurações.',
      'As mensagens de teste e as simulações não são enviadas ao WhatsApp.',
    ],
  },
  {
    id: 'library',
    title: 'Biblioteca',
    subtitle: 'Prepare respostas para usar no atendimento.',
    icon: Library,
    route: 'library',
    steps: [
      'Escolha Textos, Áudios, Mídias ou Documentos.',
      'Crie respostas rápidas e agrupe os recursos em categorias.',
      'Clique em um recurso para conferir a prévia ou use Editar, Duplicar e Excluir.',
    ],
  },
  {
    id: 'settings',
    title: 'Conta e configurações',
    subtitle: 'Ajuste aparência, acesso e cópias de segurança.',
    icon: Settings,
    route: 'settings',
    steps: [
      'Escolha o tema e a cor de destaque na seção Geral.',
      'Os ajustes da conta são sincronizados pelo servidor.',
      'Crie uma cópia integral em Backups e acesso antes de mudanças importantes.',
    ],
  },
];
export function HelpCenter({
  onNavigate,
}: {
  onNavigate: Dispatch<
    SetStateAction<
      | 'inbox'
      | 'library'
      | 'connections'
      | 'settings'
      | 'crm'
      | 'flows'
      | 'overview'
      | 'contacts'
      | 'campaigns'
      | 'schedule'
      | 'help'
    >
  >;
}) {
  return (
    <main className="workspace-page help-center">
      <div className="page-heading">
        <div>
          <p className="eyebrow">CENTRAL DE SUPORTE</p>
          <h1>Ajuda e configurações</h1>
          <p>Guias rápidos para configurar a operação e testar cada recurso.</p>
        </div>
      </div>
      <div className="help-guide-grid">
        {guides.map(({ id, title, subtitle, icon: Icon, steps, route }) => (
          <article className="surface help-guide" key={id}>
            <header>
              <span className="asset-icon">
                <Icon size={20} />
              </span>
              <span>
                <h2>{title}</h2>
                <p>{subtitle}</p>
              </span>
            </header>
            <ol>
              {steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <button className="button" onClick={() => onNavigate(route)}>
              <BookOpen size={15} /> Abrir seção <ArrowRight size={15} />
            </button>
          </article>
        ))}
      </div>
    </main>
  );
}
