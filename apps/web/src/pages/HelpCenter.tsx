import { BookOpen, ArrowRight, Wifi, Workflow, Send, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Dispatch, SetStateAction } from 'react';

const guides: {
  id: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  steps: string[];
  route: 'connections' | 'flows' | 'campaigns' | 'inbox' | 'library' | 'settings' | 'sandbox' | 'personalization';
}[] = [
  {
    id: 'connections',
    title: '1. Conexões',
    subtitle: 'WhatsApp, QR Code e sessões.',
    icon: Wifi,
    route: 'connections',
    steps: [
      'Abra Conexões, crie ou selecione a sessão que deseja vincular.',
      'Clique em Conectar. No celular, abra WhatsApp → Aparelhos conectados → Conectar aparelho e leia o QR Code.',
      'Mantenha o servidor ativo e aguarde a sincronização de contatos, etiquetas e conversas.',
      'Use Pausar/Desconectar para encerrar com segurança; não compartilhe arquivos de sessão nem backups.',
    ],
  },
  {
    id: 'automation',
    title: '2. Autoatendimento e IA',
    subtitle: 'Fluxos, estilo de atendimento e economia.',
    icon: Workflow,
    route: 'flows',
    steps: [
      'Crie um fluxo, defina o gatilho e organize mensagens, perguntas, condições e esperas.',
      'Use a simulação antes de publicar; a simulação de IA pode consumir tokens do provedor.',
      'Em Configurações → Integração de IA, salve sua chave. Para Gemini, use Consultar modelos disponíveis e escolha um identificador do catálogo; o número do projeto não é um modelo.',
      'A clonagem atual usa exemplos aprovados como contexto; não treina nem altera o modelo externo.',
      'Revise o uso e os limites de IA antes de ativar respostas automáticas.',
      'Use o Espaço de Teste para praticar sem QR Code e sem enviar mensagens reais.',
      'Em Configurações → Economia de Tokens, revise as otimizações por função, o consumo estimado e as respostas em cache. A similaridade atual usa palavras e sinônimos; revise as respostas antes de reutilizar.',
      'Se o provedor recusar o projeto ou a cota, o simulador mostra o erro e mantém sua mensagem para nova tentativa. Não é necessário ativar a IA automática para testar.',
      'O simulador não mostra raciocínio interno do modelo; use as regras e fontes exibidas como contexto verificável.',
    ],
  },
  {
    id: 'campaigns',
    title: '3. Campanhas, remarketing e Excel',
    subtitle: 'Importação, público, conteúdo e revisão antes do envio.',
    icon: Send,
    route: 'campaigns',
    steps: [
      'Importe CSV ou Excel em Contatos e confira a prévia dos nomes e telefones antes de confirmar.',
      'Escolha listas, etiquetas e inatividade para formar o público e revise a amostra.',
      'Configure texto/mídia, variações e intervalos; campanhas devem ser revisadas antes de iniciar.',
      'Salve como rascunho enquanto valida. Intervalos ajudam a cadenciar envios, mas não garantem que um número não seja bloqueado.',
      'Configure a troca de etiqueta após o envio para manter o funil organizado. A remoção de uma etiqueta pode ser usada sem adicionar outra. Consulte Ver envios para conferir o telefone de cada destinatário.',
      'Na prévia da importação ou da campanha, use Verificar números no WhatsApp. A consulta não envia mensagens; remova da prévia somente os números confirmados como sem conta. Falhas ficam inconclusivas. Conta encontrada não comprova presença online nem consentimento.',
      'Em Campanhas, use Vincular vendas do CRM para escolher negócios ganhos. Uma venda só pode ser atribuída a uma campanha. O financeiro acompanha o valor e o estado da venda; investimento é informado separadamente. O retorno estimado não é lucro líquido.',
      'Rotação multi-chip não está disponível.',
      'Testes de campanha podem ser simulados no Espaço de Teste sem enviar mensagens reais.',
    ],
  },
  {
    id: 'team',
    title: '4. Atendimento, equipe e atalhos',
    subtitle: 'HUD, ferramentas, transferências e mensagens fixadas.',
    icon: Users,
    steps: [
      'Abra Personalização para ajustar o HUD, a ordem dos painéis e os atalhos de atendimento.',
      'Cadastre atendentes e departamentos nas configurações e teste transferências em conversa fictícia.',
      'Use a Biblioteca para preparar textos, áudios, mídias e documentos; marque recursos aprovados para encontrar no atendimento.',
      'Use os atalhos de Cliente, Notas e Transferências para abrir a função correspondente. Mensagens fixadas usam a lateral; Textos e Áudios mostram os conteúdos salvos na biblioteca.',
      'Em Personalizar Atendimento, a prévia acompanha todas as abas. Use Ampliar prévia para conferir com mais espaço e Confirmar alterações para salvar; Cancelar descarta o rascunho.',
      'O Espaço de Teste funciona sem conexão e mantém exemplos separados do atendimento real.',
      'Follow-up individual, resumo prioritário do turno noturno e regras de opt-out estão configuráveis. O resumo noturno usa sinais simples da conversa e deve ser revisado pelo atendente.',
    ],
    route: 'personalization',
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
      | 'personalization'
      | 'crm'
      | 'flows'
      | 'overview'
      | 'contacts'
      | 'campaigns'
      | 'schedule'
      | 'sandbox'
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
          <p>Quatro guias por etapa, com orientações seguras para configurar e testar a operação.</p>
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
