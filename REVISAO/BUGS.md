# Registro de bugs — revisão

Atualização: 27/10/2026. Nenhum defeito funcional novo confirmado na Fase 1 e nenhuma correção de aplicativo realizada.

| ID | Onde | O que aconteceu | Causa | Correção | Reteste |
|---|---|---|---|---|---|
| AMB-001 | Build inicial no terminal restrito | Vite/esbuild não conseguiu ler diretórios/configuração | Permissão do ambiente, não causa de código comprovada | Nenhuma alteração de código; execução autorizada | npm.cmd run build passou, servidor e interface |
| OBS-001 | Build web | Aviso de pacote principal maior que 500 kB | Tamanho de código informado pelo compilador | Não alterado nesta fase | Compilação final passou em 27/10; avaliar impacto na Fase 2 |

## Relatos históricos a conferir

Os relatos do usuário estão individualizados em REQUISITOS.md (L-05, L-17, L-18, L-19, L-20, L-23 e L-24). Relatórios anteriores dizem que alguns foram corrigidos, mas não ganham status 🔧 nesta revisão sem reteste próprio.
IDs BUG-001 em diante serão atribuídos a defeitos concretos na Fase 2. Não converter observação ambiental em bug do produto.

## BUG-002 — Resumo parava de acompanhar conversas longas (reprodução corrigida e enviada em 29/10/2026)

Prioridade alta; esforço estimado M. `apps/server/src/modules/operations/ai.service.ts:27–31, 62–70`: a consulta carrega no máximo 60 mensagens, mas a atualização compara o tamanho dessa janela com `covered`. Depois de criar um resumo com `covered=57`, novas mensagens não fazem `60 - 57` atingir o intervalo de 10. Configurar intervalo acima de 60 também impede o primeiro resumo.

Reprodução em 27/10/2026: execução real de `generateSuggestion` com repositório em memória e provedor inteiramente fictício, primeiro com 60 e depois com 90 mensagens. Houve 1 resumo antes e 1 depois, `covered=57`, demonstrando que o resumo ficou parado. Zero chamadas externas; nenhuma leitura de conversa real. Script de diagnóstico ignorado pelo Git: `.npm-cache/audit-ai-economy.mts`.

Correção local: o disparo do resumo considera a contagem completa de mensagens, processa o próximo trecho cronológico em lotes de até 100 e inclui o resumo anterior no pedido. O teste com provedor fictício confirmou avanço de 57 para 87 e 157 mensagens e disparo com intervalo 100. Em 29/10, o marcador ganhou data e ID da última mensagem coberta. Se a contagem anterior ao marcador mudar, o resumo é invalidado e reconstruído; registros antigos sem marcador também são reconstruídos. O teste incluiu uma mensagem importada antes do histórico resumido e reabriu o cliente Prisma sem duplicar a síntese. Suíte completa: 186 testes aprovados. A reconstrução pode gerar nova chamada e custo de IA. Ainda faltam reinício completo do servidor, falha do provedor, edição de mídia já resumida e percurso autenticado. Evidência: `evidencias/resumo-ia-2026-10-29.json`. REQ-433/434.

## BUG-003 — Cache não exigia aprovação e podia reutilizar saudação personalizada (corrigido e enviado em 29/10/2026)

Prioridade alta; esforço M. `apps/server/src/modules/operations/ai.service.ts:39–50,109–110`: respostas produzidas pelo modelo são incluídas diretamente em `AI_SEMANTIC_CACHE`, sem aprovação, e a busca não exige estado aprovado ou resposta genérica. O filtro exclui alguns números/valores, mas não nomes. A interface anuncia respostas “aprovadas”.

Reprodução isolada: dois clientes fictícios fizeram a mesma pergunta. A primeira resposta simulada foi “Oi, Joana! Podemos conversar sobre o mascote.”; na segunda conversa o método retornou exatamente essa resposta com `cached=true`, sem chamada ao provedor e sem qualquer etapa de aprovação. Isso demonstra o defeito com dados fictícios; não afirma vazamento ocorrido na operação real.

Correção local: respostas geradas entram como pendentes; somente a aprovação explícita por administrador libera reutilização. A aprovação exige conversa de origem e recusa o nome do cliente, saudações com nome e padrões de contato/valores. Editar sem aprovar retira a aprovação. Entradas antigas sem origem verificável ficam inativas e não podem ser aprovadas; nenhuma linha da base real foi apagada ou alterada. Teste isolado com três clientes fictícios aprovou o caminho de revisão e bloqueou a saudação personalizada. Falta percurso visual publicado; REQ-424 permanece parcial. Evidência: `evidencias/cache-ia-2026-10-29.json`. REQ-424/425/442.

## BUG-004 — Sugestão inicial ignorava texto analisado de mídia (corrigido e enviado em 29/10/2026)

`preprocessMedia` gravava transcrições e descrições em `ai-media`, mas `generateSuggestion` usava esse texto somente nas linhas do resumo. Antes de existir resumo, o contexto da sugestão substituía a mídia por um marcador genérico. A correção usa as linhas já enriquecidas pela análise no histórico recente. Teste isolado com áudio e vídeo fictícios confirmou que ambos os textos chegam ao pedido de sugestão; tipagem passou. Nenhum provedor externo foi chamado. Falta conferir mídia real e interface autenticada. Evidência: `evidencias/media-contexto-2026-10-29.json`. REQ-140/141.

## INT-001 — Opções da economia sem integração completa

Prioridade alta; esforço G. Verificação estática: `EconomySettings.tsx:9,60–70` exibe sete sistemas e `operations.routes.ts:956–963` salva todos. No servidor, somente `ai.service.ts` consulta `settings:ai-economy`; seu classificador reconhece `autoReply`, `summaries` e `copilot`. Não há consumidor encontrado para `systems.campaigns`, `training`, `receipts` ou `dailyDigest`. Esses quatro controles não comprovaram o efeito prometido. Não é evidência de que as funções de campanha/treinamento em si não existam. REQ-419–422.

## LAC-001 — Busca vetorial e métricas diárias ainda não entregues como solicitadas

`ai.service.ts:8–17,79–92` usa tokens de palavras, sinônimos e interseção lexical; não foi localizado código de embeddings/índice vetorial em `apps/server/src` ou `apps/web/src`. REQ-430 ausente; REQ-425 parcial. `operations.routes.ts:949–954` calcula acumulado do mês, e `EconomySettings.tsx:55–58` mostra somente esse acumulado, sem visão diária; REQ-423 parcial. Não ativar serviço pago para preencher a lacuna sem autorização.

## TST-001 — Teste de retomada concorria com o agendador

Corrigido e retestado em 27/10/2026. `apps/server/test/flows.test.ts:412–439`: o teste chamava `flush()` quatro vezes e esperava que isso equivalesse ao término do trabalho. `FlowEngine.start()` inicia também um agendador, e `flush()` retorna imediatamente se já há trabalho em execução. A execução completa inicial teve 14 aprovações e 1 falha (contagem 13 em vez de 14); o mesmo cenário isolado passou, consistente com a corrida observada no código.

O teste agora observa `COMPLETED` no banco, com prazo máximo de 10 segundos, e mantém as mesmas exigências de exatamente um envio simulado, conteúdo correto e estado final. Não foi alterado o código do motor, do serviço de Mensagens ou a contagem esperada. Nova suíte completa: 15/15 aprovados. Não é evidência de defeito confirmado no fluxo de produção. Esta mudança torna a prova da retomada menos dependente do tempo de execução do computador.

## LAC-002 — Busca da agenda não mostra etiqueta do contato

Esta lacuna é de apresentação; a implementação não foi alterada nesta fase de classificação.

Prioridade média; esforço P. Verificação estática de `apps/web/src/components/ContactCombobox.tsx:112–124`: cada opção renderiza avatar, nome e telefone, mas não renderiza `contact.labels`. O pedido REQ-319 inclui a etiqueta atual. Busca, normalização e criação de número novo existem; o requisito completo continua parcial até incluir a etiqueta e conferir visualmente uma opção com etiquetas. Nenhuma alteração do cadastro ou da agenda foi feita neste lote.

## TST-002 — Extensão de importação no teste do menu

Corrigido e retestado. A checagem completa do servidor encontrou TS2835 em `test/context-menu.test.ts:3`: o import relativo não incluía a extensão exigida por NodeNext. O executor tsx aceitava esse caminho, mas isso não bastava para aprovar a tipagem do projeto inteiro. Corrigido para `context-menu-utils.js`, seguindo os demais testes que importam auxiliares da interface. Os dois casos do menu passaram novamente e `npm run typecheck` passou nas duas aplicações. Nenhum código do menu em produção foi alterado por esta correção.


## BUG-001 — Salvamento silencioso de preferências

Arquivo: apps/web/src/context/PreferencesContext.tsx:245. O PUT automático descarta a falha com catch vazio. Na cópia fictícia, nome de menu com 31.000 caracteres foi recusado pela API (413, Configuração muito grande); o banco manteve Campanhas QA e o recarregamento recuperou esse valor. A edição local não foi persistida. Não corrigido ainda: respeitar o plano da Fase 3. É necessário apresentar falha, preservar rascunho e limitar a entrada de maneira clara.


## Correções validadas na continuação autorizada de 27/10/2026

- **BUG-001 corrigido:** preferências não descartam mais falha silenciosamente. Há aviso, rascunho local preservado, retry e fila serial contra sobrescrita por requisição lenta. A leitura inicial precisa concluir antes da gravação. Teste UI com 503 fictício exibiu aviso e retry, depois salvou e persistiu após reload; dois testes novos aprovados. A API mantém a recusa a configuração extensa.
- **LAC-002 corrigida:** sugestões da agenda mostram as etiquetas recebidas no contato. UI mostrou nome, telefone, iniciais e RM1.
- **BUG-004 corrigido:** no tema claro, balões do Sandbox usavam fallback escuro porque --panel/--border não existem no tema global. sandbox.css agora usa --surface2/--line. Capturas claro/escuro conferidas, com texto legível.
- Naquele lote, BUG-002/003 e INT-001 continuavam abertos e os testes funcionais de IA estavam adiados por solicitação do usuário. As correções posteriores de BUG-002/003 estão registradas acima; INT-001 permanece aberto.

## BUG-005 — Prévia de texto mostrava marcadores literalmente — corrigido

AssetPreview.tsx usava um parágrafo de texto simples, embora o chat aplicasse FormattedText. Corrigido para a mesma renderização segura em texto/legenda; não usa HTML arbitrário. UI conferiu strong em “3 dias úteis”. O estado de URL/erro também é limpo ao trocar de recurso para impedir prévia anterior durante carregamento. Build da interface aprovado; não alterada a lógica de envio.

## BUG-006 — Reset recuperava preferências locais antigas — corrigido

SafetyZone apagava apenas chaves com prefixo noctua:, mas as preferências usam noctua-preferences:uid e a seleção usa noctua-active-session:uid. Corrigido com clearOperationLocalState: limpa a conta corrente, tema e estado das ferramentas, preserva outras contas e Firebase. Teste com duas contas aprovado. Reset também bloqueia fluxos/macros/funis RUNNING; quatro casos safety.test.ts aprovados, com recuperação de snapshot. Modal de confirmação vermelho e EXCLUIR exato conferidos; reset real somente em banco descartável.

## BUG-007 — Editar recurso ou funil excluído recriava o item — corrigido em 28/10/2026

As rotas PUT de recurso e funil usavam upsert. Uma edição com ID antigo recriava o item, apesar de a tela tratá-la como atualização. O teste reproduziu o retorno 200 para um recurso já excluído. As rotas agora criam somente em POST e, em PUT, atualizam apenas o registro existente; devolvem 404 se ele não existir. O teste de API cobre áudio, imagem, vídeo e documento excluídos, além de funil inexistente. Banco temporário; nenhum dado de produção foi alterado. Evidência: `evidencias/biblioteca-funis-macros-2026-10-28.json`.

## BUG-008 — Iniciador procurava vínculo Vercel no arquivo errado — corrigido em 28/10/2026

`scripts/iniciar-noctua-online.ps1` inicialmente verificava somente `.vercel/repo.json`; a primeira correção passou a verificar somente `.vercel/project.json`. A Vercel CLI 65.4.0 instalada criou `repo.json` ao vincular o repositório em 28/10, sem criar `project.json`. O iniciador agora aceita qualquer um dos dois arquivos de vínculo e evita solicitar a escolha do projeto de novo. Parser PowerShell aprovado; a publicação foi feita pela CLI vinculada, sem executar o iniciador inteiro. O README e o guia de operação distinguem o servidor/túnel online do Vite local. Evidências: `evidencias/iniciador-2026-10-28.json` e `evidencias/leads-e-publicacao-2026-10-28.json`.

## BUG-009 — Resposta antiga sobrescrevia dados da nova aba de Configurações — corrigido em 28/10/2026

Ao trocar rapidamente entre Negócio, Departamentos, Opt-out e Notificações, uma requisição ainda pendente podia preencher a aba nova com dados da anterior. `WorkspaceSettings.tsx` agora ignora resultados e erros depois que a aba correspondente foi fechada. Tipagem e build da interface aprovados. Falta conferir visualmente com rede lenta; evidência: `evidencias/configuracoes-2026-10-28.json`.

## BUG-010 — Atendimento antigo não carregava após publicação — corrigido em 28/10/2026

Na página publicada, uma aba mantida aberta tentou importar um arquivo JavaScript de uma versão anterior. O erro `Failed to fetch dynamically imported module` acionou incorretamente a mensagem “Recuperar layout clássico”, que sugeria limpar a disposição do usuário. Atualizar a página resolveu a importação. A interface agora tenta uma atualização automática uma vez por minuto ao receber `vite:preloadError`; caso ainda falhe, mostra “Atualizar página” sem apagar a disposição. Acesso direto a `/atendimento` também abre o Atendimento, em vez da Visão Geral. Tipagem e build passaram; o acesso direto à publicação foi conferido. Evidências: `evidencias/atendimento-busca-2026-10-28.json` e `evidencias/leads-e-publicacao-2026-10-28.json`.

## BUG-011 — Iniciador falhou ao carregar verificador de assinatura após reinício — correção parcial em 28/10/2026

A primeira execução em janela oculta iniciou o servidor e parou na etapa 2, pois o PowerShell não carregou `Microsoft.PowerShell.Security` automaticamente. O mesmo módulo e a assinatura válida da Cloudflare funcionaram na execução interativa seguinte, que restaurou site, API e túnel. O iniciador passou a importar o módulo explicitamente e repetir a tentativa até três vezes antes de falhar; não remove o executável por falha de importação. Parser e assinatura aprovados. Falta repetir o teste com outro desligamento real para confirmar que o erro transitório foi eliminado. Evidência: `evidencias/reinicio-2026-10-28.json`.


## BUG-016 — Lista de conversas quase inacessível no layout em linhas
- Reprodução: em Atendimento, escolher layout de painéis “linhas” numa altura de viewport comum.
- Resultado observado: a lista recebia no máximo 12rem e os filtros ocupavam a maior parte da área, escondendo conversas.
- Correção: elevar a altura calculada da lista para clamp(20rem, 42vh, 26rem).
- Validação: teste REQ-216 em Chromium Playwright e teste unitário attendance-layout; viewport desktop e móvel aprovados.
- Estado: corrigido localmente em 30/10/2026.

## BUG-017 — Barra de mensagens fixadas não tinha atalho flutuante para reabrir

- REQ: REQ-240.
- Reprodução: ocultar o painel “Mensagens fixadas” no Atendimento e procurar o atalho flutuante solicitado; antes da correção, só havia ações no cabeçalho/menu.
- Resultado: não existia o atalho flutuante animado, embora o painel pudesse ser reaberto por outros controles.
- Correção: botão flutuante acessível, com animação discreta e respeito a `prefers-reduced-motion`; aciona a mesma ação existente para abrir o painel.
- Validação: Playwright desktop e móvel confirma visibilidade, animação, reabertura e ocultação; evidências em `REVISAO/evidencias/REQ-240/`.
- Estado: corrigido localmente em 30/10/2026.

## BUG-018 — Ação de resumo da conversa não ficava acessível no celular

- REQ: REQ-250/251.
- Reprodução: em 390×844, abrir as ações do cabeçalho após habilitar IA simulada; “Resumir conversa” não aparecia, embora Copiloto e análise de mídia estivessem disponíveis.
- Resultado: não havia percurso móvel para abrir o modal de resumo.
- Correção: adicionada ação “Resumir conversa” nas ações do compositor em larguras até 760 px; ela abre o mesmo modal e fluxo de resumo existente.
- Validação: retestar em Chromium móvel com resposta de provedor simulada; evidências em `REVISAO/evidencias/REQ-250/` e `REQ-251/`.
- Estado: corrigido localmente em 30/10/2026; Playwright passou em desktop 1366, desktop 1920 e mobile 390 com provedor simulado.

## BUG-019 — Mensagem apagada não arquivava a mídia recebida

- REQ: REQ-267.
- Reprodução: receber uma imagem sem cópia local, depois receber o evento de exclusão; antes da correção, o evento só marcava `deletedByClient` e não guardava arquivo.
- Resultado: a imagem ainda dependia do arquivo remoto continuar disponível.
- Correção: no evento de exclusão, o servidor tenta copiar imagem/áudio do payload Baileys para `StoredFile` (limite 20 MiB) antes de gravar o selo; mídias de visualização única são ignoradas e falha de download conserva o tombstone/metadados.
- Validação: `REQ-267 arquiva a cópia fictícia...` em banco temporário confirmou arquivo e marca após evento de exclusão; integração externa segue no checklist manual.
- Estado: corrigido localmente em 30/10/2026.

## BUG-020 — Contagem do próximo envio desaparecia quando a conexão estava indisponível

- REQ: REQ-284.
- Reprodução: abrir o monitor de campanha com uma execução ativa, tarefa futura e conexão WhatsApp indisponível.
- Resultado: o monitor mostrava apenas “Aguardando conexão do WhatsApp”, escondendo o horário estimado da próxima tentativa apesar de `nextTaskAt`/`nextAllowedAt` disponíveis.
- Correção: mostrar a contagem regressiva prevista junto ao aviso explícito de que aguarda a conexão. Não indica que um envio ocorrerá sem conexão.
- Validação: Playwright com dados e rotas fictícios verificou progresso, contagem e aviso de desconexão, pausa, retomada e cancelamento sem envio; evidências em `REVISAO/evidencias/REQ-283/` a `REQ-288/`.
- Estado: corrigido localmente em 30/10/2026.

## BUG-021 — Áudio de demonstração não tinha fala nem transcrição

- REQ: REQ-344.
- Reprodução: carregar o Espaço de Teste e abrir Atendimento ou Biblioteca; o WAV antigo tocava dois sinais sem fala e dizia explicitamente que não havia transcrição.
- Resultado: o exemplo não demonstrava um áudio falado com texto verificável.
- Correção: substituído por fala sintética pt-BR gerada localmente pelo Microsoft SAPI; texto de exemplo agora corresponde ao áudio.
- Validação: Playwright confirma o player e a transcrição coincidente em 1366×768, 1920×1080 e 390×844.
- Estado: corrigido localmente em 30/10/2026.

## BUG-022 — Vídeo anexado não passa por compressão

- REQ: REQ-381.
- Reprodução: em Atendimento, anexar um WebM sintético maior que o limite desejado e confirmar a prévia.
- Resultado: o upload recebe os mesmos bytes do arquivo original; a marca d’água é preparada, mas não há transcodificação.
- Causa: `Composer.tsx` aplica otimização de imagem, enquanto o ramo de vídeo envia o arquivo original.
- Reteste: Playwright comparou os bytes do vídeo antes e depois; resultado idêntico. As rotas de upload e envio foram interceptadas.
- Estado: defeito aberto; exige caminho de transcodificação compatível com navegador e formatos aceitos pelo conector.

## BUG-023 — Atalho do Estúdio de IA não aparecia no celular

- REQ: REQ-365.
- Reprodução: em 390×844, abrir conversa e procurar o Estúdio de IA nas ações do Atendimento.
- Resultado: a ação ficava dentro do menu de ações oculto; não havia atalho visível para abrir o recurso.
- Correção: atalho móvel “Estúdio de IA” chama o mesmo modal e handler do desktop.
- Reteste: Playwright abriu e usou o Estúdio em 390×844; evidência em `REVISAO/evidencias/REQ-365/mobile-390.png`.
- Estado: corrigido localmente em 30/10/2026.

## BUG-024 — Regras de opt-out salvas não apareciam após carregamento assíncrono

- REQ: REQ-411.
- Reprodução: abrir Configurações → Opt-out e envios quando a API retorna termos personalizados.
- Resultado: o `<textarea>` mantinha os termos padrão mesmo após a resposta; uma edição poderia substituir a configuração salva por valores antigos.
- Causa: `defaultValue` era aplicado antes da carga e o elemento não era remontado quando os dados chegavam.
- Correção: chave do `<textarea>` acompanha a lista carregada e remonta o campo com os termos persistidos.
- Reteste: Playwright local salva termos no fixture, recarrega e confirma o mesmo valor em desktop e celular; nenhum envio ocorreu.
- Estado: corrigido localmente em 30/10/2026.

## BUG-025 — Cache chamado semântico só reconhece semelhança lexical limitada

- REQ: REQ-425.
- Reprodução: habilitar cache aprovado e comparar paráfrases que preservam sentido, mas não compartilham as palavras indexadas nem os sinônimos codificados.
- Resultado: o cache não encontra equivalência semântica geral; usa palavras, um dicionário curto de sinônimos e Jaccard.
- Causa: não existe embedding, índice vetorial nem classificador de intenção no cache. Embeddings locais também não estão implementados (REQ-430 AUSENTE).
- Validação: teste do cache confirma revisão, expiração, isolamento e reutilização para equivalência lexical; não comprova compreensão semântica geral.
- Estado: defeito aberto em 30/10/2026. Nenhum serviço ou modelo externo foi ativado.

## BUG-026 — Macro anuncia figurinha, mas envia apenas recurso de imagem

- REQ: REQ-464.
- Reprodução: Atendimento → Ferramentas → Criar → Macros → Enviar mensagem → “PIX ou figurinha da biblioteca”.
- Resultado: a ação muda para `ASSET`, mas o seletor de recursos não oferece tipo Figurinha. A biblioteca classifica mídia sem modalidade de figurinha e `macros.routes.ts` converte mídia em imagem.
- Causa: não há tipo de recurso figurinha nem payload dedicado de figurinha no editor/execução da macro; o texto do atalho sugere suporte inexistente.
- Reteste: Playwright local reproduziu o seletor sem opção Figurinha em Chromium desktop e mobile; nenhum envio foi feito.
- Correção: pendente; demanda suporte explícito ao tipo sticker no modelo de recurso, seletor e dispatch, ou remoção do texto enganoso.
- Estado: defeito aberto em 30/10/2026.

## BUG-027 — Grid do HUD impedia reduzir o painel lateral a 15 rem

- REQ: REQ-446.
- Reprodução: Personalização → HUD → largura das ferramentas = 15 rem; manter painel encaixado e abrir em viewport desktop.
- Resultado: o controle aceitava 15 rem, mas `hudGrid` limitava a coluna a 21 rem.
- Correção: mínimo CSS da coluna passou a 15 rem; no celular o layout usa gaveta responsiva.
- Reteste: persistência do limite via teste de servidor; Playwright mediu largura e conferiu reload em desktop nos viewports 1366 e 1920.
- Estado: corrigido localmente em 30/10/2026.

## BUG-028 — Biblioteca consulta fluxos sem sessão selecionada

- REQ: REQ-444.
- Reprodução: abrir Atendimento sem conexão selecionada enquanto o painel de ferramentas carrega.
- Resultado: GET `/api/automation/sessions//flows` retornava 404 e registrava erro de console.
- Correção: `ResourceWorkbench` limpa lista de fluxos e encerra o efeito quando `sessionId` está vazio.
- Reteste: Playwright local confirmou console sem erros nos três viewports; API de fluxos não é chamada sem sessão.
- Estado: corrigido localmente em 30/10/2026.

## BUG-029 — Conteúdo da Biblioteca cobria a navegação lateral

- REQ: REQ-484, REQ-485.
- Reprodução: Personalizar Atendimento → Funções → Navegação na biblioteca completa = Ícones na lateral; abrir o painel de ferramentas.
- Resultado: o conteúdo da Biblioteca ocupava a área das abas Biblioteca/Fixados e interceptava cliques.
- Causa: o CSS posicionava um rail de classe antiga; o DOM atual usa `workbench-mode-tabs` e o conteúdo de fixados não tinha um contêiner único.
- Correção: abas e conteúdo receberam áreas próprias do grid; Biblioteca e Fixados estão agrupados num contêiner de conteúdo.
- Reteste: Playwright local clicou Biblioteca/Fixados e alternou todas as categorias em desktop e celular; teste passou 3/3 nos viewports.
- Estado: corrigido localmente em 30/10/2026.

## BUG-030 — Vídeo fictício do Espaço de Teste não abria no Chromium Playwright — corrigido em 30/10/2026

- REQ: REQ-345.
- Reprodução: Espaço de Teste → Biblioteca e atalhos → Vídeo de demonstração.
- Resultado: Chromium recebeu HTTP 206, mas o MP4 permaneceu em readyState=0, com DEMUXER_ERROR_NO_SUPPORTED_STREAMS; canPlayType retornou vazio para H.264/AAC.
- Causa: o Chromium Playwright instalado não inclui o decodificador proprietário usado pelo MP4 de demonstração.
- Correção: criada amostra local WebM/VP8 e o Espaço de Teste passou a usá-la. O critério de reprodução permaneceu igual.
- Reteste: REQ-345 passou 3/3; lacunas Sandbox passaram 24/24 em 3 viewports; suíte do servidor passou 220/220.
- Estado: corrigido. O MP4 usado por outros cenários de mídia não foi alterado.

## BUG-031 — Menu contextual de mensagem fechava ao focar em viewport 1920×1080 — corrigido localmente

- REQs: REQ-678, REQ-682.
- Reprodução: abrir Atendimento em Chromium 1920×1080, selecionar a conversa fictícia Ana Exemplo e clicar com o botão direito na mensagem recebida.
- Resultado: o evento era cancelado pelo handler e o popover era montado, mas uma rolagem automática de `.message-area` acionava o listener de fechamento e removia o menu.
- Causa: o foco inicial no primeiro item usava `focus()` sem `preventScroll`, deslocando a área rolável durante a abertura.
- Correção: o foco inicial agora usa `focus({ preventScroll: true })`; o fechamento por scroll espera dois frames para ignorar apenas a rolagem de colocação inicial. Rolagens posteriores do usuário continuam fechando o menu.
- Reteste: `e2e/context-menu-audit.spec.ts` passou 18/18 em 1366×768, 1920×1080 e 390×844, inclusive clique direito real em 1920×1080. Nenhum envio ou mutação real.
- Estado: corrigido localmente em 30/10/2026.
