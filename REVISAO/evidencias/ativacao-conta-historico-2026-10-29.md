# REQ-695/696/697 — alcance dos testes de ativação, 29/10/2026

Reclassificação documental, sem repetir testes nem criar chave/conta real. O livro já citava API aprovada com contas Firebase simuladas, apesar do estado “NÃO TESTADO”.

- REQ-695: `apps/web/src/auth/AuthGate.tsx:229–239` oferece cadastro com e-mail/senha; `:63–101` obtém token e consulta `/api/access/me`. `apps/server/test/access.test.ts:69–81` simulou tokens de contas diferentes, criou chaves fictícias e ativou duas operações distintas. `access.test.ts:203–239` confirmou isolamento de dados entre elas. Isso não prova cadastro externo no Firebase nem recebimento do e-mail.
- REQ-696: `apps/web/src/auth/AuthGate.tsx:171–191` mostra `ActivationPanel` à conta verificada sem acesso; `apps/web/src/auth/ActivationPanel.tsx:5–53` envia a chave a `/access/activate`. `apps/server/src/modules/access/access.routes.ts:46–50` chama `AccessService.activate`; `access.service.ts:163–230` valida chave, conta, uso único e cria o espaço. `access.test.ts:69–81,167–181,194–201` já testou ativação, reserva por e-mail e concorrência com dados fictícios.
- REQ-697: o fluxo de ativação acima não contém uma etapa de aprovação manual por Gmail/equipe; `access.service.ts:163–230` concede vínculo à conta verificada que apresenta chave válida. A API fictícia comprova ativação sem intervenção manual adicional. Falta observar o percurso completo com uma segunda conta real, e-mail verificado e operação inicialmente vazia.

Os três requisitos ficam **PARCIAIS**, com a prova anterior reconhecida. Não são concluídos sem o percurso externo e a persistência/recarregamento em conta de teste. Não houve envio de e-mail, ativação real ou alteração da plataforma nesta etapa.
