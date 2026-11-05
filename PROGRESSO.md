# Progresso — campanhas (Levas 1 e 2)

Branch: `auditoria-reqs`. Diretório oficial. Nenhuma chamada de envio real, produção, `.env.local` ou publicação foi usada. Os testes usaram SQLite temporário e socket/conector fictício.

## Concluído
- Variações: total de até 10 mensagens contando a principal, nomes editáveis, texto obrigatório, contador de caracteres, adicionar/duplicar/remover com confirmação e prévia selecionável. Distribuição aleatória equilibrada ou rodízio; cada tarefa guarda índice, texto congelado e versão.
- Personalização: `{{nome}}`, `{{saudacao}}` e `#nome`; contato sem nome usa “aí” como reserva.
- Lotes: sequência de destinatários congelada no salvamento e ordenada por horário/ordem estável; tamanho inicial padrão 50; pausa padrão após o lote; opção de continuar direto; resumo geral, métricas por variação e histórico de lote/leads/versão.
- Continuação: permite revisar textos, CTAs, follow-ups, intervalos, pausas longas, horários permitidos e tamanho antes de iniciar o próximo lote. Leads enviados nunca voltam para a fila quando filtros/etiquetas mudam.
- Segurança: fila permanece no servidor; desconexão pausa e pode retomar automaticamente; pausa/retomada gera histórico e aviso persistente. `RUNNING` após reinício e falha de confirmação viram `VERIFY`; o painel permite decidir entre tentar novamente ou marcar como enviado. O ID da solicitação permanece idempotente.
- Compatibilidade: mantém o congelamento da campanha existente. Nenhuma migração SQL foi necessária: os novos metadados ficam nos campos JSON existentes e o status da tarefa já é texto; campanhas antigas continuam legíveis.

## Testes e validações
- Aceite 1 — queda durante o lote, pausa, reconexão e envio do próximo lead sem repetição: **PASSOU**.
- Aceite 2 — reinício durante envio, status `VERIFY`, nenhum reenvio automático e resolução manual: **PASSOU**.
- Aceite 3 — lote de 50, edição da mensagem/CTA e próximo lote nos contatos 51–100, sem duplicatas: **PASSOU**.
- Aceite 4 — mudança de etiqueta entre lotes sem reintroduzir leads enviados nem alterar a lista congelada: **PASSOU**.
- Continuação direta e histórico de lotes: **PASSOU**.
- Regressões de campanha congelada, agendamento/cancelamento, saída de campanha, follow-up e fila no servidor: **6 testes passaram**.
- `npm run typecheck`: **PASSOU**. `npm run build`: **PASSOU**; Vite emitiu apenas o aviso já conhecido de um chunk acima de 500 kB.

## Commits
- `6d2258d` — inicia este registro de retomada.
- `80a19c7` — fila em lotes, pausa/retomada, rotas e testes do servidor.
- `bd8511d` — editor e monitor de campanha.
- `8a7b4a3` — resumo da implementação e das validações.

## Sincronização
- Não foi feito push. A diferença preexistente entre `auditoria-reqs` e `origin/auditoria-reqs` contém `REVISAO/evidencias/REQ-686/process.json` e `scripts/iniciar-noctua-online.ps1`, que são protegidos. Enviar a branch inteira incluiria esses arquivos; os commits anteriores não foram reescritos nem enviados.

## Retomada / pendências
- Leva 1 concluída localmente; Leva 2 não iniciada.
- Os arquivos protegidos e artefatos não rastreados preexistentes ficaram fora das alterações e do staging deste trabalho.
- Próximo passo: conferir a tela em `Operações > Campanhas`, criar campanha fictícia, conferir variações/preview e acompanhar o monitor; para verificar lote, use tamanho 50 e público de pelo menos 100 contatos de teste.

## Leva 2 — CTAs, opt-out e teste pessoal — 05/11/2026

### Implementado
- CTAs aceitam várias palavras/frases separadas por vírgula, ponto e vírgula, barra ou nova linha; comparação normaliza maiúsculas, acentos e pontuação. Respostas podem combinar texto, recurso da biblioteca e etiqueta. Ação que só aplica etiqueta não envia mensagem vazia; respostas com texto e mídia viram uma sequência na fila do servidor.
- Resposta padrão opcional é enfileirada uma única vez por contato e campanha. Respostas vinculadas à campanha geram notificação interna, são reconhecidas no status do lead e cancelam follow-ups pendentes. Respostas estruturadas de botão/lista são extraídas para suportar opções numéricas.
- Opt-out reconhece termos configurados e sinônimos comuns no começo da mensagem, cria a etiqueta “Não perturbe”, marca o contato, cancela envios futuros/follow-ups e o exclui dos novos públicos. Configurações expõem a lista para remoção manual; remoção limpa a marca e as etiquetas de bloqueio correlatas.
- Campanha pode anexar linha de saída editável à mensagem principal/variações e à prévia. Endpoint de teste resolve variáveis com dados fictícios e envia apenas ao número da própria sessão; não cria DeliveryTask nem altera contadores da campanha. Há botões separados para a mensagem principal e cada variação.
- Novos CTAs, resposta padrão e linha de saída são compatíveis com os campos JSON existentes; não foi necessária migração SQL. A rota de continuação também preserva aliases, mídia/etiquetas de CTA, resposta padrão e linha de saída.

### Validação
- Leva 2 critérios 1–4: **4/4 passaram** em `apps/server/test/operations.test.ts`, SQLite temporário e FakeSocket. Inclui duplicidade, resposta padrão/follow-up, opt-out/público/lista/remoção e envio pessoal sem tarefa/campanha alterada.
- Regressão WhatsApp: **21/21 passou**, incluindo o teste existente de opt-out.
- Typecheck dos dois workspaces: **passou**. Build completo: **passou**; mantém aviso de chunk frontend acima de 500 kB.
- Regressão completa do módulo Operations: **71/74 passaram** na execução única. Os três testes antigos que falharam (REQ-142, REQ-402/403 e rodízio) passaram quando executados individualmente; falhas agregadas indicam interferência de dados/timing entre testes preexistentes, sem falha reproduzível nas alterações da Leva 2.
- Revisão visual pelo servidor local não foi possível: a API em `127.0.0.1:3333/atendimento` apresenta a tela “Acesso em configuração” (Firebase público ausente) e as portas de frontend 5180/5173 não estavam escutando. Nenhum servidor foi reiniciado e nenhuma configuração Firebase foi alterada.

### Arquivos desta leva
- `apps/server/src/modules/operations/campaign-response.ts`, `delivery.worker.ts`, `operations.routes.ts`: regras e persistência JSON de CTA/fallback/teste/continuação.
- `apps/server/src/modules/whatsapp/sync.service.ts`: extração de resposta livre/estruturada e opt-out.
- `apps/server/test/operations.test.ts`: quatro critérios de aceite com banco e socket fictícios.
- `apps/web/src/pages/OperationsPages.tsx`: editor de CTA/saída e envio de teste por variação.
- `apps/web/src/pages/WorkspaceSettings.tsx`, `operations.css`: lista “Não perturbe” e remoção adaptável a telas estreitas.
- `PROGRESSO.md`: este resumo de retomada.

### Retomada
- Leva 2 concluída localmente; não foi enviada nenhuma mensagem real, nem houve conexão externa, publicação ou alteração de infraestrutura.
- O frontend local deve ser iniciado pelo usuário para revisar os controles na tela; o ambiente aberto atualmente não tem as variáveis públicas Firebase para autenticação.

## Correção — ordem das sequências por contato — 05/11/2026

- A fila agora mantém uma sequência ativa por campanha: envia todas as etapas de um contato, respeita a espera configurada entre elas e só então avança para o próximo contato.
- Campanhas de sequência já existentes são reconhecidas a partir das tarefas pendentes; se uma etapa já estava em andamento, a retomada prioriza essa etapa para não reiniciar a sequência.
- Contadores e pausas longas passam a contar leads concluídos, não mensagens individuais da sequência. Campanhas novas e respostas de CTA com sequência usam o mesmo controle.
- Validação com SQLite temporário e FakeSocket: **PASSOU** — dois contatos receberam a sequência completa, em ordem por contato; a segunda etapa respeitou espera; a campanha concluiu com dois leads contados e pausa longa aplicada após o segundo.
- `npm run typecheck` no servidor: **PASSOU**. Nenhum envio real foi realizado.

## Ritmo de campanha e previsão de término — 05/11/2026

- O editor oferece velocidades 1×, 1,5× e 2×. O valor reduz os intervalos entre contatos, pausas configuradas e esperas entre etapas; os tempos de follow-up continuam respeitando os minutos definidos.
- O monitor mostra uma previsão de duração e mensagens/contatos restantes. A estimativa usa a fila quando a API oferece esses dados e usa o público restante e intervalos como alternativa.
- Validação: typecheck de servidor e web **PASSOU**; teste de sequência com fila fictícia **PASSOU**; build completo **PASSOU**. O aviso existente de chunk web acima de 500 kB permanece.
- Deploy de produção Vercel concluído: https://notcua.vercel.app (deployment `dpl_C1gA2McvNgYCZD6kKTe2wbLFGcty`). A resposta HTML de produção foi conferida com `vercel curl`.
- Nomes dos contatos: a mensagem continua usando o nome do cadastro do Noctua. O título do chat no WhatsApp depende do catálogo de contatos sincronizado no telefone/WhatsApp e não pode ser gravado pela conexão Baileys do Noctua; não houve alteração nos contatos do aparelho.
- Nenhuma mensagem real foi enviada. O deploy da Vercel atualiza o painel web; o servidor persistente da API permanece hospedado separadamente.

## Publicação do painel a partir do diretório oficial — 05/11/2026

- Código de campanhas, sequência, ritmo e interface salvo em `81ab203` na branch `auditoria-reqs`; arquivos protegidos e artefatos não rastreados ficaram fora do commit.
- `npm run typecheck` e `npm run build -w @noctua/web` passaram. Testes focais: quatro aceites da Leva 1 e quatro da Leva 2 passaram com SQLite e socket fictícios. O teste de sequência falhou na execução conjunta por interferência de dados de outro teste e passou isoladamente (1/1).
- Painel publicado diretamente do diretório oficial na Vercel: `dpl_3bYZ9npQE2XFYGuMmpgrsnWzAMAc`, produção `https://notcua.vercel.app`, estado `READY`; `vercel curl` confirmou a resposta HTML.
- A API/worker continuam no computador local e dependem do processo, túnel e conexão estarem ativos. Nenhum disparo real foi feito nesta etapa. A entrega a 25–50 leads, reconexão real e proteção contra duplicidade no WhatsApp real ainda não foram validadas.
- Push do Git permanece pendente: a branch local contém commits anteriores que alteram `REVISAO/evidencias/REQ-686/process.json` e `scripts/iniciar-noctua-online.ps1`, protegidos contra inclusão no envio. Não enviar a branch inteira sem resolver esse histórico de forma explícita.
## Retomada — alternativas completas de campanha — 05/11/2026

- [ ] Rotação de alternativas completas por lead, incluindo texto, mídia, sequência, funil e fluxo.
- [ ] Conteúdo e alternativa congelados por contato.
- [ ] Até 10 alternativas; adicionar, duplicar e remover com confirmação e mínimo 1.
- [ ] Lotes estáveis, continuação, exclusão de contatos já enviados e histórico por lote.
- [x] Pausa/retomada segura no servidor, estados por lead e proteção contra duplicidade.
- [ ] Compatibilidade retroativa com campanhas já existentes.
- [ ] Testes fictícios: queda, reinício, lotes 1/2, filtro alterado e rotação 1-2-3.
- [ ] Build e suíte relevante aprovados.
- [ ] Deploy só após aprovação completa, com rollback verificável.

Decisão: cada alternativa é um conteúdo completo; sequência é uma única alternativa e mantém sua ordem e esperas. Campanhas legadas continuam usando os campos atuais até serem editadas.

### Fase 1 — modelo aditivo e flag desativada — concluída localmente

- [x] Estrutura CampaignAlternative / CampaignAlternativeStep e snapshots por tarefa adicionados ao schema.
- [x] Migração aditiva cria tabelas/colunas sem atualizar nem apagar os JSONs antigos. Cada BATCH legado recebe uma alternativa compatível; tarefas sequenciais preservam cada etapa, ordem e espera.
- [x] `CAMPAIGN_ALTERNATIVES_ENABLED` existe e assume `false` por padrão. Nenhuma rota/worker usa o novo modelo enquanto desligada.
- [x] Prova SQLite isolada: migrações antigas + campanha e tarefa sequencial fictícias + migração nova; JSON legado idêntico antes/depois e etapas de texto/mídia com posições/esperas preservadas.
- [x] Prisma schema validado; `npm run typecheck` concluiu com exit code 0.
- [x] Após autorização explícita e confirmação de zero campanhas ativas, servidor/worker local parados graciosamente; `prisma generate` concluiu com Prisma 6.19.3.
- [x] Migração passou em cópia do backup: `migrate deploy` aplicou a 9ª migração; 25 campanhas viraram 25 alternativas; 27 etapas backfilled; integrity `ok`; contagens de tarefas preservadas.
- [x] Migração aplicada no banco real com o mesmo Prisma; integrity `ok`, 25 campanhas, 25 alternativas e 27 etapas. As tarefas permanecem exatamente 2 CANCELLED, 37 COMPLETED, 9 QUEUED e 1 VERIFY.
- [x] Servidor reiniciado: `/health` retornou `ok`, runtime `firebase`; sessão WhatsApp no banco indica 1 CONNECTED e 3 DISCONNECTED. Worker só seleciona batches `ACTIVE`/retomáveis e tarefas `QUEUED`; `DRAFT` e `VERIFY` não são processados.
- Feature flag permanece desligada; sem deploy.

### Verificação prévia autorizada do banco real — 05/11/2026 12:22 BRT

- Backup SQLite consistente feito antes de consultar estados: `.audit/backups/noctua-before-alternatives-20261105-122228.db` (324.792.320 bytes); `PRAGMA integrity_check` no backup retornou `ok`.
- Banco consultado sem expor dados pessoais: nenhuma campanha estava ativa/agendada. As 9 tarefas `QUEUED` eram de campanhas `DRAFT`; a tarefa `VERIFY` pertence a campanha `COMPLETED`. Com autorização explícita posterior do usuário, servidor foi parado graciosamente e as tarefas foram preservadas.
- Migração real concluída, banco verificado e servidor reiniciado conforme Fase 1.
- `CAMPAIGN_ALTERNATIVES_ENABLED=false`; sem deploy.

### Fase 2 — worker e criação das tarefas — concluída localmente em 05/11/2026

- API de criação aceita `alternatives: [{ name, delivery }]` (1–10), com texto, recurso da biblioteca ou sequência de texto/mídia. Com a flag desligada, alternativas explícitas são recusadas e campanhas legadas mantêm o comportamento anterior. Funis/fluxos e editor de alternativas não foram ampliados nesta fase.
- Rodízio determinístico por posição do público congelado: 1, 2, 3, 1, 2, 3. Alternativas, etapas e tarefas são gravadas na mesma transação; cada tarefa recebe ID estável por campanha/conversa, alternativeId, alternativeIndex, frozenContent e cursor stepIndex. O worker não consulta alternativas editáveis para enviar.
- Sequências completas contam um lead, mantêm exclusividade por contato e esperas entre etapas. Cursor e avanço da fila são persistidos junto ao resultado. A retomada usa a próxima etapa após a última confirmação persistida. RUNNING interrompido continua virando VERIFY: entrega incerta nunca é reenviada automaticamente.
- Idempotência usa as chaves persistentes de MessagingService (`delivery:<tarefa>:<etapa>`). Texto/mídia já confirmados não voltam ao socket se a tarefa for recuperada antes da transação de conclusão do worker.
- Provas novas: `apps/server/test/delivery-alternatives.test.ts`, SQLite temporário e FakeSocket, **9/9 passaram**. Incluem sete leads em rodízio com nova instância do worker a cada envio, sequência como uma alternativa, snapshot preservado após editar origem, mídia/legenda congeladas, reexecução idempotente, espera, cursor, contagem por lead e reinício com entrega incerta.
- Regressão completa `operations.test.ts`: **74/74 passou**. Corrigido isolamento das fixtures: campanhas anteriores injetavam envios; importação deduplicada preservava nomes de outros casos; mais de 100 conversas antigas ocupavam a página da distribuição. Expectativas funcionais preservadas; nenhum ajuste de regra de negócio nesses casos.
- Typecheck servidor/web e build do servidor passaram. Neste ambiente Windows, tsx falhou antes de executar por `uv_os_get_passwd/ENOMEM`; validação executada com loader local `.audit/phase2-test-loader.mjs` (em apps/server), usando registerHooks/stripTypeScriptTypes do Node, sem modificar dependências.
- Flag de execução permanece desligada. Nenhum acesso ao banco real, reinício de serviço do usuário, envio real, push ou deploy. Fase 1 preservada; demais fases não iniciadas.

### Fechamento verificado da Fase 2 — 05/11/2026

- A conferência antes da Fase 3 encontrou duas lacunas; por isso foi executada somente a conclusão da Fase 2, conforme a condição do usuário. Nenhum arquivo do editor foi alterado.
- Corrigida a ultrapassagem no rodízio quando a primeira alternativa tem espera inicial: seleção usa a ordem persistida do público e prioriza sequência já iniciada, sem adiantar leads posteriores pelo runAt.
- Corrigida a resolução manual de uma etapa incerta: marcar como enviada agora avança o cursor, preserva a espera e as etapas restantes, mantém a campanha pausada e conta o lead apenas no término da sequência. Atualização da tarefa e da campanha é transacional, com recusa de resolução concorrente.
- Ambos os defeitos foram reproduzidos por novos testes antes das correções. Detalhes em REVISAO/BUGS.md. A flag permanece desligada; sem banco real, envio real, reinício de serviços, push ou deploy.
- Build web concluído com `npm exec -w @noctua/web -- vite build --configLoader runner` (aviso existente de chunk >500 kB). O carregador padrão do Vite/esbuild encontrou acesso negado ao inspecionar diretórios ascendentes; o runner resolveu sem alterar dependências ou configuração.
- Validação final após ambas as correções: **85/85 testes passaram** (11 dedicados, incluindo o agrupador, + 74 Operations), typecheck servidor/web e builds servidor/web aprovados. Evidência local: apps/server/.audit/phase2-final-results.txt.
- Commit tentado novamente; `git add` recusado ao criar `.git/index.lock` (Permission denied). Alterações salvas; fechamento do commit depende da permissão de escrita em .git. Fase 3 não iniciada.

### Fase 3 — editor de alternativas completas — concluída localmente em 05/11/2026

- Editor integrado à criação de campanha: alternativa inicial única, nomes editáveis, Adicionar, Duplicar com IDs independentes e Remover com confirmação. Limites de 1–10 alternativas aplicados aos controles; ao remover, seleção e prévia passam para uma alternativa restante.
- Cada alternativa permite até 30 etapas de texto ou recurso da biblioteca, com espera própria em segundos, mover para cima/baixo e remover mantendo no mínimo uma etapa. Upload/gravação reaproveita o componente existente; a atualização assíncrona preserva as outras alternativas.
- Prévia com seletor sincronizado à edição, textos personalizados e mídia na ordem das etapas, incluindo as esperas. Contadores por alternativa mostram caracteres de texto, quantidade de etapas e total de espera; cada texto conserva o limite de 10.000 caracteres. Legendas da prévia mantêm contraste no tema escuro.
- Salvamento serializa todas as alternativas para o contrato da Fase 2 e valida também alternativas fora da seleção atual. Erro da API mantém o rascunho para nova tentativa. Rodízio é enviado explicitamente; campos legados continuam disponíveis fora do modo de alternativas.
- O GET /operations/features apenas informa campaignAlternativesEnabled. O novo modo fica disponível somente quando a flag existente está habilitada; a flag real continua desligada e não foi alterada. Nenhuma migração, worker ou regra da Fase 2 foi ampliada nesta fase.
- Testes Playwright: **9/9 passaram**, cobrindo 1366×768, 1920×1080 e 390×844. Provas incluem mínimo/máximo, cópia independente, cancelamento/confirmação de remoção, seleção após remoção, texto/mídia/espera/reordenação na prévia e no payload, validação de alternativa não selecionada, erro 503 e nova tentativa com conteúdo preservado, flag desligada e ausência de overflow do dialog. API e mídia inteiramente fictícias.
- Regressão servidor: **86/86 passou** (12 em delivery-alternatives.test.ts, incluindo o agrupador e o teste novo de capacidade; 74 Operations). Typecheck servidor/web e build servidor/web aprovados. Build web usa --configLoader runner devido ao acesso negado do carregador padrão neste ambiente; permanece apenas o aviso conhecido de chunk >500 kB.
- Evidências locais: .audit/phase3-confirmation.txt, .audit/phase3-screenshots/ e apps/server/.audit/phase3-server-tests.txt. O harness em e2e/fixtures e o servidor de teste em e2e/scripts/phase3-editor-server.mjs usam build isolada sem arquivos de ambiente, login real ou chamadas externas. Execução: iniciar esse servidor e usar PHASE3_USE_RUNNING_SERVER=1 com playwright -c e2e/phase3.config.ts. Detector de interface: nenhum apontamento nos arquivos verificados.
- Sem deploy, push, envio real ou acesso ao banco real. Demais fases não iniciadas. Alterações preexistentes, arquivos protegidos e .gitignore preservados fora do staging solicitado.
- Commit da Fase 3 tentado com caminhos explícitos; git add falhou novamente em .git/index.lock com Permission denied. Código, testes e documentação estão salvos; nenhum commit foi criado e nenhum push/deploy foi executado. Restrição de escrita em .git registrada no protocolo.

### Confirmação posterior de commits das Fases 2 e 3 — 05/11/2026

- Fases 2 e 3 estão commitadas localmente: `f521bbd` (`feat: add campaign alternatives editor`) e `f262490` (`Fase 3: correcoes de rotas, preview e testes de alternativas`). O segundo commit foi feito pelo usuário e também registrou correções de rotas e testes.
- Os registros anteriores de falha de escrita em `.git` descrevem a tentativa inicial; foram superados pelo commit manual. Nenhum push ou deploy foi feito.

### Fase 4 — envio em lotes de alternativas — concluída localmente em 05/11/2026

- Continuação preserva, para cada lead pendente, o `alternativeId`, o `alternativeIndex` e o `frozenContent` já congelados. Alterações posteriores nos filtros/etiquetas não remontam o público nem reintroduzem leads concluídos; a continuação opera sobre as tarefas pendentes do público original.
- A numeração e a ordem dos lotes seguintes são persistidas no payload em ordem estável. O cálculo usa o número do lote anterior e o tamanho selecionado, identificando corretamente lote 2, lote 3 e os seguintes mesmo quando há mais de um lote restante.
- Teste novo em `apps/server/test/delivery-alternatives.test.ts` cobre 5 leads, tamanho 2, rotação 1–2–3, mudança de metadados durante a pausa, snapshots intactos, histórico de leads do lote e envio na ordem congelada. Testes existentes cobrem queda/retomada, `VERIFY` após reinício, idempotência e os aceites de lotes 1/2 e filtros alterados.
- Suíte conjunta `delivery-alternatives.test.ts` + `operations.test.ts`: **87/87 passaram**, com SQLite temporário e FakeSocket. Typecheck do servidor passou; o build do servidor passou. `npm run build` executou `tsc` do web, mas o carregador padrão do Vite falhou por acesso negado ao diretório ascendente no Windows; `npm exec -w @noctua/web -- vite build --configLoader runner` passou. Permanece apenas o aviso conhecido de chunk acima de 500 kB.
- Nenhum deploy, push, envio real ou acesso ao banco real foi feito. O código de continuação e o teste de Fase 4 constam no commit `f262490`; o fechamento documental foi commitado em `b8782e0` (`docs: record phase 4 batch delivery`).

### Fase 5 — pausa e retomada segura — concluída localmente em 05/11/2026

- Claim de tarefa e conferência do estado da campanha agora são transacionais: uma pausa que acontece antes do claim impede o envio; uma pausa durante envio deixa somente a mensagem já em curso concluir, persiste cursor/contadores e mantém a fila seguinte bloqueada.
- Após reinício, tarefas `RUNNING` viram `VERIFY` e campanhas `ACTIVE` ou `PAUSED_CONNECTION` são pausadas sem retomada automática. A ação de retomar recusa campanhas com qualquer tarefa `VERIFY` pendente.
- Resolver `VERIFY` é transacional e idempotente: `mark-sent` só conta uma vez; `retry` respeita estados terminais, só reabre a campanha após resolver a última incerteza e reutiliza o ID persistente por etapa para evitar duplicidade.
- Reproduções locais e testes adicionados em `apps/server/test/operations.test.ts` cobrem pausa durante envio, contagem correta do lead já confirmado, bloqueio do próximo, retomada após resolver `VERIFY`, tentativa de resolução duplicada e retry com entrega já confirmada no FakeSocket. O aceite de desconexão/reconexão existente também passou.
- Suíte conjunta `delivery-alternatives.test.ts` + `operations.test.ts`: **89/89 passaram** com SQLite temporário e FakeSocket. `npm run typecheck` (servidor e web) e build do servidor passaram. Build web passou com `vite build --configLoader runner`; o comando padrão segue bloqueado por acesso negado do esbuild a diretório ascendente no Windows. Aviso conhecido de chunk >500 kB.
- Nenhum envio real, acesso ao banco real, push ou deploy foi feito.
- Commit da Fase 5: `2e97192` (`fix: make campaign pause and resume safe`). O registro foi confirmado após a gravação desta seção.

### Fase 6 — validação integral e publicação — não aprovada em 05/11/2026

- Suíte completa do servidor executada com loader Node local e banco SQLite isolado (incluindo `AUDIT_DB_PATH` temporário para o teste REQ-680): **285/285 passaram**. O comando `npm test` padrão ainda falha antes de executar por `tsx`/`uv_os_get_passwd` retornando `ENOMEM` no Windows.
- Typecheck dos dois workspaces passou. Build do servidor passou. Build da web passou com Vite `--configLoader runner` e valores Firebase/API fictícios, sem alvo de produção; o carregador padrão do Vite falha com acesso negado ao diretório ascendente.
- E2E: execução ampla reportou 621 casos planejados e foi interrompida em 41 após falhas repetidas de setup/seletores e fixture: botão direto “Configurações” não encontrado na navegação atual e alguns cenários exigem pelo menos cinco conversas, enquanto a fixture local possui três. A rodada não concluiu e não está verde.
- A condição exigida para liberar a flag/publicação não foi atingida. `CAMPAIGN_ALTERNATIVES_ENABLED` não foi ativada e nenhum deploy, push, alteração de configuração de produção ou envio real foi feito. O servidor de teste usou banco em `%TEMP%` com cópia/semente fictícia; build web usou URL local `127.0.0.1:3340`.
- Antes de retomar o gate de publicação, alinhar a fixture e os seletores de E2E com a navegação atual, executar os 621 casos até conclusão sem falhas, e validar um caminho de publicação/rollback disponível. O CLI `vercel` não está instalado neste ambiente; a API contínua não é hospedada pelo `vercel.json` (que publica apenas o painel estático).
- Os arquivos rastreados de evidência sobrescritos pela execução parcial foram restaurados byte a byte para `HEAD`; nenhuma evidência da auditoria foi mantida como saída dessa tentativa incompleta.
