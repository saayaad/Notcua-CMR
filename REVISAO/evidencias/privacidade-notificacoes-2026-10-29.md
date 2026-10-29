# REQ-105/106 — privacidade e notificações, 29/10/2026

Diagnóstico somente por leitura de código e da evidência anterior `configuracoes-2026-10-28.json`. Nenhum teste anterior foi repetido, nenhum evento real foi gerado, nenhuma permissão do navegador foi solicitada.

## REQ-105

`apps/web/src/pages/WorkspaceSettings.tsx:377–391` apresenta cinco controles. `apps/web/src/context/PreferencesContext.tsx:193–259` restaura/salva preferências por conta e aplica cinco classes ao documento. `apps/web/src/pages/operations.css:293–314` oculta visualmente nomes, fotos, prévias, bolhas e mídias em seletores específicos. A prova anterior de `access.test.ts:200–230` cobre isolamento de preferências entre espaços, mas não a aparência de cada painel.

Lacuna concreta: o seletor de nomes em `operations.css:293–295` cobre lista de conversas, cabeçalho do chat e tabela de contatos, mas o nome também aparece em `apps/web/src/pages/OperationsPages.tsx:887` e no campo editável em `apps/web/src/components/ContactWorkspace.tsx:101`, fora desses seletores. Assim, a opção “Ocultar nomes dos contatos” não comprova cobertura de todas as telas. O nome em `aria-label` de `ChatPane.tsx:379` também não é ocultado por CSS. Isso exige definição do escopo de privacidade esperado e percurso visual antes de ampliar seletores.

## REQ-106

`apps/web/src/pages/WorkspaceSettings.tsx:447–472` apresenta a opção, solicita permissão do navegador e informa que a aba deve ficar aberta. `apps/web/src/hooks/useWorkspace.ts:83–97` cria a notificação somente se a preferência estiver ativa, a aba estiver oculta, `Notification.permission` for `granted` e o evento `whatsapp:sync` tiver `kind === 'messages'`. O estado da opção segue o mecanismo de preferências por conta em `PreferencesContext.tsx:193–312`.

Lacuna concreta: o evento `messages` também é emitido após criação, confirmação ou falha de mensagem de saída em `apps/server/src/modules/attendance/messaging.service.ts:170,196,206`, e após atualizações de status em `apps/server/src/modules/whatsapp/sync.service.ts:388–414`. O payload usado na interface contém apenas `kind`; não distingue mensagem recebida de saída nem confirmação de entrega. A notificação pode, portanto, aparecer sem mensagem nova de cliente. Não há prova de permissão/entrega em navegador real. Definir quais eventos devem notificar é decisão de comportamento; não foi alterado o fluxo.

Ambos seguem parciais. Próximo passo: obter critério de cobertura visual para REQ-105 e regra de notificação para REQ-106; depois fazer verificação visual autorizada. Não usar acesso automatizado à página autenticada antes negado.
