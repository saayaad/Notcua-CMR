# REQ-103/107/109 — menu e negócio, 29/10/2026

Escopo: leitura da evidência `configuracoes-2026-10-28.json`, leitura de código e um único teste novo para a lacuna de persistência/permissão de REQ-109. Nenhum teste antigo foi repetido, nenhum dado real foi alterado.

## Menu — REQ-103 e REQ-107

`apps/web/src/components/OrderingSettings.tsx:31–88` apresenta a ordem dos grupos, a ordem dos botões dentro de cada grupo e as caixas de visibilidade. `apps/web/src/components/ReorderList.tsx:17–64` implementa o arrasto e os botões de subir/descer. `apps/web/src/App.tsx:389–427` aplica `menuGroupOrder`, `menuOrder` e `hiddenViews`; Atendimento, Conexões e Configurações continuam visíveis mesmo se constarem na lista oculta. `apps/web/src/context/PreferencesContext.tsx:193–214,231–312` persiste preferências por conta. O isolamento de preferências em banco descartável já constava em `apps/server/test/access.test.ts:200–230`; não foi repetido.

Ambos seguem **parciais**: ainda faltam arrastar/reordenar/ocultar na interface e conferir o resultado depois de recarregar. A inspeção da ligação não equivale a essa prova visual. O acesso automatizado à página autenticada foi negado anteriormente, portanto não foi tentado de novo.

## Negócio — REQ-109

`apps/web/src/pages/WorkspaceSettings.tsx:507–571` oferece empresa, dias úteis, abertura/fechamento, rodízio e encerramento automático. `apps/server/src/modules/operations/operations.routes.ts:205–241` exige administrador para gravar `settings:business`. O teste **novo** `apps/server/test/access.test.ts:346–393`, executado isoladamente, comprovou `PUT`/`GET`, persistência após abrir outra conexão SQLite, isolamento entre espaços e 403 para atendente: **1 aprovado, 0 falhas**. `tsc --noEmit -p apps/server/tsconfig.json` passou. A primeira tentativa isolada recebeu 402 porque o fixture não havia criado o atendente; o teste foi tornado independente e só ele foi repetido. A regra de encerramento automático já tinha prova em `apps/server/test/operations.test.ts:441–456`; não foi repetida.

REQ-109 segue **parcial**. O campo `schedule` é salvo e exibido, mas uma busca em `apps/server/src` encontrou leitura de `settings:business` apenas em `apps/server/src/modules/operations/business.worker.ts:34–35`, onde são usados `autoCloseMinutes` e `distribution`; o horário não é aplicado ali. Falta definir qual operação o horário deve restringir e comprovar o comportamento e a interface. Essa decisão de regra de negócio precisa da aprovação do proprietário antes de implementação.

## Assinatura — REQ-108, somente leitura conforme REQ-661

`apps/web/src/pages/WorkspaceSettings.tsx:422–430` controla a assinatura. `apps/web/src/components/Composer.tsx:163–196` adiciona a assinatura ao texto no instante de chamar `POST /send`; notas internas seguem outro caminho (`Composer.tsx:177–190`). O campo de rascunho em `Composer.tsx:512–528` mostra apenas `draft.text`, e o aviso em `Composer.tsx:623–626` não mostra a versão com assinatura. Logo, um rascunho visual não comprova o texto final que seria enviado. REQ-108 permanece parcial. Por REQ-661, não houve teste funcional, mudança de lógica de Mensagens ou envio real; a prova deste item é somente de código e ligação.
