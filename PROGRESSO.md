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
- [ ] Pausa/retomada segura no servidor, estados por lead e proteção contra duplicidade.
- [ ] Compatibilidade retroativa com campanhas já existentes.
- [ ] Testes fictícios: queda, reinício, lotes 1/2, filtro alterado e rotação 1-2-3.
- [ ] Build e suíte relevante aprovados.
- [ ] Deploy só após aprovação completa, com rollback verificável.

Decisão: cada alternativa é um conteúdo completo; sequência é uma única alternativa e mantém sua ordem e esperas. Campanhas legadas continuam usando os campos atuais até serem editadas.

### Fase 1 — modelo aditivo e flag desativada — implementação local, aplicação Prisma bloqueada

- [x] Estrutura CampaignAlternative / CampaignAlternativeStep e snapshots por tarefa adicionados ao schema.
- [x] Migração aditiva cria tabelas/colunas sem atualizar nem apagar os JSONs antigos. Cada BATCH legado recebe uma alternativa compatível; tarefas sequenciais preservam cada etapa, ordem e espera.
- [x] `CAMPAIGN_ALTERNATIVES_ENABLED` existe e assume `false` por padrão. Nenhuma rota/worker usa o novo modelo enquanto desligada.
- [x] Prova SQLite isolada: migrações antigas + campanha e tarefa sequencial fictícias + migração nova; JSON legado idêntico antes/depois e etapas de texto/mídia com posições/esperas preservadas.
- [x] Prisma schema validado; `npm run typecheck` concluiu com exit code 0.
- [ ] Prisma `migrate deploy` em banco isolado falhou com `Schema engine error` sem detalhe. `prisma generate` falhou ao substituir `query_engine-windows.dll.node` (`EPERM`), provavelmente porque o servidor local o mantém carregado; `--no-engine` gerou um cliente sem engine e não serve para testes/runtime.
- Bloqueio antes de avançar: aplicar e testar a migração via Prisma com o engine funcional; não parei o servidor em execução para evitar interromper possíveis campanhas. Feature flag permanece desligada; sem deploy.
