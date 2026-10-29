# REQ-109 — resposta fora do horário, 29/10/2026

## Regra confirmada

- Mensagens de leads continuam entrando fora do horário.
- Funis, fluxos e agendamentos continuam executando normalmente.
- Administrador pode definir horário de segunda a sexta, ativar resposta e escrever o texto.
- Cada lead recebe no máximo uma resposta por dia no fuso de São Paulo, mesmo entre conexões do mesmo espaço de trabalho.

## Prova nesta etapa

- `apps/web/src/pages/WorkspaceSettings.tsx:508–574`, formulário de Negócio: configuração, validação local e texto; opção desligada quando ausente.
- `apps/server/src/modules/operations/operations.routes.ts:218–224`, `PUT /settings/business`: apenas administrador e validação dos novos campos; `apps/server/src/modules/operations/records.ts:49–56`, persistência no registro de configuração existente.
- `apps/server/src/modules/operations/business-hours-reply.ts:11–17`, valida horário e texto quando ativado; `withinBusinessHours` em `:35–42` usa São Paulo e aceita intervalo que atravessa meia-noite.
- `BusinessHoursReplyWorker.start/flush/reply` em `business-hours-reply.ts:59–131` lê somente eventos novos de entrada, filtra horário, grupo e opt-out, evita responder após abertura ou em dia posterior, usa identificador de envio estável e grava limite diário por contato. `apps/server/src/modules/access/workspaces.ts:77–105` inicia e para o worker por espaço de trabalho.
- `apps/server/test/access.test.ts:354–408`: teste direcionado 1/1 passou. Confirmou PUT/GET, configuração após reabrir SQLite descartável, isolamento entre espaços, 403 para atendente e 422 para texto vazio. Foi repetido apenas o teste específico porque a nova configuração alterou esse percurso.
- `apps/server/test/business-hours-reply.test.ts:12–106`: teste novo 1/1 passou. Remetente fictício, sem WhatsApp real; comprovou horário, limite diário entre duas conexões, persistência após reinício, grupos, opt-out e mensagem atrasada após abertura.
- `tsc --noEmit` passou nos projetos `apps/server` e `apps/web`.

## Limites e dependências

REQ-109 permanece **PARCIAL**. Falta percurso visual do formulário, salvar e recarregar na aplicação permitida, e entrega controlada com autorização explícita. Não houve envio real, cobrança, alteração de banco de produção, migração nem publicação. A fonte é `FlowInboxEvent` criado para mensagem recebida ao vivo em `apps/server/src/modules/whatsapp/sync.service.ts:304–307`; mensagens históricas não acionam a resposta. A resposta não é enviada se o evento for processado depois da abertura ou em outro dia. O recurso depende de servidor e conexão WhatsApp ativos.

O teste de REQ-661 continua restrito à leitura das ligações existentes de Mensagens; nenhuma suíte já aprovada de Mensagens foi executada nesta etapa.
