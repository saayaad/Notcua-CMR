# REQ-110/111 — setores e equipe, 29/10/2026

## Prova nova

O teste específico `apps/server/test/access.test.ts:268–320` foi executado sozinho com `tsx --import ./test/setup-env.mjs --test --test-name-pattern 'REQ-110/111' ./test/access.test.ts`: **1 aprovado, 0 falhas, 0 pulados**. `tsc --noEmit -p apps/server/tsconfig.json` também passou. Não foi repetida a suíte já aprovada.

- REQ-110: um administrador gravou um setor fictício via `PUT /api/operations/settings/departments`; `GET` e `/api/operations/directory` devolveram o setor. Outro espaço de trabalho não o recebeu. Um atendente obteve 403 ao tentar alterar. Após abrir outra conexão Prisma para o mesmo SQLite descartável, o registro ainda existia. Ligação: `apps/web/src/pages/WorkspaceSettings.tsx:574–603` → `apps/server/src/modules/operations/operations.routes.ts:205–241` → `apps/server/src/modules/operations/team-directory.ts:47–50`.
- REQ-111: um administrador gravou um membro fictício com papel e setor via `PUT /api/operations/team`; a listagem trouxe o membro. O atendente obteve 403 na listagem e na alteração. Uma segunda conexão Prisma confirmou o registro no espaço e o vínculo no registro central. Ligação: `apps/web/src/components/TeamManager.tsx:41–65` → `apps/server/src/modules/operations/operations.routes.ts:243–270` → `apps/server/src/http/auth.ts:78–103`.

## Limite

REQ-110 continua parcial até percorrer criação, atribuição e remoção de setor na interface, com recarregamento. REQ-111 continua parcial: não há fluxo de envio de convite privado por e-mail identificado; cadastro de endereço para permitir acesso não prova entrega de convite. O teste usou contas `.invalid` e bancos temporários, sem e-mail, WhatsApp ou conta real. Implementar convite depende de escolha do fluxo e serviço de envio, sujeita à aprovação do proprietário.
