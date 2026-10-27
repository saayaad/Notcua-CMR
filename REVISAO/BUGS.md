# Registro de bugs — revisão

Atualização: 27/10/2026. Nenhum defeito funcional novo confirmado na Fase 1 e nenhuma correção de aplicativo realizada.

| ID | Onde | O que aconteceu | Causa | Correção | Reteste |
|---|---|---|---|---|---|
| AMB-001 | Build inicial no terminal restrito | Vite/esbuild não conseguiu ler diretórios/configuração | Permissão do ambiente, não causa de código comprovada | Nenhuma alteração de código; execução autorizada | npm.cmd run build passou, servidor e interface |
| OBS-001 | Build web | Aviso de pacote principal maior que 500 kB | Tamanho de código informado pelo compilador | Não alterado nesta fase | Compilação final passou em 27/10; avaliar impacto na Fase 2 |

## Relatos históricos a conferir

Os relatos do usuário estão individualizados em REQUISITOS.md (L-05, L-17, L-18, L-19, L-20, L-23 e L-24). Relatórios anteriores dizem que alguns foram corrigidos, mas não ganham status 🔧 nesta revisão sem reteste próprio.
IDs BUG-001 em diante serão atribuídos a defeitos concretos na Fase 2. Não converter observação ambiental em bug do produto.

## BUG-002 — Resumo para de acompanhar conversas longas

Prioridade alta; esforço estimado M. `apps/server/src/modules/operations/ai.service.ts:27–31, 62–70`: a consulta carrega no máximo 60 mensagens, mas a atualização compara o tamanho dessa janela com `covered`. Depois de criar um resumo com `covered=57`, novas mensagens não fazem `60 - 57` atingir o intervalo de 10. Configurar intervalo acima de 60 também impede o primeiro resumo.

Reprodução em 27/10/2026: execução real de `generateSuggestion` com repositório em memória e provedor inteiramente fictício, primeiro com 60 e depois com 90 mensagens. Houve 1 resumo antes e 1 depois, `covered=57`, demonstrando que o resumo ficou parado. Zero chamadas externas; nenhuma leitura de conversa real. Script de diagnóstico ignorado pelo Git: `.npm-cache/audit-ai-economy.mts`.

Correção planejada: avançar por identificador/horário estável das mensagens cobertas, incluindo o resumo anterior e somente o trecho novo; distinguir total da conversa de tamanho da janela. Retestar mais de 100 mensagens, intervalo 100, retomada depois de reiniciar e falha do provedor. Ainda não corrigido nesta fase de auditoria. REQ-433/434.

## BUG-003 — Cache não exige aprovação e pode reutilizar saudação personalizada

Prioridade alta; esforço M. `apps/server/src/modules/operations/ai.service.ts:39–50,109–110`: respostas produzidas pelo modelo são incluídas diretamente em `AI_SEMANTIC_CACHE`, sem aprovação, e a busca não exige estado aprovado ou resposta genérica. O filtro exclui alguns números/valores, mas não nomes. A interface anuncia respostas “aprovadas”.

Reprodução isolada: dois clientes fictícios fizeram a mesma pergunta. A primeira resposta simulada foi “Oi, Joana! Podemos conversar sobre o mascote.”; na segunda conversa o método retornou exatamente essa resposta com `cached=true`, sem chamada ao provedor e sem qualquer etapa de aprovação. Isso demonstra o defeito com dados fictícios; não afirma vazamento ocorrido na operação real.

Correção planejada: separar sugestão e publicação no cache, exigir aprovação explícita, impedir reutilização de dados personalizados e invalidar entradas antigas sem aprovação. Incluir teste de isolamento entre operações e dois clientes com perguntas iguais. A mudança nas regras de publicação/limpeza de entradas antigas será apresentada no lote de correções; nenhum cache real foi alterado. REQ-424/425/442.

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
- BUG-002/003 e INT-001 continuam abertos e com testes funcionais de IA adiados por solicitação do usuário. Os textos anteriores descrevem o estado histórico antes deste lote.

## BUG-005 — Prévia de texto mostrava marcadores literalmente — corrigido

AssetPreview.tsx usava um parágrafo de texto simples, embora o chat aplicasse FormattedText. Corrigido para a mesma renderização segura em texto/legenda; não usa HTML arbitrário. UI conferiu strong em “3 dias úteis”. O estado de URL/erro também é limpo ao trocar de recurso para impedir prévia anterior durante carregamento. Build da interface aprovado; não alterada a lógica de envio.

## BUG-006 — Reset recuperava preferências locais antigas — corrigido

SafetyZone apagava apenas chaves com prefixo noctua:, mas as preferências usam noctua-preferences:uid e a seleção usa noctua-active-session:uid. Corrigido com clearOperationLocalState: limpa a conta corrente, tema e estado das ferramentas, preserva outras contas e Firebase. Teste com duas contas aprovado. Reset também bloqueia fluxos/macros/funis RUNNING; quatro casos safety.test.ts aprovados, com recuperação de snapshot. Modal de confirmação vermelho e EXCLUIR exato conferidos; reset real somente em banco descartável.
